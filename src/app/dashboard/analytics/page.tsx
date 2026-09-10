"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { formatSellUnitLabel } from "@/lib/inventory/sell-units";
import { AnimatedCount, AnimatedCurrency } from "@/components/ui/animated-number";
import { Skeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface ProductRow {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
  profit: number;
  saleCount: number;
  weightUnit: string;
  basePackageSize: number;
}

interface DailySaleRow {
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

interface SalesByDayRow {
  date: string;
  revenue: number;
  profit: number;
  saleCount: number;
}

interface YearComparison {
  currentYear: number;
  previousYear: number;
  current: { totalRevenue: number; totalProfit: number; saleCount: number };
  previous: { totalRevenue: number; totalProfit: number; saleCount: number };
  revenueDelta: number;
  revenueDeltaPercent: number;
  productComparison: {
    name: string;
    currentRevenue: number;
    previousRevenue: number;
    currentQty: number;
    previousQty: number;
    delta: number;
    deltaPercent: number;
  }[];
}

interface AnalyticsData {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalPaid: number;
  totalDue: number;
  saleCount: number;
  topProducts: ProductRow[];
  topProfitProducts: ProductRow[];
  lowProducts: ProductRow[];
  productBreakdown: ProductRow[];
  dailySales: DailySaleRow[];
  salesByDay: SalesByDayRow[];
  yearComparison: YearComparison | null;
  inventoryValue: number;
  from?: string;
  to?: string;
}

const emptyData: AnalyticsData = {
  totalRevenue: 0,
  totalCost: 0,
  totalProfit: 0,
  totalPaid: 0,
  totalDue: 0,
  saleCount: 0,
  topProducts: [],
  topProfitProducts: [],
  lowProducts: [],
  productBreakdown: [],
  dailySales: [],
  salesByDay: [],
  yearComparison: null,
  inventoryValue: 0,
};

function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function firstOfMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function AnalyticsPage() {
  const { t, locale } = useI18n();
  const [view, setView] = useState<"day" | "month" | "year" | "range">("day");
  const [compareYoy, setCompareYoy] = useState(false);
  const [fromDate, setFromDate] = useState(firstOfMonthKey());
  const [toDate, setToDate] = useState(todayKey());
  const [data, setData] = useState<AnalyticsData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (view === "range") {
        params.set("from", fromDate);
        params.set("to", toDate);
      } else {
        params.set("period", view);
      }
      if (compareYoy && view === "year") {
        params.set("compare", "yoy");
      }
      const res = await fetch(`/api/analytics?${params.toString()}`);
      const json = await res.json();
      setData({ ...emptyData, ...json });
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [view, fromDate, toDate, compareYoy]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const periods = [
    { key: "day" as const, label: t.analytics.dailySales },
    { key: "month" as const, label: t.analytics.monthlySales },
    { key: "year" as const, label: t.analytics.yearlySales },
    { key: "range" as const, label: t.analytics.dateRange },
  ];

  const showDailyLedger = view === "day" || view === "range";
  const showSalesByDay = view === "month" || view === "year" || view === "range";

  const rangeLabel = useMemo(() => {
    if (data.from && data.to) {
      const from = formatDateTime(data.from, locale).split(",")[0];
      const to = formatDateTime(data.to, locale).split(",")[0];
      return from === to ? from : `${from} – ${to}`;
    }
    return "";
  }, [data.from, data.to, locale]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{t.analytics.title}</h1>
      {rangeLabel ? <p className="text-sm text-gray-500 mb-6">{rangeLabel}</p> : <div className="mb-6" />}

      <div className="flex flex-wrap gap-2 mb-4">
        {periods.map((p) => (
          <Button
            key={p.key}
            variant={view === p.key ? "default" : "outline"}
            size="sm"
            onClick={() => setView(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {view === "range" && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div>
            <label className="text-xs text-gray-500 block mb-1">{t.analytics.fromDate}</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">{t.analytics.toDate}</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <Button size="sm" onClick={loadAnalytics} disabled={loading}>
            {t.analytics.applyRange}
          </Button>
        </div>
      )}

      {view === "year" && (
        <div className="mb-4">
          <Button
            variant={compareYoy ? "default" : "outline"}
            size="sm"
            onClick={() => setCompareYoy((v) => !v)}
          >
            {t.analytics.yearOverYear}
          </Button>
        </div>
      )}

      {initialLoad ? (
        <StatCardSkeleton count={6} className="mb-8 lg:grid-cols-3" />
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { label: t.analytics.revenue, value: data.totalRevenue, currency: true },
            { label: t.analytics.costOfGoods, value: data.totalCost, currency: true },
            {
              label: t.analytics.grossProfit,
              value: data.totalProfit,
              currency: true,
              highlight: true,
            },
            { label: t.common.paid, value: data.totalPaid, currency: true },
            { label: t.common.due, value: data.totalDue, currency: true },
            { label: t.analytics.saleCount, value: data.saleCount, currency: false },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <p className="text-sm text-gray-500">{card.label}</p>
              <div
                className={`mt-1 ${
                  card.highlight ? (data.totalProfit >= 0 ? "text-emerald-600" : "text-red-600") : ""
                }`}
              >
                {loading ? (
                  <Skeleton className="mt-1 h-8 w-32" />
                ) : card.currency ? (
                  <AnimatedCurrency value={card.value as number} className="text-2xl font-bold" />
                ) : (
                  <AnimatedCount value={card.value as number} className="text-2xl font-bold" />
                )}
              </div>
            </div>
          ))}
      </div>
      )}

      {data.yearComparison && (
        <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="font-bold mb-4">
            {t.analytics.yearOverYear}: {data.yearComparison.currentYear} vs {data.yearComparison.previousYear}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-xs text-gray-500">{data.yearComparison.currentYear}</p>
              <p className="text-lg font-bold text-emerald-600">
                {formatCurrency(data.yearComparison.current.totalRevenue)}
              </p>
              <p className="text-xs text-gray-500">
                {data.yearComparison.current.saleCount} {t.analytics.sales}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{data.yearComparison.previousYear}</p>
              <p className="text-lg font-bold">{formatCurrency(data.yearComparison.previous.totalRevenue)}</p>
              <p className="text-xs text-gray-500">
                {data.yearComparison.previous.saleCount} {t.analytics.sales}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t.analytics.change}</p>
              <p
                className={`text-lg font-bold ${
                  data.yearComparison.revenueDelta >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {formatCurrency(data.yearComparison.revenueDelta)} (
                {data.yearComparison.revenueDeltaPercent.toFixed(1)}%)
              </p>
            </div>
          </div>
          {data.yearComparison.productComparison.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-gray-500">
                    <th className="py-2 pr-4">{t.analytics.product}</th>
                    <th className="py-2 pr-4">{data.yearComparison.currentYear}</th>
                    <th className="py-2 pr-4">{data.yearComparison.previousYear}</th>
                    <th className="py-2">{t.analytics.change}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.yearComparison.productComparison.slice(0, 10).map((row) => (
                    <tr key={row.name} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 pr-4 font-medium">{row.name}</td>
                      <td className="py-2 pr-4">{formatCurrency(row.currentRevenue)}</td>
                      <td className="py-2 pr-4">{formatCurrency(row.previousRevenue)}</td>
                      <td
                        className={`py-2 ${row.delta >= 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {formatCurrency(row.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 mb-8">
        <h2 className="font-bold mb-4">{t.analytics.allProducts}</h2>
        {data.productBreakdown.length === 0 ? (
          <p className="text-gray-500 text-sm">{t.common.noData}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-gray-500">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">{t.analytics.product}</th>
                  <th className="py-2 pr-4">{t.analytics.quantitySold}</th>
                  <th className="py-2 pr-4">{t.analytics.revenue}</th>
                  <th className="py-2 pr-4">{t.analytics.grossProfit}</th>
                  <th className="py-2">{t.analytics.saleCount}</th>
                </tr>
              </thead>
              <tbody>
                {data.productBreakdown.map((p, i) => (
                  <tr key={p.productId} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                    <td className="py-2 pr-4 font-medium">{p.name}</td>
                    <td className="py-2 pr-4">
                      {formatSellUnitLabel(p.qty, p.weightUnit, p.basePackageSize)}
                    </td>
                    <td className="py-2 pr-4 text-emerald-600 font-medium">{formatCurrency(p.revenue)}</td>
                    <td
                      className={`py-2 pr-4 font-medium ${p.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {formatCurrency(p.profit)}
                    </td>
                    <td className="py-2">{p.saleCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDailyLedger && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 mb-8">
          <h2 className="font-bold mb-4">{t.analytics.dailySalesLedger}</h2>
          {data.dailySales.length === 0 ? (
            <p className="text-gray-500 text-sm">{t.common.noData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-gray-500">
                    <th className="py-2 pr-4">{t.analytics.dateTime}</th>
                    <th className="py-2 pr-4">{t.analytics.customer}</th>
                    <th className="py-2 pr-4">{t.analytics.revenue}</th>
                    <th className="py-2 pr-4">{t.common.paid}</th>
                    <th className="py-2 pr-4">{t.common.due}</th>
                    <th className="py-2">{t.analytics.items}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailySales.map((sale) => (
                    <tr key={sale.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {formatDateTime(sale.createdAt, locale)}
                      </td>
                      <td className="py-2 pr-4">
                        {sale.customerName || sale.customerPhone || t.analytics.walkIn}
                      </td>
                      <td className="py-2 pr-4 font-medium">{formatCurrency(sale.totalAmount)}</td>
                      <td className="py-2 pr-4">{formatCurrency(sale.paidAmount)}</td>
                      <td className="py-2 pr-4">{formatCurrency(sale.dueAmount)}</td>
                      <td className="py-2">{sale.itemCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showSalesByDay && data.salesByDay.length > 1 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 mb-8">
          <h2 className="font-bold mb-4">{t.analytics.salesByDay}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-gray-500">
                  <th className="py-2 pr-4">{t.analytics.date}</th>
                  <th className="py-2 pr-4">{t.analytics.revenue}</th>
                  <th className="py-2 pr-4">{t.analytics.grossProfit}</th>
                  <th className="py-2">{t.analytics.saleCount}</th>
                </tr>
              </thead>
              <tbody>
                {data.salesByDay.map((row) => (
                  <tr key={row.date} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-4 font-medium">
                      {formatDateTime(`${row.date}T12:00:00`, locale).split(",")[0]}
                    </td>
                    <td className="py-2 pr-4 text-emerald-600">{formatCurrency(row.revenue)}</td>
                    <td className="py-2 pr-4">{formatCurrency(row.profit)}</td>
                    <td className="py-2">{row.saleCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="font-bold mb-4">{t.analytics.topProducts}</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-gray-500 text-sm">{t.common.noData}</p>
          ) : (
            <div className="space-y-3">
              {data.topProducts.map((p, i) => (
                <div key={p.productId} className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full w-6 h-6 flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium truncate">{p.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-emerald-600 font-medium">{formatCurrency(p.revenue)}</p>
                    <p className="text-xs text-gray-500">
                      {t.analytics.grossProfit} {formatCurrency(p.profit)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="font-bold mb-4">{t.analytics.topProfitProducts}</h2>
          {data.topProfitProducts.length === 0 ? (
            <p className="text-gray-500 text-sm">{t.common.noData}</p>
          ) : (
            <div className="space-y-3">
              {data.topProfitProducts.map((p) => (
                <div key={p.productId} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span
                    className={`text-sm font-medium ${p.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {formatCurrency(p.profit)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="font-bold mb-2">{t.analytics.inventoryValue}</h2>
        <p className="text-3xl font-bold text-emerald-600">{formatCurrency(data.inventoryValue)}</p>
        <p className="mt-1 text-sm text-gray-500">{t.analytics.inventoryHint}</p>
      </div>
    </div>
  );
}
