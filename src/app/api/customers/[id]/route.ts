import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCustomerBalance } from "@/lib/customers/balance";
import { getCustomerTier, getTierProgress } from "@/lib/customers/tier";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, shopId: session.shopId },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const balance = await getCustomerBalance(session.shopId, id);
  const lifetimeSpend = Number(customer.lifetimeSpend);
  const tier = getCustomerTier(lifetimeSpend);
  const progress = getTierProgress(lifetimeSpend);

  const sales = await prisma.sale.findMany({
    where: { shopId: session.shopId, customerId: id },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    customer: {
      ...customer,
      lifetimeSpend,
      totalDue: balance.totalDue,
      oldestDueAt: balance.oldestDueAt?.toISOString() ?? null,
      tier: tier.tier,
      tierLabel: tier.label,
      nextTier: progress.next?.tier ?? null,
      nextTierLabel: progress.next?.label ?? null,
      amountToNextTier: progress.amountToNext,
    },
    sales: sales.map((s) => ({
      ...s,
      totalAmount: Number(s.totalAmount),
      paidAmount: Number(s.paidAmount),
      dueAmount: Number(s.dueAmount),
    })),
  });
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const existing = await prisma.customer.findFirst({
      where: { id, shopId: session.shopId },
    });
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const body = await request.json();
    const data = updateSchema.parse(body);

    if (data.phone && data.phone !== existing.phone) {
      const dup = await prisma.customer.findUnique({
        where: { shopId_phone: { shopId: session.shopId, phone: data.phone } },
      });
      if (dup) {
        return NextResponse.json(
          { error: "Another customer already uses this phone number" },
          { status: 400 }
        );
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data,
    });

    await logAudit(
      session.shopId,
      "CUSTOMER",
      id,
      "UPDATE",
      `Customer "${customer.name}" updated`,
      existing,
      customer
    );

    return NextResponse.json({ customer });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.customer.findFirst({
    where: { id, shopId: session.shopId },
  });
  if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const balance = await getCustomerBalance(session.shopId, id);
  if (balance.totalDue > 0) {
    return NextResponse.json(
      { error: "Cannot delete customer until all due balance is cleared" },
      { status: 400 }
    );
  }

  await prisma.customer.delete({ where: { id } });
  await logAudit(
    session.shopId,
    "CUSTOMER",
    id,
    "DELETE",
    `Customer "${existing.name}" deleted`,
    existing,
    null
  );

  return NextResponse.json({ success: true });
}
