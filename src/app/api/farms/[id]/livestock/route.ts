import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { applyFarmWalletTx } from "@/lib/farms/wallet";

const livestockSchema = z.object({
  type: z.enum(["BUY", "SELL"]),
  description: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  amount: z.number().positive(),
  notes: z.string().optional(),
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

  const livestock = await prisma.farmLivestockTransaction.findMany({
    where: { farmId: id, shopId: session.shopId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ livestock });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: farmId } = await params;

  try {
    const data = livestockSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const farm = await tx.farm.findFirst({
        where: { id: farmId, shopId: session.shopId, isActive: true },
      });
      if (!farm) throw new Error("Farm not found");

      const txRecord = await tx.farmLivestockTransaction.create({
        data: {
          shopId: session.shopId,
          farmId,
          type: data.type,
          description: data.description,
          quantity: data.quantity,
          amount: data.amount,
          notes: data.notes,
        },
      });

      const isBuy = data.type === "BUY";
      await applyFarmWalletTx(tx, {
        shopId: session.shopId,
        type: isBuy ? "FARM_LIVESTOCK_BUY" : "FARM_LIVESTOCK_SELL",
        amount: data.amount,
        note: `Livestock ${isBuy ? "buy" : "sell"} — ${data.description} (${farm.name})`,
        referenceId: txRecord.id,
        decrement: isBuy,
      });

      return { txRecord, farm };
    });

    await logAudit(
      session.shopId,
      "FARM",
      farmId,
      "CREATE",
      `Livestock ${data.type} for "${result.farm.name}": ${data.description} — ৳${data.amount}`,
      null,
      result.txRecord
    );

    return NextResponse.json({ livestock: result.txRecord });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Livestock transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
