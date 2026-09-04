"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Search, X, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { sellUnitLabel } from "@/lib/inventory/khugra";

interface Product {
  id: string;
  productId: string;
  name: string;
  imageUrl?: string;
  basePackageSize: number;
  sellPrice: number;
  allowedSellUnits: number[];
  inventory: {
    formattedTotal: string;
    closedBags: number;
    formattedOpenBag: string | null;
    totalStock: number;
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

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products ?? []));
  }, []);

  const cartTotal = cart.reduce((s, i) => s + i.pricePerUnit * i.unitCount, 0);

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setSellUnit(p.allowedSellUnits[0] ?? 250);
    setSellPrice(p.sellPrice);
    setUnitCount(1);
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    const item: CartItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantityInSmallestUnit: sellUnit,
      sellUnitLabel: sellUnitLabel(sellUnit, selectedProduct.basePackageSize),
      pricePerUnit: sellPrice,
      unitCount,
    };
    setCart([...cart, item]);
    setSelectedProduct(null);
    setPaidAmount(cartTotal + sellPrice * unitCount);
  };

  const completeSale = () => {
    if (cart.length === 0) return;
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: customerName || undefined,
            customerPhone: customerPhone || undefined,
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
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Product Grid */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{t.sell.title}</h1>
          <Button variant="outline" size="sm" onClick={() => setShowSearch(!showSearch)}>
            <Search size={16} /> {t.sell.searchSale}
          </Button>
        </div>

        {showSearch && (
          <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder={t.sell.searchSale}
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="max-w-xs"
              />
              <Input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={searchSales}>{t.common.search}</Button>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProduct(p)}
              className={`rounded-xl border-2 p-3 text-left transition-all hover:shadow-md ${
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
              <p className="text-xs text-gray-500">{p.productId}</p>
              <p className="text-xs mt-1 text-emerald-600 font-medium">{p.inventory.formattedTotal}</p>
              {p.inventory.formattedOpenBag && (
                <p className="text-xs text-orange-500">Open: {p.inventory.formattedOpenBag}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sell Panel + Cart */}
      <div className="w-full lg:w-96 space-y-4">
        {selectedProduct && (
          <div className="rounded-xl border-2 border-emerald-500 bg-[var(--card)] p-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold">{selectedProduct.name}</h3>
              <button onClick={() => setSelectedProduct(null)}><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Stock: {selectedProduct.inventory.formattedTotal} · {selectedProduct.inventory.closedBags} bags
            </p>

            <Label className="mb-1 block">{t.sell.khugra}</Label>
            <div className="flex flex-wrap gap-1 mb-3">
              {selectedProduct.allowedSellUnits.map((u) => (
                <button
                  key={u}
                  onClick={() => setSellUnit(u)}
                  className={`px-2 py-1 rounded text-xs border ${
                    sellUnit === u ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-300"
                  }`}
                >
                  {sellUnitLabel(u, selectedProduct.basePackageSize)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <Label>{t.sell.quantity}</Label>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" onClick={() => setUnitCount(Math.max(1, unitCount - 1))}>
                    <Minus size={14} />
                  </Button>
                  <span className="font-bold w-8 text-center">{unitCount}</span>
                  <Button size="icon" variant="outline" onClick={() => setUnitCount(unitCount + 1)}>
                    <Plus size={14} />
                  </Button>
                </div>
              </div>
              <div>
                <Label>{t.sell.sellPrice}</Label>
                <Input
                  type="number"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <p className="text-sm mb-3">
              Line total: <strong>{formatCurrency(sellPrice * unitCount)}</strong>
            </p>

            <Button className="w-full" onClick={addToCart}>
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
            <div>
              <Label>{t.sell.customerName}</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div>
              <Label>{t.sell.customerPhone}</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <div>
              <Label>{t.common.paid}</Label>
              <Input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="flex justify-between font-bold text-lg mb-3">
            <span>{t.common.total}</span>
            <span className="text-emerald-600">{formatCurrency(cartTotal)}</span>
          </div>

          {cartTotal > paidAmount && (
            <p className="text-sm text-orange-500 mb-2">
              {t.common.due}: {formatCurrency(cartTotal - paidAmount)}
            </p>
          )}

          <Button className="w-full" onClick={completeSale} disabled={cart.length === 0 || loading}>
            {t.sell.completeSale}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmState.open}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={close}
        loading={loading}
      />
    </div>
  );
}
