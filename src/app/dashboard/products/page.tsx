"use client";

import { useEffect, useState } from "react";
import { Plus, Package, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NumberInput } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProductPriceHistoryPanel } from "@/components/products/product-price-history";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency } from "@/lib/utils";
import {
  PRODUCT_TYPE_TEMPLATES,
  buildSellUnitOptions,
  formatSellUnitLabel,
  generateFeedAllowedSellUnits,
  getSellPresets,
} from "@/lib/inventory/sell-units";
import {
  defaultPackageSizeForType,
  detectProductType,
  packageDisplaySize,
  packageToBaseSize,
  type ProductTypeKey,
} from "@/lib/inventory/product-type";

interface Product {
  id: string;
  productId: string;
  name: string;
  imageUrl?: string;
  weightUnit: string;
  basePackageSize: number;
  sellPrice: number;
  defaultCostPrice?: number | null;
  defaultTpPrice?: number | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [productType, setProductType] = useState<ProductTypeKey>("feed_bag");
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [packageSize, setPackageSize] = useState(defaultPackageSizeForType("feed_bag"));
  const [sellPrice, setSellPrice] = useState(0);
  const [defaultCostPrice, setDefaultCostPrice] = useState(0);
  const [defaultTpPrice, setDefaultTpPrice] = useState(0);
  const [allowedSellUnits, setAllowedSellUnits] = useState<number[]>(
    PRODUCT_TYPE_TEMPLATES.feed_bag.allowedSellUnits
  );

  const tpl = PRODUCT_TYPE_TEMPLATES[productType];

  const load = () => fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products ?? []));
  useEffect(() => { load(); }, []);

  const effectivePackageSize =
    packageSize > 0
      ? packageSize
      : tpl.defaultBagSizeKg ?? tpl.defaultBottleMl ?? tpl.basePackageSize;

  const basePackageGrams = packageToBaseSize(tpl.weightUnit, effectivePackageSize);

  useEffect(() => {
    if (productType === "feed_bag" && packageSize > 0) {
      setAllowedSellUnits(generateFeedAllowedSellUnits(basePackageGrams));
    }
  }, [productType, packageSize, basePackageGrams]);

  const applyTemplate = (key: ProductTypeKey) => {
    const template = PRODUCT_TYPE_TEMPLATES[key];
    setProductType(key);
    setAllowedSellUnits(template.allowedSellUnits);
    setPackageSize((current) =>
      current > 0 ? current : defaultPackageSizeForType(key)
    );
  };

  const toggleSellUnit = (value: number) => {
    setAllowedSellUnits((units) =>
      units.includes(value) ? units.filter((u) => u !== value) : [...units, value]
    );
  };

  const openEdit = (p: Product) => {
    const type = detectProductType(p.weightUnit, p.basePackageSize, p.allowedSellUnits);
    setEditingId(p.id);
    setProductType(type);
    setName(p.name);
    setImageUrl(p.imageUrl ?? "");
    const displaySize = packageDisplaySize(p.weightUnit, p.basePackageSize, type, p.allowedSellUnits);
    setPackageSize(
      displaySize > 0 ? displaySize : defaultPackageSizeForType(type)
    );
    setSellPrice(p.sellPrice);
    setDefaultCostPrice(p.defaultCostPrice ?? 0);
    setDefaultTpPrice(p.defaultTpPrice ?? 0);
    setAllowedSellUnits(p.allowedSellUnits);
    setShowForm(true);
    requestAnimationFrame(() => {
      document.getElementById("product-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setProductType("feed_bag");
    setAllowedSellUnits(PRODUCT_TYPE_TEMPLATES.feed_bag.allowedSellUnits);
    setPackageSize(defaultPackageSizeForType("feed_bag"));
    setName("");
    setImageUrl("");
    setSellPrice(0);
    setDefaultCostPrice(0);
    setDefaultTpPrice(0);
  };

  const buildPayload = () => ({
    name,
    imageUrl: imageUrl || undefined,
    weightUnit: tpl.weightUnit,
    basePackageSize: packageToBaseSize(tpl.weightUnit, packageSize > 0 ? packageSize : effectivePackageSize),
    sellPrice,
    defaultCostPrice: defaultCostPrice > 0 ? defaultCostPrice : null,
    defaultTpPrice: defaultTpPrice > 0 ? defaultTpPrice : null,
    allowedSellUnits,
  });

  const handleSave = () => {
    confirm(async () => {
      setLoading(true);
      try {
        const url = editingId ? `/api/products/${editingId}` : "/api/products";
        const method = editingId ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
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
    }, { message: editingId ? `Update product "${name}"?` : `Add product "${name}"?` });
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

  const presets = getSellPresets(tpl.weightUnit, packageToBaseSize(tpl.weightUnit, effectivePackageSize));
  const sellCounterPreview =
    productType === "feed_bag" && packageSize > 0
      ? buildSellUnitOptions({
          weightUnit: tpl.weightUnit,
          basePackageSize: basePackageGrams,
          allowedSellUnits,
        }).map((u) => formatSellUnitLabel(u, tpl.weightUnit, basePackageGrams))
      : [];
  const showPackageSize = productType === "feed_bag" || productType === "liquid";
  const productFormValid =
    name.trim().length > 0 &&
    sellPrice > 0 &&
    allowedSellUnits.length > 0 &&
    (!showPackageSize || packageSize > 0) &&
    (defaultTpPrice <= 0 || (defaultCostPrice > 0 && defaultTpPrice >= defaultCostPrice));

  return (
    <div>
      <div className="mb-4 rounded-xl border border-[var(--info-border)] bg-[var(--info-bg)] p-4 text-sm text-[var(--info-text)]">
        <p className="font-semibold">Simple workflow</p>
        <p className="mt-1">1. Add product here → 2. Purchase (bags/pieces) → 3. Sell on counter</p>
        <p className="mt-1 opacity-90">{t.products.feedExample}</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">{t.products.title}</h1>
        <Button className="min-h-11 shrink-0" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus size={18} /> {t.products.addProduct}
        </Button>
      </div>

      {showForm && (
        <div
          id="product-form"
          className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6"
        >
          <h2 className="mb-1 font-semibold">{editingId ? "Edit Product" : "New Product"}</h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            {editingId
              ? "Choose product type and set bag/bottle weight below — same options as when adding a new product."
              : t.products.selectTypeFirst}
          </p>

          <Label className="mb-2 block">{t.products.productType}</Label>
          <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(PRODUCT_TYPE_TEMPLATES).map(([key, template]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyTemplate(key as ProductTypeKey)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  productType === key
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              >
                <p className="font-medium text-sm">{template.label}</p>
                <p className="mt-1 text-xs text-gray-500">{template.description}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{t.products.productName} *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Layer Feed 50kg" required />
            </div>
            <div>
              <Label>{t.products.image} (optional URL)</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            </div>

            {showPackageSize && (
              <div>
                <Label>
                  {productType === "feed_bag" ? t.products.bagSizeKg : t.products.bottleSizeMl} *
                </Label>
                <NumberInput
                  required
                  placeholder={productType === "feed_bag" ? "e.g. 50" : "e.g. 500"}
                  value={packageSize}
                  onChange={setPackageSize}
                />
                {productType === "feed_bag" && (
                  <p className="mt-1 text-xs text-gray-500">
                    When you buy in Purchases, qty = number of {effectivePackageSize} kg bags
                  </p>
                )}
              </div>
            )}

            <div>
              <Label>{t.products.referencePrice} *</Label>
              <NumberInput
                required
                placeholder={t.common.enterPrice}
                value={sellPrice}
                onChange={setSellPrice}
              />
              <p className="mt-1 text-xs text-gray-500">{t.products.referencePriceHelp}</p>
            </div>

            <div>
              <Label>{t.products.defaultCostPrice}</Label>
              <NumberInput
                placeholder={t.common.enterPrice}
                value={defaultCostPrice}
                onChange={setDefaultCostPrice}
              />
              <p className="mt-1 text-xs text-gray-500">{t.products.defaultCostPriceHelp}</p>
            </div>

            <div>
              <Label>{t.products.defaultTpPrice}</Label>
              <NumberInput
                placeholder={t.common.enterPrice}
                value={defaultTpPrice}
                onChange={setDefaultTpPrice}
              />
              <p className="mt-1 text-xs text-gray-500">{t.products.defaultTpPriceHelp}</p>
              {defaultTpPrice > 0 && defaultCostPrice > 0 && defaultTpPrice < defaultCostPrice && (
                <p className="mt-1 text-xs text-red-600">{t.products.tpMustBeAtLeastCost}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <Label>{t.products.quickSellButtons} *</Label>
              <p className="mb-2 text-xs text-gray-500">{t.products.quickSellHelp}</p>
              {productType === "feed_bag" && packageSize > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-emerald-700">
                    {t.products.sellCounterPreview}: {sellCounterPreview.join(" → ")}
                  </p>
                  <p className="text-xs text-gray-500">{t.products.feedKhucraAutoHelp}</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => toggleSellUnit(p.value)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        allowedSellUnits.includes(p.value)
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} disabled={!productFormValid || loading}>{t.common.save}</Button>
            <Button variant="outline" onClick={resetForm}>{t.common.cancel}</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => {
          const type = detectProductType(p.weightUnit, p.basePackageSize, p.allowedSellUnits);
          const typeLabel = PRODUCT_TYPE_TEMPLATES[type]?.label ?? p.weightUnit;
          const sizeLabel =
            type === "feed_bag"
              ? `${packageDisplaySize(p.weightUnit, p.basePackageSize, type)} kg bag`
              : type === "liquid"
                ? `${p.basePackageSize} ml bottle`
                : "per piece";

          return (
            <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              <div className="h-32 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" /> : <Package size={48} className="text-gray-400" />}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="text-xs text-gray-500">{p.productId}</p>
                    <p className="text-xs text-emerald-700">{typeLabel} · {sizeLabel}</p>
                    {p.sellPrice > 0 && (
                      <p className="text-xs text-gray-400">Suggested: {formatCurrency(p.sellPrice)}</p>
                    )}
                    {(p.defaultCostPrice ?? 0) > 0 && (
                      <p className="text-xs text-gray-400">
                        {t.products.defaultCostPrice}: {formatCurrency(p.defaultCostPrice!)}
                      </p>
                    )}
                    {(p.defaultTpPrice ?? 0) > 0 && (
                      <p className="text-xs text-gray-400">
                        {t.products.defaultTpPrice}: {formatCurrency(p.defaultTpPrice!)}
                      </p>
                    )}
                  </div>
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
                <ProductPriceHistoryPanel
                  productId={p.id}
                  currentSell={p.sellPrice}
                  currentCost={p.defaultCostPrice ?? null}
                  currentTp={p.defaultTpPrice ?? null}
                />
              </div>
            </div>
          );
        })}
        {products.length === 0 && <p className="col-span-full text-center text-gray-500 py-12">{t.common.noData}</p>}
      </div>

      <ConfirmDialog open={confirmState.open} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={close} loading={loading} />
    </div>
  );
}
