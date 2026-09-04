import type { WalletTxType } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

export async function applyFarmWalletTx(
  tx: TxClient,
  params: {
    shopId: string;
    type: WalletTxType;
    amount: number;
    note: string;
    referenceId?: string;
    decrement?: boolean;
  }
) {
  const wallet = await tx.wallet.findUnique({ where: { shopId: params.shopId } });
  if (!wallet) throw new Error("Wallet not found");

  const delta = params.decrement ? -params.amount : params.amount;
  if (params.decrement && Number(wallet.balance) < params.amount) {
    throw new Error("Insufficient wallet balance for this farm transaction");
  }

  await tx.wallet.update({
    where: { shopId: params.shopId },
    data: { balance: { increment: delta } },
  });

  await tx.walletTransaction.create({
    data: {
      shopId: params.shopId,
      type: params.type,
      amount: params.amount,
      note: params.note,
      referenceId: params.referenceId,
    },
  });
}

export const ANIMAL_TYPE_LABELS: Record<string, { en: string; bn: string }> = {
  POULTRY: { en: "Poultry", bn: "পোল্ট্রি" },
  COW: { en: "Cow / Cattle", bn: "গরু" },
  FISH: { en: "Fish", bn: "মাছ" },
  DUCK: { en: "Duck", bn: "হাঁস" },
  GOAT: { en: "Goat", bn: "ছাগল" },
  SHEEP: { en: "Sheep", bn: "ভেড়া" },
  RABBIT: { en: "Rabbit", bn: "খরগোশ" },
  OTHER: { en: "Other", bn: "অন্যান্য" },
};
