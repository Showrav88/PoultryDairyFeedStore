"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { ANIMAL_TYPE_LABELS } from "@/lib/farms/wallet";
import {
  formatIssueLineQuantity,
  type FarmIssueRow,
} from "@/lib/farms/issue-display";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

interface FarmIssueHistoryListProps {
  issues: FarmIssueRow[];
  showFarm?: boolean;
}

export function FarmIssueHistoryList({ issues, showFarm = false }: FarmIssueHistoryListProps) {
  const { t, locale } = useI18n();

  const animalLabel = (type: string) => {
    const labels = ANIMAL_TYPE_LABELS[type];
    return labels ? (locale === "bn" ? labels.bn : labels.en) : type;
  };

  if (issues.length === 0) {
    return <p className="py-8 text-center text-gray-500">{t.farms.noIssueHistory}</p>;
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => (
        <div
          key={issue.id}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] pb-2">
            <div>
              {showFarm && issue.farm && (
                <Link
                  href={`/dashboard/farms/${issue.farm.id}`}
                  className="font-semibold text-emerald-600 hover:underline"
                >
                  {issue.farm.name}
                </Link>
              )}
              {showFarm && issue.farm?.animalType && (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                  {animalLabel(issue.farm.animalType)}
                </span>
              )}
              <p className={cn("text-sm text-gray-500", showFarm && "mt-1")}>
                {formatDateTime(issue.createdAt)} · {t.farms.issueRef} #{issue.id.slice(-6)}
              </p>
            </div>
            <p className="font-semibold">{formatCurrency(Number(issue.totalCost))}</p>
          </div>

          <ul className="mt-3 space-y-2">
            {issue.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  <span className="font-medium">{item.product.name}</span>
                  <span className="text-gray-500"> — {formatIssueLineQuantity(item)}</span>
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  {formatCurrency(Number(item.costTotal))}
                </span>
              </li>
            ))}
          </ul>

          {issue.notes && (
            <p className="mt-2 text-xs text-gray-500">
              {t.common.notes}: {issue.notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
