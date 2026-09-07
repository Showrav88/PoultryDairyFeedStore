import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { tailDeployLog } from "@/lib/deploy/log-tail";

const ACTIVE_DEPLOY_STATES = new Set([
  "started",
  "pulling",
  "building",
  "restarting",
  "running",
]);

const STALE_ACTIVE_MS = 3 * 60 * 1000;

function isStaleActiveDeploy(
  deployStatus: Record<string, string> | null
): boolean {
  if (!deployStatus?.updatedAt) return false;
  if (!ACTIVE_DEPLOY_STATES.has(deployStatus.state ?? "")) return false;
  const ageMs = Date.now() - new Date(deployStatus.updatedAt).getTime();
  return ageMs > STALE_ACTIVE_MS;
}

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

  const activeState = ACTIVE_DEPLOY_STATES.has(deployStatus?.state ?? "");
  const deployRunning = activeState && !isStaleActiveDeploy(deployStatus);

  return NextResponse.json({
    deploySha,
    deployStatus,
    deployRunning,
    logTail: tailDeployLog(30),
  });
}
