import type { PaymentStatus, Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

function calcPaymentStatus(total: number, paid: number): PaymentStatus {
  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "DUE";
}

export interface PaymentAllocation {
  saleId: string | null;
  amount: number;
  label: string;
}

export interface CollectPaymentResult {
  paymentId: string;
  amount: number;
  allocations: PaymentAllocation[];
  remainingUnallocated: number;
  newTotalDue: number;
}

async function applyToSaleDue(
  tx: TxClient,
  params: {
    shopId: string;
    farmerName: string;
    saleId: string;
    amount: number;
  }
): Promise<number> {
  const sale = await tx.sale.findFirst({
    where: { id: params.saleId, shopId: params.shopId },
  });
  if (!sale || Number(sale.dueAmount) <= 0) return 0;

  const due = Number(sale.dueAmount);
  const applied = Math.min(due, params.amount);
  const newPaid = Number(sale.paidAmount) + applied;
  const newDue = due - applied;
  const total = Number(sale.totalAmount);

  await tx.sale.update({
    where: { id: params.saleId },
    data: {
      paidAmount: newPaid,
      dueAmount: newDue,
      status: calcPaymentStatus(total, newPaid),
    },
  });

  await tx.walletTransaction.create({
    data: {
      shopId: params.shopId,
      type: "RECEIVABLE",
      amount: applied,
      note: `Due collected from ${params.farmerName} — Sale #${params.saleId.slice(-6)}`,
      referenceId: params.saleId,
    },
  });

  return applied;
}

async function applyToOpeningDue(
  tx: TxClient,
  params: { farmerId: string; amount: number }
): Promise<number> {
  const farmer = await tx.farmer.findUnique({ where: { id: params.farmerId } });
  if (!farmer || Number(farmer.openingDue) <= 0) return 0;

  const openingDue = Number(farmer.openingDue);
  const applied = Math.min(openingDue, params.amount);

  await tx.farmer.update({
    where: { id: params.farmerId },
    data: { openingDue: openingDue - applied },
  });

  return applied;
}

/**
 * Allocate a farmer payment FIFO: optional target sale first, then opening due, then oldest sales.
 */
export async function collectFarmerPayment(
  tx: TxClient,
  params: {
    shopId: string;
    farmerId: string;
    farmerName: string;
    amount: number;
    note?: string;
    saleId?: string;
    targetSaleId?: string;
    excludeSaleId?: string;
    skipWallet?: boolean;
  }
): Promise<CollectPaymentResult> {
  if (params.amount <= 0) throw new Error("Payment amount must be positive");

  const farmer = await tx.farmer.findFirst({
    where: { id: params.farmerId, shopId: params.shopId },
  });
  if (!farmer) throw new Error("Farmer not found");

  let remaining = params.amount;
  const allocations: PaymentAllocation[] = [];

  if (params.targetSaleId) {
    const applied = await applyToSaleDue(tx, {
      shopId: params.shopId,
      farmerName: params.farmerName,
      saleId: params.targetSaleId,
      amount: remaining,
    });
    if (applied > 0) {
      remaining -= applied;
      allocations.push({
        saleId: params.targetSaleId,
        amount: applied,
        label: `Sale #${params.targetSaleId.slice(-6)}`,
      });
    }
  }

  const openingApplied = await applyToOpeningDue(tx, {
    farmerId: params.farmerId,
    amount: remaining,
  });
  if (openingApplied > 0) {
    remaining -= openingApplied;
    allocations.push({
      saleId: null,
      amount: openingApplied,
      label: "Opening due",
    });
  }

  const excludeIds = new Set<string>();
  if (params.excludeSaleId) excludeIds.add(params.excludeSaleId);
  if (params.targetSaleId) excludeIds.add(params.targetSaleId);

  const unpaidSales = await tx.sale.findMany({
    where: {
      shopId: params.shopId,
      farmerId: params.farmerId,
      dueAmount: { gt: 0 },
      ...(excludeIds.size > 0 ? { id: { notIn: [...excludeIds] } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  for (const sale of unpaidSales) {
    if (remaining <= 0) break;
    const applied = await applyToSaleDue(tx, {
      shopId: params.shopId,
      farmerName: params.farmerName,
      saleId: sale.id,
      amount: remaining,
    });
    if (applied > 0) {
      remaining -= applied;
      allocations.push({
        saleId: sale.id,
        amount: applied,
        label: `Sale #${sale.id.slice(-6)}`,
      });
    }
  }

  const payment = await tx.farmerPayment.create({
    data: {
      shopId: params.shopId,
      farmerId: params.farmerId,
      amount: params.amount,
      note: params.note,
      saleId: params.saleId,
      allocations: {
        create: allocations.map((a) => ({
          saleId: a.saleId,
          amount: a.amount,
        })),
      },
    },
  });

  if (!params.skipWallet) {
    const wallet = await tx.wallet.findUnique({ where: { shopId: params.shopId } });
    if (wallet) {
      await tx.wallet.update({
        where: { shopId: params.shopId },
        data: { balance: { increment: params.amount } },
      });
      await tx.walletTransaction.create({
        data: {
          shopId: params.shopId,
          type: "SALE_INCOME",
          amount: params.amount,
          note: `Payment from ${params.farmerName}${params.note ? `: ${params.note}` : ""}`,
          referenceId: payment.id,
        },
      });
    }
  }

  const updatedFarmer = await tx.farmer.findUnique({ where: { id: params.farmerId } });
  const stillUnpaid = await tx.sale.aggregate({
    where: { shopId: params.shopId, farmerId: params.farmerId, dueAmount: { gt: 0 } },
    _sum: { dueAmount: true },
  });
  const newTotalDue =
    Number(updatedFarmer?.openingDue ?? 0) + Number(stillUnpaid._sum.dueAmount ?? 0);

  return {
    paymentId: payment.id,
    amount: params.amount,
    allocations,
    remainingUnallocated: remaining,
    newTotalDue,
  };
}
