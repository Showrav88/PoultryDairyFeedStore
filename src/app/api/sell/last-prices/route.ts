import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { BuyerTypeKey } from "@/lib/sell/last-price";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const farmerId = searchParams.get("farmerId");
  const customerId = searchParams.get("customerId");
  const phone = searchParams.get("phone")?.trim();

  let buyerType: BuyerTypeKey | null = null;
  let buyerId: string | null = null;

  if (farmerId) {
    const farmer = await prisma.farmer.findFirst({
      where: { id: farmerId, shopId: session.shopId, isActive: true },
    });
    if (!farmer) return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    buyerType = "FARMER";
    buyerId = farmer.id;
  } else if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, shopId: session.shopId, isActive: true },
    });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    buyerType = "CUSTOMER";
    buyerId = customer.id;
  } else if (phone && phone.length >= 10) {
    const customer = await prisma.customer.findUnique({
      where: { shopId_phone: { shopId: session.shopId, phone } },
    });
    if (customer?.isActive) {
      buyerType = "CUSTOMER";
      buyerId = customer.id;
    } else {
      const farmer = await prisma.farmer.findFirst({
        where: { shopId: session.shopId, phone, isActive: true },
      });
      if (farmer) {
        buyerType = "FARMER";
        buyerId = farmer.id;
      }
    }
  }

  if (!buyerType || !buyerId) {
    return NextResponse.json({ prices: [] });
  }

  const rows = await prisma.buyerProductLastPrice.findMany({
    where: { shopId: session.shopId, buyerType, buyerId },
  });

  return NextResponse.json({
    prices: rows.map((r) => ({
      productId: r.productId,
      unitSizeInSmallestUnit: r.unitSizeInSmallestUnit,
      sellUnitLabel: r.sellUnitLabel,
      pricePerUnit: Number(r.pricePerUnit),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}
