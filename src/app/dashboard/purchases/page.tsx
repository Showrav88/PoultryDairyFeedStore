"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency, formatDateTime, formatOptionalAmount, parseOptionalAmountInput } from "@/lib/utils";

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
  const [selectedBuyerData, setSelectedBuyerData] = useState<Buyer | null>(null);
  const [paidAmount, setPaidAmount] = useState(0);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [editPaidAmount, setEditPaidAmount] = useState(0);

  const loadPurchases = () =>
    fetch("/api/purchases").then((r) => r.json()).then((d) => setPurchases(d.purchases ?? []));

  const searchBuyers = useCallback((q: string) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    fetch(`/api/buyers${params}`)
      .then((r) => r.json())
      .then((d) => setBuyers(d.buyers ?? []));
  }, []);

  useEffect(() => {
    loadPurchases();
    searchBuyers("");
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products ?? []));
  }, [searchBuyers]);

  useEffect(() => {
    if (buyerId) return;
    const timer = setTimeout(() => searchBuyers(buyerSearch), 300);
    return () => clearTimeout(timer);
  }, [buyerSearch, searchBuyers, buyerId]);

  const selectBuyer = (buyer: Buyer) => {
    setBuyerId(buyer.id);
    setSelectedBuyerData(buyer);
    setBuyerSearch(`${buyer.name} (${buyer.phone})`);
  };

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
        setBuyerSearch("");
        setSelectedBuyerData(null);
        setPaidAmount(0);
        loadPurchases();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Purchase failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `Create purchase for ${formatCurrency(totalCost)}?` });
  };

  const handleUpdatePayment = () => {
    if (!editingPurchase) return;
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/purchases/${editingPurchase.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paidAmount: editPaidAmount }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setEditingPurchase(null);
        loadPurchases();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Update failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `Update paid amount to ${formatCurrency(editPaidAmount)}?` });
  };

  const selectedBuyer = selectedBuyerData ?? buyers.find((b) => b.id === buyerId) ?? null;
  const buyerSuggestions = buyerSearch && !buyerId
    ? buyers.filter(
        (b) =>
          b.name.toLowerCase().includes(buyerSearch.toLowerCase()) ||
          b.phone.includes(buyerSearch.replace(/\D/g, ""))
      )
    : [];

  return (
    <div>
      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-semibold">How to add stock:</p>
        <p className="mt-1">1. Create product in Products → 2. Add buyer in Buyers → 3. New Purchase here (qty = number of bags) → 4. Stock appears in Sell Counter</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">{t.purchases.title}</h1>
        <Button className="min-h-11 shrink-0" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> {t.purchases.newPurchase}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="relative">
              <Label>{t.purchases.selectBuyer}</Label>
              <Input
                placeholder={t.buyers.searchByNameOrPhone}
                value={buyerSearch}
                onChange={(e) => {
                  setBuyerSearch(e.target.value);
                  setBuyerId("");
                  setSelectedBuyerData(null);
                }}
                className="mb-2"
              />
              {selectedBuyer && (
                <p className="mb-2 text-xs text-emerald-600">
                  Selected: {selectedBuyer.name} ({selectedBuyer.phone})
                </p>
              )}
              {buyerSuggestions.length > 0 && !buyerId && buyerSearch && (
                <div className="absolute z-20 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
                  {buyerSuggestions.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => selectBuyer(b)}
                      className="flex w-full flex-col items-start px-3 py-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    >
                      <span className="font-medium">{b.name}</span>
                      <span className="text-xs text-gray-500">{b.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {buyerSearch && !buyerId && buyerSuggestions.length === 0 && (
                <p className="text-xs text-orange-600">No buyer found. Add buyer first in Buyers page.</p>
              )}
            </div>
            <div>
              <Label>{t.common.paid}</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={formatOptionalAmount(paidAmount)}
                onChange={(e) => setPaidAmount(parseOptionalAmountInput(e.target.value))}
              />
              <p className="mt-1 text-xs text-gray-500">
                Total: {formatCurrency(totalCost)} · Due: {formatCurrency(Math.max(0, totalCost - paidAmount))}
              </p>
            </div>
          </div>

          <div className="mb-4 mt-4 space-y-2">
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
                  <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <Label>{t.purchases.costPerUnit}</Label>
                  <Input type="number" value={item.costPricePerUnit} onChange={(e) => updateItem(idx, "costPricePerUnit", parseFloat(e.target.value) || 0)} />
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
            <Button className="min-h-11" variant="outline" onClick={addItem} disabled={products.length === 0}>
              <Plus size={16} /> {t.purchases.addItem}
            </Button>
            <span className="font-bold sm:ml-auto">{t.common.total}: {formatCurrency(totalCost)}</span>
            <Button className="min-h-11" onClick={handleCreate} disabled={!buyerId || items.length === 0}>{t.common.save}</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {purchases.map((p) => (
          <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex justify-between items-start gap-3">
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
              {p.items.map((i) => `${i.product.name} ×${i.quantity} bags`).join(", ")}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span>{t.common.paid}: <strong>{formatCurrency(p.paidAmount)}</strong></span>
              <span>{t.common.due}: <strong className="text-orange-600">{formatCurrency(p.dueAmount)}</strong></span>
              <Button
                size="sm"
                variant="outline"
                className="min-h-9"
                onClick={() => {
                  setEditingPurchase(p);
                  setEditPaidAmount(Number(p.paidAmount));
                }}
              >
                <Pencil size={14} /> Update Payment
              </Button>
            </div>
          </div>
        ))}
        {purchases.length === 0 && <p className="text-center text-gray-500 py-8">{t.common.noData}</p>}
      </div>

      {editingPurchase && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingPurchase(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--card)] p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Update Payment</h3>
            <p className="mt-1 text-sm text-gray-500">{editingPurchase.buyer.name}</p>
            <p className="text-sm">Total: {formatCurrency(editingPurchase.totalCost)}</p>
            <div className="mt-4">
              <Label>{t.common.paid}</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={formatOptionalAmount(editPaidAmount)}
                onChange={(e) => setEditPaidAmount(parseOptionalAmountInput(e.target.value))}
              />
              <p className="mt-1 text-xs text-gray-500">
                Due after update: {formatCurrency(Math.max(0, Number(editingPurchase.totalCost) - editPaidAmount))}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="outline" className="min-h-11" onClick={() => setEditingPurchase(null)}>{t.common.cancel}</Button>
              <Button className="min-h-11" onClick={handleUpdatePayment}>{t.common.save}</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmState.open} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={close} loading={loading} />
    </div>
  );
}
