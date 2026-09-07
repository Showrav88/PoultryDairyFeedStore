"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ChevronRight, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NumberInput } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { cn, formatCurrency } from "@/lib/utils";

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  totalDue: number;
  lifetimeSpend: number;
  tier: string;
  tierLabel: string;
}

function tierBadge(tier: string, label: string) {
  const styles: Record<string, string> = {
    platinum: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
    gold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
    silver: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    bronze: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", styles[tier] ?? styles.bronze)}>
      {label}
    </span>
  );
}

export default function CustomersPage() {
  const { t } = useI18n();
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [collectId, setCollectId] = useState<string | null>(null);
  const [collectAmount, setCollectAmount] = useState(0);

  const load = (q?: string) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    fetch(`/api/customers${params}`)
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers ?? []));
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (c: CustomerRow) => {
    setEditingId(c.id);
    setForm({ name: c.name, phone: c.phone });
    setShowForm(true);
  };

  const handleSave = () => {
    confirm(async () => {
      setLoading(true);
      try {
        const url = editingId ? `/api/customers/${editingId}` : "/api/customers";
        const method = editingId ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setShowForm(false);
        setEditingId(null);
        setForm({ name: "", phone: "" });
        load(search);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      } finally {
        setLoading(false);
        close();
      }
    }, {
      message: editingId
        ? `${t.customers.editCustomer}: "${form.name}"?`
        : `${t.customers.addCustomer}: "${form.name}"?`,
    });
  };

  const handleDelete = (c: CustomerRow) => {
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers/${c.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error);
        load(search);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Delete failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `${t.customers.deleteCustomer}: "${c.name}"?` });
  };

  const saveCollect = () => {
    if (!collectId || collectAmount <= 0 || loading) return;
    const c = customers.find((x) => x.id === collectId);
    if (c && collectAmount > c.totalDue) {
      alert(`${t.customers.maxCollect}: ${formatCurrency(c.totalDue)}`);
      return;
    }
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers/${collectId}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: collectAmount }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setCollectId(null);
        setCollectAmount(0);
        load(search);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Payment failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `${t.customers.collectPayment}: ${formatCurrency(collectAmount)}?` });
  };

  const sorted = [...customers].sort((a, b) => b.totalDue - a.totalDue || b.lifetimeSpend - a.lifetimeSpend);

  return (
    <div>
      <div className="mb-4 rounded-xl border border-[var(--info-border)] bg-[var(--info-bg)] p-4 text-sm text-[var(--info-text)]">
        <p>{t.customers.pageHint}</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">{t.customers.title}</h1>
        <Button
          className="min-h-11 shrink-0"
          onClick={() => {
            setEditingId(null);
            setForm({ name: "", phone: "" });
            setShowForm(!showForm);
          }}
        >
          <Plus size={18} /> {t.customers.addCustomer}
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder={t.customers.searchByNameOrPhone}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            load(e.target.value);
          }}
        />
      </div>

      {showForm && (
        <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 md:grid-cols-2">
          <div className="font-semibold md:col-span-2">
            {editingId ? t.customers.editCustomer : t.customers.addCustomer}
          </div>
          <div>
            <Label>{t.common.name}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>{t.common.phone}</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button onClick={handleSave} disabled={!form.name || !form.phone}>
              {t.common.save}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((c) => (
          <div
            key={c.id}
            className={cn(
              "rounded-xl border bg-[var(--card)] p-4",
              c.totalDue > 0 ? "border-orange-400 dark:border-orange-700" : "border-[var(--border)]"
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{c.name}</h3>
                  {tierBadge(c.tier, c.tierLabel)}
                </div>
                <p className="text-sm text-gray-500">{c.phone}</p>
                <p className="mt-1 text-sm">
                  {t.customers.lifetimeSpend}: {formatCurrency(c.lifetimeSpend)}
                </p>
                {c.totalDue > 0 && (
                  <p className="mt-1 font-medium text-orange-600">
                    {t.customers.totalDue}: {formatCurrency(c.totalDue)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {c.totalDue > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCollectId(c.id);
                      setCollectAmount(c.totalDue);
                    }}
                  >
                    <Banknote size={14} /> {t.customers.collectPayment}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                  <Pencil size={14} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(c)}>
                  <Trash2 size={14} />
                </Button>
                <Link href={`/dashboard/customers/${c.id}`}>
                  <Button size="sm">
                    {t.customers.profile} <ChevronRight size={14} />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="py-8 text-center text-gray-500">{t.common.noData}</p>
        )}
      </div>

      {collectId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="mb-3 font-bold">{t.customers.collectPayment}</h3>
            <Label>{t.customers.paymentAmount}</Label>
            <NumberInput className="mt-1" value={collectAmount} onChange={setCollectAmount} />
            <div className="mt-4 flex gap-2">
              <Button onClick={saveCollect} disabled={collectAmount <= 0}>
                {t.common.save}
              </Button>
              <Button variant="outline" onClick={() => setCollectId(null)}>
                {t.common.cancel}
              </Button>
            </div>
          </div>
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
