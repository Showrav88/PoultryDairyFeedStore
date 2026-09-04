"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ChevronRight, Tractor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { ANIMAL_TYPE_LABELS } from "@/lib/farms/wallet";

const ANIMAL_TYPES = ["POULTRY", "COW", "FISH", "DUCK", "GOAT", "SHEEP", "RABBIT", "OTHER"] as const;

interface Farm {
  id: string;
  name: string;
  animalType: string;
  location?: string;
  notes?: string;
  _count?: { issues: number; expenses: number };
}

export default function FarmsPage() {
  const { t, locale } = useI18n();
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    animalType: "POULTRY" as (typeof ANIMAL_TYPES)[number],
    location: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  const load = () => {
    fetch("/api/farms")
      .then((r) => r.json())
      .then((d) => setFarms(d.farms ?? []));
  };

  useEffect(() => { load(); }, []);

  const animalLabel = (type: string) => {
    const labels = ANIMAL_TYPE_LABELS[type];
    return labels ? (locale === "bn" ? labels.bn : labels.en) : type;
  };

  const openEdit = (f: Farm) => {
    setEditingId(f.id);
    setForm({
      name: f.name,
      animalType: (f.animalType as (typeof ANIMAL_TYPES)[number]) || "OTHER",
      location: f.location ?? "",
      notes: f.notes ?? "",
    });
    setShowForm(true);
  };

  const handleSave = () => {
    confirm(async () => {
      setLoading(true);
      try {
        const url = editingId ? `/api/farms/${editingId}` : "/api/farms";
        const method = editingId ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            animalType: form.animalType,
            location: form.location || undefined,
            notes: form.notes || undefined,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setShowForm(false);
        setEditingId(null);
        setForm({ name: "", animalType: "POULTRY", location: "", notes: "" });
        load();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      } finally {
        setLoading(false);
        close();
      }
    }, {
      message: editingId
        ? `${t.farms.editFarm}: "${form.name}"?`
        : `${t.farms.addFarm}: "${form.name}"?`,
    });
  };

  const handleDelete = (f: Farm) => {
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/farms/${f.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error);
        load();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Delete failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `${t.farms.deleteFarm}: "${f.name}"?` });
  };

  return (
    <div>
      <div className="mb-4 rounded-xl border border-[var(--info-border)] bg-[var(--info-bg)] p-4 text-sm text-[var(--info-text)]">
        <p>{t.farms.ownFarmsHelp}</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">{t.farms.title}</h1>
        <Button
          className="min-h-11 shrink-0"
          onClick={() => {
            setEditingId(null);
            setForm({ name: "", animalType: "POULTRY", location: "", notes: "" });
            setShowForm(!showForm);
          }}
        >
          <Plus size={18} /> {t.farms.addFarm}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 md:grid-cols-2">
          <div className="md:col-span-2 font-semibold">
            {editingId ? t.farms.editFarm : t.farms.addFarm}
          </div>
          <div>
            <Label>{t.common.name}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>{t.farms.animalType}</Label>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={form.animalType}
              onChange={(e) =>
                setForm({ ...form, animalType: e.target.value as (typeof ANIMAL_TYPES)[number] })
              }
            >
              {ANIMAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {animalLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t.farms.location}</Label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder={t.common.optional}
            />
          </div>
          <div>
            <Label>{t.common.notes}</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t.common.optional}
            />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={handleSave} disabled={!form.name}>
              {t.common.save}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {farms.map((f) => (
          <div
            key={f.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Tractor size={18} className="text-emerald-600" />
                  <p className="font-semibold">{f.name}</p>
                </div>
                <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                  {animalLabel(f.animalType)}
                </span>
                {f.location && <p className="mt-1 text-xs text-gray-500">{f.location}</p>}
                {f._count && (
                  <p className="mt-1 text-xs text-gray-500">
                    {f._count.issues} {t.farms.issues} · {f._count.expenses} {t.farms.expenses}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/dashboard/farms/${f.id}`}>
                  <Button size="sm" className="min-h-9 gap-1">
                    {t.farms.manage} <ChevronRight size={14} />
                  </Button>
                </Link>
                <Button size="sm" variant="outline" onClick={() => openEdit(f)} title={t.common.edit}>
                  <Pencil size={14} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(f)} title={t.farms.deleteFarm}>
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {farms.length === 0 && (
          <p className="py-8 text-center text-gray-500">{t.common.noData}</p>
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
