import { prisma } from "@/lib/db";

export async function logWalletDebt(
  shopId: string,
  type: "RECEIVABLE" | "PAYABLE",
  amount: number,
  note: string,
  referenceId: string
) {
  if (amount <= 0) return;
  await prisma.walletTransaction.create({
    data: {
      shopId,
      type,
      amount,
      note,
      referenceId,
    },
  });
}
