import { ItemId } from "kubejs_ts/types";
import { chunkKey, toChunkCoord } from "../chunk";
import {
  LogisticsRuntimeState,
  MarketEntry,
  VillageDemandOrder,
  VillageMarketState,
} from "kubejs_ts/types/logistics";
import { getRuntimeState, persistRuntimeState } from "../runtime";
import { removeStation, toStationRef } from "../station";
import { randomInt, toPlainNumber } from "../math";
import {
  compressCoins,
  getControllerBlock,
  isCreativePlayer,
  isMainHand,
} from "../utils";
import { describeInventoryPresent, getRelativeInventory } from "../inventory";
import {
  countDispatchTokens,
  extractDispatchTokens,
  MAX_TOKENS_PER_STEP,
} from "./hub";
import { extractItem, insertItem } from "../item";
import { $MinecraftServer } from "@package/net/minecraft/server";
import { $LevelBlock } from "@package/dev/latvian/mods/kubejs/level";
import { $Player } from "@package/net/minecraft/world/entity/player";
import { $EntityArrayList } from "@package/dev/latvian/mods/kubejs/player";
import { $Level } from "@package/net/minecraft/world/level";
import { $BlockPos } from "@package/net/minecraft/core";

export const VILLAGE_MARKET_BLOCK_ID = "kubejs:village_market_controller";
export const VILLAGE_REFRESH_TICKS = 20 * 45;

export const VILLAGE_DEFAULT_MAX_BACKLOG = 8;
export const VILLAGE_REGISTER_CHUNK_RADIUS = 1;
export const VILLAGE_MIN_VILLAGER_COUNT = 1;
export const VILLAGE_VILLAGER_SCAN_RADIUS = 48;
export const VILLAGE_POI_SCAN_RADIUS = 8;
export const VILLAGE_POI_SCAN_Y = 4;
export const VILLAGE_MIN_POI_MARKERS = 2;

export const VILLAGE_JOB_SITE_BLOCK_IDS = new Set<string>([
  "minecraft:barrel",
  "minecraft:blast_furnace",
  "minecraft:brewing_stand",
  "minecraft:cartography_table",
  "minecraft:cauldron",
  "minecraft:composter",
  "minecraft:fletching_table",
  "minecraft:grindstone",
  "minecraft:lectern",
  "minecraft:loom",
  "minecraft:smoker",
  "minecraft:smithing_table",
  "minecraft:stonecutter",
]);

export let villagePoolCache: ItemId[] = [];
export let villagePoolCacheSize = -1;

export function toVillageChunkKey(
  dimension: string,
  x: number,
  z: number,
): string {
  return chunkKey(dimension, toChunkCoord(x), toChunkCoord(z));
}

export function addOrGetVillageMarket(
  server: $MinecraftServer,
  block: $LevelBlock,
): VillageMarketState {
  const state = getRuntimeState(server);
  const ref = toStationRef(block);
  const existing = state.villageMarkets.find((entry) => entry.key === ref.key);
  if (existing) return existing;

  const created: VillageMarketState = {
    key: ref.key,
    dimension: ref.dimension,
    x: ref.x,
    y: ref.y,
    z: ref.z,
    refreshEveryTicks: VILLAGE_REFRESH_TICKS,
    backlogRefreshes: 0,
    unloadedCycles: 0,
    lastRefreshTick: 0,
    totalPurchased: 0,
    totalPaid: 0,
    pendingPayout: 0,
    orders: [],
  };

  state.villageMarkets.push(created);
  persistRuntimeState(server);
  return created;
}

export function getVillageDemandPool(): ItemId[] {
  const entries = global.marketEntries;
  const size = Object.keys(entries).length;

  if (size === villagePoolCacheSize) {
    return villagePoolCache;
  }

  villagePoolCacheSize = size;
  villagePoolCache = Object.entries(entries)
    .filter(([itemId, entry]) => {
      if (!entry.markets.includes("village")) return false;
      if (entry.sellPrice <= 0) return false;
      if (itemId.startsWith("numismatics:")) return false;
      if (itemId.startsWith("kubejs:")) return false;
      if (itemId.includes("spawn_egg")) return false;
      return true;
    })
    .map(([itemId]) => itemId as ItemId);

  return villagePoolCache;
}

export function rollVillageOrder(
  itemId: ItemId,
  entry: MarketEntry,
): VillageDemandOrder {
  const basePrice = Math.max(1, Math.floor(entry.sellPrice));
  const multiplier = 1.2 + Math.random() * 0.6;
  const unitPrice = Math.max(1, Math.ceil(basePrice * multiplier));

  let maxAmount = 64;
  let minAmount = 24;

  if (basePrice >= 200) {
    minAmount = 2;
    maxAmount = 6;
  } else if (basePrice >= 90) {
    minAmount = 6;
    maxAmount = 16;
  } else if (basePrice >= 40) {
    minAmount = 12;
    maxAmount = 32;
  }

  return {
    itemId,
    remaining: randomInt(minAmount, maxAmount),
    unitPrice,
  };
}

export function refreshVillageOrders(
  market: VillageMarketState,
  multiplier: number,
): void {
  const pool = getVillageDemandPool();
  if (pool.length === 0) return;

  const picks = Math.min(3, pool.length);
  const used = new Set<ItemId>();
  const orders: VillageDemandOrder[] = [];
  const cappedMultiplier = Math.max(1, Math.min(4, multiplier));

  while (orders.length < picks) {
    const candidate = pool[randomInt(0, pool.length - 1)] as ItemId;
    if (used.has(candidate)) continue;

    const entry = global.marketEntries[candidate];
    if (!entry) continue;

    const order = rollVillageOrder(candidate, entry);
    order.remaining *= cappedMultiplier;

    used.add(candidate);
    orders.push(order);
  }

  market.orders = orders;
}

export function handleVillageMarket(
  server: $MinecraftServer,
  market: VillageMarketState,
  tick: number,
): void {
  const block = getControllerBlock(server, market);
  if (!block || block.getId() !== VILLAGE_MARKET_BLOCK_ID) {
    market.unloadedCycles += 1;
    market.backlogRefreshes = Math.min(
      VILLAGE_DEFAULT_MAX_BACKLOG,
      market.backlogRefreshes + 1,
    );
    return;
  }

  const inputInventory = getRelativeInventory(block, 0, 1, 0);
  if (!inputInventory) {
    market.unloadedCycles = 0;
    return;
  }

  const payoutInventory =
    getRelativeInventory(block, 0, -1, 0) ?? inputInventory;

  market.unloadedCycles = 0;

  const consumedTokens = extractDispatchTokens(
    payoutInventory,
    MAX_TOKENS_PER_STEP,
  );
  if (consumedTokens > 0) {
    market.backlogRefreshes += consumedTokens;
  }

  const shouldRefresh =
    consumedTokens > 0 ||
    market.orders.length === 0 ||
    tick - market.lastRefreshTick >= market.refreshEveryTicks;

  if (shouldRefresh) {
    refreshVillageOrders(market, 1 + market.backlogRefreshes);
    market.backlogRefreshes = 0;
    market.lastRefreshTick = tick;
  }

  if (market.pendingPayout > 0) {
    let paidNow = 0;
    const money = compressCoins(market.pendingPayout);
    money.forEach((stack) => {
      paidNow += insertItem(payoutInventory, stack.id, stack.count);
    });
    market.pendingPayout = Math.max(0, market.pendingPayout - paidNow);
    market.totalPaid += paidNow;
  }

  let sold = 0;
  let payout = 0;

  market.orders.forEach((order) => {
    if (order.remaining <= 0) return;

    const extracted = extractItem(
      inputInventory,
      order.itemId,
      order.remaining,
    );
    if (extracted <= 0) return;

    order.remaining -= extracted;
    sold += extracted;
    payout += extracted * order.unitPrice;
  });

  market.orders = market.orders.filter((order) => order.remaining > 0);

  if (payout > 0) {
    let paidNow = 0;
    const money = compressCoins(payout);
    money.forEach((stack) => {
      paidNow += insertItem(payoutInventory, stack.id, stack.count);
    });
    const owed = Math.max(0, payout - paidNow);

    market.pendingPayout += owed;
    market.totalPaid += paidNow;
    market.totalPurchased += sold;
  }
}

export function showVillageOrders(
  player: $Player,
  market: VillageMarketState,
): void {
  if (market.orders.length === 0) {
    player.tell({
      text: "No active village orders right now.",
      color: "yellow",
    });
    return;
  }

  player.tell({
    text: "Active village orders:",
    color: "gold",
  });
  market.orders.forEach((order, index) => {
    const total = order.remaining * order.unitPrice;
    player.tell({
      text: `#${index + 1} ${order.remaining}x ${Item.of(order.itemId).displayName.getString()} @ ${order.unitPrice} Spurs (total ${total})`,
      color: "aqua",
    });
  });
}

export function isVillageChunkAllowed(
  state: LogisticsRuntimeState,
  dimension: string,
  x: number,
  z: number,
): boolean {
  const key = toVillageChunkKey(dimension, x, z);
  return state.allowedVillageChunks.includes(key);
}

export function isVillageMarkerBlockId(blockId: string): boolean {
  if (blockId === "minecraft:bell") return true;
  if (blockId.endsWith("_bed")) return true;
  return VILLAGE_JOB_SITE_BLOCK_IDS.has(blockId);
}

export function countVillagePoiMarkersNear(block: $LevelBlock): number {
  let markers = 0;

  for (let x = -VILLAGE_POI_SCAN_RADIUS; x <= VILLAGE_POI_SCAN_RADIUS; x++) {
    for (let z = -VILLAGE_POI_SCAN_RADIUS; z <= VILLAGE_POI_SCAN_RADIUS; z++) {
      for (let y = -VILLAGE_POI_SCAN_Y; y <= VILLAGE_POI_SCAN_Y; y++) {
        const nearby = block.offset(x, y, z);
        if (!nearby) continue;

        const blockId = nearby.getId();
        if (!isVillageMarkerBlockId(blockId)) continue;

        markers += 1;
        if (markers >= VILLAGE_MIN_POI_MARKERS) {
          return markers;
        }
      }
    }
  }

  return markers;
}

export function countNearbyVillagers(block: $LevelBlock): number {
  let entities: $EntityArrayList | null;
  try {
    entities = block.getLevel().getEntities();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return 0;
  }

  if (!entities) return 0;

  try {
    entities = entities.filterType("minecraft:villager");
    entities = entities.filterDistance(
      block.getX(),
      block.getY(),
      block.getZ(),
      VILLAGE_VILLAGER_SCAN_RADIUS,
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    // Ignore and continue with fallback counting below.
  }

  return toPlainNumber(entities.size(), 0);
}

export function isNativeVillageAt(block: $LevelBlock): boolean {
  try {
    const rawLevel = block.getLevel() as $Level & {
      isVillage: (pos: $BlockPos) => boolean;
    };
    const pos = block.getPos();
    return rawLevel.isVillage(pos);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return false;
  }
}

export function registerVillageChunks(
  state: LogisticsRuntimeState,
  dimension: string,
  x: number,
  z: number,
  radius: number,
): number {
  const chunkX = toChunkCoord(x);
  const chunkZ = toChunkCoord(z);
  const seen = new Set(state.allowedVillageChunks);
  let added = 0;

  for (let offsetX = -radius; offsetX <= radius; offsetX++) {
    for (let offsetZ = -radius; offsetZ <= radius; offsetZ++) {
      const key = chunkKey(dimension, chunkX + offsetX, chunkZ + offsetZ);
      if (seen.has(key)) continue;

      state.allowedVillageChunks.push(key);
      seen.add(key);
      added += 1;
    }
  }

  return added;
}

export function discoverVillageChunksFromPlacement(
  server: $MinecraftServer,
  block: $LevelBlock,
): boolean {
  const state = getRuntimeState(server);
  const dimension = String(block.getDimension());

  if (isVillageChunkAllowed(state, dimension, block.getX(), block.getZ())) {
    return true;
  }

  const villagers = countNearbyVillagers(block);
  const poiMarkers = countVillagePoiMarkersNear(block);
  const nativeVillageDetected = isNativeVillageAt(block);
  const heuristicsDetected =
    villagers >= VILLAGE_MIN_VILLAGER_COUNT &&
    poiMarkers >= VILLAGE_MIN_POI_MARKERS;

  if (!nativeVillageDetected && !heuristicsDetected) {
    return false;
  }

  const added = registerVillageChunks(
    state,
    dimension,
    block.getX(),
    block.getZ(),
    VILLAGE_REGISTER_CHUNK_RADIUS,
  );

  if (added > 0) {
    persistRuntimeState(server);
  }

  return true;
}

BlockEvents.placed(VILLAGE_MARKET_BLOCK_ID, (event) => {
  if (event.level.isClientSide()) return;

  const state = getRuntimeState(event.server);
  const dimension = String(event.block.getDimension());
  const inAllowedChunk = isVillageChunkAllowed(
    state,
    dimension,
    event.block.getX(),
    event.block.getZ(),
  );
  const discoveredNow = discoverVillageChunksFromPlacement(
    event.server,
    event.block,
  );

  if (!inAllowedChunk && !discoveredNow && !isCreativePlayer(event.player)) {
    event.cancel();
    if (event.player) {
      event.player.tell({
        text: "Village Market Controller can only be placed in a detected village chunk.",
        color: "red",
      });
      event.player.tell({
        text: "Detection checks villagers + village POIs nearby, then marks the local village chunks.",
        color: "gray",
      });
    }
    return;
  }

  addOrGetVillageMarket(event.server, event.block);
});

BlockEvents.broken(VILLAGE_MARKET_BLOCK_ID, (event) => {
  if (event.level.isClientSide()) return;
  removeStation(event.server, toStationRef(event.block).key);
});

BlockEvents.rightClicked(VILLAGE_MARKET_BLOCK_ID, (event) => {
  if (!isMainHand(String(event.hand))) return;
  if (event.level.isClientSide()) return;

  const state = getRuntimeState(event.server);
  const market = addOrGetVillageMarket(event.server, event.block);
  const payoutInventory = getRelativeInventory(event.block, 0, -1, 0);
  const tokenCount = payoutInventory ? countDispatchTokens(payoutInventory) : 0;

  if (market.orders.length === 0) {
    refreshVillageOrders(market, Math.max(1, 1 + market.backlogRefreshes));
    market.backlogRefreshes = 0;
    market.lastRefreshTick = state.tick;
    persistRuntimeState(event.server);
  }

  event.player.tell({
    text: `[Logistica] Village market ${market.key}`,
    color: "gold",
  });
  event.player.tell({
    text: `Input above: ${describeInventoryPresent(event.block, 0, 1, 0)} | payout/token buffer below: ${describeInventoryPresent(event.block, 0, -1, 0)} (${tokenCount})`,
    color: "gray",
  });
  event.player.tell({
    text: `Pending payout: ${market.pendingPayout} Spurs | total purchased: ${market.totalPurchased}`,
    color: "gray",
  });
  showVillageOrders(event.player, market);
  event.player.tell({
    text: "Deliver requested items into inventory above. Tokens below force immediate order refresh.",
    color: "dark_gray",
  });
});
