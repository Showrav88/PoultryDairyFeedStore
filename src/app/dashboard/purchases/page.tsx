"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface Buyer { id: string; name: string; phone: string; }
interface Product { id: string; name: string; productId: string; }
interface PurchaseItem { productId: string; quantity: number; costPricePerUnit: number; costPriceTotal: number; }
interface Purchase {
  id: string;
  totalCost: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  createdAt: string;
  buyer: { name: string };
  items: { product: { name: string }; quantity: number; costPriceTotal: number }[];
}

export default function PurchasesPage() {
  const { t, locale } = useI18n();
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [buyerId, setBuyerId] = useState("");
  const [buyerSearch, setBuyerSearch] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/purchases").then((r) => r.json()).then((d) => setPurchases(d.purchases ?? []));
    fetch("/api/buyers").then((r) => r.json()).then((d) => setBuyers(d.buyers ?? []));
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products ?? []));
  }, []);

  const filteredBuyers = buyers.filter(
    (b) => b.name.toLowerCase().includes(buyerSearch.toLowerCase()) || b.phone.includes(buyerSearch)
  );

  const addItem = () => {
    if (products.length === 0) return;
    setItems([...items, { productId: products[0].id, quantity: 1, costPricePerUnit: 0, costPriceTotal: 0 }]);
  };

  const updateItem = (idx: number, field: keyof PurchaseItem, value: number | string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "quantity" || field === "costPricePerUnit") {
      updated[idx].costPriceTotal = updated[idx].quantity * updated[idx].costPricePerUnit;
    }
    setItems(updated);
  };

  const totalCost = items.reduce((s, i) => s + i.costPriceTotal, 0);

  const handleCreate = () => {
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buyerId, paidAmount, items }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setShowForm(false);
        setItems([]);
        setBuyerId("");
        fetch("/api/purchases").then((r) => r.json()).then((d) => setPurchases(d.purchases ?? []));
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `Create purchase for ${formatCurrency(totalCost)}?` });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">{t.purchases.title}</h1>
        <Button className="min-h-11 shrink-0" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> {t.purchases.newPurchase}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label>{t.purchases.selectBuyer}</Label>
              <Input
                placeholder={t.buyers.searchByNameOrPhone}
                value={buyerSearch}
                onChange={(e) => setBuyerSearch(e.target.value)}
                className="mb-2"
              />
              <select
                className="w-full h-10 rounded-lg border border-gray-300 px-3 dark:border-gray-600 dark:bg-gray-900"
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
              >
                <option value="">Select...</option>
                {filteredBuyers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.phone})</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t.common.paid}</Label>
              <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 items-end gap-3 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="sm:col-span-2">
                  <Label>{t.purchases.selectProduct}</Label>
                  <select
                    className="w-full h-10 rounded-lg border border-gray-300 px-3 dark:border-gray-600 dark:bg-gray-900"
                    value={item.productId}
                    onChange={(e) => updateItem(idx, "productId", e.target.value)}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.productId})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Qty (bags)</Label>
                  <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value))} />
                </div>
                <div>
                  <Label>{t.purchases.costPerUnit}</Label>
                  <Input type="number" value={item.costPricePerUnit} onChange={(e) => updateItem(idx, "costPricePerUnit", parseFloat(e.target.value))} />
                </div>
                <div className="flex min-h-10 items-center justify-between gap-2 sm:col-span-2 lg:col-span-1">
                  <span className="text-sm font-medium">{formatCurrency(item.costPriceTotal)}</span>
                  <button className="flex min-h-11 min-w-11 items-center justify-center" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button className="min-h-11" variant="outline" onClick={addItem}><Plus size={16} /> {t.purchases.addItem}</Button>
            <span className="font-bold sm:ml-auto">{t.common.total}: {formatCurrency(totalCost)}</span>
            <Button className="min-h-11" onClick={handleCreate} disabled={!buyerId || items.length === 0}>{t.common.save}</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {purchases.map((p) => (
          <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{p.buyer.name}</p>
                <p className="text-xs text-gray-500">{formatDateTime(p.createdAt, locale)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{formatCurrency(p.totalCost)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  p.status === "PAID" ? "bg-emerald-100 text-emerald-700" :
                  p.status === "PARTIAL" ? "bg-orange-100 text-orange-700" :
                  "bg-red-100 text-red-700"
                }`}>{p.status}</span>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {p.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}
            </div>
          </div>
        ))}
        {purchases.length === 0 && <p className="text-center text-gray-500 py-8">{t.common.noData}</p>}
      </div>

      <ConfirmDialog open={confirmState.open} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={close} loading={loading} />
    </div>
  );
}
