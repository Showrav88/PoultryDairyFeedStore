"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Store,
  Wallet,
  BarChart3,
  History,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocaleToggle, ThemeToggle } from "@/components/layout/theme-toggle";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" as const },
  { href: "/dashboard/products", icon: Package, key: "products" as const },
  { href: "/dashboard/buyers", icon: Users, key: "buyers" as const },
  { href: "/dashboard/purchases", icon: ShoppingCart, key: "purchases" as const },
  { href: "/dashboard/sell", icon: Store, key: "sellCounter" as const },
  { href: "/dashboard/wallet", icon: Wallet, key: "wallet" as const },
  { href: "/dashboard/analytics", icon: BarChart3, key: "analytics" as const },
  { href: "/dashboard/history", icon: History, key: "history" as const },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <aside className="hidden w-64 flex-shrink-0 border-r border-[var(--border)] bg-[var(--card)] md:flex md:flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <h1 className="text-lg font-bold text-emerald-600">🐔 {t.app.name}</h1>
          <p className="text-xs text-gray-500">{t.app.tagline}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, icon: Icon, key }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              )}
            >
              <Icon size={18} />
              {t.nav[key]}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-[var(--border)]">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={logout}>
            <LogOut size={18} />
            {t.auth.logout}
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <div className="md:hidden">
            <select
              className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
              value={pathname}
              onChange={(e) => router.push(e.target.value)}
            >
              {navItems.map(({ href, key }) => (
                <option key={href} value={href}>{t.nav[key]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
