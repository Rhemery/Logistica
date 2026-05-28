import type { MarketEntry } from "../logistica/logistics";
import type { Material } from "./material";
import type { Item, ItemCostEntry } from "./item";
import type { Recipe } from "./recipe";
import type { Minecraft } from "kubejs_ts/shared/minecraft/runtime";
import { WORLDGEN_SUMMARY } from "kubejs_ts/shared/minecraft/worldgen";
import type { ItemId, TagId, Mod } from "./index";
import type { LogisticaBridgeApi } from "../logistica/bridge";

declare global {
  var global: {
    modpackModAudit: {
      ok: boolean;
      missingBaseline: boolean;
      added: Mod[];
      removed: Mod[];
      updated: (Mod & { expected: string; current: string })[];
    };
    runtimeStateCache: Partial<Minecraft.Runtime.State>;
    __runtime_meta_cache?: {
      modules: Record<
        string,
        {
          entities: Record<
            string,
            {
              lastSeenTick: number;
              isPlayer: boolean;
            }
          >;
        }
      >;
    };
    villagePoolCache: {
      entries: ItemId[];
      size: number;
    };
    materials: Record<string, Material>;
    recipes: Record<string, Recipe>;
    items: Record<ItemId, Item>;
    tags: Record<TagId, ItemId[]>;
    economyItemCosts: Record<string, ItemCostEntry>;
    marketEntries: Record<ItemId, MarketEntry>;
    biomeData: typeof WORLDGEN_SUMMARY;
    cachedBridge: {
      ref: LogisticaBridgeApi | null;
    };
    kubejs: {
      deferredReloadRequested: boolean;
      deferredReloadCompleted: boolean;
      deferredReloadTick: number;
    };
  };
}

export {};
