import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function readDeploySha(): string | null {
  if (process.env.DEPLOY_SHA?.trim()) {
    return process.env.DEPLOY_SHA.trim();
  }
  const shaFile = join(process.cwd(), ".deploy-sha");
  try {
    if (existsSync(shaFile)) {
      return readFileSync(shaFile, "utf8").trim() || null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "connected",
      deploySha: readDeploySha(),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", database: "disconnected" },
      { status: 503 }
    );
  }
}
