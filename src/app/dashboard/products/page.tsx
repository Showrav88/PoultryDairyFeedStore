"use client";

import { useEffect, useState } from "react";
import { Plus, Package, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency } from "@/lib/utils";
import { PRODUCT_TYPE_TEMPLATES, getSellPresets } from "@/lib/inventory/sell-units";

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
  };
}

const defaultForm = {
  name: "",
  imageUrl: "",
  weightUnit: "BAG",
  basePackageSize: 50000,
  sellPrice: 0,
  allowedSellUnits: [100, 250, 500, 1000, 50000],
};

export default function ProductsPage() {
  const { t } = useI18n();
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const load = () => fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products ?? []));
  useEffect(() => { load(); }, []);

  const applyTemplate = (key: string) => {
    const tpl = PRODUCT_TYPE_TEMPLATES[key];
    if (!tpl) return;
    setForm((f) => ({
      ...f,
      weightUnit: tpl.weightUnit,
      basePackageSize: tpl.basePackageSize,
      allowedSellUnits: tpl.allowedSellUnits,
    }));
  };

  const toggleSellUnit = (value: number) => {
    setForm((f) => ({
      ...f,
      allowedSellUnits: f.allowedSellUnits.includes(value)
        ? f.allowedSellUnits.filter((u) => u !== value)
        : [...f.allowedSellUnits, value],
    }));
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      imageUrl: p.imageUrl ?? "",
      weightUnit: p.weightUnit,
      basePackageSize: p.basePackageSize,
      sellPrice: p.sellPrice,
      allowedSellUnits: p.allowedSellUnits,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  const handleSave = () => {
    confirm(async () => {
      setLoading(true);
      try {
        const url = editingId ? `/api/products/${editingId}` : "/api/products";
        const method = editingId ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        resetForm();
        load();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: editingId ? `Update product "${form.name}"?` : `Add product "${form.name}"?` });
  };

  const handleDelete = (p: Product) => {
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error);
        load();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Delete failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `Delete product "${p.name}"?` });
  };

  const presets = getSellPresets(form.weightUnit, form.basePackageSize);

  return (
    <div>
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/40">
        <p className="font-semibold">Product types:</p>
        <p className="mt-1">Feed = Bag + Khucra · Eggs/Medicine = Piece · Liquid = ml/Liter</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">{t.products.title}</h1>
        <Button className="min-h-11 shrink-0" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus size={18} /> {t.products.addProduct}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
          <h2 className="mb-3 font-semibold">{editingId ? "Edit Product" : "New Product"}</h2>
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(PRODUCT_TYPE_TEMPLATES).map(([key, tpl]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyTemplate(key)}
                className="rounded-full border border-gray-300 px-3 py-1 text-xs dark:border-gray-600"
              >
                {tpl.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{t.products.productName}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{t.products.image} (Cloudinary URL)</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            </div>
            <div>
              <Label>{t.products.weightUnit}</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-600 dark:bg-gray-900"
                value={form.weightUnit}
                onChange={(e) => setForm({ ...form, weightUnit: e.target.value })}
              >
                {["BAG", "PIECE", "GRAM", "KG", "LITER", "ML", "GENERIC"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t.products.basePackageSize}</Label>
              <Input type="number" value={form.basePackageSize} onChange={(e) => setForm({ ...form, basePackageSize: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <Label>{t.products.sellPrice}</Label>
              <Input type="number" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>{t.products.allowedSellUnits}</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => toggleSellUnit(p.value)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      form.allowedSellUnits.includes(p.value)
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} disabled={!form.name || loading}>{t.common.save}</Button>
            <Button variant="outline" onClick={resetForm}>{t.common.cancel}</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <div className="h-32 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" /> : <Package size={48} className="text-gray-400" />}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-xs text-gray-500">{p.productId} · {p.weightUnit}</p>
                </div>
                <span className="text-sm font-medium text-emerald-600">{formatCurrency(p.sellPrice)}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-gray-500">
                <p>{t.products.stock}: <strong className="text-gray-900 dark:text-white">{p.inventory.formattedTotal}</strong></p>
                {(p.weightUnit === "BAG" || p.weightUnit === "GRAM" || p.weightUnit === "KG") && (
                  <p>{t.products.closedBags}: <strong>{p.inventory.closedBags}</strong></p>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}><Pencil size={14} /> {t.common.edit}</Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(p)}><Trash2 size={14} className="text-red-500" /> {t.common.delete}</Button>
              </div>
            </div>
          </div>
        ))}
        {products.length === 0 && <p className="col-span-full text-center text-gray-500 py-12">{t.common.noData}</p>}
      </div>

      <ConfirmDialog open={confirmState.open} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={close} loading={loading} />
    </div>
  );
}
