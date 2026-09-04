"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShoppingCart, Search, X, Plus, Minus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NumberInput, Select } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  formatFullPackageLabel,
  formatSellUnitLabel,
  getCustomUnitOptions,
  getKhucraSellUnits,
  parseCustomSellAmount,
  supportsFullPackageSale,
  type CustomSellUnit,
} from "@/lib/inventory/sell-units";
import {
  formatStockAmount,
  getAvailableStock,
  getCartReservedStock,
  getLineStockAmount,
  validateStockForLine,
} from "@/lib/inventory/cart-stock";

type SellMode = "khucra" | "full_bag" | "custom";

interface Product {
  id: string;
  productId: string;
  name: string;
  imageUrl?: string;
  weightUnit: string;
  basePackageSize: number;
  sellPrice: number;
  allowedSellUnits: number[];
  inventory: {
    formattedTotal: string;
    closedBags: number;
    formattedOpenBag: string | null;
    totalStock: number;
    openBagRemaining: number;
    openBagPercent: number;
    formattedAvgCostPerKg: string | null;
    avgCostPerSmallestUnit: number | null;
  };
}

interface CartItem {
  productId: string;
  productName: string;
  quantityInSmallestUnit: number;
  sellUnitLabel: string;
  pricePerUnit: number;
  unitCount: number;
}

interface Sale {
  id: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: { product: { name: string }; sellUnitLabel: string; lineTotal: number }[];
}

export default function SellCounterPage() {
  return (
    <Suspense fallback={<div className="p-4 text-gray-500">Loading...</div>}>
      <SellCounterContent />
    </Suspense>
  );
}

function SellCounterContent() {
  const searchParams = useSearchParams();
  const farmerIdParam = searchParams.get("farmerId");
  const { t, locale } = useI18n();
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sellUnit, setSellUnit] = useState(250);
  const [unitCount, setUnitCount] = useState(1);
  const [sellPrice, setSellPrice] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchResults, setSearchResults] = useState<Sale[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [sellMode, setSellMode] = useState<SellMode>("khucra");
  const [customAmount, setCustomAmount] = useState(0);
  const [customUnit, setCustomUnit] = useState<CustomSellUnit>("KG");
  const [stockError, setStockError] = useState("");
  const [farmerId, setFarmerId] = useState<string | null>(farmerIdParam);
  const [farmerName, setFarmerName] = useState("");
  const [farmerDue, setFarmerDue] = useState(0);

  useEffect(() => {
    if (farmerIdParam) {
      setFarmerId(farmerIdParam);
      fetch(`/api/farmers/${farmerIdParam}`)
        .then((r) => r.json())
        .then((d) => {
          setFarmerName(d.farmer?.name ?? "");
          setFarmerDue(d.farmer?.totalDue ?? 0);
        });
    }
  }, [farmerIdParam]);

  const getAvailable = (productId: string, totalStock: number) =>
    getAvailableStock(totalStock, cart, productId);

  const loadProducts = useCallback(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
  }, []);

  useEffect(() => {
    loadProducts();
    const onFocus = () => loadProducts();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadProducts]);

  const cartTotal = cart.reduce((s, i) => s + i.pricePerUnit * i.unitCount, 0);
  const generalOverpaid = !farmerId && cartTotal > 0 && paidAmount > cartTotal;

  const handlePaidChange = (value: number) => {
    if (!farmerId && cartTotal > 0 && value > cartTotal) {
      setPaidAmount(cartTotal);
      return;
    }
    setPaidAmount(value);
  };

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setSellUnit(p.allowedSellUnits[0] ?? 250);
    setSellPrice(0);
    setUnitCount(1);
    setSellMode("khucra");
    setCustomAmount(0);
    const units = getCustomUnitOptions(p.weightUnit);
    setCustomUnit(units[0]?.value ?? "KG");
    setStockError("");
  };

  const effectiveSellUnit = () => {
    if (!selectedProduct) return sellUnit;
    if (sellMode === "full_bag") {
      return selectedProduct.basePackageSize;
    }
    if (sellMode === "custom") {
      return parseCustomSellAmount(customAmount, customUnit);
    }
    return sellUnit;
  };

  const setSellModeAndSync = (mode: SellMode) => {
    setSellMode(mode);
    if (mode === "full_bag" && selectedProduct) {
      setSellUnit(selectedProduct.basePackageSize);
    } else if (mode === "khucra" && selectedProduct) {
      const units = getKhucraSellUnits(selectedProduct.allowedSellUnits, selectedProduct.basePackageSize);
      setSellUnit(units[0] ?? selectedProduct.allowedSellUnits[0] ?? 250);
    }
  };

  const khucraUnits = selectedProduct
    ? getKhucraSellUnits(selectedProduct.allowedSellUnits, selectedProduct.basePackageSize)
    : [];
  const showFullBag =
    selectedProduct &&
    supportsFullPackageSale(selectedProduct.weightUnit) &&
    selectedProduct.basePackageSize > 1;

  const selectedAvailable = selectedProduct
    ? getAvailable(selectedProduct.id, selectedProduct.inventory.totalStock)
    : 0;

  const lineStockNeeded = selectedProduct
    ? getLineStockAmount(effectiveSellUnit(), unitCount)
    : 0;

  const maxUnitCount = selectedProduct && effectiveSellUnit() > 0
    ? Math.max(1, Math.floor(selectedAvailable / effectiveSellUnit()))
    : 1;

  const sellMarginPerKg = selectedProduct?.inventory.avgCostPerSmallestUnit && effectiveSellUnit() > 0
    ? (sellPrice / effectiveSellUnit() - selectedProduct.inventory.avgCostPerSmallestUnit) * 1000
    : null;

  const lineEstProfit = selectedProduct && selectedProduct.inventory.avgCostPerSmallestUnit && sellPrice > 0 && effectiveSellUnit() > 0
    ? (sellPrice * unitCount) - (getLineStockAmount(effectiveSellUnit(), unitCount) * selectedProduct.inventory.avgCostPerSmallestUnit)
    : null;

  const cartEstProfit = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    const avg = product?.inventory.avgCostPerSmallestUnit ?? 0;
    const qty = item.quantityInSmallestUnit * item.unitCount;
    const revenue = item.pricePerUnit * item.unitCount;
    return sum + (revenue - qty * avg);
  }, 0);

  const addToCart = () => {
    if (!selectedProduct) return;
    const qty = effectiveSellUnit();
    if (qty <= 0) {
      setStockError("Enter a valid sell quantity");
      return;
    }
    if (sellPrice <= 0) {
      setStockError(t.sell.enterSellPrice);
      return;
    }

    const check = validateStockForLine(
      selectedProduct.inventory.totalStock,
      cart,
      selectedProduct.id,
      qty,
      unitCount
    );

    if (!check.ok) {
      setStockError(check.message);
      return;
    }

    const item: CartItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantityInSmallestUnit: qty,
      sellUnitLabel: formatSellUnitLabel(qty, selectedProduct.weightUnit, selectedProduct.basePackageSize),
      pricePerUnit: sellPrice,
      unitCount,
    };
    setCart([...cart, item]);
    setSelectedProduct(null);
    setStockError("");
    setPaidAmount(cartTotal + sellPrice * unitCount);
  };

  useEffect(() => {
    if (unitCount > maxUnitCount) {
      setUnitCount(Math.max(1, maxUnitCount));
    }
  }, [maxUnitCount, unitCount]);

  const completeSale = () => {
    if (cart.length === 0) return;

    for (const product of products) {
      const needed = getCartReservedStock(cart, product.id);
      if (needed > product.inventory.totalStock) {
        alert(`${product.name}: ${t.sell.notEnoughStock}`);
        return;
      }
    }

    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            farmerId: farmerId || undefined,
            customerName: farmerId ? undefined : customerName || undefined,
            customerPhone: farmerId ? undefined : customerPhone || undefined,
            paidAmount,
            items: cart.map((i) => ({
              productId: i.productId,
              quantityInSmallestUnit: i.quantityInSmallestUnit,
              pricePerUnit: i.pricePerUnit,
              unitCount: i.unitCount,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setPaidAmount(0);
        if (farmerId) {
          fetch(`/api/farmers/${farmerId}`)
            .then((r) => r.json())
            .then((d) => setFarmerDue(d.farmer?.totalDue ?? 0));
        }
        fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products ?? []));
      } catch (err) {
        alert(err instanceof Error ? err.message : "Sale failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `Complete sale for ${formatCurrency(cartTotal)}?` });
  };

  const searchSales = async () => {
    const params = new URLSearchParams();
    if (searchQ) params.set("q", searchQ);
    if (searchDate) params.set("date", searchDate);
    const res = await fetch(`/api/sales?${params}`);
    const data = await res.json();
    setSearchResults(data.sales ?? []);
  };

  return (
    <>
      <div className="mb-4 rounded-xl border border-[var(--info-border)] bg-[var(--info-bg)] p-4 text-sm text-[var(--info-text)]">
        <p className="font-semibold">{t.sell.pricingNotice}</p>
        <p className="mt-1 opacity-90">{t.sell.tapProductHint}</p>
      </div>

      {farmerId && farmerName && (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">
            {t.farmers.sellToFarmer}: {farmerName}
          </p>
          {farmerDue > 0 && (
            <p className="mt-1 text-orange-700 dark:text-orange-300">
              {t.farmers.farmerDueBalance}: {formatCurrency(farmerDue)}
            </p>
          )}
          <Link href={`/dashboard/farmers/${farmerId}`} className="mt-2 inline-block text-emerald-700 underline dark:text-emerald-400">
            {t.farmers.profile} / {t.farmers.collectPayment}
          </Link>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-[var(--info-border)] bg-[var(--info-bg)] p-4 text-sm text-[var(--info-text)]">
        <p className="font-semibold">Stock comes from Purchases</p>
        <p className="mt-1">If quantity shows 0, go to Purchases and buy bags for that product first. Tap Refresh if you just added stock.</p>
        <Button className="mt-2 min-h-9" size="sm" variant="outline" onClick={loadProducts}>Refresh Stock</Button>
      </div>

      <div className="flex h-full flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Product Grid */}
      <div className="flex-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold sm:text-2xl">{t.sell.title}</h1>
          <Button className="min-h-11" variant="outline" size="sm" onClick={() => setShowSearch(!showSearch)}>
            <Search size={16} /> {t.sell.searchSale}
          </Button>
        </div>

        {showSearch && (
          <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Input
                placeholder={t.sell.searchSale}
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="w-full sm:max-w-xs"
              />
              <Input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="w-full sm:max-w-xs"
              />
              <Button className="min-h-11 w-full sm:w-auto" onClick={searchSales}>{t.common.search}</Button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {searchResults.map((sale) => (
                  <div key={sale.id} className="text-sm border-b border-[var(--border)] pb-2">
                    <div className="flex justify-between">
                      <span>{sale.customerName || sale.customerPhone || "Walk-in"}</span>
                      <span className="font-medium">{formatCurrency(sale.totalAmount)}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDateTime(sale.createdAt, locale)} · {sale.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-gray-500 mb-3">{t.sell.selectProduct}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProduct(p)}
              className={`min-w-0 rounded-xl border-2 p-2 text-left transition-all hover:shadow-md sm:p-3 ${
                selectedProduct?.id === p.id
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                  : "border-[var(--border)] bg-[var(--card)]"
              }`}
            >
              <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover rounded-lg" />
                ) : (
                  <span className="text-3xl">📦</span>
                )}
              </div>
              <h3 className="font-semibold text-sm truncate">{p.name}</h3>
              <p className="truncate text-xs text-gray-500">{p.productId}</p>
              <p className="text-xs mt-1 text-emerald-600 font-medium">
                {t.sell.availableStock}: {formatStockAmount(getAvailable(p.id, p.inventory.totalStock), p.weightUnit)}
                {(p.weightUnit === "BAG" || p.weightUnit === "GRAM" || p.weightUnit === "KG") && (
                  <> · {p.inventory.closedBags} sealed</>
                )}
              </p>
              {getCartReservedStock(cart, p.id) > 0 && (
                <p className="text-xs text-blue-600">
                  {t.sell.inCart}: {formatStockAmount(getCartReservedStock(cart, p.id), p.weightUnit)}
                </p>
              )}
              {p.inventory.totalStock <= 0 && (
                <p className="text-xs text-red-500">No stock — add purchase first</p>
              )}
              {p.inventory.formattedOpenBag && (
                <p className="text-xs text-orange-500">Open: {p.inventory.formattedOpenBag}</p>
              )}
              {p.sellPrice > 0 && (
                <p className="text-xs text-gray-500">
                  {t.sell.suggestedOnly}: {formatCurrency(p.sellPrice)}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sell Panel + Cart */}
      <div className="w-full space-y-4 lg:w-96 lg:flex-none">
        {selectedProduct && (
          <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 max-h-[72dvh] overflow-y-auto rounded-t-2xl border-2 border-emerald-500 bg-[var(--card)] p-4 shadow-2xl lg:static lg:max-h-none lg:rounded-xl lg:shadow-none">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold">{selectedProduct.name}</h3>
              <button onClick={() => setSelectedProduct(null)}><X size={18} /></button>
            </div>
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
              <p className="font-semibold">{t.sell.availableStock}: {formatStockAmount(selectedAvailable, selectedProduct.weightUnit)}</p>
              <p className="mt-1 text-emerald-800 dark:text-emerald-200">
                Total in store: {selectedProduct.inventory.formattedTotal}
                {getCartReservedStock(cart, selectedProduct.id) > 0 && (
                  <> · {t.sell.inCart}: {formatStockAmount(getCartReservedStock(cart, selectedProduct.id), selectedProduct.weightUnit)}</>
                )}
              </p>
              {(selectedProduct.weightUnit === "BAG" || selectedProduct.weightUnit === "GRAM" || selectedProduct.weightUnit === "KG") && (
                <div className="mt-2 space-y-1 border-t border-emerald-200 pt-2 dark:border-emerald-800">
                  <p><strong>{t.sell.sealedBags}:</strong> {selectedProduct.inventory.closedBags}</p>
                  {selectedProduct.inventory.openBagRemaining > 0 ? (
                    <>
                      <p><strong>{t.sell.openBagTitle}:</strong> {selectedProduct.inventory.formattedOpenBag} ({selectedProduct.inventory.openBagPercent}% left)</p>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-emerald-200">
                        <div
                          className="h-full rounded-full bg-orange-500"
                          style={{ width: `${selectedProduct.inventory.openBagPercent}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-orange-700 dark:text-orange-300">{t.sell.openBagEmpty}</p>
                  )}
                  <p className="text-emerald-700 dark:text-emerald-300">{t.sell.openBagFinished}</p>
                  <p>
                    <strong>{t.sell.avgBuyCost}:</strong>{" "}
                    {selectedProduct.inventory.formattedAvgCostPerKg ?? t.sell.noAvgCostYet}
                  </p>
                  {sellMarginPerKg !== null && sellPrice > 0 && (
                    <p>
                      <strong>{t.sell.sellMargin}:</strong>{" "}
                      <span className={sellMarginPerKg >= 0 ? "text-emerald-700" : "text-red-600"}>
                        ৳{sellMarginPerKg.toFixed(2)}/kg
                        {sellMarginPerKg >= 0 ? " profit" : " loss"} vs avg buy cost
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {stockError && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/30">
                {stockError}
              </p>
            )}

            {lineStockNeeded > 0 && selectedAvailable >= lineStockNeeded && (
              <p className="mb-3 text-xs text-gray-600">
                {t.sell.stockAfterAdd}: {formatStockAmount(selectedAvailable - lineStockNeeded, selectedProduct.weightUnit)}
              </p>
            )}

            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSellModeAndSync("khucra")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                  sellMode === "khucra"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              >
                {t.sell.khucra}
              </button>
              {showFullBag && (
                <button
                  type="button"
                  onClick={() => setSellModeAndSync("full_bag")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                    sellMode === "full_bag"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
                  }`}
                >
                  <Package size={12} className="inline mr-1" />
                  {t.sell.fullBag}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSellModeAndSync("custom")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                  sellMode === "custom"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              >
                {t.sell.customAmount}
              </button>
            </div>

            {sellMode === "khucra" && (
              <>
                <Label className="mb-1 block">{t.sell.khucra}</Label>
                {khucraUnits.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {khucraUnits.map((u) => (
                      <button
                        key={u}
                        onClick={() => setSellUnit(u)}
                        className={`min-h-11 rounded-lg border px-3 py-2 text-sm ${
                          sellUnit === u
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {formatSellUnitLabel(u, selectedProduct.weightUnit, selectedProduct.basePackageSize)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-gray-500">
                    No khucra presets for this product. Use Custom amount or Full Bag.
                  </p>
                )}
              </>
            )}

            {sellMode === "full_bag" && showFullBag && (
              <div className="mb-3 rounded-xl border-2 border-blue-400 bg-blue-50 p-4 dark:border-blue-600 dark:bg-blue-950/30">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <Package size={24} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-blue-900 dark:text-blue-100">
                      {formatFullPackageLabel(selectedProduct.basePackageSize, selectedProduct.weightUnit)}
                    </p>
                    <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
                      Sell 1 complete sealed bag per quantity. Stock:{" "}
                      <strong>{selectedProduct.inventory.closedBags} sealed bags</strong>
                      {selectedProduct.inventory.formattedOpenBag
                        ? ` (+ open bag ${selectedProduct.inventory.formattedOpenBag})`
                        : ""}
                    </p>
                    <p className="mt-2 text-xs text-blue-700/80 dark:text-blue-300/80">
                      Each unit deducts {formatFullPackageLabel(selectedProduct.basePackageSize, selectedProduct.weightUnit)} from inventory.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {sellMode === "custom" && (
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <Label>Custom quantity</Label>
                  <NumberInput
                    placeholder={t.common.enterQty}
                    value={customAmount}
                    onChange={setCustomAmount}
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as CustomSellUnit)}
                  >
                    {getCustomUnitOptions(selectedProduct.weightUnit).map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </Select>
                </div>
                <p className="col-span-2 text-xs text-emerald-700">
                  Will deduct: {formatSellUnitLabel(effectiveSellUnit(), selectedProduct.weightUnit, selectedProduct.basePackageSize)} per item
                </p>
              </div>
            )}

            <div className="mb-3 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
              <div>
                <Label>
                  {sellMode === "full_bag" ? t.sell.bagQuantity : t.sell.quantity}
                </Label>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" onClick={() => {
                    setUnitCount(Math.max(1, unitCount - 1));
                    setStockError("");
                  }}>
                    <Minus size={14} />
                  </Button>
                  <span className="font-bold w-8 text-center">{unitCount}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={unitCount >= maxUnitCount}
                    onClick={() => {
                      if (unitCount < maxUnitCount) {
                        setUnitCount(unitCount + 1);
                        setStockError("");
                      } else {
                        setStockError(t.sell.notEnoughStock);
                      }
                    }}
                  >
                    <Plus size={14} />
                  </Button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Max at this size: {maxUnitCount}</p>
              </div>
              <div>
                <Label>
                  {sellMode === "full_bag" ? t.sell.pricePerBag : t.sell.sellPriceNow}
                </Label>
                <NumberInput
                  required
                  placeholder={t.sell.enterSellPrice}
                  value={sellPrice}
                  onChange={(v) => {
                    setSellPrice(v);
                    setStockError("");
                  }}
                />
                {selectedProduct.sellPrice > 0 ? (
                  <p className="mt-1 text-xs text-gray-500">
                    {t.sell.suggestedOnly}: {formatCurrency(selectedProduct.sellPrice)} ({t.sell.notAutoFilled})
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">{t.sell.enterSellPrice}</p>
                )}
              </div>
            </div>

            {lineEstProfit !== null && (
              <p className={`text-sm mb-3 font-medium ${lineEstProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {t.sell.estProfit}: {formatCurrency(lineEstProfit)}
              </p>
            )}

            <p className="text-sm mb-3">
              Line total: <strong>{formatCurrency(sellPrice * unitCount)}</strong>
            </p>

            <Button
              className="min-h-12 w-full"
              onClick={addToCart}
              disabled={selectedAvailable <= 0 || lineStockNeeded > selectedAvailable}
            >
              <Plus size={16} /> Add to {t.sell.cart}
            </Button>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="font-bold flex items-center gap-2 mb-3">
            <ShoppingCart size={18} /> {t.sell.cart}
          </h3>

          {cart.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">{t.common.noData}</p>
          ) : (
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm border-b border-[var(--border)] pb-2">
                  <div>
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-xs text-gray-500">{item.sellUnitLabel} × {item.unitCount}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{formatCurrency(item.pricePerUnit * item.unitCount)}</span>
                    <button onClick={() => setCart(cart.filter((_, i) => i !== idx))}>
                      <X size={14} className="text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 mb-3">
            {!farmerId && (
              <>
                <div>
                  <Label>{t.sell.customerName} ({t.common.optional})</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t.common.optional} />
                </div>
                <div>
                  <Label>{t.sell.customerPhone} ({t.common.optional})</Label>
                  <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder={t.common.optional} />
                </div>
              </>
            )}
            <div>
              <Label>{t.common.paid}</Label>
              <NumberInput
                placeholder={t.common.enterAmount}
                value={paidAmount}
                onChange={handlePaidChange}
              />
              {generalOverpaid && (
                <p className="mt-1 text-sm text-red-500">{t.sell.paidExceedsTotal}</p>
              )}
            </div>
          </div>

          <div className="flex justify-between font-bold text-lg mb-3">
            <span>{t.common.total}</span>
            <span className="text-emerald-600">{formatCurrency(cartTotal)}</span>
          </div>

          {cart.length > 0 && cartEstProfit !== 0 && (
            <p className={`text-sm mb-3 font-medium ${cartEstProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {t.sell.cartEstProfit}: {formatCurrency(cartEstProfit)}
            </p>
          )}

          {cartTotal > paidAmount && (
            <p className="text-sm text-orange-500 mb-2">
              {t.common.due}: {formatCurrency(cartTotal - paidAmount)}
            </p>
          )}

          {farmerId && paidAmount > cartTotal && cartTotal > 0 && (
            <p className="text-sm text-emerald-600 mb-2">
              {t.farmers.overpaymentHint}: {formatCurrency(paidAmount - cartTotal)}
            </p>
          )}

          <Button
            className="min-h-12 w-full"
            onClick={completeSale}
            disabled={cart.length === 0 || loading || generalOverpaid}
          >
            {t.sell.completeSale}
          </Button>
        </div>
      </div>
      </div>

      <ConfirmDialog
        open={confirmState.open}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={close}
        loading={loading}
      />
    </>
  );
}
