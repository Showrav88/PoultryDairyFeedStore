export type PaymentAlert = "none" | "normal" | "amber" | "red";

/** Amber at 15+ days overdue, red at 30+ days (from oldest unpaid sale). */
export function getPaymentAlert(
  oldestDueAt: Date | null,
  totalDue: number
): PaymentAlert {
  if (totalDue <= 0 || !oldestDueAt) return "none";
  const days = Math.floor((Date.now() - oldestDueAt.getTime()) / 86_400_000);
  if (days >= 30) return "red";
  if (days >= 15) return "amber";
  return "normal";
}

export function alertDaysOverdue(oldestDueAt: Date | null, totalDue: number): number {
  if (totalDue <= 0 || !oldestDueAt) return 0;
  return Math.max(0, Math.floor((Date.now() - oldestDueAt.getTime()) / 86_400_000));
}
