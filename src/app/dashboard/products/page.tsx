"use client";

import { useEffect, useState } from "react";
import { Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency } from "@/lib/utils";
import { KHUCRA_PRESETS } from "@/lib/inventory/khucra";

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

export default function ProductsPage() {
  const { t } = useI18n();
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    imageUrl: "",
    weightUnit: "BAG",
    basePackageSize: 50000,
    sellPrice: 0,
    allowedSellUnits: [100, 250, 500, 1000],
  });

  const load = () => fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products ?? []));
  useEffect(() => { load(); }, []);

  const handleCreate = () => {
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setShowForm(false);
        setForm({ name: "", imageUrl: "", weightUnit: "BAG", basePackageSize: 50000, sellPrice: 0, allowedSellUnits: [100, 250, 500, 1000] });
        load();
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `Add product "${form.name}"?` });
  };

  const toggleSellUnit = (value: number) => {
    setForm((f) => ({
      ...f,
      allowedSellUnits: f.allowedSellUnits.includes(value)
        ? f.allowedSellUnits.filter((u) => u !== value)
        : [...f.allowedSellUnits, value],
    }));
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">{t.products.title}</h1>
        <Button className="min-h-11 shrink-0" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> {t.products.addProduct}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{t.products.productName}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{t.products.image} (Cloudinary URL)</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>{t.products.weightUnit}</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-600 dark:bg-gray-900"
                value={form.weightUnit}
                onChange={(e) => setForm({ ...form, weightUnit: e.target.value })}
              >
                {["BAG", "KG", "GRAM", "LITER", "ML", "PIECE", "GENERIC"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t.products.basePackageSize} (e.g. 50000 for 50kg bag)</Label>
              <Input
                type="number"
                value={form.basePackageSize}
                onChange={(e) => setForm({ ...form, basePackageSize: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>{t.products.sellPrice}</Label>
              <Input
                type="number"
                value={form.sellPrice}
                onChange={(e) => setForm({ ...form, sellPrice: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <Label>{t.products.allowedSellUnits}</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {KHUCRA_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => toggleSellUnit(p.value)}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      form.allowedSellUnits.includes(p.value)
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => toggleSellUnit(form.basePackageSize)}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    form.allowedSellUnits.includes(form.basePackageSize)
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  Full Bag
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleCreate} disabled={!form.name || loading}>{t.common.save}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <div className="h-32 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <Package size={48} className="text-gray-400" />
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-xs text-gray-500">{p.productId}</p>
                </div>
                <span className="text-sm font-medium text-emerald-600">{formatCurrency(p.sellPrice)}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-gray-500">
                <p>{t.products.stock}: <strong className="text-gray-900 dark:text-white">{p.inventory.formattedTotal}</strong></p>
                <p>{t.products.closedBags}: <strong>{p.inventory.closedBags}</strong></p>
                {p.inventory.formattedOpenBag && (
                  <p>{t.products.openBag}: <strong>{p.inventory.formattedOpenBag}</strong></p>
                )}
              </div>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="col-span-full text-center text-gray-500 py-12">{t.common.noData}</p>
        )}
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
