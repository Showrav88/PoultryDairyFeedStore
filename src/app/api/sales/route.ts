import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { deductStock, sellUnitLabel } from "@/lib/inventory/khugra";

const saleSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  paidAmount: z.number().min(0),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantityInSmallestUnit: z.number().int().positive(),
      pricePerUnit: z.number().min(0),
      unitCount: z.number().int().positive().default(1),
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
    const data = saleSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          id: { in: data.items.map((i) => i.productId) },
          shopId: session.shopId,
          isActive: true,
        },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));
      const inventoryUpdates: { id: string; state: ReturnType<typeof deductStock> }[] = [];

      for (const item of data.items) {
        const product = productMap.get(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);

        const deductResult = deductStock(
          {
            stockInSmallestUnit: product.stockInSmallestUnit,
            closedPackages: product.closedPackages,
            openPackageRemaining: product.openPackageRemaining,
            basePackageSize: product.basePackageSize,
          },
          item.quantityInSmallestUnit * item.unitCount
        );

        if (!deductResult.success) {
          throw new Error(`${product.name}: ${deductResult.error}`);
        }

        inventoryUpdates.push({ id: product.id, state: deductResult });
      }

      const lineItems = data.items.map((item) => {
        const product = productMap.get(item.productId)!;
        const totalQty = item.quantityInSmallestUnit * item.unitCount;
        const lineTotal = item.pricePerUnit * item.unitCount;
        return {
          productId: item.productId,
          quantityInSmallestUnit: totalQty,
          sellUnitLabel: sellUnitLabel(item.quantityInSmallestUnit, product.basePackageSize),
          pricePerUnit: item.pricePerUnit,
          lineTotal,
          unitCount: item.unitCount,
        };
      });

      const totalAmount = lineItems.reduce((s, i) => s + i.lineTotal, 0);
      const dueAmount = Math.max(0, totalAmount - data.paidAmount);
      const status = calcPaymentStatus(totalAmount, data.paidAmount);

      const sale = await tx.sale.create({
        data: {
          shopId: session.shopId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          totalAmount,
          paidAmount: data.paidAmount,
          dueAmount,
          status,
          notes: data.notes,
          items: { create: lineItems },
        },
        include: { items: { include: { product: true } } },
      });

      for (const update of inventoryUpdates) {
        await tx.product.update({
          where: { id: update.id },
          data: update.state.newState,
        });
      }

      if (data.paidAmount > 0) {
        const wallet = await tx.wallet.findUnique({ where: { shopId: session.shopId } });
        if (wallet) {
          await tx.wallet.update({
            where: { shopId: session.shopId },
            data: { balance: { increment: data.paidAmount } },
          });
          await tx.walletTransaction.create({
            data: {
              shopId: session.shopId,
              type: "SALE_INCOME",
              amount: data.paidAmount,
              note: `Sale #${sale.id.slice(-6)}`,
              referenceId: sale.id,
            },
          });
        }
      }

      return sale;
    });

    await logAudit(
      session.shopId,
      "SALE",
      result.id,
      "CREATE",
      `Sale completed: ৳${Number(result.totalAmount)} (${result.status})`,
      null,
      result
    );

    return NextResponse.json({ sale: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sale failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const date = searchParams.get("date");

  const where: Record<string, unknown> = { shopId: session.shopId };

  if (q) {
    where.OR = [
      { customerName: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q } },
    ];
  }

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { gte: start, lte: end };
  }

  const sales = await prisma.sale.findMany({
    where,
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ sales });
}
