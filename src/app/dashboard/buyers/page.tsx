"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";

interface Buyer {
  id: string;
  name: string;
  phone: string;
  address?: string;
}

export default function BuyersPage() {
  const { t } = useI18n();
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [loading, setLoading] = useState(false);

  const load = (q?: string) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    fetch(`/api/buyers${params}`).then((r) => r.json()).then((d) => setBuyers(d.buyers ?? []));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = () => {
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/buyers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setShowForm(false);
        setForm({ name: "", phone: "", address: "" });
        load();
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `Add buyer "${form.name}"?` });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t.buyers.title}</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> {t.buyers.addBuyer}
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder={t.buyers.searchByNameOrPhone}
          value={search}
          onChange={(e) => { setSearch(e.target.value); load(e.target.value); }}
        />
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>{t.common.name}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>{t.common.phone}</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>{t.common.address}</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="md:col-span-3 flex gap-2">
            <Button onClick={handleCreate} disabled={!form.name || !form.phone}>{t.common.save}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left">{t.common.name}</th>
              <th className="px-4 py-3 text-left">{t.common.phone}</th>
              <th className="px-4 py-3 text-left">{t.common.address}</th>
            </tr>
          </thead>
          <tbody>
            {buyers.map((b) => (
              <tr key={b.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">{b.name}</td>
                <td className="px-4 py-3">{b.phone}</td>
                <td className="px-4 py-3">{b.address || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {buyers.length === 0 && <p className="text-center text-gray-500 py-8">{t.common.noData}</p>}
      </div>

      <ConfirmDialog open={confirmState.open} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={close} loading={loading} />
    </div>
  );
}
