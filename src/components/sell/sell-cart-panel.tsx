"use client";

import { ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, NumberInput } from "@/components/ui/input";
import {
  WholesaleBuyerSearch,
  hasTrackedIdentity,
  type TrackedBuyer,
} from "@/components/sell/wholesale-buyer-search";
import { useI18n } from "@/lib/i18n/context";
import { cn, formatCurrency } from "@/lib/utils";
import type { CartLine } from "@/lib/inventory/cart-stock";

export interface CartItem extends CartLine {
  productName: string;
  sellUnitLabel: string;
  pricePerUnit: number;
}

interface SellCartPanelProps {
  id?: string;
  className?: string;
  cart: CartItem[];
  onRemove: (index: number) => void;
  paidAmount: number;
  onPaidChange: (v: number) => void;
  trackedBuyer: TrackedBuyer | null;
  onBuyerSelect: (buyer: TrackedBuyer | null) => void;
  manualName: string;
  manualPhone: string;
  onManualNameChange: (v: string) => void;
  onManualPhoneChange: (v: string) => void;
  onComplete: () => void;
  loading: boolean;
  fullBagInCart: boolean;
}

export function SellCartPanel({
  id,
  className,
  cart,
  onRemove,
  paidAmount,
  onPaidChange,
  trackedBuyer,
  onBuyerSelect,
  manualName,
  manualPhone,
  onManualNameChange,
  onManualPhoneChange,
  onComplete,
  loading,
  fullBagInCart,
}: SellCartPanelProps) {
  const { t } = useI18n();
  const cartTotal = cart.reduce((s, i) => s + i.pricePerUnit * i.unitCount, 0);
  const dueAmount = Math.max(0, cartTotal - paidAmount);
  const dueRequired = dueAmount > 0.001;
  const overpaid = cartTotal > 0 && paidAmount > cartTotal;
  const tracked = hasTrackedIdentity(trackedBuyer, manualName, manualPhone);
  const previousDue = trackedBuyer?.totalDue ?? 0;
  const totalOwedAfter = previousDue + dueAmount;

  const identityOk = !dueRequired && !fullBagInCart
    ? true
    : tracked;

  const handlePaidChange = (value: number) => {
    if (cartTotal > 0 && value > cartTotal) {
      onPaidChange(cartTotal);
      return;
    }
    onPaidChange(value);
  };

  return (
    <div
      id={id}
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4",
        className
      )}
    >
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

      {cart.length > 0 && (
        <div className="mb-3">
          <WholesaleBuyerSearch
            selected={trackedBuyer}
            onSelect={onBuyerSelect}
            manualName={manualName}
            manualPhone={manualPhone}
            onManualNameChange={onManualNameChange}
            onManualPhoneChange={onManualPhoneChange}
            dueRequired={dueRequired}
            fullBagInCart={fullBagInCart && !tracked}
          />
        </div>
      )}

      {trackedBuyer && previousDue > 0 && (
        <p className="mb-2 text-sm text-orange-600">
          {t.sell.previousDue}: {formatCurrency(previousDue)}
        </p>
      )}

      <div className="mb-3">
        <Label>{t.common.paid}</Label>
        <NumberInput
          className="mt-1"
          placeholder={t.common.enterAmount}
          value={paidAmount}
          onChange={handlePaidChange}
        />
        {trackedBuyer && cartTotal > 0 && (
          <p className="mt-1 text-xs text-gray-500">{t.farmers.sellPaidThisSaleOnly}</p>
        )}
        {overpaid && (
          <p className="mt-1 text-sm text-red-500">{t.sell.paidExceedsTotal}</p>
        )}
        {!tracked && dueRequired && (
          <p className="mt-1 text-xs text-orange-600">{t.sell.noDueWithoutBuyer}</p>
        )}
      </div>

      {cartTotal > 0 && (
        <div className="mb-3 space-y-1 text-sm">
          <div className="flex justify-between font-bold">
            <span>{t.sell.thisBill}</span>
            <span className="text-emerald-600">{formatCurrency(cartTotal)}</span>
          </div>
          {dueRequired && (
            <div className="flex justify-between text-orange-600">
              <span>{t.sell.dueThisSale}</span>
              <span>{formatCurrency(dueAmount)}</span>
            </div>
          )}
          {trackedBuyer && previousDue > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>{t.sell.totalOwedAfter}</span>
              <span>{formatCurrency(totalOwedAfter)}</span>
            </div>
          )}
        </div>
      )}

      <Button
        className="min-h-12 w-full"
        onClick={onComplete}
        disabled={
          cart.length === 0 ||
          loading ||
          overpaid ||
          !identityOk
        }
      >
        {t.sell.completeSale}
      </Button>
    </div>
  );
}
