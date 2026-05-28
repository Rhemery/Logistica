import { getControllerBlock, isMainHand, percentLabel } from "../minecraft/utils";
import {
  ExcavationChunkState,
  ExcavationResourceShare,
  MiningOutpostState,
} from "kubejs_ts/types/logistica/logistics";
import {
  describeInventoryPresent,
  getRelativeInventory,
} from "../minecraft/inventory";
import { insertItem } from "../minecraft/item";
import { chunkKey, toChunkCoord } from "../minecraft/chunk";
import { randomInt } from "../math";
import { OUTPOST_DEFAULT_MAX_BACKLOG } from "../minecraft/runtime";
import { ItemId } from "kubejs_ts/types/minecraft";
import { removeStation, toStationRef } from "./station";
import { buildMarketEntries } from "./market";
import { $MinecraftServer } from "@package/net/minecraft/server";
import { $LevelBlock } from "@package/dev/latvian/mods/kubejs/level";
import { OUTPOST_PLACE_RULES } from "./config/outposts";
import {
  countDispatchTokens,
  DISPATCH_TOKEN_NAME,
  extractDispatchTokens,
  MAX_TOKENS_PER_STEP,
} from "./hub";
import {
  getOutpostOwner,
  isOutpostPlaceable,
  stampOutpostOwner,
} from "./outpost";
import { Logistica } from "./runtime";
import { getChunkOreSaturations } from "./bridge";

export const MINING_OUTPOST_BLOCK_ID = "kubejs:mining_outpost_controller";
export const TOKEN_MINING_CYCLE_BONUS = 2;

const EXCAVATION_BASE_MIN_AMOUNT = 1;
const EXCAVATION_BASE_MAX_AMOUNT = 3;

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
  const excavationChunk = getExcavationChunkAtBlock(server, block);

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
    const count = rollExcavationAmount(pickedResource);
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
  saturations: Record<string, number>,
): ExcavationChunkState {
  const key = chunkKey(dimension, chunkX, chunkZ);
  const resources: ExcavationResourceShare[] = [];

  for (const [itemId, saturation] of Object.entries(saturations)) {
    const resolvedItemId = itemId as ItemId;
    if (!global.items[resolvedItemId]) continue;
    if (!Number.isFinite(saturation) || saturation <= 0) continue;

    resources.push({
      itemId: resolvedItemId,
      weight: saturation,
      percent: 0,
    });
  }

  resources.sort((left, right) => right.weight - left.weight);

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
    empty: resources.length === 0,
    resources,
  };
}

export function getExcavationChunk(
  server: $MinecraftServer,
  dimension: string,
  chunkX: number,
  chunkZ: number,
): ExcavationChunkState {
  const level = server.getLevel(dimension);
  if (!level) {
    return buildExcavationChunkState(dimension, chunkX, chunkZ, {});
  }

  const saturations = getChunkOreSaturations(level, chunkX, chunkZ);
  return buildExcavationChunkState(dimension, chunkX, chunkZ, saturations);
}

export function getExcavationChunkAtBlock(
  server: $MinecraftServer,
  block: $LevelBlock,
): ExcavationChunkState {
  const dimension = String(block.getDimension());
  const chunkX = toChunkCoord(block.getX());
  const chunkZ = toChunkCoord(block.getZ());
  return getExcavationChunk(server, dimension, chunkX, chunkZ);
}

export function addOrGetMiningOutpost(
  server: $MinecraftServer,
  block: $LevelBlock,
): MiningOutpostState {
  const state = Logistica.Runtime.getServerState();
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
  Logistica.Runtime.saveServerState(server);
  return created;
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

export function rollExcavationAmount(resource: ExcavationResourceShare): number {
  const clampedWeight = Math.max(0, Math.min(1, resource.weight));
  const maxAmount = Math.max(
    EXCAVATION_BASE_MIN_AMOUNT,
    Math.min(EXCAVATION_BASE_MAX_AMOUNT, 1 + Math.floor(clampedWeight * 3)),
  );

  return randomInt(EXCAVATION_BASE_MIN_AMOUNT, maxAmount);
}

export function ensureMarketEntries(): void {
  if (Object.keys(global.marketEntries).length === 0) {
    buildMarketEntries();
  }
}

BlockEvents.placed(MINING_OUTPOST_BLOCK_ID, (event) => {
  if (event.level.isClientSide()) return;

  const owner = getOutpostOwner(event.player);
  if (!owner) {
    event.cancel();
    event.player?.tell({
      text: "Mining Outpost Controller placement requires a player owner.",
      color: "red",
    });
    return;
  }

  const state = Logistica.Runtime.getServerState();
  const result = isOutpostPlaceable(
    {
      event,
      state,
      block: event.block,
      blockId: MINING_OUTPOST_BLOCK_ID,
      owner,
    },
    OUTPOST_PLACE_RULES[MINING_OUTPOST_BLOCK_ID],
  );

  if (!result.placeable) {
    event.cancel();
    event.player.tell({
      text: result.failedRule.message,
      color: "red",
    });
    return;
  }

  const outpost = addOrGetMiningOutpost(event.server, event.block);
  stampOutpostOwner(outpost, owner);
  Logistica.Runtime.saveServerState(event.server);
});

BlockEvents.broken(MINING_OUTPOST_BLOCK_ID, (event) => {
  if (event.level.isClientSide()) return;
  removeStation(event.server, toStationRef(event.block).key);
});

BlockEvents.rightClicked(MINING_OUTPOST_BLOCK_ID, (event) => {
  if (!isMainHand(String(event.hand))) return;
  if (event.level.isClientSide()) return;

  const outpost = addOrGetMiningOutpost(event.server, event.block);
  const excavationProfile = getExcavationChunkAtBlock(event.server, event.block);
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
