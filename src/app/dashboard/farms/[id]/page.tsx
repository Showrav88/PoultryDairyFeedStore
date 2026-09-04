"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Minus, Package, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NumberInput } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { ANIMAL_TYPE_LABELS } from "@/lib/farms/wallet";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
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
  validateStockForLine,
} from "@/lib/inventory/cart-stock";

type Tab = "summary" | "issue" | "returns" | "expenses" | "livestock";
type SellMode = "khucra" | "full_bag" | "custom";

interface Product {
  id: string;
  name: string;
  weightUnit: string;
  basePackageSize: number;
  allowedSellUnits: number[];
  inventory: {
    totalStock: number;
    formattedTotal: string;
    closedBags: number;
    avgCostPerSmallestUnit?: number | null;
  };
}

interface CartItem {
  productId: string;
  productName: string;
  quantityInSmallestUnit: number;
  unitCount: number;
}

interface FarmReturn {
  id: string;
  status: string;
  totalCost: number;
  notes?: string;
  createdAt: string;
  items: { sellUnitLabel: string; costTotal: number; product: { name: string } }[];
}

export default function FarmDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [tab, setTab] = useState<Tab>("summary");
  const [farm, setFarm] = useState<Record<string, unknown> | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Issue feed state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sellMode, setSellMode] = useState<SellMode>("khucra");
  const [sellUnit, setSellUnit] = useState(250);
  const [unitCount, setUnitCount] = useState(1);
  const [customAmount, setCustomAmount] = useState(0);
  const [customUnit, setCustomUnit] = useState<CustomSellUnit>("KG");
  const [issueNotes, setIssueNotes] = useState("");
  const [stockError, setStockError] = useState("");

  // Return state
  const [returns, setReturns] = useState<FarmReturn[]>([]);
  const [returnCart, setReturnCart] = useState<CartItem[]>([]);
  const [returnNotes, setReturnNotes] = useState("");

  // Expense state
  const [expType, setExpType] = useState("SALARY");
  const [expAmount, setExpAmount] = useState(0);
  const [expDesc, setExpDesc] = useState("");

  // Livestock state
  const [lsType, setLsType] = useState<"BUY" | "SELL">("BUY");
  const [lsDesc, setLsDesc] = useState("");
  const [lsQty, setLsQty] = useState(1);
  const [lsAmount, setLsAmount] = useState(0);
  const [lsNotes, setLsNotes] = useState("");

  const animalLabel = (type: string) => {
    const labels = ANIMAL_TYPE_LABELS[type];
    return labels ? (locale === "bn" ? labels.bn : labels.en) : type;
  };

  const loadFarm = useCallback(() => {
    fetch(`/api/farms/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setFarm(d.farm);
        setSummary(d.summary);
      });
  }, [id]);

  const loadProducts = useCallback(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
  }, []);

  const loadReturns = useCallback(() => {
    fetch(`/api/farms/${id}/returns`)
      .then((r) => r.json())
      .then((d) => setReturns(d.returns ?? []));
  }, [id]);

  useEffect(() => {
    loadFarm();
    loadProducts();
    loadReturns();
  }, [loadFarm, loadProducts, loadReturns]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "summary", label: t.farms.summary },
    { key: "issue", label: t.farms.issueFeed },
    { key: "returns", label: t.farms.returns },
    { key: "expenses", label: t.farms.expenses },
    { key: "livestock", label: t.farms.livestock },
  ];

  const getAvailable = (productId: string, totalStock: number) =>
    getAvailableStock(totalStock, cart, productId);

  const effectiveSellUnit = () => {
    if (!selectedProduct) return sellUnit;
    if (sellMode === "full_bag") return selectedProduct.basePackageSize;
    if (sellMode === "custom") return parseCustomSellAmount(customAmount, customUnit);
    return sellUnit;
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    const qty = effectiveSellUnit();
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
    setStockError("");
    setCart([
      ...cart,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantityInSmallestUnit: qty,
        unitCount,
      },
    ]);
    setSelectedProduct(null);
  };

  const submitIssue = () => {
    if (cart.length === 0) return;
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/farms/${id}/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: issueNotes || undefined,
            items: cart.map((c) => ({
              productId: c.productId,
              quantityInSmallestUnit: c.quantityInSmallestUnit,
              unitCount: c.unitCount,
            })),
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setCart([]);
        setIssueNotes("");
        loadFarm();
        loadProducts();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Issue failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: t.farms.confirmIssue });
  };

  const addToReturnCart = (p: Product, qty: number, count: number) => {
    setReturnCart([
      ...returnCart,
      { productId: p.id, productName: p.name, quantityInSmallestUnit: qty, unitCount: count },
    ]);
  };

  const submitReturn = () => {
    if (returnCart.length === 0) return;
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/farms/${id}/returns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: returnNotes || undefined,
            items: returnCart.map((c) => ({
              productId: c.productId,
              quantityInSmallestUnit: c.quantityInSmallestUnit,
              unitCount: c.unitCount,
            })),
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setReturnCart([]);
        setReturnNotes("");
        loadReturns();
        loadFarm();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Return failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: t.farms.confirmReturn });
  };

  const handleReturnAction = (returnId: string, action: "approve" | "reject") => {
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/farms/${id}/returns/${returnId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        loadReturns();
        loadFarm();
        loadProducts();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Action failed");
      } finally {
        setLoading(false);
        close();
      }
    }, {
      message: action === "approve" ? t.farms.approveReturn : t.farms.rejectReturn,
    });
  };

  const submitExpense = () => {
    if (expAmount <= 0) return;
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/farms/${id}/expenses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: expType, amount: expAmount, description: expDesc || undefined }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setExpAmount(0);
        setExpDesc("");
        loadFarm();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Expense failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: t.farms.confirmExpense });
  };

  const submitLivestock = () => {
    if (!lsDesc || lsAmount <= 0) return;
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/farms/${id}/livestock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: lsType,
            description: lsDesc,
            quantity: lsQty,
            amount: lsAmount,
            notes: lsNotes || undefined,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setLsDesc("");
        setLsAmount(0);
        setLsQty(1);
        setLsNotes("");
        loadFarm();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: t.farms.confirmLivestock });
  };

  if (!farm) {
    return <div className="p-4 text-gray-500">{t.common.loading}</div>;
  }

  const farmData = farm as {
    name: string;
    animalType: string;
    location?: string;
    notes?: string;
    issues?: { id: string; totalCost: number; createdAt: string; items: { sellUnitLabel: string; costTotal: number; product: { name: string } }[] }[];
    expenses?: { id: string; type: string; amount: number; description?: string; createdAt: string }[];
    livestock?: { id: string; type: string; description: string; quantity: number; amount: number; createdAt: string }[];
  };

  return (
    <div>
      <Link href="/dashboard/farms" className="mb-4 inline-flex items-center gap-1 text-sm text-emerald-600">
        <ArrowLeft size={16} /> {t.farms.backToFarms}
      </Link>

      <div className="mb-4">
        <h1 className="text-xl font-bold sm:text-2xl">{farmData.name}</h1>
        <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
          {animalLabel(farmData.animalType)}
        </span>
        {farmData.location && <p className="mt-1 text-sm text-gray-500">{farmData.location}</p>}
      </div>

      <div className="mb-4 flex flex-wrap gap-1 overflow-x-auto">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "bg-emerald-600 text-white"
                : "bg-[var(--border)]/30 text-[var(--muted)] hover:bg-[var(--border)]/50"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" && summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: t.farms.feedIssuedCost, value: summary.feedIssuedCost },
            { label: t.farms.expenses, value: summary.expenses },
            { label: t.farms.livestockBuy, value: summary.livestockBuy },
            { label: t.farms.livestockSell, value: summary.livestockSell },
            { label: t.farms.netLivestock, value: summary.netLivestock },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-bold">{formatCurrency(value)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "issue" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-[var(--info-text)]">{t.farms.issueHelp}</p>
            <div className="space-y-2">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProduct(p);
                    setSellUnit(p.allowedSellUnits[0] ?? 250);
                    setUnitCount(1);
                    setSellMode("khucra");
                    setStockError("");
                  }}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    selectedProduct?.id === p.id
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-[var(--border)] bg-[var(--card)] hover:border-emerald-300"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Package size={16} />
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {t.sell.availableStock}: {p.inventory.formattedTotal}
                    {p.inventory.closedBags > 0 && ` · ${p.inventory.closedBags} bags`}
                  </p>
                  {getAvailable(p.id, p.inventory.totalStock) <
                    p.inventory.totalStock * 0.2 &&
                    p.inventory.totalStock > 0 && (
                      <p className="mt-1 text-xs text-amber-600">{t.farms.lowStockWarning}</p>
                    )}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            {selectedProduct ? (
              <div className="space-y-3">
                <p className="font-semibold">{selectedProduct.name}</p>
                <div className="flex flex-wrap gap-1">
                  {(["khucra", "full_bag", "custom"] as SellMode[]).map((mode) => {
                    if (mode === "full_bag" && !supportsFullPackageSale(selectedProduct.weightUnit)) return null;
                    return (
                      <button
                        key={mode}
                        onClick={() => setSellMode(mode)}
                        className={cn(
                          "rounded-lg px-2 py-1 text-xs",
                          sellMode === mode ? "bg-emerald-600 text-white" : "bg-[var(--border)]/40"
                        )}
                      >
                        {mode === "khucra" ? t.sell.khucra : mode === "full_bag" ? t.sell.fullBag : t.sell.customAmount}
                      </button>
                    );
                  })}
                </div>
                {sellMode === "khucra" && (
                  <div className="flex flex-wrap gap-1">
                    {getKhucraSellUnits(selectedProduct.allowedSellUnits, selectedProduct.basePackageSize).map(
                      (u) => (
                        <button
                          key={u}
                          onClick={() => setSellUnit(u)}
                          className={cn(
                            "rounded-lg px-2 py-1 text-xs",
                            sellUnit === u ? "bg-emerald-600 text-white" : "bg-[var(--border)]/40"
                          )}
                        >
                          {formatSellUnitLabel(u, selectedProduct.weightUnit, selectedProduct.basePackageSize)}
                        </button>
                      )
                    )}
                  </div>
                )}
                {sellMode === "full_bag" && (
                  <p className="text-sm">{formatFullPackageLabel(selectedProduct.basePackageSize, selectedProduct.weightUnit)}</p>
                )}
                {sellMode === "custom" && (
                  <div className="flex gap-2">
                    <NumberInput value={customAmount} onChange={setCustomAmount} />
                    <select
                      className="rounded-lg border border-[var(--border)] px-2 text-sm"
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value as CustomSellUnit)}
                    >
                      {getCustomUnitOptions(selectedProduct.weightUnit).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Label>{t.sell.quantity}</Label>
                  <Button size="sm" variant="outline" onClick={() => setUnitCount(Math.max(1, unitCount - 1))}>
                    <Minus size={14} />
                  </Button>
                  <span className="w-8 text-center">{unitCount}</span>
                  <Button size="sm" variant="outline" onClick={() => setUnitCount(unitCount + 1)}>
                    <Plus size={14} />
                  </Button>
                </div>
                {stockError && <p className="text-sm text-red-500">{stockError}</p>}
                <Button onClick={addToCart}>{t.farms.addToIssue}</Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t.farms.selectProductIssue}</p>
            )}

            {cart.length > 0 && (
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <p className="mb-2 font-semibold">{t.farms.issueCart}</p>
                {cart.map((c, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>
                      {c.productName} × {formatSellUnitLabel(c.quantityInSmallestUnit, "GRAM", 50000)} × {c.unitCount}
                    </span>
                    <button onClick={() => setCart(cart.filter((_, j) => j !== i))} className="text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div className="mt-2">
                  <Label>{t.common.notes}</Label>
                  <Input value={issueNotes} onChange={(e) => setIssueNotes(e.target.value)} />
                </div>
                <Button className="mt-3 w-full" onClick={submitIssue}>
                  {t.farms.confirmIssueBtn}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "returns" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--info-text)]">{t.farms.returnHelp}</p>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="mb-2 font-semibold">{t.farms.newReturn}</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {products.slice(0, 6).map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="outline"
                  onClick={() => addToReturnCart(p, p.basePackageSize, 1)}
                >
                  {p.name} (1 bag)
                </Button>
              ))}
            </div>
            {returnCart.map((c, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{c.productName} × {c.unitCount}</span>
                <button onClick={() => setReturnCart(returnCart.filter((_, j) => j !== i))}>
                  <X size={14} className="text-red-500" />
                </button>
              </div>
            ))}
            <Input
              className="mt-2"
              placeholder={t.common.notes}
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
            />
            <Button className="mt-2" disabled={returnCart.length === 0} onClick={submitReturn}>
              {t.farms.submitReturn}
            </Button>
          </div>

          <div className="space-y-2">
            {returns.map((r) => (
              <div key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        r.status === "PENDING" && "bg-amber-100 text-amber-800",
                        r.status === "APPROVED" && "bg-green-100 text-green-800",
                        r.status === "REJECTED" && "bg-red-100 text-red-800"
                      )}
                    >
                      {r.status}
                    </span>
                    <p className="mt-1 text-sm">{formatCurrency(r.totalCost)} · {formatDateTime(r.createdAt)}</p>
                    {r.items.map((item, i) => (
                      <p key={i} className="text-xs text-gray-500">
                        {item.product.name} — {item.sellUnitLabel}
                      </p>
                    ))}
                  </div>
                  {r.status === "PENDING" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleReturnAction(r.id, "approve")}>
                        <Check size={14} /> {t.farms.approve}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReturnAction(r.id, "reject")}>
                        <X size={14} /> {t.farms.reject}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {returns.length === 0 && <p className="text-center text-gray-500">{t.common.noData}</p>}
          </div>
        </div>
      )}

      {tab === "expenses" && (
        <div className="max-w-md space-y-4">
          <p className="text-sm text-[var(--info-text)]">{t.farms.expenseHelp}</p>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
            <div>
              <Label>{t.farms.expenseType}</Label>
              <select
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                value={expType}
                onChange={(e) => setExpType(e.target.value)}
              >
                <option value="SALARY">{t.farms.salary}</option>
                <option value="BILL">{t.farms.bill}</option>
                <option value="UTILITY">{t.farms.utility}</option>
                <option value="OTHER">{t.wallet.other}</option>
              </select>
            </div>
            <div>
              <Label>{t.common.amount}</Label>
              <NumberInput value={expAmount} onChange={setExpAmount} />
            </div>
            <div>
              <Label>{t.common.notes}</Label>
              <Input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} />
            </div>
            <Button onClick={submitExpense} disabled={expAmount <= 0}>
              {t.farms.addExpense}
            </Button>
          </div>

          {(farmData.expenses ?? []).map((e) => (
            <div key={e.id} className="rounded-lg border border-[var(--border)] p-3 text-sm">
              <span className="font-medium">{e.type}</span> — {formatCurrency(Number(e.amount))}
              {e.description && <span className="text-gray-500"> · {e.description}</span>}
              <p className="text-xs text-gray-400">{formatDateTime(e.createdAt)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "livestock" && (
        <div className="max-w-md space-y-4">
          <p className="text-sm text-[var(--info-text)]">{t.farms.livestockHelp}</p>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
            <div className="flex gap-2">
              <Button
                variant={lsType === "BUY" ? "default" : "outline"}
                onClick={() => setLsType("BUY")}
              >
                {t.farms.buyLivestock}
              </Button>
              <Button
                variant={lsType === "SELL" ? "default" : "outline"}
                onClick={() => setLsType("SELL")}
              >
                {t.farms.sellLivestock}
              </Button>
            </div>
            <div>
              <Label>{t.farms.description}</Label>
              <Input
                value={lsDesc}
                onChange={(e) => setLsDesc(e.target.value)}
                placeholder={t.farms.livestockPlaceholder}
              />
            </div>
            <div>
              <Label>{t.farms.quantity}</Label>
              <NumberInput value={lsQty} onChange={setLsQty} />
            </div>
            <div>
              <Label>{t.common.amount}</Label>
              <NumberInput value={lsAmount} onChange={setLsAmount} />
            </div>
            <div>
              <Label>{t.common.notes}</Label>
              <Input value={lsNotes} onChange={(e) => setLsNotes(e.target.value)} />
            </div>
            <Button onClick={submitLivestock} disabled={!lsDesc || lsAmount <= 0}>
              {t.common.save}
            </Button>
          </div>

          {(farmData.livestock ?? []).map((l) => (
            <div key={l.id} className="rounded-lg border border-[var(--border)] p-3 text-sm">
              <span className={cn("font-medium", l.type === "BUY" ? "text-red-600" : "text-green-600")}>
                {l.type}
              </span>{" "}
              — {l.description} × {l.quantity} — {formatCurrency(Number(l.amount))}
              <p className="text-xs text-gray-400">{formatDateTime(l.createdAt)}</p>
            </div>
          ))}
        </div>
      )}

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
