"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, NumberInput } from "@/components/ui/input";
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

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  lifetimeSpend: number;
  totalDue: number;
  tier: string;
  tierLabel: string;
  nextTierLabel: string | null;
  amountToNextTier: number | null;
}

function tierBadge(tier: string, label: string) {
  const styles: Record<string, string> = {
    platinum: "bg-purple-100 text-purple-800",
    gold: "bg-yellow-100 text-yellow-800",
    silver: "bg-slate-200 text-slate-700",
    bronze: "bg-orange-100 text-orange-800",
  };
  return (
    <span className={cn("rounded-full px-3 py-1 text-sm font-medium", styles[tier] ?? styles.bronze)}>
      {label}
    </span>
  );
}

export default function CustomerProfilePage() {
  const { t, locale } = useI18n();
  const params = useParams();
  const id = params.id as string;
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [showCollect, setShowCollect] = useState(false);
  const [collectAmount, setCollectAmount] = useState(0);
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setCustomer(d.customer);
        setSales(d.sales ?? []);
      });
    fetch(`/api/customers/${id}/payments`)
      .then((r) => r.json())
      .then((d) => setPayments(d.payments ?? []));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveManualPayment = () => {
    if (collectAmount <= 0 || loading) return;
    if (customer && collectAmount > customer.totalDue) {
      alert(`${t.customers.maxCollect}: ${formatCurrency(customer.totalDue)}`);
      return;
    }
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers/${id}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: collectAmount }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setShowCollect(false);
        setCollectAmount(0);
        load();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Payment failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `${t.customers.collectPayment}: ${formatCurrency(collectAmount)}?` });
  };

  const saveSalePayment = () => {
    if (!paySaleId || payAmount <= 0 || loading) return;
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
    }, { message: `${t.customers.collectPayment}: ${formatCurrency(payAmount)}?` });
  };

  if (!customer) {
    return <p className="text-gray-500">{t.common.loading}</p>;
  }

  return (
    <div>
      <Link
        href="/dashboard/customers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-emerald-600"
      >
        <ArrowLeft size={16} /> {t.customers.title}
      </Link>

      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{customer.name}</h1>
            <p className="text-gray-500">{customer.phone}</p>
            <div className="mt-3">{tierBadge(customer.tier, customer.tierLabel)}</div>
            <p className="mt-3 text-sm">
              {t.customers.lifetimeSpend}:{" "}
              <strong>{formatCurrency(customer.lifetimeSpend)}</strong>
            </p>
            {customer.nextTierLabel && customer.amountToNextTier !== null && (
              <p className="mt-1 text-xs text-gray-500">
                {t.customers.nextTier}: {customer.nextTierLabel} —{" "}
                {formatCurrency(customer.amountToNextTier)} {t.customers.toGo}
              </p>
            )}
            {customer.totalDue > 0 && (
              <p className="mt-2 text-lg font-semibold text-orange-600">
                {t.customers.totalDue}: {formatCurrency(customer.totalDue)}
              </p>
            )}
          </div>
          {customer.totalDue > 0 && (
            <Button onClick={() => { setShowCollect(true); setCollectAmount(customer.totalDue); }}>
              <Banknote size={16} /> {t.customers.collectPayment}
            </Button>
          )}
        </div>
      </div>

      <h2 className="mb-3 text-lg font-bold">{t.customers.salesHistory}</h2>
      <div className="mb-8 space-y-2">
        {sales.map((sale) => (
          <div key={sale.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{formatCurrency(sale.totalAmount)} · {sale.status}</p>
                <p className="text-xs text-gray-500">{formatDateTime(sale.createdAt, locale)}</p>
                {sale.dueAmount > 0 && (
                  <p className="mt-1 text-sm text-orange-600">
                    {t.common.due}: {formatCurrency(sale.dueAmount)}
                  </p>
                )}
              </div>
              {sale.dueAmount > 0 && (
                <Button size="sm" variant="outline" onClick={() => { setPaySaleId(sale.id); setPayAmount(sale.dueAmount); }}>
                  {t.customers.collectPayment}
                </Button>
              )}
            </div>
            <ul className="mt-2 text-xs text-gray-600">
              {sale.items.map((item, i) => (
                <li key={i}>
                  {item.product.name} — {item.sellUnitLabel} — {formatCurrency(item.lineTotal)}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {sales.length === 0 && <p className="text-gray-500">{t.common.noData}</p>}
      </div>

      <h2 className="mb-3 text-lg font-bold">{t.customers.paymentHistory}</h2>
      <div className="space-y-2">
        {payments.map((p) => (
          <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
            <div className="flex justify-between font-medium">
              <span>{formatCurrency(p.amount)}</span>
              <span className="text-xs text-gray-500">{formatDateTime(p.createdAt, locale)}</span>
            </div>
            {p.note && <p className="text-xs text-gray-500">{p.note}</p>}
          </div>
        ))}
        {payments.length === 0 && <p className="text-gray-500">{t.customers.noPaymentsYet}</p>}
      </div>

      {showCollect && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="mb-3 font-bold">{t.customers.collectPayment}</h3>
            <Label>{t.customers.paymentAmount}</Label>
            <NumberInput className="mt-1" value={collectAmount} onChange={setCollectAmount} />
            <div className="mt-4 flex gap-2">
              <Button onClick={saveManualPayment}>{t.common.save}</Button>
              <Button variant="outline" onClick={() => setShowCollect(false)}>{t.common.cancel}</Button>
            </div>
          </div>
        </div>
      )}

      {paySaleId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="mb-3 font-bold">{t.customers.collectPayment}</h3>
            <Label>{t.customers.paymentAmount}</Label>
            <NumberInput className="mt-1" value={payAmount} onChange={setPayAmount} />
            <div className="mt-4 flex gap-2">
              <Button onClick={saveSalePayment}>{t.common.save}</Button>
              <Button variant="outline" onClick={() => setPaySaleId(null)}>{t.common.cancel}</Button>
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
