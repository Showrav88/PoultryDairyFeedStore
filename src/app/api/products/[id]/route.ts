import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getInventorySummary } from "@/lib/inventory/khugra";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, shopId: session.shopId },
  });

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    product: {
      ...product,
      sellPrice: Number(product.sellPrice),
      inventory: getInventorySummary({
        stockInSmallestUnit: product.stockInSmallestUnit,
        closedPackages: product.closedPackages,
        openPackageRemaining: product.openPackageRemaining,
        basePackageSize: product.basePackageSize,
      }),
    },
  });
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  imageUrl: z.string().optional(),
  weightUnit: z.enum(["GENERIC", "GRAM", "KG", "LITER", "ML", "BAG", "PIECE"]).optional(),
  basePackageSize: z.number().int().positive().optional(),
  sellPrice: z.number().min(0).optional(),
  allowedSellUnits: z.array(z.number().int().positive()).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.product.findFirst({ where: { id, shopId: session.shopId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    await logAudit(session.shopId, "PRODUCT", id, "UPDATE", `Product "${product.name}" updated`, existing, product);

    return NextResponse.json({ product });
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
  const existing = await prisma.product.findFirst({ where: { id, shopId: session.shopId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.product.update({ where: { id }, data: { isActive: false } });
  await logAudit(session.shopId, "PRODUCT", id, "DELETE", `Product "${existing.name}" deactivated`, existing, null);

  return NextResponse.json({ success: true });
}
