import {
  ExcavationChunkState,
  ExcavationResourceShare,
  HubDispatchState,
  LogisticsRuntimeState,
  MiningOutpostState,
  VillageDemandOrder,
  VillageMarketState,
} from "kubejs_ts/types/logistics";
import { clamp, toPlainNumber } from "./math";
import { ItemId } from "kubejs_ts/types";
import { VILLAGE_REFRESH_TICKS } from "./core/village";
import {
  HUB_DEFAULT_THRESHOLD,
  HUB_DEFAULT_WATCH_ITEMS,
  HUB_INACTIVITY_TICKS,
} from "./core/hub";
import { normalizeChunkKey } from "./chunk";
import {
  EXCAVATION_RICHNESS_MAX,
  EXCAVATION_RICHNESS_MIN,
} from "./core/excavation";
import { $MinecraftServer } from "@package/net/minecraft/server";
import { $CompoundTag } from "@package/net/minecraft/nbt";

export const RUNTIME_STATE_NBT_KEY = "logisticaMvpStateJson";
export const RUNTIME_STATE_SAVE_INTERVAL_TICKS = 20 * 15;
export const OUTPOST_DEFAULT_MAX_BACKLOG = 16;

export let runtimeStateCache: LogisticsRuntimeState | null = null;

export function createDefaultRuntimeState(): LogisticsRuntimeState {
  return {
    tick: 0,
    miningOutposts: [],
    villageMarkets: [],
    hubs: [],
    allowedVillageChunks: [],
    excavationChunks: [],
  };
}

export function normalizeRuntimeState(raw: unknown): LogisticsRuntimeState {
  const fallback = createDefaultRuntimeState();
  if (typeof raw !== "object" || raw == null) return fallback;

  const state = raw as Partial<LogisticsRuntimeState>;

  const miningOutposts: MiningOutpostState[] = Array.isArray(
    state.miningOutposts,
  )
    ? state.miningOutposts.map((entry) => {
        const candidate = entry as Partial<MiningOutpostState>;
        const key = typeof candidate.key === "string" ? candidate.key : "";
        const dimension =
          typeof candidate.dimension === "string"
            ? candidate.dimension
            : "minecraft:overworld";

        return {
          key,
          dimension,
          x: toPlainNumber(candidate.x, 0),
          y: toPlainNumber(candidate.y, 0),
          z: toPlainNumber(candidate.z, 0),
          backlogCycles: toPlainNumber(candidate.backlogCycles, 0),
          maxBacklogCycles: Math.max(
            1,
            toPlainNumber(
              candidate.maxBacklogCycles,
              OUTPOST_DEFAULT_MAX_BACKLOG,
            ),
          ),
          unloadedCycles: toPlainNumber(candidate.unloadedCycles, 0),
          lastRunTick: toPlainNumber(candidate.lastRunTick, 0),
          totalProduced: toPlainNumber(candidate.totalProduced, 0),
        } satisfies MiningOutpostState;
      })
    : [];

  const villageMarkets: VillageMarketState[] = Array.isArray(
    state.villageMarkets,
  )
    ? state.villageMarkets.map((entry) => {
        const candidate = entry as Partial<VillageMarketState>;
        const key = typeof candidate.key === "string" ? candidate.key : "";
        const dimension =
          typeof candidate.dimension === "string"
            ? candidate.dimension
            : "minecraft:overworld";
        const orders: VillageDemandOrder[] = Array.isArray(candidate.orders)
          ? candidate.orders.map((order) => {
              const normalizedOrder = order as Partial<VillageDemandOrder>;
              const itemId =
                typeof normalizedOrder.itemId === "string"
                  ? normalizedOrder.itemId
                  : ("minecraft:air" as ItemId);
              return {
                itemId,
                remaining: toPlainNumber(normalizedOrder.remaining, 0),
                unitPrice: toPlainNumber(normalizedOrder.unitPrice, 0),
              } satisfies VillageDemandOrder;
            })
          : [];

        return {
          key,
          dimension,
          x: toPlainNumber(candidate.x, 0),
          y: toPlainNumber(candidate.y, 0),
          z: toPlainNumber(candidate.z, 0),
          refreshEveryTicks: Math.max(
            20,
            toPlainNumber(candidate.refreshEveryTicks, VILLAGE_REFRESH_TICKS),
          ),
          backlogRefreshes: toPlainNumber(candidate.backlogRefreshes, 0),
          unloadedCycles: toPlainNumber(candidate.unloadedCycles, 0),
          lastRefreshTick: toPlainNumber(candidate.lastRefreshTick, 0),
          totalPurchased: toPlainNumber(candidate.totalPurchased, 0),
          totalPaid: toPlainNumber(candidate.totalPaid, 0),
          pendingPayout: toPlainNumber(candidate.pendingPayout, 0),
          orders,
        } satisfies VillageMarketState;
      })
    : [];

  const hubs: HubDispatchState[] = Array.isArray(state.hubs)
    ? state.hubs.map((entry) => {
        const candidate = entry as Partial<HubDispatchState>;
        const watchItems: ItemId[] = Array.isArray(candidate.watchItems)
          ? candidate.watchItems.map((itemId) => itemId)
          : HUB_DEFAULT_WATCH_ITEMS;
        const key = typeof candidate.key === "string" ? candidate.key : "";
        const dimension =
          typeof candidate.dimension === "string"
            ? candidate.dimension
            : "minecraft:overworld";

        return {
          key,
          dimension,
          x: toPlainNumber(candidate.x, 0),
          y: toPlainNumber(candidate.y, 0),
          z: toPlainNumber(candidate.z, 0),
          watchItems,
          thresholdPerItem: Math.max(
            1,
            toPlainNumber(candidate.thresholdPerItem, HUB_DEFAULT_THRESHOLD),
          ),
          inactivityTicks: Math.max(
            20,
            toPlainNumber(candidate.inactivityTicks, HUB_INACTIVITY_TICKS),
          ),
          lastDispatchTick: toPlainNumber(candidate.lastDispatchTick, 0),
          dispatchCount: toPlainNumber(candidate.dispatchCount, 0),
        } satisfies HubDispatchState;
      })
    : [];

  const allowedVillageChunks: string[] = Array.isArray(
    state.allowedVillageChunks,
  )
    ? Array.from(
        new Set(
          state.allowedVillageChunks
            .map((value) => normalizeChunkKey(value))
            .filter((value): value is string => value != null),
        ),
      )
    : [];

  const excavationChunks: ExcavationChunkState[] = Array.isArray(
    state.excavationChunks,
  )
    ? state.excavationChunks.map((entry) => {
        const candidate = entry as Partial<ExcavationChunkState>;
        const key = typeof candidate.key === "string" ? candidate.key : "";
        const dimension =
          typeof candidate.dimension === "string"
            ? candidate.dimension
            : "minecraft:overworld";
        const resources: ExcavationResourceShare[] = Array.isArray(
          candidate.resources,
        )
          ? candidate.resources
              .map((resource) => {
                const normalized = resource as Partial<ExcavationResourceShare>;
                const itemId =
                  typeof normalized.itemId === "string"
                    ? normalized.itemId
                    : ("minecraft:air" as ItemId);
                return {
                  itemId,
                  weight: Math.max(0, toPlainNumber(normalized.weight, 0)),
                  percent: clamp(toPlainNumber(normalized.percent, 0), 0, 1),
                } satisfies ExcavationResourceShare;
              })
              .filter(
                (resource) => resource.itemId !== ("minecraft:air" as ItemId),
              )
          : [];

        const normalizedChunk: ExcavationChunkState = {
          key,
          dimension,
          chunkX: toPlainNumber(candidate.chunkX, 0),
          chunkZ: toPlainNumber(candidate.chunkZ, 0),
          biomeId:
            typeof candidate.biomeId === "string"
              ? candidate.biomeId
              : "minecraft:unknown",
          richness: clamp(
            toPlainNumber(candidate.richness, EXCAVATION_RICHNESS_MIN),
            EXCAVATION_RICHNESS_MIN,
            EXCAVATION_RICHNESS_MAX,
          ),
          empty: Boolean(candidate.empty),
          resources,
        };

        if (normalizedChunk.resources.length === 0) {
          normalizedChunk.empty = true;
        }

        return normalizedChunk;
      })
    : [];

  return {
    tick: toPlainNumber(state.tick, 0),
    miningOutposts,
    villageMarkets,
    hubs,
    allowedVillageChunks,
    excavationChunks,
  };
}

export function persistRuntimeState(server: $MinecraftServer): void {
  if (!runtimeStateCache) return;

  const data = server.persistentData;
  data.putString(RUNTIME_STATE_NBT_KEY, JSON.stringify(runtimeStateCache));
}

export function getRuntimeState(
  server: $MinecraftServer,
): LogisticsRuntimeState {
  if (runtimeStateCache) return runtimeStateCache;

  const data = server.persistentData as $CompoundTag & {
    logisticaMvp?: unknown;
  };

  let loadedState: LogisticsRuntimeState | null = null;

  if (data.contains(RUNTIME_STATE_NBT_KEY)) {
    const json = data.getString(RUNTIME_STATE_NBT_KEY);
    if (json && json.length > 0) {
      try {
        loadedState = normalizeRuntimeState(JSON.parse(json));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warnf(
          `[Logistica] Failed to parse runtime state JSON: ${errorMessage}`,
        );
      }
    }
  } else if (data.logisticaMvp != null) {
    // Migrate legacy NBT-bean-like storage.
    loadedState = normalizeRuntimeState(data.logisticaMvp);
    data.remove("logisticaMvp");
  }

  runtimeStateCache = loadedState ?? createDefaultRuntimeState();
  persistRuntimeState(server);
  return runtimeStateCache;
}

export function resetStateCache() {
  runtimeStateCache = null;
}
