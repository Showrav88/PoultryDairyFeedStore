import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getFarmerBalanceSummaries } from "@/lib/farmers/balance";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  const farmers = await prisma.farmer.findMany({
    where: {
      shopId: session.shopId,
      isActive: true,
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

  const balances = await getFarmerBalanceSummaries(
    session.shopId,
    farmers.map((f) => f.id)
  );

  return NextResponse.json({
    farmers: farmers.map((f) => {
      const bal = balances.get(f.id);
      return {
        ...f,
        openingDue: Number(f.openingDue),
        totalDue: bal?.totalDue ?? 0,
        alert: bal?.alert ?? "none",
        daysOverdue: bal?.daysOverdue ?? 0,
        oldestDueAt: bal?.oldestDueAt?.toISOString() ?? null,
      };
    }),
  });
}

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  address: z.string().optional(),
  openingDue: z.number().min(0).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const farmer = await prisma.farmer.create({
      data: {
        shopId: session.shopId,
        name: data.name,
        phone: data.phone,
        address: data.address,
        openingDue: data.openingDue ?? 0,
      },
    });

    await logAudit(
      session.shopId,
      "FARMER",
      farmer.id,
      "CREATE",
      `Farmer "${data.name}" added`,
      null,
      farmer
    );

    return NextResponse.json({ farmer });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create farmer" }, { status: 500 });
  }
}
