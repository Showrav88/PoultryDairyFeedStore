import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { addStock } from "@/lib/inventory/khucra";
import { computeWeightedAvgCost } from "@/lib/inventory/avg-cost";
import {
  getPurchasePayableTotal,
  resolvePurchasePricingModel,
  validatePurchaseTpLine,
} from "@/lib/pricing/tp-pricing";

const purchaseSchema = z.object({
  buyerId: z.string(),
  paidAmount: z.number().min(0),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      costPricePerUnit: z.number().min(0),
      costPriceTotal: z.number().min(0),
      tpPricePerUnit: z.number().min(0).optional(),
      tpPriceTotal: z.number().min(0).optional(),
    })
  ).min(1),
});

function calcPaymentStatus(total: number, paid: number) {
  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "DUE";
}

function normalizePurchaseItems(
  items: z.infer<typeof purchaseSchema>["items"]
) {
  return items.map((item) => {
    const tpPerUnit = item.tpPricePerUnit ?? 0;
    const tpTotal =
      item.tpPriceTotal ?? (tpPerUnit > 0 ? tpPerUnit * item.quantity : 0);
    return {
      ...item,
      tpPricePerUnit: tpPerUnit > 0 ? tpPerUnit : null,
      tpPriceTotal: tpTotal > 0 ? tpTotal : null,
    };
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = purchaseSchema.parse(body);
    const normalizedItems = normalizePurchaseItems(data.items);

    for (const item of normalizedItems) {
      const tpError = validatePurchaseTpLine(item.costPricePerUnit, item.tpPricePerUnit);
      if (tpError) {
        return NextResponse.json({ error: tpError }, { status: 400 });
      }
    }

    const pricingModel = resolvePurchasePricingModel(normalizedItems);
    const totalCost = normalizedItems.reduce((s, i) => s + i.costPriceTotal, 0);
    const totalTpAmount =
      pricingModel === "DUAL"
        ? normalizedItems.reduce((s, i) => s + (i.tpPriceTotal ?? 0), 0)
        : null;
    const payableTotal = pricingModel === "DUAL" ? totalTpAmount! : totalCost;

    if (data.paidAmount > payableTotal) {
      return NextResponse.json(
        { error: "Paid amount cannot exceed supplier payable total" },
        { status: 400 }
      );
    }

    const dueAmount = Math.max(0, payableTotal - data.paidAmount);
    const status = calcPaymentStatus(payableTotal, data.paidAmount);

    const result = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          id: { in: data.items.map((i) => i.productId) },
          shopId: session.shopId,
        },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const purchase = await tx.purchase.create({
        data: {
          shopId: session.shopId,
          buyerId: data.buyerId,
          totalCost,
          totalTpAmount,
          pricingModel,
          paidAmount: data.paidAmount,
          dueAmount,
          status,
          notes: data.notes,
          items: {
            create: normalizedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              costPricePerUnit: item.costPricePerUnit,
              costPriceTotal: item.costPriceTotal,
              tpPricePerUnit: item.tpPricePerUnit,
              tpPriceTotal: item.tpPriceTotal,
            })),
          },
        },
        include: { items: { include: { product: true } }, buyer: true },
      });

      for (const item of normalizedItems) {
        const product = productMap.get(item.productId);
        if (!product) continue;

        const stockResult = addStock(
          {
            stockInSmallestUnit: product.stockInSmallestUnit,
            closedPackages: product.closedPackages,
            openPackageRemaining: product.openPackageRemaining,
            basePackageSize: product.basePackageSize,
          },
          item.quantity
        );

        const addedUnits = item.quantity * product.basePackageSize;
        const newAvgCost = computeWeightedAvgCost(
          product.stockInSmallestUnit,
          Number(product.avgCostPerSmallestUnit),
          addedUnits,
          item.costPriceTotal
        );

        await tx.product.update({
          where: { id: item.productId },
          data: {
            ...stockResult.newState,
            avgCostPerSmallestUnit: newAvgCost,
          },
        });
      }

      if (data.paidAmount > 0) {
        const wallet = await tx.wallet.findUnique({ where: { shopId: session.shopId } });
        if (wallet) {
          await tx.wallet.update({
            where: { shopId: session.shopId },
            data: { balance: { decrement: data.paidAmount } },
          });
          await tx.walletTransaction.create({
            data: {
              shopId: session.shopId,
              type: "PURCHASE_EXPENSE",
              amount: data.paidAmount,
              note: `Purchase #${purchase.id.slice(-6)}${pricingModel === "DUAL" ? " (TP)" : ""}`,
              referenceId: purchase.id,
            },
          });
        }
      }

      if (dueAmount > 0) {
        await tx.walletTransaction.create({
          data: {
            shopId: session.shopId,
            type: "PAYABLE",
            amount: dueAmount,
            note: `Supplier due - Purchase #${purchase.id.slice(-6)} (${purchase.buyer.name})${pricingModel === "DUAL" ? " [TP]" : ""}`,
            referenceId: purchase.id,
          },
        });
      }

      return purchase;
    });

    const payable = getPurchasePayableTotal(result);
    await logAudit(
      session.shopId,
      "PURCHASE",
      result.id,
      "CREATE",
      `Purchase from ${result.buyer.name}: book ৳${Number(result.totalCost)}, payable ৳${payable} (${result.pricingModel})`,
      null,
      result
    );

    return NextResponse.json({ purchase: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Purchase failed" }, { status: 500 });
  }
}

function enrichPurchase(p: {
  totalCost: unknown;
  totalTpAmount?: unknown | null;
  paidAmount: unknown;
  dueAmount: unknown;
  pricingModel: string;
  items: Array<{
    costPricePerUnit: unknown;
    costPriceTotal: unknown;
    tpPricePerUnit?: unknown | null;
    tpPriceTotal?: unknown | null;
    product: unknown;
  }>;
  [key: string]: unknown;
}) {
  const enriched = {
    ...p,
    totalCost: Number(p.totalCost),
    totalTpAmount: p.totalTpAmount != null ? Number(p.totalTpAmount) : null,
    paidAmount: Number(p.paidAmount),
    dueAmount: Number(p.dueAmount),
    payableTotal: getPurchasePayableTotal({
      pricingModel: p.pricingModel,
      totalCost: p.totalCost,
      totalTpAmount: p.totalTpAmount,
    }),
    items: p.items.map((item) => ({
      ...item,
      costPricePerUnit: Number(item.costPricePerUnit),
      costPriceTotal: Number(item.costPriceTotal),
      tpPricePerUnit: item.tpPricePerUnit != null ? Number(item.tpPricePerUnit) : null,
      tpPriceTotal: item.tpPriceTotal != null ? Number(item.tpPriceTotal) : null,
    })),
  };
  return enriched;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const purchases = await prisma.purchase.findMany({
    where: { shopId: session.shopId },
    include: { items: { include: { product: true } }, buyer: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ purchases: purchases.map(enrichPurchase) });
}
