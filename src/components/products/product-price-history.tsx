"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { ProductPriceHistoryRow } from "@/lib/pricing/product-price-history";

interface ProductPriceHistoryPanelProps {
  productId: string;
  currentSell: number;
  currentCost: number | null;
  currentTp: number | null;
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) return null;
  const up = delta > 0;
  return (
    <span
      className={`ml-1 text-[10px] font-semibold ${
        up ? "text-emerald-600" : "text-red-600"
      }`}
    >
      {up ? "▲" : "▼"} {formatCurrency(Math.abs(delta))}
    </span>
  );
}

function PriceCell({
  value,
  delta,
}: {
  value: number | null;
  delta: number | null;
}) {
  if (value == null || value <= 0) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <span>
      {formatCurrency(value)}
      <DeltaBadge delta={delta} />
    </span>
  );
}

export function ProductPriceHistoryPanel({
  productId,
  currentSell,
  currentCost,
  currentTp,
}: ProductPriceHistoryPanelProps) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ProductPriceHistoryRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/products/${productId}/price-history`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .finally(() => setLoading(false));
  }, [open, productId]);

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left text-xs font-medium text-amber-800 dark:text-amber-300"
      >
        <span className="inline-flex items-center gap-1.5">
          <TrendingUp size={14} />
          {t.products.priceHistory}
        </span>
        <span>{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-amber-200/80 bg-amber-50/80 p-2 dark:border-amber-900/50 dark:bg-amber-950/20">
            <div>
              <p className="text-[10px] uppercase text-amber-900/70 dark:text-amber-200/70">
                {t.products.referencePrice}
              </p>
              <p className="text-xs font-bold text-amber-950 dark:text-amber-100">
                {currentSell > 0 ? formatCurrency(currentSell) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-amber-900/70 dark:text-amber-200/70">
                {t.products.defaultCostPrice}
              </p>
              <p className="text-xs font-bold text-amber-950 dark:text-amber-100">
                {currentCost && currentCost > 0 ? formatCurrency(currentCost) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-amber-900/70 dark:text-amber-200/70">
                {t.products.defaultTpPrice}
              </p>
              <p className="text-xs font-bold text-amber-950 dark:text-amber-100">
                {currentTp && currentTp > 0 ? formatCurrency(currentTp) : "—"}
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-xs text-gray-500">{t.common.loading}</p>
          ) : (
            <div className="max-h-44 overflow-y-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                  <tr className="text-left text-gray-500">
                    <th className="px-2 py-1.5">{t.common.date}</th>
                    <th className="px-2 py-1.5">{t.products.sellShort}</th>
                    <th className="px-2 py-1.5">{t.products.costShort}</th>
                    <th className="px-2 py-1.5">{t.products.tpShort}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--border)]">
                      <td className="whitespace-nowrap px-2 py-1.5 text-gray-500">
                        {formatDateTime(row.createdAt, locale).split(",")[0]}
                      </td>
                      <td className="px-2 py-1.5 font-medium">
                        <PriceCell value={row.sellPrice} delta={row.sellDelta} />
                      </td>
                      <td className="px-2 py-1.5">
                        <PriceCell value={row.defaultCostPrice} delta={row.costDelta} />
                      </td>
                      <td className="px-2 py-1.5">
                        <PriceCell value={row.defaultTpPrice} delta={row.tpDelta} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-500">{t.common.noData}</p>
              )}
            </div>
          )}
          <p className="text-[10px] text-gray-500">{t.products.priceHistoryHelp}</p>
        </div>
      )}
    </div>
  );
}
