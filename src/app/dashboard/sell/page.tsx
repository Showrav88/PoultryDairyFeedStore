"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ProductSellCard,
  getDefaultProductState,
  type ProductCardState,
  type SellProduct,
} from "@/components/sell/product-sell-card";
import { SellCartPanel, type CartItem } from "@/components/sell/sell-cart-panel";
import type { SelectedCustomer } from "@/components/sell/customer-search";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { formatSellUnitLabel } from "@/lib/inventory/sell-units";
import { getCartReservedStock } from "@/lib/inventory/cart-stock";

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
  const { t, locale } = useI18n();
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [products, setProducts] = useState<SellProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cardStates, setCardStates] = useState<Record<string, ProductCardState>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchResults, setSearchResults] = useState<Sale[]>([]);
  const [showSearch, setShowSearch] = useState(false);
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

  const loadProducts = useCallback(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        const list: SellProduct[] = (d.products ?? []).map((p: SellProduct) => ({
          ...p,
          sellPrice: Number(p.sellPrice),
        }));
        setProducts(list);
        setCardStates((prev) => {
          const next = { ...prev };
          for (const p of list) {
            if (!next[p.id]) next[p.id] = getDefaultProductState(p);
          }
          return next;
        });
      });
  }, []);

  useEffect(() => {
    loadProducts();
    const onFocus = () => loadProducts();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadProducts]);

  const cartTotal = cart.reduce((s, i) => s + i.pricePerUnit * i.unitCount, 0);

  const addToCart = (product: SellProduct) => {
    const state = cardStates[product.id] ?? getDefaultProductState(product);
    const sellUnitLabel = formatSellUnitLabel(
      state.unitSize,
      product.weightUnit,
      product.basePackageSize
    );

    setCart((prev) => {
      const idx = prev.findIndex(
        (i) =>
          i.productId === product.id && i.quantityInSmallestUnit === state.unitSize
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
          quantityInSmallestUnit: state.unitSize,
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
        const res = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            farmerId: farmerId || undefined,
            customerId: farmerId ? undefined : selectedCustomer?.id,
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
        setSelectedCustomer(null);
        setCustomerName("");
        setCustomerPhone("");
        setPaidAmount(0);
        if (farmerId) {
          fetch(`/api/farmers/${farmerId}`)
            .then((r) => r.json())
            .then((d) => setFarmerDue(d.farmer?.totalDue ?? 0));
        }
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
        <p className="font-semibold">{t.sell.redesignHint}</p>
        <p className="mt-1 opacity-90">{t.sell.autoPriceHint}</p>
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
          <Link
            href={`/dashboard/farmers/${farmerId}`}
            className="mt-2 inline-block text-emerald-700 underline dark:text-emerald-400"
          >
            {t.farmers.profile}
          </Link>
        </div>
      )}

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

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex-1">
          <p className="mb-3 text-sm text-gray-500">{t.sell.selectProductCards}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {products.map((p) => (
              <ProductSellCard
                key={p.id}
                product={p}
                cart={cart}
                state={cardStates[p.id] ?? getDefaultProductState(p)}
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

        <div className="w-full xl:w-96 xl:shrink-0">
          <SellCartPanel
            cart={cart}
            onRemove={(idx) => {
              setCart(cart.filter((_, i) => i !== idx));
            }}
            paidAmount={paidAmount}
            onPaidChange={setPaidAmount}
            selectedCustomer={selectedCustomer}
            onCustomerSelect={setSelectedCustomer}
            manualName={customerName}
            manualPhone={customerPhone}
            onManualNameChange={setCustomerName}
            onManualPhoneChange={setCustomerPhone}
            onComplete={completeSale}
            loading={loading}
            farmerMode={!!farmerId}
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
