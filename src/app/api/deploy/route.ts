import { createHash, timingSafeEqual } from "crypto";
import { spawn, spawnSync } from "child_process";
import { existsSync, openSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { tailDeployLog } from "@/lib/deploy/log-tail";
import { ensureDeployLogDir, writeDeployStatus } from "@/lib/deploy/status";
import { isStaleActiveDeploy } from "@/lib/deploy/stale";

function normalizeSecret(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function safeEqual(a: string, b: string): boolean {
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
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
  const shortSha = sha.length >= 7 ? sha.slice(0, 7) : sha;

  const webhookScript = join(process.cwd(), "deploy/webhook-deploy.sh");
  const deployScript = join(process.cwd(), "deploy/deploy-via-app.sh");

  const script = existsSync(webhookScript)
    ? webhookScript
    : existsSync(deployScript)
      ? deployScript
      : null;

  if (!script) {
    return NextResponse.json(
      { error: "Deploy scripts are missing on the server" },
      { status: 503 }
    );
  }

  const appDir = process.cwd();
  const statusPath = join(appDir, ".deploy-status");
  if (existsSync(statusPath)) {
    try {
      const deployStatus = JSON.parse(readFileSync(statusPath, "utf8")) as Record<string, string>;
      if (isStaleActiveDeploy(deployStatus)) {
        unlinkSync(statusPath);
      }
    } catch {
      /* ignore */
    }
  }

  const prepareScript = join(appDir, "deploy/pre-webhook-prepare.sh");
  if (existsSync(prepareScript)) {
    spawnSync("bash", [prepareScript], { cwd: appDir, stdio: "ignore" });
  }

  async function isHealthyAtSha(sha: string): Promise<boolean> {
    try {
      const res = await fetch("http://127.0.0.1:5001/api/health", {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        status?: string;
        deploySha?: string;
        deployState?: string;
      };
      return (
        data.status === "ok" &&
        data.deploySha === sha &&
        (data.deployState === "ready" || !data.deployState)
      );
    } catch {
      return false;
    }
  }

  // Skip only when the running app reports the target commit on /api/health.
  if (await isHealthyAtSha(shortSha)) {
    try {
      writeDeployStatus("ready", shortSha, "Already deployed at target commit");
    } catch (err) {
      console.error("Could not write deploy status:", err);
    }
    return NextResponse.json(
      {
        status: "accepted",
        sha: shortSha,
        mode: "skip",
        message: "Already deployed at target commit. No redeploy needed.",
        logTail: tailDeployLog(10),
      },
      { status: 202 }
    );
  }

  const logPath = ensureDeployLogDir();
  let logFd: number;
  try {
    logFd = openSync(logPath, "a");
  } catch (err) {
    console.error("Could not open deploy log:", err);
    return NextResponse.json(
      { error: "Could not open deploy log for writing" },
      { status: 500 }
    );
  }

  const child = spawn("setsid", ["bash", script], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    cwd: process.cwd(),
    env: {
      ...process.env,
      TARGET_SHA: shortSha,
      DEPLOY_TRIGGER: "webhook",
    },
  });

  child.on("error", (err) => {
    try {
      writeDeployStatus("failed", shortSha, `Deploy spawn failed: ${err.message}`);
    } catch {
      /* ignore */
    }
  });

  child.unref();

  const mode =
    script === webhookScript
      ? "webhook"
      : script === deployScript
        ? "app-user"
        : "sudo";

  return NextResponse.json(
    {
      status: "accepted",
      sha: shortSha,
      mode,
      message:
        mode === "webhook"
          ? "Deploy started via systemd (newproject-deploy.service). Check /api/health."
          : "Deploy started (app user). Check /api/health and logs/deploy.log.",
      logTail: tailDeployLog(20),
    },
    { status: 202 }
  );
}
