import { $ServerLevel } from "@package/net/minecraft/server/level";
import { LogisticaBridgeApi, MaterialConfig } from "kubejs_ts/types/logistica/bridge";
import { SURVEY_TOOLS } from "./config/items";
import { ItemId } from "kubejs_ts/types/minecraft";

const MATERIALS: Record<ItemId, MaterialConfig> = {
  "minecraft:netherite_scrap": {
    displayName: "Netherite Scrap",
    baseChance: 0.9,
    maxSaturation: 0.92,
    noiseScale: 0.08,
    noisePower: 1.3,
  },
  "minecraft:quartz": {
    displayName: "Quartz",
    baseChance: 0.9,
    maxSaturation: 0.92,
    noiseScale: 0.08,
    noisePower: 1.3,
  },
  "minecraft:emerald": {
    displayName: "Emerald",
    baseChance: 0.9,
    maxSaturation: 0.92,
    noiseScale: 0.08,
    noisePower: 1.3,
  },
  "minecraft:diamond": {
    displayName: "Diamond",
    baseChance: 0.9,
    maxSaturation: 0.92,
    noiseScale: 0.08,
    noisePower: 1.3,
  },
  "minecraft:lapis_lazuli": {
    displayName: "Lapis Lazuli",
    baseChance: 0.9,
    maxSaturation: 0.92,
    noiseScale: 0.08,
    noisePower: 1.3,
  },
  "minecraft:redstone": {
    displayName: "Redstone",
    baseChance: 0.9,
    maxSaturation: 0.92,
    noiseScale: 0.08,
    noisePower: 1.3,
  },
  "minecraft:raw_gold": {
    displayName: "Gold",
    baseChance: 0.8,
    maxSaturation: 0.9,
    noiseScale: 0.08,
    noisePower: 1.4,
  },
  "create:raw_zinc": {
    displayName: "Zinc",
    baseChance: 0.72,
    maxSaturation: 0.86,
    noiseScale: 0.085,
    noisePower: 1.75,
  },
  "minecraft:raw_iron": {
    displayName: "Iron",
    baseChance: 0.72,
    maxSaturation: 0.86,
    noiseScale: 0.085,
    noisePower: 1.75,
  },
  "minecraft:raw_copper": {
    displayName: "Copper",
    baseChance: 0.64,
    maxSaturation: 0.8,
    noiseScale: 0.095,
    noisePower: 1.55,
  },
  "minecraft:coal": {
    displayName: "Coal",
    baseChance: 0.9,
    maxSaturation: 0.92,
    noiseScale: 0.08,
    noisePower: 1.3,
  },
} as Record<ItemId, MaterialConfig>;

function getBridge(): LogisticaBridgeApi | null {
  if (global.cachedBridge.ref) return global.cachedBridge.ref;

  try {
    global.cachedBridge.ref = Java.loadClass(
      "com.rhemery.logistica.LogisticaBridge",
    ) as unknown as LogisticaBridgeApi;
    return global.cachedBridge.ref;
  } catch (error) {
    console.errorf(`[Logistica] Failed to load LogisticaBridge: ${String(error)}`);
    return null;
  }
}

function buildMaterialIdCsv(materials: ItemId[]): string {
  return materials.join(",");
}

export function setKubeJsLoadingStatus(
  visible: boolean,
  text: string,
  percentage: number,
): void {
  const bridge = getBridge();
  if (!bridge) return;

  try {
    const clamped = Math.max(0, Math.min(1, percentage));
    bridge.setKubeJsLoadingStatus(visible, text, clamped);
  } catch (error) {
    console.errorf(`[Logistica] Failed to set KubeJS loading status: ${String(error)}`);
  }
}

export function configureSurveyBridge(): void {
  const bridge = getBridge();
  if (!bridge) return;

  try {
    //bridge.clearOreMaterials();
    //bridge.clearSurveyTiers();
    //bridge.clearSurveyTools();

    Object.entries(MATERIALS).forEach(([id, material]) => {
      bridge.registerOreMaterial(
        id,
        material.displayName,
        material.baseChance,
        material.maxSaturation,
        material.noiseScale,
        material.noisePower,
      );
    });

    SURVEY_TOOLS.forEach((tool) => {
      bridge.defineSurveyTierCsv(tool.displayName, tool.range, buildMaterialIdCsv(tool.materials));
      bridge.registerSurveyTool(`kubejs:${tool.id}`, tool.displayName);
    });
  } catch (error) {
    console.errorf(`[Logistica] Failed to configure survey bridge: ${String(error)}`);
  }
}

export function getChunkOreSaturations(
  level: $ServerLevel,
  chunkX: number,
  chunkZ: number,
): Record<string, number> {
  const bridge = getBridge();
  if (!bridge) return {};

  try {
    const javaMap = bridge.getChunkOres(level, chunkX, chunkZ) as {
      entrySet(): { iterator(): { hasNext(): boolean; next(): unknown } };
    } | null;
    const result: Record<string, number> = {};
    if (!javaMap) {
      return result;
    }

    const iterator = javaMap.entrySet().iterator();
    while (iterator.hasNext()) {
      const entry = iterator.next() as { getKey(): unknown; getValue(): unknown };
      const itemId = String(entry.getKey());
      const saturation = Number(entry.getValue());

      if (!Number.isFinite(saturation) || saturation <= 0) {
        continue;
      }
      result[itemId] = saturation;
    }

    return result;
  } catch (error) {
    console.errorf(`[Logistica] Failed to read chunk ore saturations: ${String(error)}`);
    return {};
  }
}
