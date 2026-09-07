"use client";

import Link from "next/link";
import { ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, NumberInput } from "@/components/ui/input";
import { CustomerSearch, type SelectedCustomer } from "@/components/sell/customer-search";
import { useI18n } from "@/lib/i18n/context";
import { cn, formatCurrency } from "@/lib/utils";
import type { CartLine } from "@/lib/inventory/cart-stock";

export interface CartItem extends CartLine {
  productName: string;
  sellUnitLabel: string;
  pricePerUnit: number;
}

export interface FarmerSellInfo {
  id: string;
  name: string;
  totalDue: number;
  lifetimeSpend: number;
  tier: string;
  tierLabel: string;
}

interface SellCartPanelProps {
  cart: CartItem[];
  onRemove: (index: number) => void;
  paidAmount: number;
  onPaidChange: (v: number) => void;
  selectedCustomer: SelectedCustomer | null;
  onCustomerSelect: (c: SelectedCustomer | null) => void;
  manualName: string;
  manualPhone: string;
  onManualNameChange: (v: string) => void;
  onManualPhoneChange: (v: string) => void;
  onComplete: () => void;
  loading: boolean;
  farmer?: FarmerSellInfo | null;
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

export function SellCartPanel({
  cart,
  onRemove,
  paidAmount,
  onPaidChange,
  selectedCustomer,
  onCustomerSelect,
  manualName,
  manualPhone,
  onManualNameChange,
  onManualPhoneChange,
  onComplete,
  loading,
  farmer,
}: SellCartPanelProps) {
  const { t } = useI18n();
  const cartTotal = cart.reduce((s, i) => s + i.pricePerUnit * i.unitCount, 0);
  const dueAmount = Math.max(0, cartTotal - paidAmount);
  const dueRequired = dueAmount > 0.001;
  const overpaid = cartTotal > 0 && paidAmount > cartTotal;

  const identityOk =
    farmer ||
    !dueRequired ||
    selectedCustomer ||
    (manualName.trim().length > 0 && manualPhone.trim().length >= 10);

  const handlePaidChange = (value: number) => {
    if (cartTotal > 0 && value > cartTotal) {
      onPaidChange(cartTotal);
      return;
    }
    onPaidChange(value);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 lg:sticky lg:top-4">
      <h3 className="mb-3 flex items-center gap-2 font-bold">
        <ShoppingCart size={18} /> {t.sell.cart}
      </h3>

      {farmer && (
        <div className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="font-semibold text-emerald-800 dark:text-emerald-200">{farmer.name}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={cn("rounded-full px-2 py-0.5 font-medium", tierColor(farmer.tier))}>
              {farmer.tierLabel}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {t.farmers.lifetimeSpend}: {formatCurrency(farmer.lifetimeSpend)}
            </span>
            {farmer.totalDue > 0 && (
              <span className="font-medium text-orange-600">
                {t.farmers.totalDue}: {formatCurrency(farmer.totalDue)}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
            {t.farmers.collectOnFarmersTab}
          </p>
          <Link
            href={`/dashboard/farmers/${farmer.id}`}
            className="mt-1 inline-block text-xs text-emerald-700 underline dark:text-emerald-400"
          >
            {t.farmers.profile} · {t.farmers.collectPayment}
          </Link>
        </div>
      )}

      {cart.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">{t.sell.cartEmptyHint}</p>
      ) : (
        <div className="mb-3 max-h-56 space-y-2 overflow-y-auto">
          {cart.map((item, idx) => (
            <div
              key={`${item.productId}-${item.quantityInSmallestUnit}-${idx}`}
              className="flex justify-between border-b border-[var(--border)] pb-2 text-sm"
            >
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="text-xs text-gray-500">
                  {item.sellUnitLabel} × {item.unitCount}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span>{formatCurrency(item.pricePerUnit * item.unitCount)}</span>
                <button type="button" onClick={() => onRemove(idx)}>
                  <X size={14} className="text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!farmer && cart.length > 0 && (
        <div className="mb-3">
          <CustomerSearch
            selected={selectedCustomer}
            onSelect={onCustomerSelect}
            manualName={manualName}
            manualPhone={manualPhone}
            onManualNameChange={onManualNameChange}
            onManualPhoneChange={onManualPhoneChange}
            dueRequired={dueRequired}
          />
        </div>
      )}

      <div className="mb-3">
        <Label>{t.common.paid}</Label>
        <NumberInput
          className="mt-1"
          placeholder={t.common.enterAmount}
          value={paidAmount}
          onChange={handlePaidChange}
        />
        {farmer && cartTotal > 0 && (
          <p className="mt-1 text-xs text-gray-500">{t.farmers.sellPaidThisSaleOnly}</p>
        )}
        {overpaid && (
          <p className="mt-1 text-sm text-red-500">{t.sell.paidExceedsTotal}</p>
        )}
      </div>

      <div className="mb-3 flex justify-between text-lg font-bold">
        <span>{t.common.total}</span>
        <span className="text-emerald-600">{formatCurrency(cartTotal)}</span>
      </div>

      {dueRequired && (
        <p className="mb-3 text-sm text-orange-500">
          {t.common.due}: {formatCurrency(dueAmount)}
          {farmer ? ` (${t.farmers.dueAddedToFarmer})` : ""}
        </p>
      )}

      <Button
        className="min-h-12 w-full"
        onClick={onComplete}
        disabled={
          cart.length === 0 ||
          loading ||
          overpaid ||
          (!farmer && dueRequired && !identityOk)
        }
      >
        {t.sell.completeSale}
      </Button>
    </div>
  );
}
