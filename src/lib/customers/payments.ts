import type { PaymentStatus, Prisma } from "@/generated/prisma/client";
import { getCustomerTotalDueInTx } from "@/lib/customers/balance";

type TxClient = Prisma.TransactionClient;

function calcPaymentStatus(total: number, paid: number): PaymentStatus {
  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "DUE";
}

export interface CustomerPaymentAllocation {
  saleId: string | null;
  amount: number;
  label: string;
}

export interface CollectCustomerPaymentResult {
  paymentId: string;
  amount: number;
  allocations: CustomerPaymentAllocation[];
  remainingUnallocated: number;
  newTotalDue: number;
}

async function applyToCustomerSaleDue(
  tx: TxClient,
  params: {
    shopId: string;
    customerName: string;
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
  const total = Number(sale.totalAmount);
  const newPaid = Math.min(total, Number(sale.paidAmount) + applied);
  const newDue = Math.max(0, total - newPaid);

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
      note: `Due collected from ${params.customerName} — Sale #${params.saleId.slice(-6)}`,
      referenceId: params.saleId,
    },
  });

  return applied;
}

export async function collectCustomerPayment(
  tx: TxClient,
  params: {
    shopId: string;
    customerId: string;
    customerName: string;
    amount: number;
    note?: string;
    saleId?: string;
    targetSaleId?: string;
    excludeSaleId?: string;
    skipWallet?: boolean;
  }
): Promise<CollectCustomerPaymentResult> {
  if (params.amount <= 0) throw new Error("Payment amount must be positive");

  const customer = await tx.customer.findFirst({
    where: { id: params.customerId, shopId: params.shopId },
  });
  if (!customer) throw new Error("Customer not found");

  const totalDue = await getCustomerTotalDueInTx(tx, params.shopId, params.customerId);
  if (totalDue <= 0) {
    throw new Error("This customer has no due balance to collect");
  }
  if (params.amount > totalDue + 0.001) {
    throw new Error(
      `Cannot collect more than due balance. Customer owes ৳${totalDue.toFixed(2)}, you entered ৳${params.amount.toFixed(2)}`
    );
  }

  let remaining = params.amount;
  const allocations: CustomerPaymentAllocation[] = [];

  if (params.targetSaleId) {
    const applied = await applyToCustomerSaleDue(tx, {
      shopId: params.shopId,
      customerName: params.customerName,
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

  const excludeIds = new Set<string>();
  if (params.excludeSaleId) excludeIds.add(params.excludeSaleId);
  if (params.targetSaleId) excludeIds.add(params.targetSaleId);

  const unpaidSales = await tx.sale.findMany({
    where: {
      shopId: params.shopId,
      customerId: params.customerId,
      dueAmount: { gt: 0 },
      ...(excludeIds.size > 0 ? { id: { notIn: [...excludeIds] } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  for (const sale of unpaidSales) {
    if (remaining <= 0) break;
    const applied = await applyToCustomerSaleDue(tx, {
      shopId: params.shopId,
      customerName: params.customerName,
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

  const payment = await tx.customerPayment.create({
    data: {
      shopId: params.shopId,
      customerId: params.customerId,
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
          note: `Payment from ${params.customerName}${params.note ? `: ${params.note}` : ""}`,
          referenceId: payment.id,
        },
      });
    }
  }

  const newTotalDue = await getCustomerTotalDueInTx(tx, params.shopId, params.customerId);

  return {
    paymentId: payment.id,
    amount: params.amount,
    allocations,
    remainingUnallocated: remaining,
    newTotalDue,
  };
}
