import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { collectCustomerPayment } from "@/lib/customers/payments";

const paymentSchema = z.object({
  amount: z.number().positive(),
  note: z.string().optional(),
  targetSaleId: z.string().optional(),
});

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

  const payments = await prisma.customerPayment.findMany({
    where: { customerId: id, shopId: session.shopId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      allocations: {
        include: { sale: { select: { id: true, totalAmount: true, createdAt: true } } },
      },
    },
  });

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      note: p.note,
      saleId: p.saleId,
      createdAt: p.createdAt.toISOString(),
      allocations: p.allocations.map((a) => ({
        saleId: a.saleId,
        amount: Number(a.amount),
        label: a.saleId ? `Sale #${a.saleId.slice(-6)}` : "Due",
      })),
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: customerId } = await params;

  try {
    const data = paymentSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, shopId: session.shopId, isActive: true },
      });
      if (!customer) throw new Error("Customer not found");

      return collectCustomerPayment(tx, {
        shopId: session.shopId,
        customerId,
        customerName: customer.name,
        amount: data.amount,
        note: data.note,
        targetSaleId: data.targetSaleId,
      });
    });

    try {
      const allocated = result.allocations.reduce((s, a) => s + a.amount, 0);
      await logAudit(
        session.shopId,
        "CUSTOMER",
        customerId,
        "UPDATE",
        `Payment collected: ৳${data.amount} applied to due ৳${allocated}`,
        null,
        result
      );
    } catch (auditErr) {
      console.error("Audit log failed for customer payment:", auditErr);
    }

    return NextResponse.json({ payment: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment failed";
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
