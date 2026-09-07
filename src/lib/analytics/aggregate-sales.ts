import type { Product, Sale, SaleItem } from "@/generated/prisma/client";

export type SaleWithItems = Sale & {
  items: (SaleItem & { product: Product })[];
};

export interface SalesSummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalPaid: number;
  totalDue: number;
  saleCount: number;
}

export interface ProductBreakdownRow {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
  profit: number;
  saleCount: number;
  weightUnit: string;
  basePackageSize: number;
}

export interface DailySaleRow {
  id: string;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  itemCount: number;
}

export interface SalesByDayRow {
  date: string;
  revenue: number;
  profit: number;
  saleCount: number;
}

export function parseDateParam(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function resolveAnalyticsRange(params: {
  period: string;
  from: string | null;
  to: string | null;
}): { startDate: Date; endDate: Date; mode: "preset" | "range"; period?: string } {
  const fromDate = parseDateParam(params.from);
  const toDate = parseDateParam(params.to);

  if (fromDate && toDate) {
    if (fromDate > toDate) {
      return { startDate: toDate, endDate: endOfDay(fromDate), mode: "range" };
    }
    return { startDate: fromDate, endDate: endOfDay(toDate), mode: "range" };
  }

  const now = new Date();
  let startDate: Date;
  let endDate = endOfDay(now);

  switch (params.period) {
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate, mode: "preset", period: params.period || "day" };
}

export function summarizeSales(sales: SaleWithItems[]): SalesSummary {
  return {
    totalRevenue: sales.reduce((s, sale) => s + Number(sale.totalAmount), 0),
    totalCost: sales.reduce((s, sale) => s + Number(sale.totalCost), 0),
    totalProfit: sales.reduce((s, sale) => s + Number(sale.totalProfit), 0),
    totalPaid: sales.reduce((s, sale) => s + Number(sale.paidAmount), 0),
    totalDue: sales.reduce((s, sale) => s + Number(sale.dueAmount), 0),
    saleCount: sales.length,
  };
}

export function buildProductBreakdown(sales: SaleWithItems[]): ProductBreakdownRow[] {
  const productSales = new Map<string, ProductBreakdownRow>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const key = item.productId;
      const existing = productSales.get(key);
      if (!existing) {
        productSales.set(key, {
          productId: key,
          name: item.product.name,
          qty: 0,
          revenue: 0,
          profit: 0,
          saleCount: 0,
          weightUnit: item.product.weightUnit,
          basePackageSize: item.product.basePackageSize,
        });
      }
      const row = productSales.get(key)!;
      row.qty += item.quantityInSmallestUnit;
      row.revenue += Number(item.lineTotal);
      row.profit += Number(item.profit);
      row.saleCount += 1;
    }
  }

  return [...productSales.values()].sort((a, b) => b.revenue - a.revenue);
}

export function buildDailySalesList(sales: SaleWithItems[]): DailySaleRow[] {
  return [...sales]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((sale) => ({
      id: sale.id,
      createdAt: sale.createdAt.toISOString(),
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      totalAmount: Number(sale.totalAmount),
      paidAmount: Number(sale.paidAmount),
      dueAmount: Number(sale.dueAmount),
      status: sale.status,
      itemCount: sale.items.length,
    }));
}

export function buildSalesByDay(sales: SaleWithItems[]): SalesByDayRow[] {
  const byDay = new Map<string, SalesByDayRow>();

  for (const sale of sales) {
    const date = sale.createdAt.toISOString().slice(0, 10);
    const existing = byDay.get(date);
    if (!existing) {
      byDay.set(date, {
        date,
        revenue: 0,
        profit: 0,
        saleCount: 0,
      });
    }
    const row = byDay.get(date)!;
    row.revenue += Number(sale.totalAmount);
    row.profit += Number(sale.totalProfit);
    row.saleCount += 1;
  }

  return [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
