import { $Map } from "@package/java/util";
import { clearObject } from "./object";

export function tryLoadJson<T extends Record<string, unknown>, K extends keyof T, V extends T[K]>(
  path: string,
  targetName: string,
  target: T,
): boolean {
  if (!path.endsWith(".json")) return false;
  if (!global.modpackModAudit.ok) {
    clearObject(target);
    console.infof(`[Economy] Modlist changed, clearing ${targetName} cache.`);
    return false;
  }

  const targetFromFile = JsonIO.read(path) as $Map<K, V>;
  if (!targetFromFile) return false;

  const fileHasItems = targetFromFile.size() > 0;
  const cacheHasItems = Object.keys(target).length > 0;

  if (cacheHasItems) {
    console.infof(`[Economy] ${targetName} already loaded in cache.`);
    saveJson(path, target);
    return true;
  }

  if (!cacheHasItems && fileHasItems) {
    clearObject(target);
    targetFromFile.forEach((key, value) => {
      target[key] = value;
    });
    console.infof(`[Economy] ${targetName} cleared and loaded from file.`);
    return true;
  }

  return false;
}
export function saveJson(path: string, data: Record<string, unknown>): void {
  JsonIO.write(path, JSON.parse(JSON.stringify(data, null, 2)));
}
