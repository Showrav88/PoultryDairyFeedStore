import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCustomerBalanceSummaries } from "@/lib/customers/balance";
import { getCustomerTier } from "@/lib/customers/tier";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  const customers = await prisma.customer.findMany({
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
    take: q ? 20 : 200,
  });

  const balances = await getCustomerBalanceSummaries(
    session.shopId,
    customers.map((c) => c.id)
  );

  return NextResponse.json({
    customers: customers.map((c) => {
      const lifetimeSpend = Number(c.lifetimeSpend);
      const bal = balances.get(c.id);
      const tier = getCustomerTier(lifetimeSpend);
      return {
        ...c,
        lifetimeSpend,
        totalDue: bal?.totalDue ?? 0,
        tier: tier.tier,
        tierLabel: tier.label,
      };
    }),
  });
}

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const existing = await prisma.customer.findUnique({
      where: { shopId_phone: { shopId: session.shopId, phone: data.phone } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A customer with this phone number already exists" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        shopId: session.shopId,
        name: data.name,
        phone: data.phone,
      },
    });

    await logAudit(
      session.shopId,
      "CUSTOMER",
      customer.id,
      "CREATE",
      `Customer "${data.name}" added`,
      null,
      customer
    );

    return NextResponse.json({
      customer: {
        ...customer,
        lifetimeSpend: Number(customer.lifetimeSpend),
        totalDue: 0,
        tier: "bronze",
        tierLabel: "Bronze",
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
