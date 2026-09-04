import { readFileSync, existsSync } from "fs";
import { join } from "path";

const APP_DEPLOY_LOG = join(process.cwd(), "logs", "deploy.log");
const SYSTEM_DEPLOY_LOG = "/var/log/newproject-deploy.log";

function readLogTail(filePath: string, maxLines: number): string | undefined {
  try {
    if (!existsSync(filePath)) return undefined;
    const lines = readFileSync(filePath, "utf8").trim().split("\n");
    return lines.slice(-maxLines).join("\n");
  } catch {
    return undefined;
  }
}

export function tailDeployLog(maxLines = 40): string | undefined {
  return readLogTail(APP_DEPLOY_LOG, maxLines) ?? readLogTail(SYSTEM_DEPLOY_LOG, maxLines);
}
