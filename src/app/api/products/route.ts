import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateProductId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getInventorySummary } from "@/lib/inventory/khucra";
import { formatStockDisplay } from "@/lib/inventory/sell-units";

async function getAvgCostPerSmallestUnit(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, number>();

  const items = await prisma.purchaseItem.findMany({
    where: { productId: { in: productIds } },
    select: {
      productId: true,
      quantity: true,
      costPriceTotal: true,
      product: { select: { basePackageSize: true } },
    },
  });

  const totals = new Map<string, { cost: number; units: number }>();
  for (const item of items) {
    const units = item.quantity * item.product.basePackageSize;
    if (units <= 0) continue;
    const cur = totals.get(item.productId) ?? { cost: 0, units: 0 };
    cur.cost += Number(item.costPriceTotal);
    cur.units += units;
    totals.set(item.productId, cur);
  }

  const result = new Map<string, number>();
  for (const [id, { cost, units }] of totals) {
    if (units > 0) result.set(id, cost / units);
  }
  return result;
}

function enrichProduct(
  p: {
    id: string;
    stockInSmallestUnit: number;
    closedPackages: number;
    openPackageRemaining: number;
    basePackageSize: number;
    sellPrice: unknown;
    weightUnit: string;
    [key: string]: unknown;
  },
  avgCostPerUnit: number | undefined
) {
  const inventory = getInventorySummary({
    stockInSmallestUnit: p.stockInSmallestUnit,
    closedPackages: p.closedPackages,
    openPackageRemaining: p.openPackageRemaining,
    basePackageSize: p.basePackageSize,
  });
  return {
    ...p,
    sellPrice: Number(p.sellPrice),
    inventory: {
      ...inventory,
      formattedTotal: formatStockDisplay(
        p.stockInSmallestUnit,
        p.weightUnit,
        p.basePackageSize
      ),
      avgCostPerSmallestUnit: avgCostPerUnit ?? null,
      formattedAvgCostPerKg:
        avgCostPerUnit && (p.weightUnit === "BAG" || p.weightUnit === "GRAM" || p.weightUnit === "KG")
          ? `৳${((avgCostPerUnit * 1000).toFixed(2))}/kg`
          : null,
    },
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { shopId: session.shopId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const avgCosts = await getAvgCostPerSmallestUnit(products.map((p) => p.id));
  const enriched = products.map((p) => enrichProduct(p, avgCosts.get(p.id)));

  return NextResponse.json({ products: enriched });
}

const createSchema = z.object({
  name: z.string().min(1),
  imageUrl: z.string().optional(),
  weightUnit: z.enum(["GENERIC", "GRAM", "KG", "LITER", "ML", "BAG", "PIECE"]),
  basePackageSize: z.number().int().positive(),
  sellPrice: z.number().min(0),
  allowedSellUnits: z.array(z.number().int().positive()).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const shop = await prisma.shop.update({
      where: { id: session.shopId },
      data: { productIdCounter: { increment: 1 } },
    });

    const productId = generateProductId(data.name, shop.productIdCounter);

    const product = await prisma.product.create({
      data: {
        shopId: session.shopId,
        productId,
        name: data.name,
        imageUrl: data.imageUrl,
        weightUnit: data.weightUnit,
        basePackageSize: data.basePackageSize,
        sellPrice: data.sellPrice,
        allowedSellUnits: data.allowedSellUnits ?? [100, 250, 500, 1000],
      },
    });

    await logAudit(session.shopId, "PRODUCT", product.id, "CREATE", `Product "${data.name}" created (${productId})`, null, product);

    return NextResponse.json({ product });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
