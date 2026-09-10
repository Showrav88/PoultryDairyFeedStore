export interface SaleLineInput {
  productId: string;
  quantityInSmallestUnit: number;
  pricePerUnit: number;
  unitCount?: number;
}

export interface ProductForSaleValidation {
  id: string;
  basePackageSize: number;
}

export function lineIsFullBag(
  line: SaleLineInput,
  product: ProductForSaleValidation
): boolean {
  return product.basePackageSize > 1 && line.quantityInSmallestUnit === product.basePackageSize;
}

export function cartHasFullBagLine(
  lines: SaleLineInput[],
  productMap: Map<string, ProductForSaleValidation>
): boolean {
  return lines.some((line) => {
    const product = productMap.get(line.productId);
    if (!product) return false;
    return lineIsFullBag(line, product);
  });
}

export function hasTrackedBuyer(params: {
  farmerId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
}): boolean {
  if (params.farmerId) return true;
  if (params.customerId) return true;
  const phone = params.customerPhone?.trim() ?? "";
  const name = params.customerName?.trim() ?? "";
  return name.length > 0 && phone.length >= 10;
}

export function validateSaleCheckout(params: {
  lines: SaleLineInput[];
  products: ProductForSaleValidation[];
  paidAmount: number;
  totalAmount: number;
  farmerId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
}): string | null {
  const productMap = new Map(params.products.map((p) => [p.id, p]));
  const dueAmount = Math.max(0, params.totalAmount - params.paidAmount);
  const tracked = hasTrackedBuyer(params);

  if (dueAmount > 0 && !tracked) {
    return "Due sales require buyer name and phone, or select a saved farmer/customer";
  }

  if (!tracked && dueAmount > 0.001) {
    return "Walk-in khucra sales must be paid in full — no due without buyer identity";
  }

  if (params.paidAmount > params.totalAmount) {
    return "Paid amount cannot exceed sale total";
  }

  return null;
}
