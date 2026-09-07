import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const issues = await prisma.farmIssue.findMany({
    where: { shopId: session.shopId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      farm: { select: { id: true, name: true, animalType: true } },
      items: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json({ issues });
}
