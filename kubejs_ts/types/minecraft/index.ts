import { RegistryTypes } from "@special/types";
import { Item, ItemCostEntry } from "./item";
import {
  ExcavationChunkState,
  HubDispatchState,
  MarketEntry,
  MarketTerminalState,
  MiningOutpostState,
  VillageMarketState,
} from "../logistica/logistics";
import { Material } from "./material";
import { Recipe } from "./recipe";
import { WORLDGEN_SUMMARY } from "kubejs_ts/shared/minecraft/worldgen";
import { CA } from "../core_awakening";

declare global {
  let global: {
    runtimeStateCache: RuntimeState;
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
    entities: Record<
      string,
      {
        data: {
          core: CA.Core;
          nodesDisintigrated: number;
        };
      }
    >;
  };
}

export type ResourceLocation = `${string}:${string}`;
export type ItemId = RegistryTypes.Item;
export type TagId = RegistryTypes.ItemTag;
export type BlockId = RegistryTypes.Block;
export type FluidId = RegistryTypes.Fluid;
export type EntityId = RegistryTypes.EntityType;
export type RecipeTypeId = RegistryTypes.RecipeType;
export type ModId = string;

export type DeepSearchObject = Record<string, any> | any[] | string;

export type RuntimeState = {
  tick: number;
  marketTerminals: MarketTerminalState[];
  miningOutposts: MiningOutpostState[];
  villageMarkets: VillageMarketState[];
  hubs: HubDispatchState[];
  allowedVillageChunks: string[];
  excavationChunks: ExcavationChunkState[];
  caState: CA.RuntimeState;
  entities: Record<string, CA.EntityData>;
};

export {};
