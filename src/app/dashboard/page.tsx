"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Store, Wallet, BarChart3 } from "lucide-react";
import { AnimatedCount, AnimatedCurrency } from "@/components/ui/animated-number";
import { StatCardSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n/context";

export default function DashboardPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    balance: 0,
    totalRevenue: 0,
    saleCount: 0,
    inventoryValue: 0,
  });

  useEffect(() => {
    const started = performance.now();
    Promise.all([
      fetch("/api/wallet", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/analytics?period=day", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([wallet, analytics]) => {
        setStats({
          balance: wallet.balance ?? 0,
          totalRevenue: analytics.totalRevenue ?? 0,
          saleCount: analytics.saleCount ?? 0,
          inventoryValue: analytics.inventoryValue ?? 0,
        });
      })
      .finally(() => {
        setLoading(false);
        if (process.env.NODE_ENV === "development") {
          console.info(`[dashboard] loaded in ${Math.round(performance.now() - started)}ms`);
        }
      });
  }, []);

  const cards = [
    {
      label: t.wallet.balance,
      href: "/dashboard/wallet",
      icon: Wallet,
      content: <AnimatedCurrency value={stats.balance} loading={loading} className="text-2xl font-bold mt-1" />,
    },
    {
      label: t.analytics.dailySales,
      href: "/dashboard/sell",
      icon: Store,
      content: <AnimatedCurrency value={stats.totalRevenue} loading={loading} className="text-2xl font-bold mt-1" />,
    },
    {
      label: "Today's Sales",
      href: "/dashboard/analytics",
      icon: BarChart3,
      content: <AnimatedCount value={stats.saleCount} loading={loading} className="text-2xl font-bold mt-1" />,
    },
    {
      label: t.analytics.inventoryValue,
      href: "/dashboard/products",
      icon: Package,
      content: <AnimatedCurrency value={stats.inventoryValue} loading={loading} className="text-2xl font-bold mt-1" />,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t.nav.dashboard}</h1>
      {loading ? (
        <StatCardSkeleton count={4} />
      ) : (
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
              {card.content}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
