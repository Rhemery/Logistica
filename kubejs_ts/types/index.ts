import { RegistryTypes } from "@special/types";
import { Item, ItemCostEntry } from "./item";
import { MarketEntry } from "./logistics";
import { Material } from "./material";
import { Recipe } from "./recipe";
import { WORLDGEN_SUMMARY } from "kubejs_ts/shared/worldgen";

declare global {
  let global: {
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
export type ItemId = RegistryTypes.Item;
export type TagId = RegistryTypes.ItemTag;
export type BlockId = RegistryTypes.Block;
export type FluidId = RegistryTypes.Fluid;
export type EntityId = RegistryTypes.EntityType;
export type RecipeTypeId = RegistryTypes.RecipeType;

export type DeepSearchObject = Record<string, any> | any[] | string;

export {};
