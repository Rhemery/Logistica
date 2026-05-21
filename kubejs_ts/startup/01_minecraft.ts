import { WORLDGEN_SUMMARY } from "kubejs_ts/shared/minecraft/worldgen";
import { ItemId, TagId } from "kubejs_ts/types/minecraft";
import { Item } from "kubejs_ts/types/minecraft/item";
import { MarketEntry } from "kubejs_ts/types/logistica/logistics";
import { createDefaultRuntimeState } from "kubejs_ts/shared/minecraft/runtime";

global.runtimeStateCache = createDefaultRuntimeState();
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

console.infof("========== GLOBALS LOADED ==========");
