import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getFarmerBalance } from "@/lib/farmers/balance";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const farmer = await prisma.farmer.findFirst({
    where: { id, shopId: session.shopId },
  });
  if (!farmer) return NextResponse.json({ error: "Farmer not found" }, { status: 404 });

  const balance = await getFarmerBalance(session.shopId, id);

  const sales = await prisma.sale.findMany({
    where: { shopId: session.shopId, farmerId: id },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    farmer: {
      ...farmer,
      openingDue: Number(farmer.openingDue),
      totalDue: balance.totalDue,
      alert: balance.alert,
      daysOverdue: balance.daysOverdue,
      oldestDueAt: balance.oldestDueAt?.toISOString() ?? null,
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
  address: z.string().optional(),
  openingDue: z.number().min(0).optional(),
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
    const existing = await prisma.farmer.findFirst({
      where: { id, shopId: session.shopId },
    });
    if (!existing) return NextResponse.json({ error: "Farmer not found" }, { status: 404 });

    const body = await request.json();
    const data = updateSchema.parse(body);

    const farmer = await prisma.farmer.update({
      where: { id },
      data,
    });

    await logAudit(
      session.shopId,
      "FARMER",
      id,
      "UPDATE",
      `Farmer "${farmer.name}" updated`,
      existing,
      farmer
    );

    return NextResponse.json({ farmer });
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

  const existing = await prisma.farmer.findFirst({
    where: { id, shopId: session.shopId },
    include: { sales: { where: { dueAmount: { gt: 0 } }, take: 1 } },
  });
  if (!existing) return NextResponse.json({ error: "Farmer not found" }, { status: 404 });

  if (existing.sales.length > 0 || Number(existing.openingDue) > 0) {
    return NextResponse.json(
      { error: "Cannot delete farmer with outstanding due balance" },
      { status: 400 }
    );
  }

  await prisma.farmer.delete({ where: { id } });
  await logAudit(
    session.shopId,
    "FARMER",
    id,
    "DELETE",
    `Farmer "${existing.name}" deleted`,
    existing,
    null
  );

  return NextResponse.json({ success: true });
}
