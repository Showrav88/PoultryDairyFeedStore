import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  buildDailySalesList,
  buildProductBreakdown,
  buildSalesByDay,
  resolveAnalyticsRange,
  summarizeSales,
  type SaleWithItems,
} from "@/lib/analytics/aggregate-sales";
import { prisma } from "@/lib/db";

async function fetchSalesInRange(shopId: string, startDate: Date, endDate: Date) {
  return prisma.sale.findMany({
    where: {
      shopId,
      createdAt: { gte: startDate, lte: endDate },
    },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  }) as Promise<SaleWithItems[]>;
}

function buildRankedProducts(productBreakdown: ReturnType<typeof buildProductBreakdown>) {
  const profitRanked = [...productBreakdown].sort((a, b) => b.profit - a.profit);
  return {
    topProducts: productBreakdown.slice(0, 5),
    topProfitProducts: profitRanked.slice(0, 5),
    lowProducts: [...productBreakdown].slice(-5).reverse(),
  };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "day";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const compare = searchParams.get("compare");

  const range = resolveAnalyticsRange({ period, from, to });

  const sales = await fetchSalesInRange(session.shopId, range.startDate, range.endDate);
  const summary = summarizeSales(sales);
  const productBreakdown = buildProductBreakdown(sales);
  const ranked = buildRankedProducts(productBreakdown);
  const dailySales = buildDailySalesList(sales);
  const salesByDay = buildSalesByDay(sales);

  const products = await prisma.product.findMany({
    where: { shopId: session.shopId, isActive: true },
  });

  const inventoryValue = products.reduce((s, p) => {
    const avgCost = Number(p.avgCostPerSmallestUnit);
    return s + p.stockInSmallestUnit * avgCost;
  }, 0);

  const logs = await prisma.auditLog.findMany({
    where: { shopId: session.shopId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  let yearComparison: Record<string, unknown> | null = null;
  if (compare === "yoy") {
    const now = new Date();
    const currentYear = now.getFullYear();
    const previousYear = currentYear - 1;

    const currentStart = new Date(currentYear, 0, 1);
    const currentEnd = range.endDate;
    const previousStart = new Date(previousYear, 0, 1);
    const previousEnd = new Date(previousYear, 11, 31, 23, 59, 59, 999);

    const [currentSales, previousSales] = await Promise.all([
      fetchSalesInRange(session.shopId, currentStart, currentEnd),
      fetchSalesInRange(session.shopId, previousStart, previousEnd),
    ]);

    const currentSummary = summarizeSales(currentSales);
    const previousSummary = summarizeSales(previousSales);
    const currentProducts = buildProductBreakdown(currentSales);
    const previousProducts = buildProductBreakdown(previousSales);

    const previousByName = new Map(previousProducts.map((p) => [p.productId, p]));
    const productComparison = currentProducts.map((current) => {
      const previous = previousByName.get(current.productId);
      const previousRevenue = previous?.revenue ?? 0;
      const delta = current.revenue - previousRevenue;
      const deltaPercent =
        previousRevenue > 0 ? (delta / previousRevenue) * 100 : current.revenue > 0 ? 100 : 0;
      return {
        productId: current.productId,
        name: current.name,
        currentRevenue: current.revenue,
        previousRevenue,
        currentQty: current.qty,
        previousQty: previous?.qty ?? 0,
        delta,
        deltaPercent,
      };
    });

    const revenueDelta = currentSummary.totalRevenue - previousSummary.totalRevenue;
    const revenueDeltaPercent =
      previousSummary.totalRevenue > 0
        ? (revenueDelta / previousSummary.totalRevenue) * 100
        : currentSummary.totalRevenue > 0
          ? 100
          : 0;

    yearComparison = {
      currentYear,
      previousYear,
      current: currentSummary,
      previous: previousSummary,
      revenueDelta,
      revenueDeltaPercent,
      productComparison,
    };
  }

  return NextResponse.json({
    ...summary,
    period: range.period ?? period,
    mode: range.mode,
    from: range.startDate.toISOString(),
    to: range.endDate.toISOString(),
    productBreakdown,
    dailySales,
    salesByDay,
    yearComparison,
    ...ranked,
    inventoryValue,
    logs,
  });
}
