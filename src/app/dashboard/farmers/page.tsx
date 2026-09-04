"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Store, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NumberInput } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { cn, formatCurrency } from "@/lib/utils";

interface Farmer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  totalDue: number;
  alert: "none" | "normal" | "amber" | "red";
  daysOverdue: number;
}

function alertBadge(alert: Farmer["alert"], days: number, t: ReturnType<typeof useI18n>["t"]) {
  if (alert === "red") {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
        {t.farmers.alertRed} · {days}{t.farmers.daysOverdue}
      </span>
    );
  }
  if (alert === "amber") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
        {t.farmers.alertAmber} · {days}{t.farmers.daysOverdue}
      </span>
    );
  }
  return null;
}

export default function FarmersPage() {
  const { t } = useI18n();
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", openingDue: 0 });
  const [loading, setLoading] = useState(false);

  const load = (q?: string) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    fetch(`/api/farmers${params}`)
      .then((r) => r.json())
      .then((d) => setFarmers(d.farmers ?? []));
  };

  useEffect(() => { load(); }, []);

  const openEdit = (f: Farmer) => {
    setEditingId(f.id);
    setForm({ name: f.name, phone: f.phone, address: f.address ?? "", openingDue: 0 });
    setShowForm(true);
  };

  const handleSave = () => {
    confirm(async () => {
      setLoading(true);
      try {
        const url = editingId ? `/api/farmers/${editingId}` : "/api/farmers";
        const method = editingId ? "PATCH" : "POST";
        const body = editingId
          ? { name: form.name, phone: form.phone, address: form.address || undefined }
          : form;
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setShowForm(false);
        setEditingId(null);
        setForm({ name: "", phone: "", address: "", openingDue: 0 });
        load(search);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      } finally {
        setLoading(false);
        close();
      }
    }, {
      message: editingId
        ? `${t.farmers.editFarmer}: "${form.name}"?`
        : `${t.farmers.addFarmer}: "${form.name}"?`,
    });
  };

  const handleDelete = (f: Farmer) => {
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/farmers/${f.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error);
        load(search);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Delete failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `Delete farmer "${f.name}"? (Only if no due balance)` });
  };

  const sorted = [...farmers].sort((a, b) => {
    const rank = { red: 0, amber: 1, normal: 2, none: 3 };
    return rank[a.alert] - rank[b.alert] || b.totalDue - a.totalDue;
  });

  return (
    <div>
      <div className="mb-4 rounded-xl border border-[var(--info-border)] bg-[var(--info-bg)] p-4 text-sm text-[var(--info-text)]">
        <p>{t.farmers.sellFromFarmers}</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">{t.farmers.title}</h1>
        <Button className="min-h-11 shrink-0" onClick={() => { setEditingId(null); setForm({ name: "", phone: "", address: "", openingDue: 0 }); setShowForm(!showForm); }}>
          <Plus size={18} /> {t.farmers.addFarmer}
        </Button>
      </div>

      <div className="mb-4">
        <Input placeholder={t.farmers.searchByNameOrPhone} value={search} onChange={(e) => { setSearch(e.target.value); load(e.target.value); }} />
      </div>

      {showForm && (
        <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 md:grid-cols-2">
          <div className="md:col-span-2 font-semibold">{editingId ? t.farmers.editFarmer : t.farmers.addFarmer}</div>
          <div><Label>{t.common.name}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>{t.common.phone}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>{t.common.address}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          {!editingId && (
            <div className="md:col-span-2">
              <Label>{t.farmers.openingDue}</Label>
              <NumberInput value={form.openingDue} onChange={(v) => setForm({ ...form, openingDue: v })} />
              <p className="mt-1 text-xs text-gray-500">{t.farmers.openingDueHelp}</p>
            </div>
          )}
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={handleSave} disabled={!form.name || !form.phone}>{t.common.save}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((f) => (
          <div
            key={f.id}
            className={cn(
              "rounded-xl border bg-[var(--card)] p-4",
              f.alert === "red" && "border-red-400 dark:border-red-700",
              f.alert === "amber" && "border-amber-400 dark:border-amber-600",
              f.alert !== "red" && f.alert !== "amber" && "border-[var(--border)]"
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{f.name}</p>
                <p className="text-sm text-gray-500">{f.phone}</p>
                {f.address && <p className="text-xs text-gray-500">{f.address}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {f.totalDue > 0 && (
                    <span className="text-sm font-medium text-orange-600">
                      {t.farmers.totalDue}: {formatCurrency(f.totalDue)}
                    </span>
                  )}
                  {alertBadge(f.alert, f.daysOverdue, t)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/dashboard/sell?farmerId=${f.id}`}>
                  <Button size="sm" className="min-h-9 gap-1">
                    <Store size={14} /> {t.farmers.sellToFarmer}
                  </Button>
                </Link>
                <Link href={`/dashboard/farmers/${f.id}`}>
                  <Button size="sm" variant="outline" className="min-h-9 gap-1">
                    {t.farmers.profile} <ChevronRight size={14} />
                  </Button>
                </Link>
                <Button size="sm" variant="outline" onClick={() => openEdit(f)} title={t.common.edit}>
                  <Pencil size={14} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(f)} title={t.common.delete}>
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-center text-gray-500 py-8">{t.common.noData}</p>}
      </div>

      <ConfirmDialog open={confirmState.open} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={close} loading={loading} />
    </div>
  );
}
