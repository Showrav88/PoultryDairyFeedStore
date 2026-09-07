import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

export interface CustomerBalanceSummary {
  totalDue: number;
  oldestDueAt: Date | null;
}

export async function getCustomerBalanceSummaries(
  shopId: string,
  customerIds: string[]
): Promise<Map<string, CustomerBalanceSummary>> {
  const map = new Map<string, CustomerBalanceSummary>();
  if (customerIds.length === 0) return map;

  for (const id of customerIds) {
    map.set(id, { totalDue: 0, oldestDueAt: null });
  }

  const unpaidSales = await prisma.sale.findMany({
    where: {
      shopId,
      customerId: { in: customerIds },
      dueAmount: { gt: 0 },
    },
    select: { customerId: true, dueAmount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  for (const sale of unpaidSales) {
    if (!sale.customerId) continue;
    const cur = map.get(sale.customerId);
    if (!cur) continue;
    cur.totalDue += Number(sale.dueAmount);
    if (!cur.oldestDueAt || sale.createdAt < cur.oldestDueAt) {
      cur.oldestDueAt = sale.createdAt;
    }
  }

  return map;
}

export async function getCustomerBalance(
  shopId: string,
  customerId: string
): Promise<CustomerBalanceSummary> {
  const summaries = await getCustomerBalanceSummaries(shopId, [customerId]);
  return summaries.get(customerId) ?? { totalDue: 0, oldestDueAt: null };
}

export async function getCustomerTotalDueInTx(
  tx: TxClient,
  shopId: string,
  customerId: string
): Promise<number> {
  const unpaid = await tx.sale.aggregate({
    where: { shopId, customerId, dueAmount: { gt: 0 } },
    _sum: { dueAmount: true },
  });
  return Number(unpaid._sum.dueAmount ?? 0);
}
