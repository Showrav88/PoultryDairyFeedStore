import { createHash, timingSafeEqual } from "crypto";
import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_LOG = "/var/log/newproject-deploy.log";

function normalizeSecret(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function safeEqual(a: string, b: string): boolean {
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

function tailLog(maxLines = 80): string | undefined {
  const paths = [
    join(process.cwd(), "logs/deploy.log"),
    SYSTEM_LOG,
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

export async function POST(request: NextRequest) {
  const secret = normalizeSecret(process.env.DEPLOY_WEBHOOK_SECRET);
  if (!secret) {
    return NextResponse.json(
      { error: "DEPLOY_WEBHOOK_SECRET is not configured on the server" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const token = normalizeSecret(auth.startsWith("Bearer ") ? auth.slice(7) : auth);
  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json(
      { error: "Invalid deploy webhook secret. Match GitHub DEPLOY_WEBHOOK_SECRET with VPS .env exactly." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const sha = typeof body.sha === "string" ? body.sha : "unknown";

  const deployScript = join(process.cwd(), "deploy/deploy-via-app.sh");
  const sbinDeploy = "/usr/local/sbin/deploy-newproject";

  // Prefer no-sudo deploy (same user as the running app). Fall back to sudo wrapper if script missing.
  const useAppDeploy = existsSync(deployScript);
  const child = useAppDeploy
    ? spawn("bash", [deployScript], { detached: true, stdio: "ignore", cwd: process.cwd() })
    : spawn("sudo", [sbinDeploy], { detached: true, stdio: "ignore" });
  child.unref();

  return NextResponse.json(
    {
      status: "accepted",
      sha,
      mode: useAppDeploy ? "app-user" : "sudo",
      message: useAppDeploy
        ? "Deploy started (app user). Check /api/health and logs/deploy.log."
        : "Deploy started (sudo). Check /api/health and /var/log/newproject-deploy.log.",
      logTail: tailLog(20),
    },
    { status: 202 }
  );
}
