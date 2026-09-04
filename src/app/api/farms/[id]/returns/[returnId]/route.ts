import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { restoreStock } from "@/lib/inventory/khucra";
import { applyFarmWalletTx } from "@/lib/farms/wallet";

const patchSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; returnId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: farmId, returnId } = await params;

  try {
    const { action } = patchSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const farm = await tx.farm.findFirst({
        where: { id: farmId, shopId: session.shopId },
      });
      if (!farm) throw new Error("Farm not found");

      const farmReturn = await tx.farmReturn.findFirst({
        where: { id: returnId, farmId, shopId: session.shopId },
        include: { items: { include: { product: true } } },
      });
      if (!farmReturn) throw new Error("Return not found");
      if (farmReturn.status !== "PENDING") throw new Error("Return already processed");

      if (action === "reject") {
        const updated = await tx.farmReturn.update({
          where: { id: returnId },
          data: { status: "REJECTED" },
          include: { items: { include: { product: true } } },
        });
        return { farmReturn: updated, farm, action: "reject" as const };
      }

      for (const item of farmReturn.items) {
        const product = item.product;
        const restoreResult = restoreStock(
          {
            stockInSmallestUnit: product.stockInSmallestUnit,
            closedPackages: product.closedPackages,
            openPackageRemaining: product.openPackageRemaining,
            basePackageSize: product.basePackageSize,
          },
          item.quantityInSmallestUnit
        );

        await tx.product.update({
          where: { id: product.id },
          data: restoreResult.newState,
        });
      }

      const updated = await tx.farmReturn.update({
        where: { id: returnId },
        data: { status: "APPROVED", approvedAt: new Date() },
        include: { items: { include: { product: true } } },
      });

      await applyFarmWalletTx(tx, {
        shopId: session.shopId,
        type: "FARM_RETURN",
        amount: Number(updated.totalCost),
        note: `Return approved from ${farm.name} — Return #${returnId.slice(-6)}`,
        referenceId: returnId,
        decrement: false,
      });

      return { farmReturn: updated, farm, action: "approve" as const };
    });

    await logAudit(
      session.shopId,
      "FARM",
      farmId,
      "UPDATE",
      result.action === "approve"
        ? `Return approved for "${result.farm.name}": ৳${Number(result.farmReturn.totalCost)}`
        : `Return rejected for "${result.farm.name}"`,
      null,
      result.farmReturn
    );

    return NextResponse.json({ farmReturn: result.farmReturn });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Return update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
