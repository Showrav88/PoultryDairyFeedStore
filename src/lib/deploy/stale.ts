export const ACTIVE_DEPLOY_STATES = new Set([
  "started",
  "pulling",
  "building",
  "restarting",
  "running",
]);

/** Active deploy status with no live process is treated as stale after this age. */
export const STALE_ACTIVE_MS = 3 * 60 * 1000;

export function isStaleActiveDeploy(
  deployStatus: Record<string, string> | null | undefined
): boolean {
  if (!deployStatus?.updatedAt) return false;
  if (!ACTIVE_DEPLOY_STATES.has(deployStatus.state ?? "")) return false;
  const ageMs = Date.now() - new Date(deployStatus.updatedAt).getTime();
  return ageMs > STALE_ACTIVE_MS;
}

export function effectiveDeployState(
  deployStatus: Record<string, string> | null | undefined
): string | null {
  if (!deployStatus?.state) return null;
  if (isStaleActiveDeploy(deployStatus)) return null;
  return deployStatus.state;
}

export function isDeployRunning(
  deployStatus: Record<string, string> | null | undefined
): boolean {
  return (
    ACTIVE_DEPLOY_STATES.has(deployStatus?.state ?? "") &&
    !isStaleActiveDeploy(deployStatus)
  );
}
