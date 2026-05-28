import { WORLDGEN_SUMMARY } from "kubejs_ts/shared/minecraft/worldgen";
import { ItemId, TagId } from "kubejs_ts/types/minecraft";
import { Item } from "kubejs_ts/types/minecraft/item";
import { MarketEntry } from "kubejs_ts/types/logistica/logistics";

global.runtimeStateCache = {};
global.__runtime_meta_cache = {
  modules: {},
};
global.villagePoolCache = {
  entries: [] as ItemId[],
  size: 0,
};
global.items = {} as Record<ItemId, Item>;
global.tags = {} as Record<TagId, ItemId[]>;
global.recipes = {};
global.materials = {};
global.economyItemCosts = {};
global.marketEntries = {} as Record<ItemId, MarketEntry>;
global.biomeData = WORLDGEN_SUMMARY;
global.cachedBridge = {
  ref: null,
};
global.kubejs = {
  deferredReloadRequested: false,
  deferredReloadCompleted: false,
  deferredReloadTick: -1,
};
global.modpackModAudit = {
  ok: true,
  missingBaseline: true,
  added: [],
  removed: [],
  updated: [],
};

console.infof("========== GLOBALS LOADED ==========");
