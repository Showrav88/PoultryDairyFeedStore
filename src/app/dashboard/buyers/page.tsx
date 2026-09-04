"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [loading, setLoading] = useState(false);

  const load = (q?: string) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    fetch(`/api/buyers${params}`).then((r) => r.json()).then((d) => setBuyers(d.buyers ?? []));
  };

  useEffect(() => { load(); }, []);

  const openEdit = (b: Buyer) => {
    setEditingId(b.id);
    setForm({ name: b.name, phone: b.phone, address: b.address ?? "" });
    setShowForm(true);
  };

  const handleSave = () => {
    confirm(async () => {
      setLoading(true);
      try {
        const url = editingId ? `/api/buyers/${editingId}` : "/api/buyers";
        const method = editingId ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setShowForm(false);
        setEditingId(null);
        setForm({ name: "", phone: "", address: "" });
        load(search);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: editingId ? `Update buyer "${form.name}"?` : `Add buyer "${form.name}"?` });
  };

  const handleDelete = (b: Buyer) => {
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/buyers/${b.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error);
        load(search);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Delete failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `Delete buyer "${b.name}"? (Only if no purchases exist)` });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">{t.buyers.title}</h1>
        <Button className="min-h-11 shrink-0" onClick={() => { setEditingId(null); setForm({ name: "", phone: "", address: "" }); setShowForm(!showForm); }}>
          <Plus size={18} /> {t.buyers.addBuyer}
        </Button>
      </div>

      <div className="mb-4">
        <Input placeholder={t.buyers.searchByNameOrPhone} value={search} onChange={(e) => { setSearch(e.target.value); load(e.target.value); }} />
      </div>

      {showForm && (
        <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 md:grid-cols-3">
          <div className="md:col-span-3 font-semibold">{editingId ? "Edit Buyer" : "Add Buyer"}</div>
          <div><Label>{t.common.name}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>{t.common.phone}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>{t.common.address}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="md:col-span-3 flex gap-2">
            <Button onClick={handleSave} disabled={!form.name || !form.phone}>{t.common.save}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="min-w-[560px] w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left">{t.common.name}</th>
              <th className="px-4 py-3 text-left">{t.common.phone}</th>
              <th className="px-4 py-3 text-left">{t.common.address}</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {buyers.map((b) => (
              <tr key={b.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">{b.name}</td>
                <td className="px-4 py-3">{b.phone}</td>
                <td className="px-4 py-3">{b.address || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(b)} title={t.common.edit}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(b)} title={t.common.delete}>
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </div>
                </td>
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
