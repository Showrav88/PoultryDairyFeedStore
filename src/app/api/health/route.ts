import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function readDeploySha(): string | null {
  const candidates = [
    join(process.cwd(), ".deploy-sha"),
    process.env.DEPLOY_SHA,
  ];
  for (const value of candidates) {
    if (!value) continue;
    if (value.includes("/") || value.includes("\\")) {
      try {
        if (existsSync(value)) {
          return readFileSync(value, "utf8").trim() || null;
        }
      } catch {
        continue;
      }
    } else {
      return value.trim() || null;
    }
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
