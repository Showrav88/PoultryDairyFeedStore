"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Users,
  UserRound,
  ShoppingCart,
  Store,
  Wallet,
  BarChart3,
  History,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LocaleToggle, ThemeToggle } from "@/components/layout/theme-toggle";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" as const },
  { href: "/dashboard/products", icon: Package, key: "products" as const },
  { href: "/dashboard/suppliers", icon: Users, key: "suppliers" as const },
  { href: "/dashboard/farmers", icon: UserRound, key: "farmers" as const },
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
  const [menuOpen, setMenuOpen] = useState(false);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="flex min-h-[100dvh] bg-[var(--background)]">
      <aside className="hidden w-64 flex-shrink-0 border-r border-[var(--border)] bg-[var(--card)] md:flex md:flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <h1 className="text-lg font-bold text-emerald-600">🐔 {t.app.name}</h1>
          <p className="text-xs text-[var(--muted)]">{t.app.tagline}</p>
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
                  : "text-[var(--muted)] hover:bg-[var(--border)]/30"
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--card)]/95 px-3 backdrop-blur md:px-4">
          <button
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>
          <p className="truncate px-2 text-sm font-semibold md:hidden">
            {navItems.find((item) => item.href === pathname)?.key
              ? t.nav[navItems.find((item) => item.href === pathname)!.key]
              : t.app.name}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden p-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:p-4 md:p-6 md:pb-6">
          {children}
        </main>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="relative flex h-full w-[82%] max-w-xs flex-col bg-[var(--card)] pt-[env(safe-area-inset-top)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
              <div>
                <h1 className="font-bold text-emerald-600">🐔 {t.app.name}</h1>
                <p className="text-xs text-[var(--muted)]">{t.app.tagline}</p>
              </div>
              <button
                className="flex min-h-11 min-w-11 items-center justify-center"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation"
              >
                <X size={22} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {navItems.map(({ href, icon: Icon, key }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                    pathname === href
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "text-[var(--muted)]"
                  )}
                >
                  <Icon size={20} />
                  {t.nav[key]}
                </Link>
              ))}
            </nav>
            <div className="border-t border-[var(--border)] p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
              <Button variant="ghost" className="min-h-12 w-full justify-start gap-3" onClick={logout}>
                <LogOut size={20} />
                {t.auth.logout}
              </Button>
            </div>
          </aside>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--card)]/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {navItems.slice(0, 5).map(({ href, icon: Icon, key }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium",
              pathname === href ? "text-emerald-600" : "text-[var(--muted)]"
            )}
          >
            <Icon size={21} />
            <span className="max-w-full truncate">{t.nav[key]}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
