import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateProductId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getInventorySummary } from "@/lib/inventory/khucra";
import { formatAvgCostPerKg } from "@/lib/inventory/avg-cost";
import { formatStockDisplay } from "@/lib/inventory/sell-units";

function enrichProduct(p: {
  stockInSmallestUnit: number;
  closedPackages: number;
  openPackageRemaining: number;
  basePackageSize: number;
  sellPrice: unknown;
  avgCostPerSmallestUnit: unknown;
  weightUnit: string;
  [key: string]: unknown;
}) {
  const avgCost = Number(p.avgCostPerSmallestUnit);
  const inventory = getInventorySummary({
    stockInSmallestUnit: p.stockInSmallestUnit,
    closedPackages: p.closedPackages,
    openPackageRemaining: p.openPackageRemaining,
    basePackageSize: p.basePackageSize,
  });
  return {
    ...p,
    sellPrice: Number(p.sellPrice),
    suggestedSellPrice: Number(p.sellPrice),
    inventory: {
      ...inventory,
      formattedTotal: formatStockDisplay(
        p.stockInSmallestUnit,
        p.weightUnit,
        p.basePackageSize
      ),
      avgCostPerSmallestUnit: avgCost > 0 ? avgCost : null,
      formattedAvgCostPerKg:
        avgCost > 0 && (p.weightUnit === "BAG" || p.weightUnit === "GRAM" || p.weightUnit === "KG")
          ? formatAvgCostPerKg(avgCost)
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

  const enriched = products.map((p) => enrichProduct(p));

  return NextResponse.json({ products: enriched });
}

const createSchema = z.object({
  name: z.string().min(1),
  imageUrl: z.string().optional(),
  weightUnit: z.enum(["GENERIC", "GRAM", "KG", "LITER", "ML", "BAG", "PIECE"]),
  basePackageSize: z.number().int().positive(),
  sellPrice: z.number().min(0).optional(),
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
        sellPrice: data.sellPrice ?? 0,
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
