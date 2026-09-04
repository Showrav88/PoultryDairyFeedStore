import { createHash, timingSafeEqual } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const DEPLOY_CMD = "/usr/local/sbin/deploy-newproject";

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

  try {
    const { stdout, stderr } = await execFileAsync("sudo", [DEPLOY_CMD], {
      timeout: 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return NextResponse.json({
      status: "ok",
      sha,
      output: stdout.trim(),
      warnings: stderr.trim() || undefined,
    });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return NextResponse.json(
      {
        status: "error",
        sha,
        error: err.message ?? "Deploy failed",
        output: err.stdout?.trim(),
        details: err.stderr?.trim(),
      },
      { status: 500 }
    );
  }
}
