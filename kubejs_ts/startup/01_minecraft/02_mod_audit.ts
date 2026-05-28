// Set this to true ONLY on your development instance to generate the baseline file.
// For release builds, keep it false.

import { $Map } from "@package/java/util";
import { Mod } from "kubejs_ts/types/minecraft";

const CREATE_BASELINE_IF_MISSING = true;

const BASELINE_PATH = "kubejs/exported/startup/expected_mods.json";
const REPORT_PATH = "kubejs/exported/startup/mod_audit_report.json";

function getLoadedMods() {
  const result: Record<string, Mod> = {};

  const it = Platform.getMods().entrySet().iterator();

  while (it.hasNext()) {
    const entry = it.next();
    const id = entry.getKey();
    const info = entry.getValue();

    result[id] = {
      id: id,
      name: info.getName(),
      version: info.getVersion(),
    };
  }

  return result;
}

function compareMods(expected: Record<string, Mod>, current: Record<string, Mod>) {
  const added: Mod[] = [];
  const removed: Mod[] = [];
  const updated: (Mod & { expected: string; current: string })[] = [];

  for (const id in current) {
    const currentMod = current[id] as Mod;
    if (!expected[id]) {
      added.push(currentMod);
    } else {
      const expectedVersion = String(expected[id].version);
      const currentVersion = String(currentMod.version);
      const currentVersionSegments = currentVersion.split(".");
      const expectedVersionSegments = expectedVersion.split(".");

      if (currentVersionSegments.length == 2 && currentVersion.endsWith(".0")) {
        if (currentVersionSegments[0] == expectedVersionSegments[0]) {
          continue;
        }
      }

      if (expectedVersion !== currentVersion) {
        updated.push({
          id: id,
          name: currentMod.name,
          version: String(currentMod.version),
          expected: String(expected[id].version),
          current: String(currentMod.version),
        });
      }
    }
  }

  for (const id in expected) {
    const expectedMod = expected[id] as Mod;
    if (!current[id]) {
      removed.push(expectedMod);
    }
  }

  return {
    ok: added.length === 0 && removed.length === 0 && updated.length === 0,
    missingBaseline: false,
    added: added,
    removed: removed,
    updated: updated,
  };
}

const currentMods = getLoadedMods();
const expectedMods: Record<string, Mod> = {};
const expectedModsMap = JsonIO.read(BASELINE_PATH) as $Map<string, Mod>;

if (expectedModsMap) {
  expectedModsMap.forEach((key, value) => {
    expectedMods[key] = value;
  });
}

JsonIO.write(BASELINE_PATH, currentMods as any);

if (Object.keys(expectedMods).length === 0) {
  if (CREATE_BASELINE_IF_MISSING) {
    console.warnf(`[Modpack Audit] Created baseline file: ${BASELINE_PATH}`);
  } else {
    console.warnf(`[Modpack Audit] Missing baseline file: ${BASELINE_PATH}`);
    console.warnf(
      "[Modpack Audit] Set CREATE_BASELINE_IF_MISSING = true once in your dev instance.",
    );
  }
} else {
  global.modpackModAudit = compareMods(expectedMods, currentMods);

  if (global.modpackModAudit.ok) {
    console.infof("[Modpack Audit] Mod list is valid.");
  } else {
    console.warnf("[Modpack Audit] Mod list changed!");
    console.warnf(`[Modpack Audit] Added: ${global.modpackModAudit.added.length}`);
    console.warnf(`[Modpack Audit] Removed: ${global.modpackModAudit.removed.length}`);
    console.warnf(`[Modpack Audit] Updated: ${global.modpackModAudit.updated.length}`);
    console.warnf(`[Modpack Audit] Full report: ${REPORT_PATH}`);
  }
}

JsonIO.write(REPORT_PATH, global.modpackModAudit as any);
