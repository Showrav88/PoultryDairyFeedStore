import { createHash, timingSafeEqual } from "crypto";
import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { NextRequest, NextResponse } from "next/server";

const DEPLOY_CMD = "/usr/local/sbin/deploy-newproject";
const DEPLOY_LOG = "/var/log/newproject-deploy.log";

function normalizeSecret(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function safeEqual(a: string, b: string): boolean {
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

function tailLog(maxLines = 80): string | undefined {
  if (!existsSync(DEPLOY_LOG)) return undefined;
  try {
    const lines = readFileSync(DEPLOY_LOG, "utf8").trim().split("\n");
    return lines.slice(-maxLines).join("\n");
  } catch {
    return undefined;
  }
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

  // Must match sudoers: NOPASSWD: /usr/local/sbin/deploy-newproject
  // Wrapper always execs repo deploy/deploy-newproject.sh (self-updates on each run).
  const child = spawn("sudo", [DEPLOY_CMD], { detached: true, stdio: "ignore" });
  child.unref();

  return NextResponse.json(
    {
      status: "accepted",
      sha,
      message: "Deploy started in background. Check /api/health and /var/log/newproject-deploy.log on VPS.",
      logTail: tailLog(20),
    },
    { status: 202 }
  );
}
