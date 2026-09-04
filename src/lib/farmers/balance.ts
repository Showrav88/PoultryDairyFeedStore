import { prisma } from "@/lib/db";
import { getPaymentAlert, type PaymentAlert } from "@/lib/farmers/alerts";

export interface FarmerBalanceSummary {
  totalDue: number;
  oldestDueAt: Date | null;
  alert: PaymentAlert;
  daysOverdue: number;
}

export async function getFarmerBalanceSummaries(
  shopId: string,
  farmerIds: string[]
): Promise<Map<string, FarmerBalanceSummary>> {
  const map = new Map<string, FarmerBalanceSummary>();
  if (farmerIds.length === 0) return map;

  const farmers = await prisma.farmer.findMany({
    where: { shopId, id: { in: farmerIds } },
    select: { id: true, openingDue: true, createdAt: true },
  });

  const unpaidSales = await prisma.sale.findMany({
    where: {
      shopId,
      farmerId: { in: farmerIds },
      dueAmount: { gt: 0 },
    },
    select: { farmerId: true, dueAmount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  for (const f of farmers) {
    map.set(f.id, {
      totalDue: Number(f.openingDue),
      oldestDueAt: Number(f.openingDue) > 0 ? f.createdAt : null,
      alert: "none",
      daysOverdue: 0,
    });
  }

  for (const sale of unpaidSales) {
    if (!sale.farmerId) continue;
    const cur = map.get(sale.farmerId);
    if (!cur) continue;
    cur.totalDue += Number(sale.dueAmount);
    if (!cur.oldestDueAt || sale.createdAt < cur.oldestDueAt) {
      cur.oldestDueAt = sale.createdAt;
    }
  }

  for (const [id, summary] of map) {
    summary.alert = getPaymentAlert(summary.oldestDueAt, summary.totalDue);
    summary.daysOverdue =
      summary.oldestDueAt && summary.totalDue > 0
        ? Math.max(
            0,
            Math.floor((Date.now() - summary.oldestDueAt.getTime()) / 86_400_000)
          )
        : 0;
    map.set(id, summary);
  }

  return map;
}

export async function getFarmerBalance(
  shopId: string,
  farmerId: string
): Promise<FarmerBalanceSummary> {
  const summaries = await getFarmerBalanceSummaries(shopId, [farmerId]);
  return (
    summaries.get(farmerId) ?? {
      totalDue: 0,
      oldestDueAt: null,
      alert: "none",
      daysOverdue: 0,
    }
  );
}
