import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().min(1),
  animalType: z.enum(["POULTRY", "COW", "FISH", "DUCK", "GOAT", "SHEEP", "RABBIT", "OTHER"]),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const farms = await prisma.farm.findMany({
    where: { shopId: session.shopId, isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { issues: true, expenses: true } },
    },
  });

  return NextResponse.json({ farms });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = createSchema.parse(await request.json());
    const farm = await prisma.farm.create({
      data: { shopId: session.shopId, ...data },
    });
    await logAudit(session.shopId, "FARM", farm.id, "CREATE", `Farm "${data.name}" added`, null, farm);
    return NextResponse.json({ farm });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create farm" }, { status: 500 });
  }
}
