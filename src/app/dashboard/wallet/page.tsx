"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NumberInput } from "@/components/ui/input";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface Transaction {
  id: string;
  type: string;
  category?: string;
  amount: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

const expenseCategories = [
  "FAMILY", "UTILITIES", "LAW_AND_SUIT", "GUEST_BILL", "STAFF_SALARY", "OTHER",
] as const;

export default function WalletPage() {
  const { t, locale } = useI18n();
  const { state: confirmState, confirm, close } = useConfirmDialog();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [txType, setTxType] = useState<"DEPOSIT" | "WITHDRAW" | "EXPENSE">("DEPOSIT");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("OTHER");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const load = () => fetch("/api/wallet").then((r) => r.json()).then((d) => {
    setBalance(d.balance ?? 0);
    setTransactions(d.transactions ?? []);
  });

  useEffect(() => { load(); }, []);

  const categoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      FAMILY: t.wallet.family,
      UTILITIES: t.wallet.utilities,
      LAW_AND_SUIT: t.wallet.lawAndSuit,
      GUEST_BILL: t.wallet.guestBill,
      STAFF_SALARY: t.wallet.staffSalary,
      OTHER: t.wallet.other,
    };
    return map[cat] ?? cat;
  };

  const handleSubmit = () => {
    confirm(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: txType, amount, category: txType === "EXPENSE" ? category : undefined, note }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setShowForm(false);
        setAmount(0);
        setNote("");
        load();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      } finally {
        setLoading(false);
        close();
      }
    }, { message: `${txType} ${formatCurrency(amount)}?` });
  };

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold sm:text-2xl">{t.wallet.title}</h1>

      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white mb-6">
        <p className="text-sm opacity-80">{t.wallet.balance}</p>
        <p className="mt-1 break-words text-3xl font-bold sm:text-4xl">{formatCurrency(balance)}</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(["DEPOSIT", "WITHDRAW", "EXPENSE"] as const).map((type) => (
          <Button
            key={type}
            variant={showForm && txType === type ? "default" : "outline"}
            onClick={() => { setShowForm(true); setTxType(type); }}
          >
            <Plus size={16} />
            {type === "DEPOSIT" ? t.wallet.deposit : type === "WITHDRAW" ? t.wallet.withdraw : t.wallet.expense}
          </Button>
        ))}
      </div>

      {showForm && (
        <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 md:grid-cols-2">
          <div>
            <Label>{t.common.amount}</Label>
            <NumberInput
              placeholder={t.common.enterAmount}
              value={amount}
              onChange={setAmount}
            />
          </div>
          {txType === "EXPENSE" && (
            <div>
              <Label>{t.wallet.category}</Label>
              <select
                className="w-full h-10 rounded-lg border border-gray-300 px-3 dark:border-gray-600 dark:bg-gray-900"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {expenseCategories.map((c) => (
                  <option key={c} value={c}>{categoryLabel(c)}</option>
                ))}
              </select>
            </div>
          )}
          <div className="md:col-span-2">
            <Label>{t.common.notes}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={handleSubmit} disabled={amount <= 0}>{t.common.save}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="min-w-[760px] w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left">{t.common.date}</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">{t.wallet.category}</th>
              <th className="px-4 py-3 text-right">{t.common.amount}</th>
              <th className="px-4 py-3 text-left">{t.common.notes}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 text-xs">{formatDateTime(tx.createdAt, locale)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    tx.type === "DEPOSIT" || tx.type === "SALE_INCOME" ? "bg-emerald-100 text-emerald-700" :
                    tx.type === "RECEIVABLE" ? "bg-blue-100 text-blue-700" :
                    tx.type === "PAYABLE" ? "bg-orange-100 text-orange-700" :
                    "bg-red-100 text-red-700"
                  }`}>{tx.type}</span>
                </td>
                <td className="px-4 py-3">{tx.category ? categoryLabel(tx.category) : "—"}</td>
                <td className={`px-4 py-3 text-right font-medium ${
                  tx.type === "DEPOSIT" || tx.type === "SALE_INCOME" || tx.type === "RECEIVABLE" ? "text-emerald-600" : "text-red-600"
                }`}>
                  {tx.type === "RECEIVABLE" || tx.type === "PAYABLE" ? "" : tx.type === "DEPOSIT" || tx.type === "SALE_INCOME" ? "+" : "-"}
                  {formatCurrency(tx.amount)}
                  {tx.type === "RECEIVABLE" ? " (due in)" : tx.type === "PAYABLE" ? " (due out)" : ""}
                </td>
                <td className="px-4 py-3 text-gray-500">{tx.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && <p className="text-center text-gray-500 py-8">{t.common.noData}</p>}
      </div>

      <ConfirmDialog open={confirmState.open} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={close} loading={loading} />
    </div>
  );
}
