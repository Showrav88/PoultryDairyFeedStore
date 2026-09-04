"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Store, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NumberInput } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

interface Sale {
  id: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  createdAt: string;
  items: { product: { name: string }; sellUnitLabel: string; lineTotal: number }[];
}

interface PaymentRecord {
  id: string;
  amount: number;
  note?: string;
  createdAt: string;
  allocations: { saleId: string | null; amount: number; label: string }[];
}

interface FarmerDetail {
  id: string;
  name: string;
  phone: string;
  address?: string;
  openingDue: number;
  totalDue: number;
  alert: "none" | "normal" | "amber" | "red";
  daysOverdue: number;
}

export default function FarmerProfilePage() {
  const { t, locale } = useI18n();
  const params = useParams();
  const id = params.id as string;
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [farmer, setFarmer] = useState<FarmerDetail | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [showCollect, setShowCollect] = useState(false);
  const [collectAmount, setCollectAmount] = useState(0);
  const [collectNote, setCollectNote] = useState("");
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/farmers/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setFarmer(d.farmer);
        setSales(d.sales ?? []);
      });
    fetch(`/api/farmers/${id}/payments`)
      .then((r) => r.json())
      .then((d) => setPayments(d.payments ?? []));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const openSalePayment = (sale: Sale) => {
    setPaySaleId(sale.id);
    setPayAmount(Number(sale.dueAmount));
  };

  const saveManualPayment = () => {
    if (collectAmount <= 0 || loading) return;
    if (farmer && collectAmount > farmer.totalDue) {
      alert(`${t.farmers.maxCollect}: ${formatCurrency(farmer.totalDue)}`);
      return;
    }
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/farmers/${id}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: collectAmount, note: collectNote || undefined }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setShowCollect(false);
        setCollectAmount(0);
        setCollectNote("");
        load();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Payment failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `${t.farmers.collectPayment}: ${formatCurrency(collectAmount)}?` });
  };

  const saveSalePayment = () => {
    if (!paySaleId || payAmount <= 0 || loading) return;
    const sale = sales.find((s) => s.id === paySaleId);
    if (farmer && payAmount > farmer.totalDue) {
      alert(`${t.farmers.maxCollect}: ${formatCurrency(farmer.totalDue)}`);
      return;
    }
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/sales/${paySaleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ additionalAmount: payAmount }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setPaySaleId(null);
        setPayAmount(0);
        load();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Payment failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `${t.farmers.collectPayment}: ${formatCurrency(payAmount)}?` });
  };

  if (!farmer) {
    return <p className="text-gray-500">{t.common.loading}</p>;
  }

  return (
    <div>
      <Link href="/dashboard/farmers" className="mb-4 inline-flex items-center gap-1 text-sm text-emerald-600">
        <ArrowLeft size={16} /> {t.farmers.title}
      </Link>

      <div
        className={cn(
          "mb-6 rounded-xl border p-4 sm:p-6",
          farmer.alert === "red" && "border-red-400 bg-red-50/50 dark:bg-red-950/20",
          farmer.alert === "amber" && "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
          farmer.alert !== "red" && farmer.alert !== "amber" && "border-[var(--border)] bg-[var(--card)]"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{farmer.name}</h1>
            <p className="text-sm text-gray-500">{farmer.phone}</p>
            {farmer.address && <p className="text-sm text-gray-500">{farmer.address}</p>}
            <p className="mt-3 text-lg font-semibold text-orange-600">
              {t.farmers.totalDue}: {formatCurrency(farmer.totalDue)}
            </p>
            {farmer.openingDue > 0 && (
              <p className="text-sm text-gray-500">
                {t.farmers.openingDue}: {formatCurrency(farmer.openingDue)}
              </p>
            )}
            {farmer.alert === "amber" && (
              <p className="text-sm text-amber-700">{t.farmers.alertAmber} · {farmer.daysOverdue} {t.farmers.daysOverdue}</p>
            )}
            {farmer.alert === "red" && (
              <p className="text-sm text-red-700">{t.farmers.alertRed} · {farmer.daysOverdue} {t.farmers.daysOverdue}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {farmer.totalDue > 0 && (
              <Button className="min-h-11 gap-2" variant="outline" onClick={() => { setShowCollect(true); setCollectAmount(farmer.totalDue); }}>
                <Banknote size={18} /> {t.farmers.collectPayment}
              </Button>
            )}
            <Link href={`/dashboard/sell?farmerId=${farmer.id}`}>
              <Button className="min-h-11 gap-2">
                <Store size={18} /> {t.farmers.sellToFarmer}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold">{t.farmers.paymentHistory}</h2>
      <div className="mb-6 space-y-2">
        {payments.map((p) => (
          <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-emerald-700">{formatCurrency(p.amount)}</p>
                <p className="text-xs text-gray-500">{formatDateTime(p.createdAt, locale)}</p>
                {p.note && <p className="text-xs text-gray-500">{p.note}</p>}
              </div>
            </div>
            {p.allocations.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-gray-500">
                <li className="font-medium text-emerald-600">
                  {t.farmers.appliedToDue}:{" "}
                  {formatCurrency(p.allocations.reduce((s, a) => s + a.amount, 0))}
                </li>
                {p.allocations.map((a, i) => (
                  <li key={i}>
                    {a.label}: {formatCurrency(a.amount)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {payments.length === 0 && <p className="text-center text-gray-500 py-4">{t.farmers.noPaymentsYet}</p>}
      </div>

      <h2 className="mb-3 text-lg font-semibold">{t.farmers.salesHistory}</h2>
      <div className="space-y-3">
        {sales.map((sale) => {
          const paidOnSale = Math.min(Number(sale.paidAmount), Number(sale.totalAmount));
          return (
          <div key={sale.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{formatCurrency(sale.totalAmount)} · {sale.status}</p>
                <p className="text-xs text-gray-500">{formatDateTime(sale.createdAt, locale)}</p>
                <p className="text-sm mt-1">
                  {t.farmers.paidOnSale}: {formatCurrency(paidOnSale)} · {t.common.due}: {formatCurrency(sale.dueAmount)}
                </p>
              </div>
              {Number(sale.dueAmount) > 0 && (
                <Button size="sm" variant="outline" onClick={() => openSalePayment(sale)}>
                  {t.farmers.collectPayment}
                </Button>
              )}
            </div>
            <ul className="mt-2 text-xs text-gray-500">
              {sale.items.map((item, i) => (
                <li key={i}>{item.product.name} · {item.sellUnitLabel} · {formatCurrency(item.lineTotal)}</li>
              ))}
            </ul>
          </div>
          );
        })}
        {sales.length === 0 && <p className="text-center text-gray-500 py-6">{t.common.noData}</p>}
      </div>

      {showCollect && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="font-semibold mb-1">{t.farmers.collectPayment}</h3>
            <p className="mb-3 text-sm text-gray-500">{t.farmers.collectHelp}</p>
            {farmer.totalDue > 0 && (
              <p className="mb-2 text-sm text-orange-600">
                {t.farmers.maxCollect}: {formatCurrency(farmer.totalDue)}
              </p>
            )}
            <Label>{t.farmers.paymentAmount}</Label>
            <NumberInput
              value={collectAmount}
              onChange={(v) => setCollectAmount(Math.min(v, farmer.totalDue))}
              className="mb-3"
            />
            <Label>{t.common.notes} ({t.common.optional})</Label>
            <Input value={collectNote} onChange={(e) => setCollectNote(e.target.value)} className="mb-4" />
            <div className="flex gap-2">
              <Button onClick={saveManualPayment} disabled={collectAmount <= 0}>{t.common.save}</Button>
              <Button variant="outline" onClick={() => setShowCollect(false)}>{t.common.cancel}</Button>
            </div>
          </div>
        </div>
      )}

      {paySaleId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="font-semibold mb-1">{t.farmers.collectPayment}</h3>
            <p className="mb-3 text-sm text-gray-500">{t.farmers.collectSaleHelp}</p>
            <Label>{t.farmers.paymentAmount}</Label>
            <NumberInput
              value={payAmount}
              onChange={(v) => {
                const max = farmer?.totalDue ?? v;
                setPayAmount(Math.min(v, max));
              }}
              className="mb-4"
            />
            <div className="flex gap-2">
              <Button onClick={saveSalePayment} disabled={payAmount <= 0}>{t.common.save}</Button>
              <Button variant="outline" onClick={() => setPaySaleId(null)}>{t.common.cancel}</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmState.open} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={close} loading={loading} />
    </div>
  );
}
