import {
  getControllerBlock,
  getPlayerStandingBlock,
  isMainHand,
  percentLabel,
} from "../utils";
import {
  ExcavationChunkState,
  ExcavationResourceDefinition,
  ExcavationResourceShare,
  MiningOutpostState,
} from "kubejs_ts/types/logistics";
import { describeInventoryPresent, getRelativeInventory } from "../inventory";
import {
  countDispatchTokens,
  DISPATCH_TOKEN_NAME,
  extractDispatchTokens,
  MAX_TOKENS_PER_STEP,
} from "./hub";
import { insertItem } from "../item";
import { chunkKey, resolveBiomeIdAtChunk, toChunkCoord } from "../chunk";
import {
  biomeMatchesKeywords,
  clamp,
  hashString32,
  lerp,
  randomInt,
  sampleNormalizedNoise,
  toPlainNumber,
} from "../math";
import {
  getRuntimeState,
  OUTPOST_DEFAULT_MAX_BACKLOG,
  persistRuntimeState,
} from "../runtime";
import { ItemId } from "kubejs_ts/types";
import { removeStation, toStationRef } from "../station";
import { buildMarketEntries } from "../market";
import { $MinecraftServer } from "@package/net/minecraft/server";
import { $LevelBlock } from "@package/dev/latvian/mods/kubejs/level";
import { $Player } from "@package/net/minecraft/world/entity/player";
import { $ServerLevel } from "@package/net/minecraft/server/level";

export const MINING_OUTPOST_BLOCK_ID = "kubejs:mining_outpost_controller";
export const EXCAVATION_SURVEY_ITEM_ID =
  "kubejs:excavation_survey_tool" as ItemId;

export const EXCAVATION_EMPTY_THRESHOLD = 0.6;
export const EXCAVATION_MIN_RESOURCE_WEIGHT = 0.05;
export const EXCAVATION_MAX_RESOURCES_PER_CHUNK = 6;
export const EXCAVATION_RICHNESS_MIN = 0.6;
export const EXCAVATION_RICHNESS_MAX = 1.8;
export const EXCAVATION_DEFAULT_SEED = 9137;

export const TOKEN_MINING_CYCLE_BONUS = 2;

export const EXCAVATION_RESOURCE_DEFINITIONS: ExcavationResourceDefinition[] = [
  {
    itemId: "minecraft:raw_iron",
    baseWeight: 1.1,
    noiseScale: 0.055,
    minNoise: 0.4,
    minAmount: 1,
    maxAmount: 2,
    whitelistBiomeKeywords: [
      "mountain",
      "peak",
      "hills",
      "taiga",
      "forest",
      "stony",
    ],
    blacklistBiomeKeywords: ["ocean", "river", "beach"],
  },
  {
    itemId: "minecraft:raw_copper",
    baseWeight: 1.05,
    noiseScale: 0.065,
    minNoise: 0.38,
    minAmount: 1,
    maxAmount: 2,
    whitelistBiomeKeywords: ["badlands", "savanna", "stony", "dripstone"],
    blacklistBiomeKeywords: ["ocean", "river", "beach"],
  },
  {
    itemId: "minecraft:coal",
    baseWeight: 1.4,
    noiseScale: 0.045,
    minNoise: 0.3,
    minAmount: 1,
    maxAmount: 3,
    whitelistBiomeKeywords: [],
    blacklistBiomeKeywords: ["ocean"],
  },
  {
    itemId: "create:raw_zinc",
    baseWeight: 0.85,
    noiseScale: 0.05,
    minNoise: 0.45,
    minAmount: 1,
    maxAmount: 3,
    whitelistBiomeKeywords: ["stony", "mountain", "peak", "dripstone", "mesa"],
    blacklistBiomeKeywords: ["ocean", "river", "beach", "swamp"],
  },
  {
    itemId: "minecraft:redstone",
    baseWeight: 0.45,
    noiseScale: 0.072,
    minNoise: 0.54,
    minAmount: 1,
    maxAmount: 2,
    whitelistBiomeKeywords: ["cave", "dripstone", "deep", "mountain", "peak"],
    blacklistBiomeKeywords: ["ocean", "beach"],
  },
  {
    itemId: "minecraft:lapis_lazuli",
    baseWeight: 0.35,
    noiseScale: 0.078,
    minNoise: 0.58,
    minAmount: 1,
    maxAmount: 2,
    whitelistBiomeKeywords: ["cave", "mountain", "peak", "snow", "taiga"],
    blacklistBiomeKeywords: ["ocean", "beach"],
  },
  {
    itemId: "minecraft:raw_gold",
    baseWeight: 0.3,
    noiseScale: 0.09,
    minNoise: 0.6,
    minAmount: 1,
    maxAmount: 2,
    whitelistBiomeKeywords: ["badlands", "mesa", "jungle", "savanna", "eroded"],
    blacklistBiomeKeywords: ["ocean", "river", "beach"],
  },
  {
    itemId: "minecraft:diamond",
    baseWeight: 0.08,
    noiseScale: 0.12,
    minNoise: 0.76,
    minAmount: 1,
    maxAmount: 1,
    whitelistBiomeKeywords: ["deep", "cave", "peak", "dripstone"],
    blacklistBiomeKeywords: ["ocean", "beach"],
  },
  {
    itemId: "minecraft:emerald",
    baseWeight: 0.06,
    noiseScale: 0.115,
    minNoise: 0.78,
    minAmount: 1,
    maxAmount: 1,
    whitelistBiomeKeywords: ["mountain", "peak", "windswept", "stony"],
    blacklistBiomeKeywords: ["ocean", "beach"],
  },
];

export function handleMiningOutpost(
  server: $MinecraftServer,
  outpost: MiningOutpostState,
  tick: number,
): void {
  const block = getControllerBlock(server, outpost);
  if (!block || block.getId() !== MINING_OUTPOST_BLOCK_ID) {
    outpost.unloadedCycles += 1;
    outpost.backlogCycles = Math.min(
      outpost.maxBacklogCycles,
      outpost.backlogCycles + 1,
    );
    return;
  }

  const inventory = getRelativeInventory(block, 0, 1, 0);
  if (!inventory) {
    outpost.lastRunTick = tick;
    outpost.unloadedCycles = 0;
    return;
  }

  const tokenInventory = getRelativeInventory(block, 0, -1, 0);
  let bonusCycles = 0;
  if (tokenInventory) {
    const consumedTokens = extractDispatchTokens(
      tokenInventory,
      MAX_TOKENS_PER_STEP,
    );
    bonusCycles = consumedTokens * TOKEN_MINING_CYCLE_BONUS;
  }

  const cyclesToRun = 1 + outpost.backlogCycles + bonusCycles;
  outpost.backlogCycles = 0;
  let produced = 0;
  const excavationChunk = getOrCreateExcavationChunkAtBlock(server, block);

  if (excavationChunk.empty || excavationChunk.resources.length === 0) {
    outpost.unloadedCycles = 0;
    outpost.lastRunTick = tick;
    return;
  }

  for (let cycle = 0; cycle < cyclesToRun; cycle++) {
    const pickedResource = pickExcavationResource(excavationChunk.resources);
    if (!pickedResource) {
      break;
    }

    const itemId = pickedResource.itemId;
    const count = rollExcavationAmount(itemId, excavationChunk.richness);
    const inserted = insertItem(inventory, itemId, count);

    produced += inserted;

    if (inserted < count) {
      const unprocessed = cyclesToRun - cycle;
      outpost.backlogCycles = Math.min(
        outpost.maxBacklogCycles,
        outpost.backlogCycles + unprocessed,
      );
      break;
    }
  }

  outpost.unloadedCycles = 0;
  outpost.lastRunTick = tick;
  outpost.totalProduced += produced;
}

export function buildExcavationChunkState(
  dimension: string,
  chunkX: number,
  chunkZ: number,
  biomeId: string,
  seed: number,
): ExcavationChunkState {
  const key = chunkKey(dimension, chunkX, chunkZ);

  const emptyNoise = sampleNormalizedNoise(
    chunkX,
    chunkZ,
    seed ^ 0x5f3759df,
    0.035,
  );
  const richnessNoise = sampleNormalizedNoise(
    chunkX,
    chunkZ,
    seed ^ 0x9e3779b9,
    0.06,
  );
  const richness = lerp(
    EXCAVATION_RICHNESS_MIN,
    EXCAVATION_RICHNESS_MAX,
    richnessNoise,
  );

  const resources: ExcavationResourceShare[] = [];

  if (emptyNoise < EXCAVATION_EMPTY_THRESHOLD) {
    for (const definition of EXCAVATION_RESOURCE_DEFINITIONS) {
      if (!global.items[definition.itemId]) continue;
      if (
        !biomeMatchesKeywords(
          biomeId,
          definition.whitelistBiomeKeywords,
          definition.blacklistBiomeKeywords,
        )
      ) {
        continue;
      }

      const noiseValue = sampleNormalizedNoise(
        chunkX,
        chunkZ,
        seed ^ hashString32(definition.itemId),
        definition.noiseScale,
      );
      const normalizedStrength = clamp(
        (noiseValue - definition.minNoise) / (1 - definition.minNoise),
        0,
        1,
      );
      const weight = definition.baseWeight * normalizedStrength * richness;

      if (weight < EXCAVATION_MIN_RESOURCE_WEIGHT) {
        continue;
      }

      resources.push({
        itemId: definition.itemId,
        weight,
        percent: 0,
      });
    }
  }

  resources.sort((left, right) => right.weight - left.weight);

  if (resources.length > EXCAVATION_MAX_RESOURCES_PER_CHUNK) {
    resources.length = EXCAVATION_MAX_RESOURCES_PER_CHUNK;
  }

  let weightTotal = 0;
  for (const resource of resources) {
    weightTotal += resource.weight;
  }

  if (weightTotal > 0) {
    for (const resource of resources) {
      resource.percent = resource.weight / weightTotal;
    }
  }

  return {
    key,
    dimension,
    chunkX,
    chunkZ,
    biomeId,
    richness,
    empty: resources.length === 0,
    resources,
  };
}

export function getOrCreateExcavationChunk(
  server: $MinecraftServer,
  dimension: string,
  chunkX: number,
  chunkZ: number,
): ExcavationChunkState {
  const state = getRuntimeState(server);
  const key = chunkKey(dimension, chunkX, chunkZ);
  const existing = state.excavationChunks.find((entry) => entry.key === key);
  if (existing) return existing;

  const level = server.getLevel(dimension);
  const biomeId = resolveBiomeIdAtChunk(server, dimension, chunkX, chunkZ);
  const seed = level
    ? resolveDimensionSeed(level, dimension)
    : (EXCAVATION_DEFAULT_SEED ^ hashString32(dimension)) >>> 0;
  const created = buildExcavationChunkState(
    dimension,
    chunkX,
    chunkZ,
    biomeId,
    seed,
  );

  state.excavationChunks.push(created);
  persistRuntimeState(server);
  return created;
}

export function getOrCreateExcavationChunkAtBlock(
  server: $MinecraftServer,
  block: $LevelBlock,
): ExcavationChunkState {
  const dimension = String(block.getDimension());
  const chunkX = toChunkCoord(block.getX());
  const chunkZ = toChunkCoord(block.getZ());
  return getOrCreateExcavationChunk(server, dimension, chunkX, chunkZ);
}

export function addOrGetMiningOutpost(
  server: $MinecraftServer,
  block: $LevelBlock,
): MiningOutpostState {
  const state = getRuntimeState(server);
  const ref = toStationRef(block);
  const existing = state.miningOutposts.find((entry) => entry.key === ref.key);
  if (existing) return existing;

  const created: MiningOutpostState = {
    key: ref.key,
    dimension: ref.dimension,
    x: ref.x,
    y: ref.y,
    z: ref.z,
    backlogCycles: 0,
    maxBacklogCycles: OUTPOST_DEFAULT_MAX_BACKLOG,
    unloadedCycles: 0,
    lastRunTick: 0,
    totalProduced: 0,
  };

  state.miningOutposts.push(created);
  persistRuntimeState(server);
  return created;
}

export function showExcavationSurvey(
  player: $Player,
  profile: ExcavationChunkState,
): void {
  player.tell({
    text: `[Logistica] Excavation chunk ${profile.dimension} @ (${profile.chunkX}, ${profile.chunkZ})`,
    color: "gold",
  });
  player.tell({
    text: `Biome: ${profile.biomeId} | richness: ${profile.richness.toFixed(2)}`,
    color: "gray",
  });

  if (profile.empty || profile.resources.length === 0) {
    player.tell({
      text: "No extractable resources detected in this chunk.",
      color: "red",
    });
    return;
  }

  player.tell({
    text: "Resource distribution:",
    color: "aqua",
  });
  for (const resource of profile.resources) {
    player.tell({
      text: `- ${resource.itemId}: ${percentLabel(resource.percent)} (weight ${resource.weight.toFixed(2)})`,
      color: "gray",
    });
  }
}

export function pickExcavationResource(
  resources: ExcavationResourceShare[],
): ExcavationResourceShare | null {
  if (resources.length === 0) return null;

  let totalPercent = 0;
  for (const resource of resources) {
    totalPercent += resource.percent;
  }

  if (totalPercent <= 0) {
    return resources[0] ?? null;
  }

  let cursor = Math.random() * totalPercent;
  for (const resource of resources) {
    cursor -= resource.percent;
    if (cursor <= 0) return resource;
  }

  return resources[resources.length - 1] ?? null;
}

export function getExcavationDefinitionByItemId(
  itemId: ItemId,
): ExcavationResourceDefinition | null {
  for (const definition of EXCAVATION_RESOURCE_DEFINITIONS) {
    if (definition.itemId === itemId) {
      return definition;
    }
  }
  return null;
}

export function rollExcavationAmount(itemId: ItemId, richness: number): number {
  const definition = getExcavationDefinitionByItemId(itemId);
  if (!definition) return 1;

  const richnessBoost = Math.max(1, Math.round(richness));
  const maxAmount = Math.max(definition.minAmount, definition.maxAmount);
  const minAmount = Math.max(1, definition.minAmount);
  const rolled = randomInt(minAmount, maxAmount);
  return Math.max(minAmount, rolled + (richnessBoost - 1));
}

export function ensureMarketEntries(): void {
  if (Object.keys(global.marketEntries).length === 0) {
    buildMarketEntries();
  }
}

export function resolveDimensionSeed(
  level: $ServerLevel,
  dimension: string,
): number {
  const baseSeed = toPlainNumber(level.seed, EXCAVATION_DEFAULT_SEED);
  return (baseSeed ^ hashString32(dimension)) >>> 0;
}

BlockEvents.placed(MINING_OUTPOST_BLOCK_ID, (event) => {
  if (event.level.isClientSide()) return;
  addOrGetMiningOutpost(event.server, event.block);
});

BlockEvents.broken(MINING_OUTPOST_BLOCK_ID, (event) => {
  if (event.level.isClientSide()) return;
  removeStation(event.server, toStationRef(event.block).key);
});

BlockEvents.rightClicked((event) => {
  if (event.level.isClientSide()) return;
  if (!isMainHand(String(event.hand))) return;
  if (event.item.id !== EXCAVATION_SURVEY_ITEM_ID) return;

  const profile = getOrCreateExcavationChunkAtBlock(event.server, event.block);
  showExcavationSurvey(event.player, profile);
  event.cancel();
});

BlockEvents.rightClicked(MINING_OUTPOST_BLOCK_ID, (event) => {
  if (!isMainHand(String(event.hand))) return;
  if (event.level.isClientSide()) return;

  const outpost = addOrGetMiningOutpost(event.server, event.block);
  const excavationProfile = getOrCreateExcavationChunkAtBlock(
    event.server,
    event.block,
  );
  const tokenInventory = getRelativeInventory(event.block, 0, -1, 0);
  const tokenCount = tokenInventory ? countDispatchTokens(tokenInventory) : 0;

  event.player.tell({
    text: `[Logistica] Mining outpost ${outpost.key}`,
    color: "gold",
  });
  event.player.tell({
    text: `Vault above: ${describeInventoryPresent(event.block, 0, 1, 0)} | token buffer below: ${describeInventoryPresent(event.block, 0, -1, 0)} (${tokenCount})`,
    color: "gray",
  });
  event.player.tell({
    text: `Backlog cycles: ${outpost.backlogCycles} | total produced: ${outpost.totalProduced}`,
    color: "gray",
  });
  if (excavationProfile.empty) {
    event.player.tell({
      text: "Chunk profile: no extractable resources in this chunk.",
      color: "red",
    });
  } else {
    const top = excavationProfile.resources[0];
    if (top) {
      event.player.tell({
        text: `Chunk profile top resource: ${top.itemId} (${percentLabel(top.percent)})`,
        color: "gray",
      });
    }
  }
  event.player.tell({
    text: `Usage: put ${DISPATCH_TOKEN_NAME} papers below this controller to run extra mining cycles instantly.`,
    color: "dark_gray",
  });
});

ItemEvents.rightClicked(EXCAVATION_SURVEY_ITEM_ID, (event) => {
  if (event.level.isClientSide()) return;
  if (!isMainHand(String(event.hand))) return;

  const playerBlock = getPlayerStandingBlock(event.level, event.player);
  if (!playerBlock) return;

  const profile = getOrCreateExcavationChunkAtBlock(event.server, playerBlock);
  showExcavationSurvey(event.player, profile);
});
