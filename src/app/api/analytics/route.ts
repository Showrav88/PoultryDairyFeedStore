import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "day";

  const now = new Date();
  let startDate: Date;

  switch (period) {
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
  }

  const sales = await prisma.sale.findMany({
    where: { shopId: session.shopId, createdAt: { gte: startDate } },
    include: { items: { include: { product: true } } },
  });

  const totalRevenue = sales.reduce((s, sale) => s + Number(sale.totalAmount), 0);
  const totalPaid = sales.reduce((s, sale) => s + Number(sale.paidAmount), 0);
  const totalDue = sales.reduce((s, sale) => s + Number(sale.dueAmount), 0);

  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const sale of sales) {
    for (const item of sale.items) {
      const key = item.productId;
      if (!productSales[key]) {
        productSales[key] = { name: item.product.name, qty: 0, revenue: 0 };
      }
      productSales[key].qty += item.quantityInSmallestUnit;
      productSales[key].revenue += Number(item.lineTotal);
    }
  }

  const ranked = Object.values(productSales).sort((a, b) => b.revenue - a.revenue);

  const products = await prisma.product.findMany({
    where: { shopId: session.shopId, isActive: true },
  });

  const inventoryValue = products.reduce(
    (s, p) => s + (p.stockInSmallestUnit / p.basePackageSize) * Number(p.sellPrice),
    0
  );

  const logs = await prisma.auditLog.findMany({
    where: { shopId: session.shopId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    period,
    totalRevenue,
    totalPaid,
    totalDue,
    saleCount: sales.length,
    topProducts: ranked.slice(0, 5),
    lowProducts: ranked.slice(-5).reverse(),
    inventoryValue,
    logs,
  });
}
