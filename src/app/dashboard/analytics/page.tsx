"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency } from "@/lib/utils";

export default function AnalyticsPage() {
  const { t } = useI18n();
  const [period, setPeriod] = useState("day");
  const [data, setData] = useState({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    totalPaid: 0,
    totalDue: 0,
    saleCount: 0,
    topProducts: [] as { name: string; qty: number; revenue: number; profit: number }[],
    topProfitProducts: [] as { name: string; qty: number; revenue: number; profit: number }[],
    lowProducts: [] as { name: string; qty: number; revenue: number; profit: number }[],
    inventoryValue: 0,
  });

  useEffect(() => {
    fetch(`/api/analytics?period=${period}`)
      .then((r) => r.json())
      .then(setData);
  }, [period]);

  const periods = [
    { key: "day", label: t.analytics.dailySales },
    { key: "month", label: t.analytics.monthlySales },
    { key: "year", label: t.analytics.yearlySales },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t.analytics.title}</h1>

      <div className="flex gap-2 mb-6">
        {periods.map((p) => (
          <Button
            key={p.key}
            variant={period === p.key ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Revenue", value: formatCurrency(data.totalRevenue) },
          { label: t.analytics.costOfGoods, value: formatCurrency(data.totalCost) },
          { label: t.analytics.grossProfit, value: formatCurrency(data.totalProfit), highlight: true },
          { label: t.common.paid, value: formatCurrency(data.totalPaid) },
          { label: t.common.due, value: formatCurrency(data.totalDue) },
          { label: "Sales Count", value: data.saleCount.toString() },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.highlight ? (data.totalProfit >= 0 ? "text-emerald-600" : "text-red-600") : ""}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="font-bold mb-4">{t.analytics.topProducts}</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-gray-500 text-sm">{t.common.noData}</p>
          ) : (
            <div className="space-y-3">
              {data.topProducts.map((p, i) => (
                <div key={i} className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full w-6 h-6 flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-sm font-medium truncate">{p.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-emerald-600 font-medium">{formatCurrency(p.revenue)}</p>
                    <p className="text-xs text-gray-500">Profit {formatCurrency(p.profit)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="font-bold mb-4">Top profit products</h2>
          {data.topProfitProducts.length === 0 ? (
            <p className="text-gray-500 text-sm">{t.common.noData}</p>
          ) : (
            <div className="space-y-3">
              {data.topProfitProducts.map((p, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className={`text-sm font-medium ${p.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(p.profit)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="font-bold mb-2">{t.analytics.inventoryValue}</h2>
        <p className="text-3xl font-bold text-emerald-600">{formatCurrency(data.inventoryValue)}</p>
        <p className="mt-1 text-sm text-gray-500">Current stock × average buy cost per unit</p>
      </div>
    </div>
  );
}
