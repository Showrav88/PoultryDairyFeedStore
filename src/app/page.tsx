import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 night:from-slate-950 night:to-slate-900">
      <div className="mx-auto max-w-lg text-center px-4">
        <div className="mb-6 text-6xl">🐔</div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          Feed Store
        </h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
          Poultry & Dairy Feed Management System
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          পোল্ট্রি ও দুগ্ধ ফিড ব্যবস্থাপনা সিস্টেম
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link href="/register">
            <Button size="lg">Register Shop</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">Login</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
