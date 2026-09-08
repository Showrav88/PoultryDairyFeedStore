import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  buildLegacyTpConversion,
  canApplyLegacyTp,
  getPurchasePayableTotal,
} from "@/lib/pricing/tp-pricing";

const legacyTpItemSchema = z.object({
  itemId: z.string(),
  tpPricePerUnit: z.number().min(0),
});

const updateSchema = z.object({
  paidAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
  legacyTpItems: z.array(legacyTpItemSchema).min(1).optional(),
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

    const existing = await prisma.purchase.findFirst({
      where: { id, shopId: session.shopId },
      include: { items: true, buyer: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    if (data.legacyTpItems) {
      if (!canApplyLegacyTp(existing)) {
        return NextResponse.json(
          { error: "Manual TP applies only to legacy purchases with open supplier due" },
          { status: 400 }
        );
      }

      const itemMap = new Map(existing.items.map((i) => [i.id, i]));
      if (data.legacyTpItems.length !== existing.items.length) {
        return NextResponse.json(
          { error: "Enter TP price for every purchase line" },
          { status: 400 }
        );
      }

      const lines = data.legacyTpItems.map((input) => {
        const item = itemMap.get(input.itemId);
        if (!item) throw new Error("Invalid purchase line");
        return {
          itemId: item.id,
          costPricePerUnit: Number(item.costPricePerUnit),
          quantity: item.quantity,
          tpPricePerUnit: input.tpPricePerUnit,
        };
      });

      const paidAmount = Number(existing.paidAmount);
      const conversion = buildLegacyTpConversion(lines, paidAmount);
      const oldDue = Number(existing.dueAmount);
      const dueDelta = conversion.newDue - oldDue;

      const result = await prisma.$transaction(async (tx) => {
        for (const line of conversion.lineUpdates) {
          await tx.purchaseItem.update({
            where: { id: line.itemId },
            data: {
              tpPricePerUnit: line.tpPricePerUnit,
              tpPriceTotal: line.tpPriceTotal,
            },
          });
        }

        const purchase = await tx.purchase.update({
          where: { id },
          data: {
            pricingModel: "DUAL",
            totalTpAmount: conversion.totalTpAmount,
            dueAmount: conversion.newDue,
            status: conversion.newStatus,
            ...(data.notes !== undefined ? { notes: data.notes } : {}),
          },
          include: { items: { include: { product: true } }, buyer: true },
        });

        if (dueDelta !== 0) {
          await tx.walletTransaction.create({
            data: {
              shopId: session.shopId,
              type: "PAYABLE",
              amount: Math.abs(dueDelta),
              note:
                dueDelta > 0
                  ? `Legacy TP applied — supplier due increased #${purchase.id.slice(-6)} [TP]`
                  : `Legacy TP applied — supplier due reduced #${purchase.id.slice(-6)} [TP]`,
              referenceId: purchase.id,
            },
          });
        }

        return purchase;
      });

      await logAudit(
        session.shopId,
        "PURCHASE",
        id,
        "UPDATE",
        `Legacy TP applied: payable ৳${conversion.totalTpAmount} (was cost-based due)`,
        existing,
        result
      );

      return NextResponse.json({ purchase: result });
    }

    const payableTotal = getPurchasePayableTotal(existing);
    const newPaid = data.paidAmount ?? Number(existing.paidAmount);

    if (newPaid > payableTotal) {
      return NextResponse.json(
        { error: "Paid amount cannot exceed supplier payable total" },
        { status: 400 }
      );
    }

    const oldPaid = Number(existing.paidAmount);
    const paymentDelta = newPaid - oldPaid;
    const newDue = Math.max(0, payableTotal - newPaid);
    const oldDue = Number(existing.dueAmount);

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          dueAmount: newDue,
          status: calcPaymentStatus(payableTotal, newPaid),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
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
              note: `Purchase payment update #${purchase.id.slice(-6)}${existing.pricingModel === "DUAL" ? " (TP)" : ""}`,
              referenceId: purchase.id,
            },
          });
        }
      }

      const dueDelta = newDue - oldDue;
      if (dueDelta !== 0) {
        await tx.walletTransaction.create({
          data: {
            shopId: session.shopId,
            type: "PAYABLE",
            amount: Math.abs(dueDelta),
            note:
              dueDelta > 0
                ? `Supplier due increased #${purchase.id.slice(-6)}${existing.pricingModel === "DUAL" ? " [TP]" : ""}`
                : `Supplier due reduced #${purchase.id.slice(-6)}${existing.pricingModel === "DUAL" ? " [TP]" : ""}`,
            referenceId: purchase.id,
          },
        });
      }

      return purchase;
    });

    await logAudit(session.shopId, "PURCHASE", id, "UPDATE", `Purchase updated`, existing, result);
    return NextResponse.json({ purchase: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
