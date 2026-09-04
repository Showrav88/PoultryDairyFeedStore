import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateProductId(name: string, counter: number): string {
  const prefix = name
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12)
    .toUpperCase() || "PROD";
  const num = String(counter).padStart(6, "0");
  return `${prefix}-${num}`;
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `৳${num.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateTime(date: Date | string, locale = "en"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(locale === "bn" ? "bn-BD" : "en-BD", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Empty input when amount is 0 — avoids showing 0 in payment fields */
export function formatOptionalAmount(value: number): string {
  return value === 0 ? "" : String(value);
}

export function parseOptionalAmountInput(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}
