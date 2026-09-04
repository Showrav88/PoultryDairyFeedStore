import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

const registerSchema = z.object({
  email: z.string().email(),
  shopName: z.string().min(2),
  shopNumber: z.string().min(1),
  phone: z.string().min(10),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    const existing = await prisma.shop.findFirst({
      where: {
        OR: [{ email: data.email }, { shopNumber: data.shopNumber }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email or shop number already registered" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(data.password);

    const shop = await prisma.shop.create({
      data: {
        email: data.email,
        shopName: data.shopName,
        shopNumber: data.shopNumber,
        phone: data.phone,
        passwordHash,
        wallet: { create: { balance: 0 } },
      },
    });

    await prisma.auditLog.create({
      data: {
        shopId: shop.id,
        entity: "SHOP",
        entityId: shop.id,
        action: "CREATE",
        summary: `Shop "${data.shopName}" registered`,
        newData: { shopName: data.shopName, shopNumber: data.shopNumber },
      },
    });

    return NextResponse.json({ success: true, shopId: shop.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("Register error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
