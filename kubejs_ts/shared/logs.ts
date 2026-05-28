import { setKubeJsLoadingStatus } from "./logistica/bridge";

export function logProgress(namespace: string, current: number, total: number) {
  const safeTotal = Math.max(1, total);
  const progress = Math.max(0, Math.min(1, current / safeTotal));

  setKubeJsLoadingStatus(true, namespace, progress);
}
