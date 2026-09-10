import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  toProductPrices,
  withPriceDeltas,
} from "@/lib/pricing/product-price-history";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, shopId: session.shopId, isActive: true },
  });

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await prisma.productPriceHistory.findMany({
    where: { productId: id, shopId: session.shopId },
    orderBy: { createdAt: "asc" },
  });

  const current = toProductPrices(product);
  const history =
    rows.length > 0
      ? withPriceDeltas(rows)
      : withPriceDeltas([
          {
            id: "current",
            sellPrice: current.sellPrice,
            defaultCostPrice: current.defaultCostPrice,
            defaultTpPrice: current.defaultTpPrice,
            createdAt: product.updatedAt,
          },
        ]);

  return NextResponse.json({
    current,
    history: [...history].reverse(),
  });
}
