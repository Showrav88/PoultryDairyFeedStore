"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { cn, formatCurrency } from "@/lib/utils";

export interface SelectedCustomer {
  id: string;
  name: string;
  phone: string;
  totalDue: number;
  lifetimeSpend: number;
  tier: string;
  tierLabel: string;
}

interface CustomerSearchProps {
  selected: SelectedCustomer | null;
  onSelect: (customer: SelectedCustomer | null) => void;
  manualName: string;
  manualPhone: string;
  onManualNameChange: (v: string) => void;
  onManualPhoneChange: (v: string) => void;
  dueRequired: boolean;
}

export function CustomerSearch({
  selected,
  onSelect,
  manualName,
  manualPhone,
  onManualNameChange,
  onManualPhoneChange,
  dueRequired,
}: CustomerSearchProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SelectedCustomer[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.customers ?? []));
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

  const tierColor = (tier: string) => {
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
  };

  if (selected) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-emerald-800 dark:text-emerald-200">{selected.name}</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">{selected.phone}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className={cn("rounded-full px-2 py-0.5 font-medium", tierColor(selected.tier))}>
                {selected.tierLabel}
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                {t.customers.lifetimeSpend}: {formatCurrency(selected.lifetimeSpend)}
              </span>
              {selected.totalDue > 0 && (
                <span className="font-medium text-orange-600">
                  {t.customers.totalDue}: {formatCurrency(selected.totalDue)}
                </span>
              )}
            </div>
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
        <Label>{t.customers.searchCustomer}</Label>
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
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full border-b border-[var(--border)] px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                onClick={() => {
                  onSelect(c);
                  onManualNameChange(c.name);
                  onManualPhoneChange(c.phone);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-gray-500">
                  {c.phone} · {c.tierLabel}
                  {c.totalDue > 0 && ` · ${t.common.due}: ${formatCurrency(c.totalDue)}`}
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
            {dueRequired ? "" : ` (${t.common.optional})`}
          </Label>
          <Input
            value={manualName}
            onChange={(e) => onManualNameChange(e.target.value)}
            placeholder={dueRequired ? t.customers.nameRequiredForDue : t.common.optional}
          />
        </div>
        <div>
          <Label>
            {t.sell.customerPhone}
            {dueRequired ? "" : ` (${t.common.optional})`}
          </Label>
          <Input
            value={manualPhone}
            onChange={(e) => onManualPhoneChange(e.target.value)}
            placeholder={dueRequired ? t.customers.phoneRequiredForDue : t.common.optional}
          />
        </div>
      </div>
      {dueRequired && (
        <p className="text-xs text-orange-600">{t.customers.dueRequiresIdentity}</p>
      )}
    </div>
  );
}
