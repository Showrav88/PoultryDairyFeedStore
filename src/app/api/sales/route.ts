import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { formatSellUnitLabel } from "@/lib/inventory/sell-units";
import { deductStock } from "@/lib/inventory/khucra";
import { computeLineProfit } from "@/lib/inventory/avg-cost";
import { calcUnitPriceFromReference } from "@/lib/inventory/unit-price";
import { computeLineTpProfit, tpPricePerSmallestUnit } from "@/lib/pricing/tp-pricing";
import { isBelowSuggested } from "@/lib/sell/last-price";
import { validateSaleCheckout } from "@/lib/sell/sale-validation";
import type { BuyerType, Prisma } from "@/generated/prisma/client";

const saleSchema = z.object({
  farmerId: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  paidAmount: z.number().min(0),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantityInSmallestUnit: z.number().int().positive(),
      pricePerUnit: z.number().min(0),
      unitCount: z.number().int().positive().default(1),
    })
  ).min(1),
});

function calcPaymentStatus(total: number, paid: number) {
  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "DUE";
}

async function resolveCustomer(
  tx: Prisma.TransactionClient,
  shopId: string,
  params: {
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    requireIdentity: boolean;
  }
): Promise<{ customerId?: string; customerName?: string; customerPhone?: string }> {
  if (params.customerId) {
    const customer = await tx.customer.findFirst({
      where: { id: params.customerId, shopId, isActive: true },
    });
    if (!customer) throw new Error("Customer not found");
    return {
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
    };
  }

  const name = params.customerName?.trim();
  const phone = params.customerPhone?.trim();

  if (params.requireIdentity) {
    if (!name || !phone || phone.length < 10) {
      throw new Error("Due sales require customer name and phone (or select a saved customer)");
    }
  }

  if (phone && phone.length >= 10) {
    const existing = await tx.customer.findUnique({
      where: { shopId_phone: { shopId, phone } },
    });
    if (existing) {
      if (name && name !== existing.name) {
        await tx.customer.update({
          where: { id: existing.id },
          data: { name },
        });
      }
      return {
        customerId: existing.id,
        customerName: name || existing.name,
        customerPhone: phone,
      };
    }

    if (name) {
      const created = await tx.customer.create({
        data: { shopId, name, phone },
      });
      return {
        customerId: created.id,
        customerName: created.name,
        customerPhone: created.phone,
      };
    }
  }

  return {
    customerName: name || undefined,
    customerPhone: phone || undefined,
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = saleSchema.parse(body);

    if (data.farmerId && data.customerId) {
      throw new Error("Cannot link both farmer and customer on the same sale");
    }

    const productsPreflight = await prisma.product.findMany({
      where: {
        id: { in: data.items.map((i) => i.productId) },
        shopId: session.shopId,
        isActive: true,
      },
    });
    const preflightTotal = data.items.reduce(
      (s, i) => s + i.pricePerUnit * (i.unitCount ?? 1),
      0
    );
    const checkoutError = validateSaleCheckout({
      lines: data.items.map((i) => ({
        productId: i.productId,
        quantityInSmallestUnit: i.quantityInSmallestUnit,
        pricePerUnit: i.pricePerUnit,
        unitCount: i.unitCount,
      })),
      products: productsPreflight.map((p) => ({ id: p.id, basePackageSize: p.basePackageSize })),
      paidAmount: data.paidAmount,
      totalAmount: preflightTotal,
      farmerId: data.farmerId,
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
    });
    if (checkoutError) {
      return NextResponse.json({ error: checkoutError }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let farmerName: string | undefined;
      if (data.farmerId) {
        const farmer = await tx.farmer.findFirst({
          where: { id: data.farmerId, shopId: session.shopId, isActive: true },
        });
        if (!farmer) throw new Error("Farmer not found");
        farmerName = farmer.name;
      }

      const products = await tx.product.findMany({
        where: {
          id: { in: data.items.map((i) => i.productId) },
          shopId: session.shopId,
          isActive: true,
        },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));
      const inventoryUpdates: { id: string; state: ReturnType<typeof deductStock> }[] = [];

      for (const item of data.items) {
        const product = productMap.get(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);

        const deductResult = deductStock(
          {
            stockInSmallestUnit: product.stockInSmallestUnit,
            closedPackages: product.closedPackages,
            openPackageRemaining: product.openPackageRemaining,
            basePackageSize: product.basePackageSize,
          },
          item.quantityInSmallestUnit * item.unitCount
        );

        if (!deductResult.success) {
          throw new Error(`${product.name}: ${deductResult.error}`);
        }

        inventoryUpdates.push({ id: product.id, state: deductResult });
      }

      const lineItems = data.items.map((item) => {
        const product = productMap.get(item.productId)!;
        const unitSize = item.quantityInSmallestUnit;
        const totalQty = unitSize * item.unitCount;
        const lineTotal = item.pricePerUnit * item.unitCount;
        const costPerUnit = Number(product.avgCostPerSmallestUnit);
        const { costTotal, profit } = computeLineProfit(totalQty, lineTotal, costPerUnit);
        const suggestedPricePerUnit = calcUnitPriceFromReference(
          Number(product.sellPrice),
          unitSize,
          product.basePackageSize
        );
        const belowSuggested = isBelowSuggested(item.pricePerUnit, suggestedPricePerUnit);

        const defaultTpPerPackage =
          product.defaultTpPrice != null ? Number(product.defaultTpPrice) : 0;
        const tpPerUnit = tpPricePerSmallestUnit(defaultTpPerPackage, product.basePackageSize);
        const tpLine = computeLineTpProfit(totalQty, lineTotal, tpPerUnit);

        return {
          productId: item.productId,
          quantityInSmallestUnit: totalQty,
          sellUnitSize: unitSize,
          sellUnitLabel: formatSellUnitLabel(
            unitSize,
            product.weightUnit,
            product.basePackageSize
          ),
          pricePerUnit: item.pricePerUnit,
          suggestedPricePerUnit,
          belowSuggested,
          lineTotal,
          unitCount: item.unitCount,
          costPerSmallestUnit: costPerUnit,
          costTotal,
          profit,
          tpPerSmallestUnit: tpLine?.tpPerSmallestUnit ?? null,
          tpTotal: tpLine?.tpTotal ?? null,
          tpProfit: tpLine?.tpProfit ?? null,
        };
      });

      const totalAmount = lineItems.reduce((s, i) => s + i.lineTotal, 0);
      const totalCost = lineItems.reduce((s, i) => s + i.costTotal, 0);
      const totalProfit = lineItems.reduce((s, i) => s + i.profit, 0);
      const tpProfitLines = lineItems.filter((i) => i.tpProfit != null);
      const totalTpProfit =
        tpProfitLines.length > 0
          ? tpProfitLines.reduce((s, i) => s + (i.tpProfit ?? 0), 0)
          : null;

      const salePaid = Math.min(data.paidAmount, totalAmount);
      const dueAmount = Math.max(0, totalAmount - salePaid);
      const status = calcPaymentStatus(totalAmount, salePaid);

      if (data.paidAmount > totalAmount) {
        throw new Error("Paid amount cannot exceed sale total");
      }

      let customerId: string | undefined;
      let customerName: string | undefined;
      let customerPhone: string | undefined;

      if (!data.farmerId) {
        const resolved = await resolveCustomer(tx, session.shopId, {
          customerId: data.customerId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          requireIdentity: dueAmount > 0,
        });
        customerId = resolved.customerId;
        customerName = resolved.customerName;
        customerPhone = resolved.customerPhone;
      }

      const sale = await tx.sale.create({
        data: {
          shopId: session.shopId,
          farmerId: data.farmerId,
          customerId,
          customerName: data.farmerId ? farmerName : customerName,
          customerPhone: data.farmerId ? undefined : customerPhone,
          totalAmount,
          totalCost,
          totalProfit,
          totalTpProfit,
          paidAmount: salePaid,
          dueAmount,
          status,
          notes: data.notes,
          items: { create: lineItems },
        },
        include: {
          items: { include: { product: true } },
          farmer: true,
          customer: true,
        },
      });

      for (const update of inventoryUpdates) {
        await tx.product.update({
          where: { id: update.id },
          data: update.state.newState,
        });
      }

      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: { lifetimeSpend: { increment: totalAmount } },
        });
      }

      if (data.farmerId) {
        await tx.farmer.update({
          where: { id: data.farmerId },
          data: { lifetimeSpend: { increment: totalAmount } },
        });
      }

      if (salePaid > 0) {
        const wallet = await tx.wallet.findUnique({ where: { shopId: session.shopId } });
        if (wallet) {
          await tx.wallet.update({
            where: { shopId: session.shopId },
            data: { balance: { increment: salePaid } },
          });
          await tx.walletTransaction.create({
            data: {
              shopId: session.shopId,
              type: "SALE_INCOME",
              amount: salePaid,
              note: `Sale #${sale.id.slice(-6)}`,
              referenceId: sale.id,
            },
          });
        }
      }

      if (dueAmount > 0) {
        const dueLabel = farmerName
          ? farmerName
          : customerName
            ? customerName
            : "Customer";
        await tx.walletTransaction.create({
          data: {
            shopId: session.shopId,
            type: "RECEIVABLE",
            amount: dueAmount,
            note: `Customer due - Sale #${sale.id.slice(-6)} (${dueLabel})`,
            referenceId: sale.id,
          },
        });
      }

      const buyerType: BuyerType | null = data.farmerId
        ? "FARMER"
        : customerId
          ? "CUSTOMER"
          : null;
      const buyerId = data.farmerId ?? customerId;

      if (buyerType && buyerId) {
        for (const item of data.items) {
          const product = productMap.get(item.productId)!;
          const sellUnitLabel = formatSellUnitLabel(
            item.quantityInSmallestUnit,
            product.weightUnit,
            product.basePackageSize
          );
          await tx.buyerProductLastPrice.upsert({
            where: {
              shopId_buyerType_buyerId_productId_unitSizeInSmallestUnit: {
                shopId: session.shopId,
                buyerType,
                buyerId,
                productId: item.productId,
                unitSizeInSmallestUnit: item.quantityInSmallestUnit,
              },
            },
            create: {
              shopId: session.shopId,
              buyerType,
              buyerId,
              productId: item.productId,
              unitSizeInSmallestUnit: item.quantityInSmallestUnit,
              sellUnitLabel,
              pricePerUnit: item.pricePerUnit,
            },
            update: {
              pricePerUnit: item.pricePerUnit,
              sellUnitLabel,
            },
          });
        }
      }

      return sale;
    });

    await logAudit(
      session.shopId,
      "SALE",
      result.id,
      "CREATE",
      `Sale completed: ৳${Number(result.totalAmount)} (${result.status})`,
      null,
      result
    );

    const belowLines = result.items.filter((i) => i.belowSuggested);
    if (belowLines.length > 0) {
      const summary = belowLines
        .map(
          (i) =>
            `${i.product.name} ${i.sellUnitLabel} @ ৳${Number(i.pricePerUnit)} (suggested ৳${Number(i.suggestedPricePerUnit ?? 0)})`
        )
        .join("; ");
      await logAudit(
        session.shopId,
        "SALE",
        result.id,
        "UPDATE",
        `Below suggested pricing: ${summary}`,
        null,
        { saleId: result.id, lines: belowLines.map((i) => i.id) }
      );
    }

    return NextResponse.json({ sale: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sale failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const farmerId = searchParams.get("farmerId");
  const customerId = searchParams.get("customerId");
  const date = searchParams.get("date");

  const where: Record<string, unknown> = { shopId: session.shopId };

  if (farmerId) {
    where.farmerId = farmerId;
  }

  if (customerId) {
    where.customerId = customerId;
  }

  if (q) {
    where.OR = [
      { customerName: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q } },
      { farmer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q } } },
    ];
  }

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { gte: start, lte: end };
  }

  const sales = await prisma.sale.findMany({
    where,
    include: { items: { include: { product: true } }, farmer: true, customer: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ sales });
}
