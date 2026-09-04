import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

export function writeDeployStatus(
  state: string,
  sha: string,
  message: string
): void {
  const appDir = process.cwd();
  const statusPath = join(appDir, ".deploy-status");
  const payload = {
    state,
    sha,
    message,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(statusPath, `${JSON.stringify(payload)}\n`, "utf8");

  if (sha && (state === "ready" || state === "building" || state === "restarting")) {
    const shaPath = join(appDir, ".deploy-sha");
    writeFileSync(shaPath, `${sha}\n`, "utf8");
  }
}

export function ensureDeployLogDir(): string {
  const logDir = join(process.cwd(), "logs");
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  return join(logDir, "deploy.log");
}
