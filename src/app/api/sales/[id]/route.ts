import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
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
    const data = updateSchema.parse(body);

    const existing = await prisma.sale.findFirst({ where: { id, shopId: session.shopId } });
    if (!existing) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

    const totalAmount = Number(existing.totalAmount);
    if (data.paidAmount > totalAmount) {
      return NextResponse.json({ error: "Paid amount cannot exceed total" }, { status: 400 });
    }

    const oldPaid = Number(existing.paidAmount);
    const paymentDelta = data.paidAmount - oldPaid;
    const newDue = Math.max(0, totalAmount - data.paidAmount);
    const oldDue = Number(existing.dueAmount);

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.update({
        where: { id },
        data: {
          paidAmount: data.paidAmount,
          dueAmount: newDue,
          status: calcPaymentStatus(totalAmount, data.paidAmount),
        },
        include: { items: { include: { product: true } } },
      });

      if (paymentDelta !== 0) {
        const wallet = await tx.wallet.findUnique({ where: { shopId: session.shopId } });
        if (wallet) {
          await tx.wallet.update({
            where: { shopId: session.shopId },
            data: { balance: { increment: paymentDelta } },
          });
          await tx.walletTransaction.create({
            data: {
              shopId: session.shopId,
              type: paymentDelta > 0 ? "SALE_INCOME" : "ADJUSTMENT",
              amount: Math.abs(paymentDelta),
              note: `Sale payment update #${sale.id.slice(-6)}`,
              referenceId: sale.id,
            },
          });
        }
      }

      const dueDelta = newDue - oldDue;
      if (dueDelta !== 0) {
        await tx.walletTransaction.create({
          data: {
            shopId: session.shopId,
            type: "RECEIVABLE",
            amount: Math.abs(dueDelta),
            note:
              dueDelta > 0
                ? `Customer due increased #${sale.id.slice(-6)}`
                : `Customer due collected #${sale.id.slice(-6)}`,
            referenceId: sale.id,
          },
        });
      }

      return sale;
    });

    await logAudit(session.shopId, "SALE", id, "UPDATE", `Sale payment updated`, existing, result);
    return NextResponse.json({ sale: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
