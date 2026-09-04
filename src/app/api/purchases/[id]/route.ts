import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const updatePaymentSchema = z.object({
  paidAmount: z.number().min(0),
});

function calcPaymentStatus(total: number, paid: number) {
  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "DUE";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updatePaymentSchema.parse(body);

    const existing = await prisma.purchase.findFirst({
      where: { id, shopId: session.shopId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    const totalCost = Number(existing.totalCost);
    if (data.paidAmount > totalCost) {
      return NextResponse.json(
        { error: "Paid amount cannot exceed total cost" },
        { status: 400 }
      );
    }

    const oldPaid = Number(existing.paidAmount);
    const paymentDelta = data.paidAmount - oldPaid;

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.update({
        where: { id },
        data: {
          paidAmount: data.paidAmount,
          dueAmount: Math.max(0, totalCost - data.paidAmount),
          status: calcPaymentStatus(totalCost, data.paidAmount),
        },
        include: { items: { include: { product: true } }, buyer: true },
      });

      if (paymentDelta !== 0) {
        const wallet = await tx.wallet.findUnique({ where: { shopId: session.shopId } });
        if (wallet) {
          if (paymentDelta > 0 && Number(wallet.balance) < paymentDelta) {
            throw new Error("Insufficient wallet balance for additional payment");
          }

          await tx.wallet.update({
            where: { shopId: session.shopId },
            data: { balance: { decrement: paymentDelta } },
          });

          await tx.walletTransaction.create({
            data: {
              shopId: session.shopId,
              type: paymentDelta > 0 ? "PURCHASE_EXPENSE" : "ADJUSTMENT",
              amount: Math.abs(paymentDelta),
              note:
                paymentDelta > 0
                  ? `Purchase payment #${purchase.id.slice(-6)}`
                  : `Purchase payment refund #${purchase.id.slice(-6)}`,
              referenceId: purchase.id,
            },
          });
        }
      }

      return purchase;
    });

    await logAudit(
      session.shopId,
      "PURCHASE",
      id,
      "UPDATE",
      `Purchase payment updated: paid ৳${data.paidAmount} (${result.status})`,
      existing,
      result
    );

    return NextResponse.json({ purchase: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
