"use client";

import { useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, NumberInput } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency } from "@/lib/utils";
import {
  formatSellUnitLabel,
  getKhucraSellUnits,
  supportsFullPackageSale,
} from "@/lib/inventory/sell-units";
import { calcUnitPriceFromReference } from "@/lib/inventory/unit-price";
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

export interface ProductCardState {
  unitSize: number;
  unitCount: number;
  pricePerUnit: number;
}

interface ProductSellCardProps {
  product: SellProduct;
  cart: CartLine[];
  state: ProductCardState;
  onStateChange: (state: ProductCardState) => void;
  onAddToCart: () => void;
  stockError: string;
  onStockError: (msg: string) => void;
}

export function getDefaultProductState(product: SellProduct): ProductCardState {
  const units = getSellUnitOptions(product);
  const unitSize = units[0] ?? product.allowedSellUnits[0] ?? product.basePackageSize;
  return {
    unitSize,
    unitCount: 1,
    pricePerUnit: calcUnitPriceFromReference(
      product.sellPrice,
      unitSize,
      product.basePackageSize
    ),
  };
}

export function getSellUnitOptions(product: SellProduct): number[] {
  const khucra = getKhucraSellUnits(product.allowedSellUnits, product.basePackageSize);
  const units = [...khucra];
  if (
    supportsFullPackageSale(product.weightUnit) &&
    product.basePackageSize > 1 &&
    !units.includes(product.basePackageSize)
  ) {
    units.push(product.basePackageSize);
  }
  if (units.length === 0 && product.allowedSellUnits.length > 0) {
    return [...new Set(product.allowedSellUnits)].sort((a, b) => a - b);
  }
  return [...new Set(units)].sort((a, b) => a - b);
}

export function ProductSellCard({
  product,
  cart,
  state,
  onStateChange,
  onAddToCart,
  stockError,
  onStockError,
}: ProductSellCardProps) {
  const { t } = useI18n();
  const unitOptions = useMemo(() => getSellUnitOptions(product), [product]);

  const available = getAvailableStock(product.inventory.totalStock, cart, product.id);
  const lineStock = getLineStockAmount(state.unitSize, state.unitCount);
  const maxUnitCount =
    state.unitSize > 0 ? Math.max(1, Math.floor(available / state.unitSize)) : 1;

  const selectUnit = (unitSize: number) => {
    onStateChange({
      ...state,
      unitSize,
      unitCount: 1,
      pricePerUnit: calcUnitPriceFromReference(
        product.sellPrice,
        unitSize,
        product.basePackageSize
      ),
    });
    onStockError("");
  };

  const lineTotal = state.pricePerUnit * state.unitCount;

  const handleAdd = () => {
    if (state.pricePerUnit <= 0) {
      onStockError(t.sell.enterSellPrice);
      return;
    }
    const check = validateStockForLine(
      product.inventory.totalStock,
      cart,
      product.id,
      state.unitSize,
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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
      <div className="mb-3 flex gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl">📦</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{product.name}</h3>
          <p className="truncate text-xs text-gray-500">{product.productId}</p>
          <p className="mt-1 text-xs font-medium text-emerald-600">
            {t.sell.availableStock}: {formatStockAmount(available, product.weightUnit)}
          </p>
          {product.sellPrice > 0 && (
            <p className="text-xs text-gray-500">
              {t.sell.referenceBag}: {formatCurrency(product.sellPrice)}
            </p>
          )}
        </div>
      </div>

      <Label className="mb-1 block text-xs">{t.sell.selectUnit}</Label>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {unitOptions.map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => selectUnit(u)}
            className={`min-h-9 rounded-lg border px-2.5 py-1 text-xs font-medium ${
              state.unitSize === u
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-gray-300 dark:border-gray-600"
            }`}
          >
            {formatSellUnitLabel(u, product.weightUnit, product.basePackageSize)}
          </button>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
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

      {stockError && (
        <p className="mb-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/30">
          {stockError}
        </p>
      )}

      <div className="mb-2 flex items-center justify-between text-sm">
        <span>{t.sell.lineTotal}</span>
        <strong>{formatCurrency(lineTotal)}</strong>
      </div>

      <Button
        className="min-h-10 w-full"
        onClick={handleAdd}
        disabled={available <= 0 || lineStock > available}
      >
        <Plus size={16} /> {t.sell.addToCart}
      </Button>
    </div>
  );
}
