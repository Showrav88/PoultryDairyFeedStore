import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { tailDeployLog } from "@/lib/deploy/log-tail";
import { isDeployRunning } from "@/lib/deploy/stale";

export async function GET() {
  const appDir = process.cwd();
  const deploySha = existsSync(join(appDir, ".deploy-sha"))
    ? readFileSync(join(appDir, ".deploy-sha"), "utf8").trim()
    : null;

  let deployStatus: Record<string, string> | null = null;
  const statusPath = join(appDir, ".deploy-status");
  if (existsSync(statusPath)) {
    try {
      deployStatus = JSON.parse(readFileSync(statusPath, "utf8"));
    } catch {
      deployStatus = { state: "unknown" };
    }
  }

  const deployRunning = isDeployRunning(deployStatus);

  return NextResponse.json({
    deploySha,
    deployStatus,
    deployRunning,
    logTail: tailDeployLog(30),
  });
}
