import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { collectFarmerPayment } from "@/lib/farmers/payments";

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
  const farmer = await prisma.farmer.findFirst({
    where: { id, shopId: session.shopId },
  });
  if (!farmer) return NextResponse.json({ error: "Farmer not found" }, { status: 404 });

  const payments = await prisma.farmerPayment.findMany({
    where: { farmerId: id, shopId: session.shopId },
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
        label: a.saleId ? `Sale #${a.saleId.slice(-6)}` : "Opening due",
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

  const { id: farmerId } = await params;

  try {
    const data = paymentSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const farmer = await tx.farmer.findFirst({
        where: { id: farmerId, shopId: session.shopId, isActive: true },
      });
      if (!farmer) throw new Error("Farmer not found");

      return collectFarmerPayment(tx, {
        shopId: session.shopId,
        farmerId,
        farmerName: farmer.name,
        amount: data.amount,
        note: data.note,
        targetSaleId: data.targetSaleId,
      });
    });

    try {
      await logAudit(
        session.shopId,
        "FARMER",
        farmerId,
        "UPDATE",
        `Payment collected: ৳${data.amount} (${result.allocations.length} allocation(s))`,
        null,
        result
      );
    } catch (auditErr) {
      console.error("Audit log failed for farmer payment:", auditErr);
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
