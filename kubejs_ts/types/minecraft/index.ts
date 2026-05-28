// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./global.d.ts" />

import { RegistryTypes } from "@special/types";

export type ResourceLocation = `${string}:${string}`;
export type ItemId = RegistryTypes.Item;
export type TagId = RegistryTypes.ItemTag;
export type BlockId = RegistryTypes.Block;
export type FluidId = RegistryTypes.Fluid;
export type EntityId = RegistryTypes.EntityType;
export type RecipeTypeId = RegistryTypes.RecipeType;
export type ModId = string;

export type Mod = {
  id: string;
  name: string;
  version: string | number;
};

export type DeepSearchObject = Record<string, any> | any[] | string;

export {};
