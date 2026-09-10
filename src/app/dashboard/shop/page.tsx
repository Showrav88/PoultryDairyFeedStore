"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { formatDateTime } from "@/lib/utils";

interface ShopProfile {
  id: string;
  email: string;
  shopName: string;
  shopNumber: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export default function ShopDetailsPage() {
  const { t, locale } = useI18n();
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState<ShopProfile | null>(null);
  const [form, setForm] = useState({
    shopName: "",
    shopNumber: "",
    phone: "",
    email: "",
  });

  const load = () =>
    fetch("/api/shop", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.shop) return;
        setInitial(d.shop);
        setForm({
          shopName: d.shop.shopName,
          shopNumber: d.shop.shopNumber,
          phone: d.shop.phone,
          email: d.shop.email,
        });
      });

  useEffect(() => {
    load();
  }, []);

  const dirty =
    initial != null &&
    (form.shopName !== initial.shopName ||
      form.phone !== initial.phone ||
      form.email !== initial.email);

  const handleSave = () => {
    if (!dirty) return;
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/shop", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopName: form.shopName,
            phone: form.phone,
            email: form.email,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const data = await res.json();
        setInitial(data.shop);
        window.dispatchEvent(
          new CustomEvent("shop-updated", {
            detail: { shopName: data.shop.shopName },
          })
        );
      } catch (err) {
        alert(err instanceof Error ? err.message : t.common.error);
      } finally {
        setLoading(false);
        close();
      }
    }, { message: t.shop.saveConfirm });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">{t.shop.title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.shop.subtitle}</p>
      </div>

      <div className="max-w-xl space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
        <div>
          <Label>{t.auth.shopName}</Label>
          <Input
            value={form.shopName}
            onChange={(e) => setForm({ ...form, shopName: e.target.value })}
          />
        </div>
        <div>
          <Label>{t.auth.shopNumber}</Label>
          <Input value={form.shopNumber} readOnly disabled />
          <p className="mt-1 text-xs text-gray-500">{t.shop.shopNumberHelp}</p>
        </div>
        <div>
          <Label>{t.auth.phone}</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <Label>{t.auth.email}</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        {initial && (
          <p className="text-xs text-gray-500">
            {t.shop.memberSince}: {formatDateTime(initial.createdAt, locale)}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            className="min-h-11"
            onClick={handleSave}
            disabled={!dirty || loading || !form.shopName || !form.phone || !form.email}
          >
            {t.common.save}
          </Button>
          {initial && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={!dirty}
              onClick={() =>
                setForm({
                  shopName: initial.shopName,
                  shopNumber: initial.shopNumber,
                  phone: initial.phone,
                  email: initial.email,
                })
              }
            >
              {t.common.cancel}
            </Button>
          )}
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
