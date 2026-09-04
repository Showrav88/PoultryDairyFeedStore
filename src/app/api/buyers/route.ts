import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  const buyers = await prisma.buyer.findMany({
    where: {
      shopId: session.shopId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ buyers });
}

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  address: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const buyer = await prisma.buyer.create({
      data: { shopId: session.shopId, ...data },
    });

    await logAudit(session.shopId, "BUYER", buyer.id, "CREATE", `Buyer "${data.name}" added`, null, buyer);

    return NextResponse.json({ buyer });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create buyer" }, { status: 500 });
  }
}
