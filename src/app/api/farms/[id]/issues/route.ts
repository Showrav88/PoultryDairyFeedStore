import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { deductStock } from "@/lib/inventory/khucra";
import { formatSellUnitLabel } from "@/lib/inventory/sell-units";
import { applyFarmWalletTx } from "@/lib/farms/wallet";

const issueSchema = z.object({
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

  const issues = await prisma.farmIssue.findMany({
    where: { farmId: id, shopId: session.shopId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: { include: { product: true } } },
  });

  return NextResponse.json({ issues });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: farmId } = await params;

  try {
    const data = issueSchema.parse(await request.json());

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
      const inventoryUpdates: { id: string; state: ReturnType<typeof deductStock> }[] = [];

      for (const item of data.items) {
        const product = productMap.get(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);

        const totalQty = item.quantityInSmallestUnit * item.unitCount;
        const deductResult = deductStock(
          {
            stockInSmallestUnit: product.stockInSmallestUnit,
            closedPackages: product.closedPackages,
            openPackageRemaining: product.openPackageRemaining,
            basePackageSize: product.basePackageSize,
          },
          totalQty
        );

        if (!deductResult.success) {
          throw new Error(`${product.name}: ${deductResult.error}`);
        }

        inventoryUpdates.push({ id: product.id, state: deductResult });
      }

      const lineItems = data.items.map((item) => {
        const product = productMap.get(item.productId)!;
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

      const issue = await tx.farmIssue.create({
        data: {
          shopId: session.shopId,
          farmId,
          totalCost,
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

      await applyFarmWalletTx(tx, {
        shopId: session.shopId,
        type: "FARM_ISSUE",
        amount: totalCost,
        note: `Feed issued to ${farm.name} — Issue #${issue.id.slice(-6)}`,
        referenceId: issue.id,
        decrement: true,
      });

      return { issue, farm };
    });

    await logAudit(
      session.shopId,
      "FARM",
      farmId,
      "CREATE",
      `Feed issued to "${result.farm.name}": ৳${Number(result.issue.totalCost)}`,
      null,
      result.issue
    );

    return NextResponse.json({ issue: result.issue });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Issue failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
