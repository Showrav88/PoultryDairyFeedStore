import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createSession,
  getSession,
  setSessionCookie,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const shopSelect = {
  id: true,
  email: true,
  shopName: true,
  shopNumber: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} as const;

const updateSchema = z.object({
  shopName: z.string().min(2).optional(),
  shopNumber: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shop = await prisma.shop.findUnique({
    where: { id: session.shopId },
    select: shopSelect,
  });

  if (!shop) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ shop });
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = updateSchema.parse(body);

    if (
      data.shopName == null &&
      data.shopNumber == null &&
      data.phone == null
    ) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const existing = await prisma.shop.findUnique({
      where: { id: session.shopId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (data.shopNumber && data.shopNumber !== existing.shopNumber) {
      const numberTaken = await prisma.shop.findFirst({
        where: { shopNumber: data.shopNumber, id: { not: session.shopId } },
      });
      if (numberTaken) {
        return NextResponse.json(
          { error: "Shop number already registered" },
          { status: 400 }
        );
      }
    }

    const shop = await prisma.shop.update({
      where: { id: session.shopId },
      data: {
        ...(data.shopName != null ? { shopName: data.shopName } : {}),
        ...(data.shopNumber != null ? { shopNumber: data.shopNumber } : {}),
        ...(data.phone != null ? { phone: data.phone } : {}),
      },
      select: shopSelect,
    });

    await logAudit(
      session.shopId,
      "SHOP",
      shop.id,
      "UPDATE",
      `Shop "${shop.shopName}" details updated`,
      {
        shopName: existing.shopName,
        shopNumber: existing.shopNumber,
        phone: existing.phone,
      },
      {
        shopName: shop.shopName,
        shopNumber: shop.shopNumber,
        phone: shop.phone,
      }
    );

    if (shop.shopName !== session.shopName) {
      const token = await createSession({
        shopId: session.shopId,
        email: session.email,
        shopName: shop.shopName,
      });
      await setSessionCookie(token);
    }

    return NextResponse.json({ shop });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("Shop update error:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
