import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const farm = await prisma.farm.findFirst({
    where: { id, shopId: session.shopId },
    include: {
      issues: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { items: { include: { product: true } } },
      },
      returns: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { items: { include: { product: true } } },
      },
      expenses: { orderBy: { createdAt: "desc" }, take: 30 },
      livestock: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });

  if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 404 });

  const issueCost = farm.issues.reduce((s, i) => s + Number(i.totalCost), 0);
  const expenseTotal = farm.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const livestockBuy = farm.livestock
    .filter((l) => l.type === "BUY")
    .reduce((s, l) => s + Number(l.amount), 0);
  const livestockSell = farm.livestock
    .filter((l) => l.type === "SELL")
    .reduce((s, l) => s + Number(l.amount), 0);
  const returnCredit = farm.returns
    .filter((r) => r.status === "APPROVED")
    .reduce((s, r) => s + Number(r.totalCost), 0);

  return NextResponse.json({
    farm,
    summary: {
      feedIssuedCost: issueCost - returnCredit,
      expenses: expenseTotal,
      livestockBuy,
      livestockSell,
      netLivestock: livestockSell - livestockBuy,
    },
  });
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  animalType: z.enum(["POULTRY", "COW", "FISH", "DUCK", "GOAT", "SHEEP", "RABBIT", "OTHER"]).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const existing = await prisma.farm.findFirst({ where: { id, shopId: session.shopId } });
    if (!existing) return NextResponse.json({ error: "Farm not found" }, { status: 404 });

    const data = updateSchema.parse(await request.json());
    const farm = await prisma.farm.update({ where: { id }, data });
    await logAudit(session.shopId, "FARM", id, "UPDATE", `Farm "${farm.name}" updated`, existing, farm);
    return NextResponse.json({ farm });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.farm.findFirst({ where: { id, shopId: session.shopId } });
  if (!existing) return NextResponse.json({ error: "Farm not found" }, { status: 404 });

  await prisma.farm.update({ where: { id }, data: { isActive: false } });
  await logAudit(session.shopId, "FARM", id, "DELETE", `Farm "${existing.name}" deactivated`, existing, null);
  return NextResponse.json({ success: true });
}
