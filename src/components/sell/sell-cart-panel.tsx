"use client";

import { ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, NumberInput } from "@/components/ui/input";
import { CustomerSearch, type SelectedCustomer } from "@/components/sell/customer-search";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency } from "@/lib/utils";
import type { CartLine } from "@/lib/inventory/cart-stock";

export interface CartItem extends CartLine {
  productName: string;
  sellUnitLabel: string;
  pricePerUnit: number;
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
  farmerMode?: boolean;
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
  farmerMode,
}: SellCartPanelProps) {
  const { t } = useI18n();
  const cartTotal = cart.reduce((s, i) => s + i.pricePerUnit * i.unitCount, 0);
  const dueAmount = Math.max(0, cartTotal - paidAmount);
  const dueRequired = dueAmount > 0.001;
  const overpaid = !farmerMode && cartTotal > 0 && paidAmount > cartTotal;

  const identityOk =
    !dueRequired ||
    selectedCustomer ||
    (manualName.trim().length > 0 && manualPhone.trim().length >= 10);

  const handlePaidChange = (value: number) => {
    if (!farmerMode && cartTotal > 0 && value > cartTotal) {
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

      {!farmerMode && cart.length > 0 && (
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
        </p>
      )}

      <Button
        className="min-h-12 w-full"
        onClick={onComplete}
        disabled={
          cart.length === 0 ||
          loading ||
          overpaid ||
          (dueRequired && !identityOk)
        }
      >
        {t.sell.completeSale}
      </Button>
    </div>
  );
}
