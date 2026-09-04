import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shop = await prisma.shop.findUnique({
    where: { id: session.shopId },
    select: {
      id: true,
      email: true,
      shopName: true,
      shopNumber: true,
      phone: true,
    },
  });

  return NextResponse.json({ shop });
}
