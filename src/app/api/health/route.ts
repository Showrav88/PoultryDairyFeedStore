import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function readFileText(path: string): string | null {
  try {
    if (existsSync(path)) {
      return readFileSync(path, "utf8").trim() || null;
    }
  } catch {
    return null;
  }
  return null;
}

function readDeploySha(): string | null {
  if (process.env.DEPLOY_SHA?.trim()) {
    return process.env.DEPLOY_SHA.trim();
  }
  return readFileText(join(process.cwd(), ".deploy-sha"));
}

function readDeployStatus(): Record<string, string> | null {
  const raw = readFileText(join(process.cwd(), ".deploy-status"));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return { state: "unknown", message: raw };
  }
}

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const deployStatus = readDeployStatus();
    const deploySha = readDeploySha() ?? deployStatus?.sha ?? null;
    return NextResponse.json({
      status: "ok",
      database: "connected",
      deploySha,
      deployState: deployStatus?.state ?? null,
      deployMessage: deployStatus?.message ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", database: "disconnected" },
      { status: 503 }
    );
  }
}
