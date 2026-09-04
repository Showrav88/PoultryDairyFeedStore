import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { applyFarmWalletTx } from "@/lib/farms/wallet";

const expenseSchema = z.object({
  type: z.enum(["SALARY", "BILL", "UTILITY", "OTHER"]),
  amount: z.number().positive(),
  description: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const farm = await prisma.farm.findFirst({ where: { id, shopId: session.shopId } });
  if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 404 });

  const expenses = await prisma.farmExpense.findMany({
    where: { farmId: id, shopId: session.shopId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ expenses });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: farmId } = await params;

  try {
    const data = expenseSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const farm = await tx.farm.findFirst({
        where: { id: farmId, shopId: session.shopId, isActive: true },
      });
      if (!farm) throw new Error("Farm not found");

      const expense = await tx.farmExpense.create({
        data: {
          shopId: session.shopId,
          farmId,
          type: data.type,
          amount: data.amount,
          description: data.description,
        },
      });

      await applyFarmWalletTx(tx, {
        shopId: session.shopId,
        type: "FARM_EXPENSE",
        amount: data.amount,
        note: `${data.type} expense for ${farm.name}${data.description ? `: ${data.description}` : ""}`,
        referenceId: expense.id,
        decrement: true,
      });

      return { expense, farm };
    });

    await logAudit(
      session.shopId,
      "FARM",
      farmId,
      "CREATE",
      `Expense for "${result.farm.name}": ৳${data.amount} (${data.type})`,
      null,
      result.expense
    );

    return NextResponse.json({ expense: result.expense });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Expense failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
