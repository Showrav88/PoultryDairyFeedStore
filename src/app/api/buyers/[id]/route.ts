import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  address: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.buyer.findFirst({ where: { id, shopId: session.shopId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    const buyer = await prisma.buyer.update({ where: { id }, data });
    await logAudit(session.shopId, "BUYER", id, "UPDATE", `Buyer "${buyer.name}" updated`, existing, buyer);
    return NextResponse.json({ buyer });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.buyer.findFirst({ where: { id, shopId: session.shopId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const purchaseCount = await prisma.purchase.count({ where: { buyerId: id } });
  if (purchaseCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete buyer with existing purchases" },
      { status: 400 }
    );
  }

  await prisma.buyer.delete({ where: { id } });
  await logAudit(session.shopId, "BUYER", id, "DELETE", `Buyer "${existing.name}" deleted`, existing, null);
  return NextResponse.json({ success: true });
}
