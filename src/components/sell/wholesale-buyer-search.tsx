"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { cn, formatCurrency } from "@/lib/utils";

export interface TrackedBuyer {
  type: "FARMER" | "CUSTOMER";
  id: string;
  name: string;
  phone: string;
  totalDue: number;
  lifetimeSpend: number;
  tier: string;
  tierLabel: string;
}

interface WholesaleBuyerSearchProps {
  selected: TrackedBuyer | null;
  onSelect: (buyer: TrackedBuyer | null) => void;
  manualName: string;
  manualPhone: string;
  onManualNameChange: (v: string) => void;
  onManualPhoneChange: (v: string) => void;
  dueRequired: boolean;
  fullBagInCart?: boolean;
}

function tierColor(tier: string) {
  switch (tier) {
    case "platinum":
      return "text-purple-700 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300";
    case "gold":
      return "text-yellow-800 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-200";
    case "silver":
      return "text-slate-700 bg-slate-200 dark:bg-slate-700 dark:text-slate-200";
    default:
      return "text-orange-800 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-200";
  }
}

export function WholesaleBuyerSearch({
  selected,
  onSelect,
  manualName,
  manualPhone,
  onManualNameChange,
  onManualPhoneChange,
  dueRequired,
  fullBagInCart,
}: WholesaleBuyerSearchProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackedBuyer[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/sell/buyers?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.buyers ?? []));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (selected) {
    const profileHref =
      selected.type === "FARMER"
        ? `/dashboard/farmers/${selected.id}`
        : `/dashboard/customers/${selected.id}`;

    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-emerald-800 dark:text-emerald-200">{selected.name}</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">{selected.phone}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-white">
                {selected.type === "FARMER" ? t.sell.buyerFarmer : t.sell.buyerCustomer}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 font-medium", tierColor(selected.tier))}>
                {selected.tierLabel}
              </span>
              {selected.totalDue > 0 && (
                <span className="font-medium text-orange-600">
                  {t.sell.previousDue}: {formatCurrency(selected.totalDue)}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">{t.sell.collectOldDueHint}</p>
            <Link href={profileHref} className="mt-1 inline-block text-xs text-emerald-700 underline dark:text-emerald-400">
              {t.sell.collectOldDueLink}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-gray-500 hover:text-red-500"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={wrapRef} className="relative">
        <Label>{t.sell.searchWholesaleBuyer}</Label>
        <div className="relative mt-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-9"
            placeholder={t.customers.searchByNameOrPhone}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>
        {open && results.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
            {results.map((b) => (
              <button
                key={`${b.type}-${b.id}`}
                type="button"
                className="w-full border-b border-[var(--border)] px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                onClick={() => {
                  onSelect(b);
                  onManualNameChange(b.name);
                  onManualPhoneChange(b.phone);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-gray-500">
                  {b.type === "FARMER" ? t.sell.buyerFarmer : t.sell.buyerCustomer} · {b.phone}
                  {b.totalDue > 0 && ` · ${t.common.due}: ${formatCurrency(b.totalDue)}`}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Label>
            {t.sell.customerName}
            {dueRequired || fullBagInCart ? "" : ` (${t.common.optional})`}
          </Label>
          <Input
            value={manualName}
            onChange={(e) => onManualNameChange(e.target.value)}
            placeholder={
              dueRequired || fullBagInCart
                ? t.customers.nameRequiredForDue
                : t.sell.khucraWalkInOptional
            }
          />
        </div>
        <div>
          <Label>
            {t.sell.customerPhone}
            {dueRequired || fullBagInCart ? "" : ` (${t.common.optional})`}
          </Label>
          <Input
            value={manualPhone}
            onChange={(e) => onManualPhoneChange(e.target.value)}
            placeholder={
              dueRequired || fullBagInCart
                ? t.customers.phoneRequiredForDue
                : t.common.optional
            }
          />
        </div>
      </div>
      {dueRequired && (
        <p className="text-xs text-orange-600">{t.customers.dueRequiresIdentity}</p>
      )}
      {fullBagInCart && !dueRequired && (
        <p className="text-xs text-orange-600">{t.sell.fullBagRequiresBuyer}</p>
      )}
    </div>
  );
}

export function hasTrackedIdentity(
  selected: TrackedBuyer | null,
  manualName: string,
  manualPhone: string
): boolean {
  if (selected) return true;
  return manualName.trim().length > 0 && manualPhone.trim().replace(/\D/g, "").length >= 10;
}
