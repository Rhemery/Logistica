import { Item, ItemCostEntry } from "./item";
import { MarketEntry } from "./logistics";
import { Material } from "./material";
import { Recipe } from "./recipe";
import { WORLDGEN_SUMMARY } from "kubejs_ts/shared/worldgen";

declare global {
  const global: {
    materials: Record<string, Material>;
    recipes: Record<string, Recipe>;
    items: Record<ItemId, Item>;
    tags: Record<TagId, ItemId[]>;
    economyItemCosts: Record<string, ItemCostEntry>;
    marketEntries: Record<ItemId, MarketEntry>;
    biomeData: typeof WORLDGEN_SUMMARY;
  };
}

export type ResourceLocation = `${string}:${string}`;
export type ItemId = ResourceLocation;
export type TagId = ResourceLocation | `#${ResourceLocation}`;
export type BlockId = ResourceLocation;
export type FluidId = ResourceLocation;
export type EntityId = ResourceLocation;
export type RecipeTypeId = ResourceLocation;
export type ModId = string;

export type DeepSearchObject = Record<string, any> | any[] | string;

export {};
