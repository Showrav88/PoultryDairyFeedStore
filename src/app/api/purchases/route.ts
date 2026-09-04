import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { addStock } from "@/lib/inventory/khucra";

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
    })
  ).min(1),
});

function calcPaymentStatus(total: number, paid: number) {
  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "DUE";
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = purchaseSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          id: { in: data.items.map((i) => i.productId) },
          shopId: session.shopId,
        },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const totalCost = data.items.reduce((s, i) => s + i.costPriceTotal, 0);
      const dueAmount = Math.max(0, totalCost - data.paidAmount);
      const status = calcPaymentStatus(totalCost, data.paidAmount);

      const purchase = await tx.purchase.create({
        data: {
          shopId: session.shopId,
          buyerId: data.buyerId,
          totalCost,
          paidAmount: data.paidAmount,
          dueAmount,
          status,
          notes: data.notes,
          items: { create: data.items },
        },
        include: { items: { include: { product: true } }, buyer: true },
      });

      for (const item of data.items) {
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

        await tx.product.update({
          where: { id: item.productId },
          data: stockResult.newState,
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
              note: `Purchase #${purchase.id.slice(-6)}`,
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
      result.id,
      "CREATE",
      `Purchase from ${result.buyer.name}: ৳${Number(result.totalCost)}`,
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

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const purchases = await prisma.purchase.findMany({
    where: { shopId: session.shopId },
    include: { items: { include: { product: true } }, buyer: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ purchases });
}
