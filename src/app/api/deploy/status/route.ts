import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

function tailLog(maxLines = 40): string | undefined {
  const paths = [
    join(process.cwd(), "logs/deploy.log"),
    "/var/log/newproject-deploy.log",
  ];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      const lines = readFileSync(path, "utf8").trim().split("\n");
      return lines.slice(-maxLines).join("\n");
    } catch {
      continue;
    }
  }
  return undefined;
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

  const deployRunning = existsSync(join(appDir, ".deploy.lock"));

  return NextResponse.json({
    deploySha,
    deployStatus,
    deployRunning,
    logTail: tailLog(30),
  });
}
