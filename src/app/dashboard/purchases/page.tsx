"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NumberInput, Select } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface Buyer { id: string; name: string; phone: string; }
interface Product {
  id: string;
  name: string;
  productId: string;
  defaultCostPrice?: number | null;
  defaultTpPrice?: number | null;
}
interface PurchaseItem {
  productId: string;
  quantity: number;
  costPricePerUnit: number;
  costPriceTotal: number;
  tpPricePerUnit: number;
  tpPriceTotal: number;
}
interface PurchaseItemRow {
  id: string;
  quantity: number;
  costPricePerUnit: number;
  costPriceTotal: number;
  tpPricePerUnit?: number | null;
  tpPriceTotal?: number | null;
  product: { id: string; name: string; defaultTpPrice?: number | null };
}
interface LegacyTpLine {
  itemId: string;
  productName: string;
  quantity: number;
  costPricePerUnit: number;
  tpPricePerUnit: number;
}
interface Purchase {
  id: string;
  totalCost: number;
  totalTpAmount?: number | null;
  payableTotal?: number;
  pricingModel: string;
  paidAmount: number;
  dueAmount: number;
  status: string;
  createdAt: string;
  buyer: { name: string };
  items: PurchaseItemRow[];
}

function payableTotal(p: Pick<Purchase, "pricingModel" | "totalCost" | "totalTpAmount" | "payableTotal">) {
  if (p.payableTotal != null) return p.payableTotal;
  if (p.pricingModel === "DUAL" && p.totalTpAmount != null) return p.totalTpAmount;
  return p.totalCost;
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
  const [legacyTpPurchase, setLegacyTpPurchase] = useState<Purchase | null>(null);
  const [legacyTpLines, setLegacyTpLines] = useState<LegacyTpLine[]>([]);

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

  const productDefaults = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    return {
      cost: p?.defaultCostPrice ?? 0,
      tp: p?.defaultTpPrice ?? 0,
    };
  };

  const recalcLine = (line: PurchaseItem): PurchaseItem => {
    const qty = Number(line.quantity) || 0;
    const costUnit = Number(line.costPricePerUnit) || 0;
    const tpUnit = Number(line.tpPricePerUnit) || 0;
    return {
      ...line,
      costPriceTotal: qty * costUnit,
      tpPriceTotal: tpUnit > 0 ? qty * tpUnit : 0,
    };
  };

  const addItem = () => {
    if (products.length === 0) return;
    const p = products[0];
    const defaults = productDefaults(p.id);
    setItems([
      ...items,
      recalcLine({
        productId: p.id,
        quantity: 0,
        costPricePerUnit: defaults.cost,
        costPriceTotal: 0,
        tpPricePerUnit: defaults.tp,
        tpPriceTotal: 0,
      }),
    ]);
  };

  const updateItem = (idx: number, field: keyof PurchaseItem, value: number | string) => {
    const updated = [...items];
    let line = { ...updated[idx], [field]: value };

    if (field === "productId") {
      const defaults = productDefaults(String(value));
      line = {
        ...line,
        costPricePerUnit: defaults.cost,
        tpPricePerUnit: defaults.tp,
      };
    }

    updated[idx] = recalcLine(line);
    setItems(updated);
  };

  const totalCost = items.reduce((s, i) => s + i.costPriceTotal, 0);
  const totalTp = items.reduce((s, i) => s + i.tpPriceTotal, 0);
  const useDualTp = totalTp > 0;
  const supplierPayable = useDualTp ? totalTp : totalCost;

  const tpLineError = items.some(
    (i) => i.tpPricePerUnit > 0 && (i.costPricePerUnit <= 0 || i.tpPricePerUnit < i.costPricePerUnit)
  );

  const purchaseFormValid =
    Boolean(buyerId) &&
    items.length > 0 &&
    items.every((i) => i.quantity > 0 && i.costPricePerUnit > 0) &&
    !tpLineError;

  const handleCreate = () => {
    confirm(async () => {
      setLoading(true);
      try {
        const payloadItems = items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          costPricePerUnit: i.costPricePerUnit,
          costPriceTotal: i.costPriceTotal,
          ...(i.tpPricePerUnit > 0
            ? { tpPricePerUnit: i.tpPricePerUnit, tpPriceTotal: i.tpPriceTotal }
            : {}),
        }));
        const res = await fetch("/api/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buyerId, paidAmount, items: payloadItems }),
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
    }, {
      message: useDualTp
        ? `Create purchase? Book cost ${formatCurrency(totalCost)}, supplier payable ${formatCurrency(supplierPayable)}`
        : `Create purchase for ${formatCurrency(totalCost)}?`,
    });
  };

  const handleUpdatePayment = () => {
    if (!editingPurchase) return;
    const total = payableTotal(editingPurchase);
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

  const openLegacyTpModal = (purchase: Purchase) => {
    setLegacyTpPurchase(purchase);
    setLegacyTpLines(
      purchase.items.map((item) => ({
        itemId: item.id,
        productName: item.product.name,
        quantity: item.quantity,
        costPricePerUnit: item.costPricePerUnit,
        tpPricePerUnit:
          Number(item.product.defaultTpPrice ?? 0) ||
          item.costPricePerUnit,
      }))
    );
  };

  const legacyTpTotal = legacyTpLines.reduce(
    (s, l) => s + l.quantity * (Number(l.tpPricePerUnit) || 0),
    0
  );
  const legacyTpValid =
    legacyTpLines.length > 0 &&
    legacyTpLines.every(
      (l) =>
        l.tpPricePerUnit > 0 &&
        l.costPricePerUnit > 0 &&
        l.tpPricePerUnit >= l.costPricePerUnit
    );

  const handleApplyLegacyTp = () => {
    if (!legacyTpPurchase || !legacyTpValid) return;
    const paid = Number(legacyTpPurchase.paidAmount);
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/purchases/${legacyTpPurchase.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legacyTpItems: legacyTpLines.map((l) => ({
              itemId: l.itemId,
              tpPricePerUnit: l.tpPricePerUnit,
            })),
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setLegacyTpPurchase(null);
        setLegacyTpLines([]);
        loadPurchases();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Update failed");
      } finally {
        setLoading(false);
        close();
      }
    }, {
      message: `${t.purchases.legacyTpConfirm} ${t.purchases.supplierPayable}: ${formatCurrency(legacyTpTotal)} · ${t.common.due}: ${formatCurrency(Math.max(0, legacyTpTotal - paid))}`,
    });
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
      <div className="mb-4 rounded-xl border border-[var(--info-border)] bg-[var(--info-bg)] p-4 text-sm text-[var(--info-text)]">
        <p className="font-semibold">How to add stock:</p>
        <p className="mt-1">1. Create product in Products → 2. Add supplier in Suppliers → 3. New Purchase here (qty = number of bags) → 4. Stock appears in Sell Counter</p>
        <p className="mt-1 opacity-90">{t.purchases.dualPricingHelp}</p>
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
              <Label>{t.purchases.selectSupplier}</Label>
              <Input
                placeholder={t.suppliers.searchByNameOrPhone}
                value={buyerSearch}
                required
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
                <p className="text-xs text-orange-600">{t.suppliers.noSupplierFound}</p>
              )}
            </div>
            <div>
              <Label>{t.common.paid}</Label>
              <NumberInput
                min={0}
                placeholder={t.common.enterAmount}
                value={paidAmount}
                onChange={setPaidAmount}
              />
              <p className="mt-1 text-xs text-gray-500">
                {useDualTp ? (
                  <>
                    {t.purchases.supplierPayable}: {formatCurrency(supplierPayable)} ·{" "}
                    {t.purchases.bookCost}: {formatCurrency(totalCost)} ·{" "}
                    {t.common.due}: {formatCurrency(Math.max(0, supplierPayable - paidAmount))}
                  </>
                ) : (
                  <>
                    {t.common.total}: {formatCurrency(totalCost)} · {t.common.due}:{" "}
                    {formatCurrency(Math.max(0, totalCost - paidAmount))}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="mb-4 mt-4 space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 items-end gap-3 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="sm:col-span-2">
                  <Label>{t.purchases.selectProduct}</Label>
                  <Select
                    value={item.productId}
                    required
                    onChange={(e) => updateItem(idx, "productId", e.target.value)}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.productId})</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Qty (bags) *</Label>
                  <NumberInput
                    required
                    placeholder={t.common.enterQty}
                    value={item.quantity}
                    onChange={(v) => updateItem(idx, "quantity", v)}
                  />
                </div>
                <div>
                  <Label>{t.purchases.costPerUnit} *</Label>
                  <NumberInput
                    required
                    placeholder={t.common.enterPrice}
                    value={item.costPricePerUnit}
                    onChange={(v) => updateItem(idx, "costPricePerUnit", v)}
                  />
                </div>
                <div>
                  <Label>{t.purchases.tpPerUnit}</Label>
                  <NumberInput
                    placeholder={t.common.enterPrice}
                    value={item.tpPricePerUnit}
                    onChange={(v) => updateItem(idx, "tpPricePerUnit", v)}
                  />
                  {item.tpPricePerUnit > 0 && item.tpPricePerUnit < item.costPricePerUnit && (
                    <p className="mt-1 text-xs text-red-600">{t.purchases.tpMustBeAtLeastCost}</p>
                  )}
                </div>
                <div className="flex min-h-10 flex-col justify-center gap-1 sm:col-span-2 lg:col-span-1">
                  <span className="text-xs text-gray-500">
                    {t.purchases.costTotal}: {formatCurrency(item.costPriceTotal)}
                  </span>
                  {item.tpPriceTotal > 0 && (
                    <span className="text-xs text-emerald-700">
                      {t.purchases.tpTotal}: {formatCurrency(item.tpPriceTotal)}
                    </span>
                  )}
                  <button
                    type="button"
                    className="flex min-h-9 w-9 items-center justify-center self-end"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  >
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
            <div className="text-right sm:ml-auto">
              <p className="text-sm text-gray-500">
                {t.purchases.bookCost}: <strong>{formatCurrency(totalCost)}</strong>
              </p>
              {useDualTp && (
                <p className="font-bold text-[var(--foreground)]">
                  {t.purchases.supplierPayable}: {formatCurrency(supplierPayable)}
                </p>
              )}
              {!useDualTp && (
                <p className="font-bold text-[var(--foreground)]">{t.common.total}: {formatCurrency(totalCost)}</p>
              )}
            </div>
            <Button className="min-h-11" onClick={handleCreate} disabled={!purchaseFormValid || loading}>{t.common.save}</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {purchases.map((p) => {
          const payTotal = payableTotal(p);
          const isDual = p.pricingModel === "DUAL" && p.totalTpAmount != null;
          return (
            <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="font-semibold">{p.buyer.name}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(p.createdAt, locale)}</p>
                  {isDual && (
                    <p className="text-xs text-emerald-700">{t.purchases.dualPricingBadge}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency(payTotal)}</p>
                  {isDual && (
                    <p className="text-xs text-gray-500">
                      {t.purchases.bookCost}: {formatCurrency(p.totalCost)}
                    </p>
                  )}
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
                {p.pricingModel === "LEGACY" && p.dueAmount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-9 border-emerald-300 text-emerald-800"
                    onClick={() => openLegacyTpModal(p)}
                  >
                    {t.purchases.setLegacyTp}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-9"
                  onClick={() => {
                    setEditingPurchase(p);
                    setEditPaidAmount(Number(p.paidAmount));
                  }}
                >
                  <Pencil size={14} /> {t.purchases.updatePayment}
                </Button>
              </div>
            </div>
          );
        })}
        {purchases.length === 0 && <p className="text-center text-gray-500 py-8">{t.common.noData}</p>}
      </div>

      {editingPurchase && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingPurchase(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--card)] p-5 shadow-xl">
            <h3 className="text-lg font-semibold">{t.purchases.updatePayment}</h3>
            <p className="mt-1 text-sm text-gray-500">{editingPurchase.buyer.name}</p>
            <p className="text-sm">
              {editingPurchase.pricingModel === "DUAL"
                ? `${t.purchases.supplierPayable}: ${formatCurrency(payableTotal(editingPurchase))}`
                : `${t.common.total}: ${formatCurrency(editingPurchase.totalCost)}`}
            </p>
            {editingPurchase.pricingModel === "DUAL" && (
              <p className="text-xs text-gray-500">
                {t.purchases.bookCost}: {formatCurrency(editingPurchase.totalCost)}
              </p>
            )}
            <div className="mt-4">
              <Label>{t.common.paid}</Label>
              <NumberInput
                placeholder={t.common.enterAmount}
                value={editPaidAmount}
                onChange={setEditPaidAmount}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t.common.due}: {formatCurrency(Math.max(0, payableTotal(editingPurchase) - editPaidAmount))}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="outline" className="min-h-11" onClick={() => setEditingPurchase(null)}>{t.common.cancel}</Button>
              <Button className="min-h-11" onClick={handleUpdatePayment}>{t.common.save}</Button>
            </div>
          </div>
        </div>
      )}

      {legacyTpPurchase && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setLegacyTpPurchase(null)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--card)] p-5 shadow-xl">
            <h3 className="text-lg font-semibold">{t.purchases.legacyTpTitle}</h3>
            <p className="mt-1 text-sm text-gray-500">{legacyTpPurchase.buyer.name}</p>
            <p className="mt-2 text-sm text-[var(--info-text)]">{t.purchases.legacyTpHelp}</p>
            <p className="mt-2 text-sm">
              {t.purchases.bookCost}: {formatCurrency(legacyTpPurchase.totalCost)} ·{" "}
              {t.common.paid}: {formatCurrency(legacyTpPurchase.paidAmount)}
            </p>
            <div className="mt-4 space-y-3">
              {legacyTpLines.map((line, idx) => (
                <div key={line.itemId} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="text-sm font-medium">{line.productName}</p>
                  <p className="text-xs text-gray-500">
                    {line.quantity} bags · {t.purchases.costPerUnit}: {formatCurrency(line.costPricePerUnit)}
                  </p>
                  <div className="mt-2">
                    <Label>{t.purchases.tpPerUnit}</Label>
                    <NumberInput
                      placeholder={t.common.enterPrice}
                      value={line.tpPricePerUnit}
                      onChange={(v) => {
                        const updated = [...legacyTpLines];
                        updated[idx] = { ...line, tpPricePerUnit: v };
                        setLegacyTpLines(updated);
                      }}
                    />
                    {line.tpPricePerUnit > 0 && line.tpPricePerUnit < line.costPricePerUnit && (
                      <p className="mt-1 text-xs text-red-600">{t.purchases.tpMustBeAtLeastCost}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm">
              {t.purchases.supplierPayable}: <strong>{formatCurrency(legacyTpTotal)}</strong> ·{" "}
              {t.common.due}:{" "}
              <strong className="text-orange-600">
                {formatCurrency(Math.max(0, legacyTpTotal - Number(legacyTpPurchase.paidAmount)))}
              </strong>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="outline" className="min-h-11" onClick={() => setLegacyTpPurchase(null)}>
                {t.common.cancel}
              </Button>
              <Button className="min-h-11" onClick={handleApplyLegacyTp} disabled={!legacyTpValid || loading}>
                {t.common.save}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmState.open} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={close} loading={loading} />
    </div>
  );
}
