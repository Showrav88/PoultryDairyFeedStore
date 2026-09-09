import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCustomerBalanceSummaries } from "@/lib/customers/balance";
import { getCustomerTier } from "@/lib/customers/tier";
import { getFarmerBalanceSummaries } from "@/lib/farmers/balance";
import { getSpendTier } from "@/lib/spend/tier";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ buyers: [] });
  }

  const where = {
    shopId: session.shopId,
    isActive: true,
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { phone: { contains: q } },
    ],
  };

  const [farmers, customers] = await Promise.all([
    prisma.farmer.findMany({ where, orderBy: { name: "asc" }, take: 15 }),
    prisma.customer.findMany({ where, orderBy: { name: "asc" }, take: 15 }),
  ]);

  const farmerBalances = await getFarmerBalanceSummaries(
    session.shopId,
    farmers.map((f) => f.id)
  );
  const customerBalances = await getCustomerBalanceSummaries(
    session.shopId,
    customers.map((c) => c.id)
  );

  const buyers = [
    ...farmers.map((f) => {
      const lifetimeSpend = Number(f.lifetimeSpend);
      const tier = getSpendTier(lifetimeSpend);
      return {
        type: "FARMER" as const,
        id: f.id,
        name: f.name,
        phone: f.phone,
        totalDue: farmerBalances.get(f.id)?.totalDue ?? 0,
        lifetimeSpend,
        tier: tier.tier,
        tierLabel: tier.label,
      };
    }),
    ...customers.map((c) => {
      const lifetimeSpend = Number(c.lifetimeSpend);
      const tier = getCustomerTier(lifetimeSpend);
      return {
        type: "CUSTOMER" as const,
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalDue: customerBalances.get(c.id)?.totalDue ?? 0,
        lifetimeSpend,
        tier: tier.tier,
        tierLabel: tier.label,
      };
    }),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ buyers });
}
