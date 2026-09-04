"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Store, Wallet, BarChart3 } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState({
    balance: 0,
    totalRevenue: 0,
    saleCount: 0,
    inventoryValue: 0,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/wallet").then((r) => r.json()),
      fetch("/api/analytics?period=day").then((r) => r.json()),
    ]).then(([wallet, analytics]) => {
      setStats({
        balance: wallet.balance ?? 0,
        totalRevenue: analytics.totalRevenue ?? 0,
        saleCount: analytics.saleCount ?? 0,
        inventoryValue: analytics.inventoryValue ?? 0,
      });
    });
  }, []);

  const cards = [
    { label: t.wallet.balance, value: formatCurrency(stats.balance), icon: Wallet, href: "/dashboard/wallet", color: "emerald" },
    { label: t.analytics.dailySales, value: formatCurrency(stats.totalRevenue), icon: Store, href: "/dashboard/sell", color: "blue" },
    { label: "Today's Sales", value: stats.saleCount.toString(), icon: BarChart3, href: "/dashboard/analytics", color: "purple" },
    { label: t.analytics.inventoryValue, value: formatCurrency(stats.inventoryValue), icon: Package, href: "/dashboard/products", color: "orange" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t.nav.dashboard}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <card.icon className="text-emerald-600" size={24} />
            </div>
            <p className="mt-3 text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
