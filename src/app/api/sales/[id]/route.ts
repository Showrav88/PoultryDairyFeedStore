import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { collectFarmerPayment } from "@/lib/farmers/payments";

const updateSchema = z
  .object({
    paidAmount: z.number().min(0).optional(),
    additionalAmount: z.number().positive().optional(),
  })
  .refine((d) => d.paidAmount !== undefined || d.additionalAmount !== undefined, {
    message: "Provide paidAmount or additionalAmount",
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.sale.findFirst({
      where: { id, shopId: session.shopId },
      include: { farmer: true },
    });
    if (!existing) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    if (!existing.farmerId || !existing.farmer) {
      return NextResponse.json({ error: "This sale is not linked to a farmer" }, { status: 400 });
    }

    const oldPaid = Number(existing.paidAmount);
    let additional = data.additionalAmount;
    if (additional === undefined && data.paidAmount !== undefined) {
      additional = data.paidAmount - oldPaid;
    }
    if (!additional || additional <= 0) {
      return NextResponse.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const paymentResult = await collectFarmerPayment(tx, {
        shopId: session.shopId,
        farmerId: existing.farmerId!,
        farmerName: existing.farmer!.name,
        amount: additional!,
        note: `Sale #${id.slice(-6)} payment`,
        targetSaleId: id,
      });

      const sale = await tx.sale.findUnique({
        where: { id },
        include: { items: { include: { product: true } } },
      });

      return { sale, paymentResult };
    });

    await logAudit(
      session.shopId,
      "SALE",
      id,
      "UPDATE",
      `Sale payment collected: ৳${additional}`,
      existing,
      result.sale
    );

    return NextResponse.json({ sale: result.sale, payment: result.paymentResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
