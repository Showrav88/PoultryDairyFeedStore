import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

const DEPLOY_LOG = "/var/log/newproject-deploy.log";

function tailLog(maxLines = 40): string | undefined {
  if (!existsSync(DEPLOY_LOG)) return undefined;
  try {
    const lines = readFileSync(DEPLOY_LOG, "utf8").trim().split("\n");
    return lines.slice(-maxLines).join("\n");
  } catch {
    return undefined;
  }
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

  return NextResponse.json({
    deploySha,
    deployStatus,
    logTail: tailLog(30),
  });
}
