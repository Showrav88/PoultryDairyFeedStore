"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ProductSellCard,
  applyLastPricesToState,
  getDefaultProductState,
  resolveSellUnitSize,
  type ProductCardState,
  type SellProduct,
} from "@/components/sell/product-sell-card";
import { SellCartPanel, type CartItem } from "@/components/sell/sell-cart-panel";
import {
  hasTrackedIdentity,
  type TrackedBuyer,
} from "@/components/sell/wholesale-buyer-search";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { formatSellUnitLabel } from "@/lib/inventory/sell-units";
import { resolveSellProductInput } from "@/lib/inventory/product-type";
import { getCartReservedStock } from "@/lib/inventory/cart-stock";
import { buildLastPriceMap } from "@/lib/sell/last-price";

interface Sale {
  id: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount: number;
  status: string;
  createdAt: string;
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
  const customerIdParam = searchParams.get("customerId");
  const { t, locale } = useI18n();
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [products, setProducts] = useState<SellProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cardStates, setCardStates] = useState<Record<string, ProductCardState>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [trackedBuyer, setTrackedBuyer] = useState<TrackedBuyer | null>(null);
  const [lastPriceMap, setLastPriceMap] = useState<Map<string, number>>(new Map());
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchResults, setSearchResults] = useState<Sale[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const loadBuyerFromFarmer = useCallback((id: string) => {
    fetch(`/api/farmers/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.farmer) return;
        setTrackedBuyer({
          type: "FARMER",
          id: d.farmer.id,
          name: d.farmer.name,
          phone: d.farmer.phone,
          totalDue: d.farmer.totalDue ?? 0,
          lifetimeSpend: d.farmer.lifetimeSpend ?? 0,
          tier: d.farmer.tier ?? "bronze",
          tierLabel: d.farmer.tierLabel ?? "Bronze",
        });
        setCustomerName(d.farmer.name);
        setCustomerPhone(d.farmer.phone);
      });
  }, []);

  const loadBuyerFromCustomer = useCallback((id: string) => {
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.customer) return;
        setTrackedBuyer({
          type: "CUSTOMER",
          id: d.customer.id,
          name: d.customer.name,
          phone: d.customer.phone,
          totalDue: d.customer.totalDue ?? 0,
          lifetimeSpend: d.customer.lifetimeSpend ?? 0,
          tier: d.customer.tier ?? "bronze",
          tierLabel: d.customer.tierLabel ?? "Bronze",
        });
        setCustomerName(d.customer.name);
        setCustomerPhone(d.customer.phone);
      });
  }, []);

  useEffect(() => {
    if (farmerIdParam) loadBuyerFromFarmer(farmerIdParam);
    else if (customerIdParam) loadBuyerFromCustomer(customerIdParam);
  }, [farmerIdParam, customerIdParam, loadBuyerFromFarmer, loadBuyerFromCustomer]);

  const loadLastPrices = useCallback(async () => {
    const params = new URLSearchParams();
    if (trackedBuyer?.type === "FARMER") params.set("farmerId", trackedBuyer.id);
    else if (trackedBuyer?.type === "CUSTOMER") params.set("customerId", trackedBuyer.id);
    else if (customerPhone.trim().length >= 10) params.set("phone", customerPhone.trim());
    else {
      setLastPriceMap(new Map());
      return;
    }

    const res = await fetch(`/api/sell/last-prices?${params}`);
    const data = await res.json();
    setLastPriceMap(buildLastPriceMap(data.prices ?? []));
  }, [trackedBuyer, customerPhone]);

  useEffect(() => {
    loadLastPrices();
  }, [loadLastPrices]);

  const loadProducts = useCallback(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        const list: SellProduct[] = (d.products ?? []).map((p: SellProduct) => ({
          ...p,
          sellPrice: Number(p.sellPrice),
        }));
        setProducts(list);
      });
  }, []);

  useEffect(() => {
    loadProducts();
    const onFocus = () => loadProducts();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadProducts]);

  // Always default to full bag (first sell unit chip), including walk-in sales.
  const preferWalkInDefault = false;

  useEffect(() => {
    if (products.length === 0) return;
    setCardStates((prev) => {
      const next = { ...prev };
      for (const p of products) {
        if (!next[p.id]) {
          next[p.id] = getDefaultProductState(p, lastPriceMap, preferWalkInDefault);
        }
      }
      return next;
    });
  }, [products, preferWalkInDefault, lastPriceMap]);

  useEffect(() => {
    if (products.length === 0 || lastPriceMap.size === 0) return;
    setCardStates((prev) => {
      const next = { ...prev };
      for (const p of products) {
        if (next[p.id]) {
          next[p.id] = applyLastPricesToState(p, next[p.id], lastPriceMap);
        }
      }
      return next;
    });
  }, [lastPriceMap, products]);

  useEffect(() => {
    if (products.length === 0) return;
    setCardStates(() => {
      const next: Record<string, ProductCardState> = {};
      for (const p of products) {
        next[p.id] = getDefaultProductState(p, lastPriceMap, preferWalkInDefault);
      }
      return next;
    });
  }, [trackedBuyer?.type, trackedBuyer?.id, preferWalkInDefault]);

  const cartTotal = cart.reduce((s, i) => s + i.pricePerUnit * i.unitCount, 0);

  const fullBagInCart = useMemo(() => {
    return cart.some((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return false;
      const resolved = resolveSellProductInput(product);
      return item.quantityInSmallestUnit === resolved.basePackageSize && resolved.basePackageSize > 1;
    });
  }, [cart, products]);

  const scrollToCart = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 1279px)").matches) return;
    document.getElementById("sell-cart-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const addToCart = (product: SellProduct) => {
    const state =
      cardStates[product.id] ??
      getDefaultProductState(product, lastPriceMap, preferWalkInDefault);
    const unitSize = resolveSellUnitSize(state);
    const resolved = resolveSellProductInput(product);

    const sellUnitLabel = formatSellUnitLabel(
      unitSize,
      resolved.weightUnit,
      resolved.basePackageSize
    );

    setCart((prev) => {
      const idx = prev.findIndex(
        (i) =>
          i.productId === product.id && i.quantityInSmallestUnit === unitSize
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          unitCount: next[idx].unitCount + state.unitCount,
          pricePerUnit: state.pricePerUnit,
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantityInSmallestUnit: unitSize,
          sellUnitLabel,
          pricePerUnit: state.pricePerUnit,
          unitCount: state.unitCount,
        },
      ];
    });

    setPaidAmount((prev) => {
      const newLine = state.pricePerUnit * state.unitCount;
      return prev === cartTotal ? cartTotal + newLine : prev;
    });
    setCardErrors((prev) => ({ ...prev, [product.id]: "" }));
    scrollToCart();
  };

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
        const body: Record<string, unknown> = {
          paidAmount,
          items: cart.map((i) => ({
            productId: i.productId,
            quantityInSmallestUnit: i.quantityInSmallestUnit,
            pricePerUnit: i.pricePerUnit,
            unitCount: i.unitCount,
          })),
        };

        if (trackedBuyer?.type === "FARMER") {
          body.farmerId = trackedBuyer.id;
        } else if (trackedBuyer?.type === "CUSTOMER") {
          body.customerId = trackedBuyer.id;
        } else {
          if (customerName.trim()) body.customerName = customerName.trim();
          if (customerPhone.trim()) body.customerPhone = customerPhone.trim();
        }

        const res = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setCart([]);
        setTrackedBuyer(null);
        setCustomerName("");
        setCustomerPhone("");
        setPaidAmount(0);
        setLastPriceMap(new Map());
        if (farmerIdParam) loadBuyerFromFarmer(farmerIdParam);
        else if (customerIdParam) loadBuyerFromCustomer(customerIdParam);
        loadProducts();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Sale failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `${t.sell.completeSale}: ${formatCurrency(cartTotal)}?` });
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
        <p className="font-semibold">
          {trackedBuyer ? t.farmers.sellCounterHint : t.sell.wholesaleHint}
        </p>
        <p className="mt-1 opacity-90">
          {trackedBuyer ? t.farmers.sellPaidThisSaleOnly : t.sell.autoPriceHint}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">{t.sell.title}</h1>
        <div className="flex gap-2">
          <Button className="min-h-11" size="sm" variant="outline" onClick={loadProducts}>
            {t.sell.refreshStock}
          </Button>
          <Button className="min-h-11" variant="outline" size="sm" onClick={() => setShowSearch(!showSearch)}>
            <Search size={16} /> {t.sell.searchSale}
          </Button>
        </div>
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
            <Button className="min-h-11 w-full sm:w-auto" onClick={searchSales}>
              {t.common.search}
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {searchResults.map((sale) => (
                <div key={sale.id} className="border-b border-[var(--border)] pb-2 text-sm">
                  <div className="flex justify-between">
                    <span>{sale.customerName || sale.customerPhone || t.sell.walkIn}</span>
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

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:gap-6">
        <div className="order-2 flex-1 xl:order-1">
          <p className="mb-2 text-sm text-gray-500 sm:mb-3">{t.sell.selectProductCards}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 2xl:grid-cols-3">
            {products.map((p) => (
              <ProductSellCard
                key={p.id}
                product={p}
                cart={cart}
                lastPriceMap={lastPriceMap}
                state={
                  cardStates[p.id] ??
                  getDefaultProductState(p, lastPriceMap, preferWalkInDefault)
                }
                onStateChange={(state) =>
                  setCardStates((prev) => ({ ...prev, [p.id]: state }))
                }
                onAddToCart={() => addToCart(p)}
                stockError={cardErrors[p.id] ?? ""}
                onStockError={(msg) =>
                  setCardErrors((prev) => ({ ...prev, [p.id]: msg }))
                }
              />
            ))}
          </div>
        </div>

        <div className="order-1 w-full xl:order-2 xl:w-96 xl:shrink-0">
          <SellCartPanel
            id="sell-cart-panel"
            className="sticky top-14 z-20 max-h-[min(46vh,26rem)] overflow-y-auto shadow-md xl:top-4 xl:max-h-none xl:shadow-sm"
            cart={cart}
            onRemove={(idx) => {
              setCart(cart.filter((_, i) => i !== idx));
            }}
            paidAmount={paidAmount}
            onPaidChange={setPaidAmount}
            trackedBuyer={trackedBuyer}
            onBuyerSelect={(b) => {
              setTrackedBuyer(b);
              if (b) {
                setCustomerName(b.name);
                setCustomerPhone(b.phone);
              }
            }}
            manualName={customerName}
            manualPhone={customerPhone}
            onManualNameChange={setCustomerName}
            onManualPhoneChange={setCustomerPhone}
            onComplete={completeSale}
            loading={loading}
            fullBagInCart={fullBagInCart}
          />
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
