import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wallet = await prisma.wallet.findUnique({
    where: { shopId: session.shopId },
  });

  const transactions = await prisma.walletTransaction.findMany({
    where: { shopId: session.shopId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    balance: wallet ? Number(wallet.balance) : 0,
    transactions,
  });
}

const txSchema = z.object({
  type: z.enum(["DEPOSIT", "WITHDRAW", "EXPENSE"]),
  amount: z.number().positive(),
  category: z.enum(["FAMILY", "UTILITIES", "LAW_AND_SUIT", "GUEST_BILL", "STAFF_SALARY", "OTHER"]).optional(),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = txSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { shopId: session.shopId } });
      if (!wallet) throw new Error("Wallet not found");

      const currentBalance = Number(wallet.balance);
      const delta = data.type === "DEPOSIT" ? data.amount : -data.amount;

      if (data.type !== "DEPOSIT" && currentBalance < data.amount) {
        throw new Error("Insufficient wallet balance");
      }

      const updated = await tx.wallet.update({
        where: { shopId: session.shopId },
        data: { balance: { increment: delta } },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          shopId: session.shopId,
          type: data.type,
          category: data.type === "EXPENSE" ? (data.category ?? "OTHER") : undefined,
          amount: data.amount,
          note: data.note,
        },
      });

      return { wallet: updated, transaction };
    });

    await logAudit(
      session.shopId,
      "WALLET",
      result.transaction.id,
      "CREATE",
      `Wallet ${data.type}: ৳${data.amount}`,
      null,
      result.transaction
    );

    return NextResponse.json({
      balance: Number(result.wallet.balance),
      transaction: result.transaction,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
