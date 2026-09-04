import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { formatSellUnitLabel } from "@/lib/inventory/sell-units";

const returnSchema = z.object({
  farmIssueId: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantityInSmallestUnit: z.number().int().positive(),
        unitCount: z.number().int().positive().default(1),
      })
    )
    .min(1),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const farm = await prisma.farm.findFirst({ where: { id, shopId: session.shopId } });
  if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 404 });

  const returns = await prisma.farmReturn.findMany({
    where: { farmId: id, shopId: session.shopId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: { include: { product: true } } },
  });

  return NextResponse.json({ returns });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: farmId } = await params;

  try {
    const data = returnSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const farm = await tx.farm.findFirst({
        where: { id: farmId, shopId: session.shopId, isActive: true },
      });
      if (!farm) throw new Error("Farm not found");

      const products = await tx.product.findMany({
        where: {
          id: { in: data.items.map((i) => i.productId) },
          shopId: session.shopId,
          isActive: true,
        },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      const lineItems = data.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);

        const totalQty = item.quantityInSmallestUnit * item.unitCount;
        const costPerUnit = Number(product.avgCostPerSmallestUnit);
        const costTotal = totalQty * costPerUnit;

        return {
          productId: item.productId,
          quantityInSmallestUnit: totalQty,
          sellUnitLabel: formatSellUnitLabel(
            item.quantityInSmallestUnit,
            product.weightUnit,
            product.basePackageSize
          ),
          unitCount: item.unitCount,
          costPerSmallestUnit: costPerUnit,
          costTotal,
        };
      });

      const totalCost = lineItems.reduce((s, i) => s + i.costTotal, 0);

      const farmReturn = await tx.farmReturn.create({
        data: {
          shopId: session.shopId,
          farmId,
          farmIssueId: data.farmIssueId,
          status: "PENDING",
          totalCost,
          notes: data.notes,
          items: { create: lineItems },
        },
        include: { items: { include: { product: true } } },
      });

      return { farmReturn, farm };
    });

    await logAudit(
      session.shopId,
      "FARM",
      farmId,
      "CREATE",
      `Return request for "${result.farm.name}" pending approval: ৳${Number(result.farmReturn.totalCost)}`,
      null,
      result.farmReturn
    );

    return NextResponse.json({ farmReturn: result.farmReturn });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Return request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
