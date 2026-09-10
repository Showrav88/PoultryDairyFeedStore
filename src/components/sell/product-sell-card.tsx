"use client";

import { useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, NumberInput, Select } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency } from "@/lib/utils";
import {
  buildSellUnitOptions,
  formatSellUnitLabel,
  getCustomUnitOptions,
  getDefaultSellUnitSize,
  getWalkInDefaultSellUnitSize,
  parseCustomSellAmount,
  type CustomSellUnit,
} from "@/lib/inventory/sell-units";
import { calcUnitPriceFromReference } from "@/lib/inventory/unit-price";
import {
  isBelowCost,
  isBelowSuggested,
  lastPriceKey,
  resolveUnitSellPrice,
} from "@/lib/sell/last-price";
import {
  formatStockAmount,
  getAvailableStock,
  getLineStockAmount,
  validateStockForLine,
  type CartLine,
} from "@/lib/inventory/cart-stock";

export interface SellProduct {
  id: string;
  productId: string;
  name: string;
  imageUrl?: string;
  weightUnit: string;
  basePackageSize: number;
  sellPrice: number;
  allowedSellUnits: number[];
  inventory: {
    totalStock: number;
    closedBags: number;
    formattedOpenBag: string | null;
    avgCostPerSmallestUnit: number | null;
  };
}

export type SellUnitMode = "preset" | "custom";

export interface ProductCardState {
  mode: SellUnitMode;
  unitSize: number;
  unitCount: number;
  pricePerUnit: number;
  customAmount: number;
  customUnit: CustomSellUnit;
}

interface ProductSellCardProps {
  product: SellProduct;
  cart: CartLine[];
  state: ProductCardState;
  lastPriceMap?: Map<string, number>;
  onStateChange: (state: ProductCardState) => void;
  onAddToCart: () => void;
  stockError: string;
  onStockError: (msg: string) => void;
}

export function resolveSellUnitSize(state: ProductCardState): number {
  if (state.mode === "custom") {
    return parseCustomSellAmount(state.customAmount, state.customUnit);
  }
  return state.unitSize;
}

function unitPriceFor(
  product: SellProduct,
  unitSize: number,
  lastPriceMap?: Map<string, number>
) {
  return resolveUnitSellPrice({
    referenceSellPrice: product.sellPrice,
    unitSize,
    basePackageSize: product.basePackageSize,
    lastPricePerUnit: lastPriceMap?.get(lastPriceKey(product.id, unitSize)),
  });
}

export function getDefaultProductState(
  product: SellProduct,
  lastPriceMap?: Map<string, number>,
  preferWalkInDefault = false
): ProductCardState {
  const unitSize = preferWalkInDefault
    ? getWalkInDefaultSellUnitSize(product)
    : getDefaultSellUnitSize(product);
  const customOptions = getCustomUnitOptions(product.weightUnit);
  const { pricePerUnit } = unitPriceFor(product, unitSize, lastPriceMap);
  return {
    mode: "preset",
    unitSize,
    unitCount: 1,
    pricePerUnit,
    customAmount: 1,
    customUnit: customOptions[0]?.value ?? "KG",
  };
}

export function applyLastPricesToState(
  product: SellProduct,
  state: ProductCardState,
  lastPriceMap?: Map<string, number>
): ProductCardState {
  const unitSize = resolveSellUnitSize(state);
  const { pricePerUnit } = unitPriceFor(product, unitSize, lastPriceMap);
  return { ...state, pricePerUnit };
}

export function getSellUnitOptions(product: SellProduct): number[] {
  return buildSellUnitOptions(product);
}

export function ProductSellCard({
  product,
  cart,
  state,
  lastPriceMap,
  onStateChange,
  onAddToCart,
  stockError,
  onStockError,
}: ProductSellCardProps) {
  const { t } = useI18n();
  const unitOptions = useMemo(() => getSellUnitOptions(product), [product]);
  const customUnitOptions = useMemo(
    () => getCustomUnitOptions(product.weightUnit),
    [product.weightUnit]
  );

  const effectiveUnitSize = resolveSellUnitSize(state);
  const pricing = unitPriceFor(product, effectiveUnitSize, lastPriceMap);
  const lastForUnit = lastPriceMap?.get(lastPriceKey(product.id, effectiveUnitSize));
  const showBelowSuggested = isBelowSuggested(state.pricePerUnit, pricing.suggestedPricePerUnit);
  const showBelowCost = isBelowCost(
    state.pricePerUnit,
    product.inventory.avgCostPerSmallestUnit,
    effectiveUnitSize
  );
  const available = getAvailableStock(product.inventory.totalStock, cart, product.id);
  const lineStock = getLineStockAmount(effectiveUnitSize, state.unitCount);
  const maxUnitCount =
    effectiveUnitSize > 0 ? Math.max(1, Math.floor(available / effectiveUnitSize)) : 1;

  const selectUnit = (unitSize: number) => {
    const { pricePerUnit } = unitPriceFor(product, unitSize, lastPriceMap);
    onStateChange({
      ...state,
      mode: "preset",
      unitSize,
      unitCount: 1,
      pricePerUnit,
    });
    onStockError("");
  };

  const selectCustomMode = () => {
    const unitSize =
      effectiveUnitSize > 0
        ? effectiveUnitSize
        : parseCustomSellAmount(state.customAmount, state.customUnit);
    const { pricePerUnit } = unitPriceFor(
      product,
      unitSize > 0 ? unitSize : product.basePackageSize,
      lastPriceMap
    );
    onStateChange({
      ...state,
      mode: "custom",
      unitCount: 1,
      pricePerUnit,
    });
    onStockError("");
  };

  const updateCustom = (customAmount: number, customUnit: CustomSellUnit) => {
    const unitSize = parseCustomSellAmount(customAmount, customUnit);
    const { pricePerUnit } =
      unitSize > 0 ? unitPriceFor(product, unitSize, lastPriceMap) : { pricePerUnit: 0 };
    onStateChange({
      ...state,
      mode: "custom",
      customAmount,
      customUnit,
      unitCount: 1,
      pricePerUnit,
    });
    onStockError("");
  };

  const lineTotal = state.pricePerUnit * state.unitCount;

  const handleAdd = () => {
    if (state.pricePerUnit <= 0) {
      onStockError(t.sell.enterSellPrice);
      return;
    }
    if (effectiveUnitSize <= 0) {
      onStockError(t.sell.enterSellPrice);
      return;
    }
    const check = validateStockForLine(
      product.inventory.totalStock,
      cart,
      product.id,
      effectiveUnitSize,
      state.unitCount
    );
    if (!check.ok) {
      onStockError(check.message);
      return;
    }
    onAddToCart();
    onStockError("");
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 sm:p-4">
      <div className="mb-2 flex gap-2 sm:mb-3 sm:gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 sm:h-16 sm:w-16">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl">📦</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{product.name}</h3>
          <p className="truncate text-xs text-gray-500">{product.productId}</p>
          <p className="mt-0.5 text-[11px] font-medium text-emerald-600 sm:mt-1 sm:text-xs">
            {t.sell.availableStock}: {formatStockAmount(available, product.weightUnit)}
          </p>
          {product.inventory.formattedOpenBag && (
            <p className="hidden text-xs text-gray-500 sm:block">
              {t.sell.openBagTitle}: {product.inventory.formattedOpenBag}
            </p>
          )}
          {product.inventory.closedBags > 0 && (
            <p className="hidden text-xs text-gray-500 sm:block">
              {t.sell.sealedBags}: {product.inventory.closedBags}
            </p>
          )}
          {product.sellPrice > 0 && (
            <p className="text-[11px] text-gray-500 sm:text-xs">
              {t.sell.suggestedOnly}: {formatCurrency(pricing.suggestedPricePerUnit)}
            </p>
          )}
          {lastForUnit != null && lastForUnit > 0 && (
            <p className="text-[11px] text-emerald-700 sm:text-xs">
              {t.sell.lastPriceForBuyer}: {formatCurrency(lastForUnit)}
            </p>
          )}
        </div>
      </div>

      <Label className="mb-1 block text-[11px] sm:text-xs">{t.sell.selectUnit}</Label>
      <div className="mb-2 flex flex-wrap gap-1 sm:mb-3 sm:gap-1.5">
        {unitOptions.map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => selectUnit(u)}
            className={`min-h-8 rounded-lg border px-2 py-0.5 text-[11px] font-medium sm:min-h-9 sm:px-2.5 sm:py-1 sm:text-xs ${
              state.mode === "preset" && state.unitSize === u
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-gray-300 dark:border-gray-600"
            }`}
          >
            {formatSellUnitLabel(u, product.weightUnit, product.basePackageSize)}
          </button>
        ))}
        <button
          type="button"
          onClick={selectCustomMode}
          className={`min-h-8 rounded-lg border px-2 py-0.5 text-[11px] font-medium sm:min-h-9 sm:px-2.5 sm:py-1 sm:text-xs ${
            state.mode === "custom"
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-gray-300 dark:border-gray-600"
          }`}
        >
          {t.sell.customAmount}
        </button>
      </div>

      {state.mode === "custom" && (
        <div className="mb-2 flex gap-2 sm:mb-3">
          <NumberInput
            className="flex-1"
            placeholder={t.common.enterQty}
            value={state.customAmount}
            onChange={(v) => updateCustom(v, state.customUnit)}
          />
          <Select
            className="h-10 w-28"
            value={state.customUnit}
            onChange={(e) => updateCustom(state.customAmount, e.target.value as CustomSellUnit)}
          >
            {customUnitOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="mb-2 grid grid-cols-2 gap-2 sm:mb-3">
        <div>
          <Label className="text-xs">{t.sell.quantity}</Label>
          <div className="mt-1 flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={() => {
                onStateChange({ ...state, unitCount: Math.max(1, state.unitCount - 1) });
                onStockError("");
              }}
            >
              <Minus size={14} />
            </Button>
            <span className="w-8 text-center font-bold">{state.unitCount}</span>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              disabled={state.unitCount >= maxUnitCount}
              onClick={() => {
                if (state.unitCount < maxUnitCount) {
                  onStateChange({ ...state, unitCount: state.unitCount + 1 });
                  onStockError("");
                } else {
                  onStockError(t.sell.notEnoughStock);
                }
              }}
            >
              <Plus size={14} />
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs">{t.sell.unitPrice}</Label>
          <NumberInput
            className="mt-1"
            value={state.pricePerUnit}
            onChange={(v) => {
              onStateChange({ ...state, pricePerUnit: v });
              onStockError("");
            }}
          />
        </div>
      </div>

      {showBelowSuggested && (
        <p className="mb-2 text-xs text-amber-700">{t.sell.belowSuggestedWarning}</p>
      )}
      {showBelowCost && (
        <p className="mb-2 text-xs text-red-600">{t.sell.belowCostWarning}</p>
      )}

      {state.mode === "custom" && effectiveUnitSize > 0 && (
        <p className="mb-2 text-xs text-gray-500">
          {formatSellUnitLabel(effectiveUnitSize, product.weightUnit, product.basePackageSize)}
        </p>
      )}

      {stockError && (
        <p className="mb-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/30">
          {stockError}
        </p>
      )}

      <div className="mb-1.5 flex items-center justify-between text-sm sm:mb-2">
        <span>{t.sell.lineTotal}</span>
        <strong>{formatCurrency(lineTotal)}</strong>
      </div>

      <Button
        type="button"
        className="min-h-10 w-full touch-manipulation active:scale-[0.99]"
        onClick={handleAdd}
        disabled={available <= 0 || lineStock > available || effectiveUnitSize <= 0}
      >
        <Plus size={16} /> {t.sell.addToCart}
      </Button>
    </div>
  );
}
