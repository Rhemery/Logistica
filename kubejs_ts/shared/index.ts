/* eslint-disable @typescript-eslint/no-unused-vars */
import type { $KubeRecipe } from "dev.latvian.mods.kubejs.recipe.KubeRecipe";
import { $Ingredient$$Type } from "net.minecraft.world.item.crafting.Ingredient";
import { clamp } from "./math";
import { DeepSearchObject, ItemId, TagId } from "kubejs_ts/types";
import { $RecipeFilter$$Type } from "dev.latvian.mods.kubejs.recipe.filter.RecipeFilter";
import { $ItemStack$$Type } from "net.minecraft.world.item.ItemStack";
import { isItemId, isTagId } from "./item";
import { Material } from "kubejs_ts/types/material";

export const ITEM_GROUP_NAMESPACE = ["c", "neoforge"] as const;

export const MATERIAL_FORM = {
  ore: "ores",
  raw: "raw_materials",
  crushed: "crushed_raw_materials",
  dust: "dusts",
  nugget: "nuggets",
  ingot: "ingots",
  gem: "gems",
  plate: "plates",
  block: "storage_blocks",
} as const;

export const SMELTING_TYPES: string[] = [
  "minecraft:smelting",
  "minecraft:blasting",
  "create:fan_blasting",
];

const itemGroupCache: Record<string, ItemId[]> = {};

export function unique<T>(list: T[]) {
  return Array.from(new Set<T>(list.filter(Boolean)));
}

export function clearObject(obj: object) {
  for (const key in obj) {
    delete obj[key as keyof typeof obj];
  }
}

export function deepSearch(
  path: string,
  object: DeepSearchObject,
  output: any[],
  expected: (
    | "bigint"
    | "boolean"
    | "function"
    | "number"
    | "object"
    | "string"
    | "symbol"
    | "undefined"
  )[],
) {
  const parts = path.split(".").filter((s) => s.length > 0);
  const part = parts[0];
  if (!part) return false;

  const key = part.replace("[]", "") as keyof typeof object;
  const isArray = part.includes("[]") && Array.isArray(object[key]);
  const nestedArray = part == "[]" && Array.isArray(object);
  const expectencyCheck = (value: any) => {
    return expected.includes(typeof value);
  };

  if (parts.length == 1) {
    if (nestedArray && expectencyCheck(object)) {
      output.push(object);
      return true;
    } else if (isArray && expectencyCheck(object[key])) {
      const arr = object[key] as any[];
      arr.forEach((_, i) => {
        if (!expectencyCheck(arr[i])) return;

        output.push(arr[i]);
      });

      return true;
    } else if (expectencyCheck(object[part as keyof typeof object])) {
      output.push(object[part as keyof typeof object]);
      return true;
    } else {
      output.push(undefined);
      return false;
    }
  }

  if (nestedArray) {
    object.forEach((o, i) => {
      deepSearch(
        parts.slice(1).join("."),
        object[i] as DeepSearchObject,
        output,
        expected,
      );
    });
  } else if (isArray) {
    (object[key] as any[]).forEach((o, i) => {
      deepSearch(
        parts.slice(1).join("."),
        (object[key] as any[])[i] as DeepSearchObject,
        output,
        expected,
      );
    });
  } else if (typeof object[key] === "object") {
    deepSearch(
      parts.slice(1).join("."),
      object[key] as DeepSearchObject,
      output,
      expected,
    );
  }

  return false;
}

export function flat<T>(array: T[][], depth = 1): T[] {
  const flattend = [];

  for (const el of array) {
    if (Array.isArray(el) && depth) {
      flat(el as T[][], depth - 1).forEach((el) => flattend.push(el as T));
    } else {
      flattend.push(el);
    }
  }

  return flattend as T[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && isFinite(value)) {
    return value;
  }

  return fallback;
}

export function itemId(id: string) {
  if (!isItemId(id))
    throw new Error(`Expected item ID ('namespace:item'), got ${id}`);

  return id as ItemId;
}

export function tagId(tag: string) {
  if (!isTagId(tag))
    throw new Error(
      `Expected tag ID ('#namespace:tag', '#namespace:category/subcategory'), got ${tag}`,
    );

  return tag as TagId;
}

export function normalizePositiveNumber(
  value: number | null | undefined,
  fallback: number,
): number {
  if (value == null) return fallback;
  if (value == undefined) return fallback;
  if (!Number.isFinite(value)) return fallback;
  if (value <= 0) return fallback;

  return value;
}

export function isStringifiedObject(value: object | string): boolean {
  function includesObjectChars(value: string) {
    return value.startsWith("{") && value.endsWith("}");
  }

  if (typeof value === "object") {
    value = String(value);
  }

  if (typeof value === "string" && includesObjectChars(value)) {
    return true;
  }

  return false;
}

export function tryParse(value: unknown): object | null {
  const forcedString = String(value);

  if (forcedString.startsWith("{") && forcedString.endsWith("}")) {
    if (forcedString.length == 2) return {};
    if (!forcedString.includes('"')) {
      console.warn(
        `[isParsableObject] Failed to parse: ${forcedString} - has values but no quotes`,
      );
    }

    return JSON.parse(forcedString) as object;
  }

  if (forcedString.startsWith("[") && forcedString.endsWith("]")) {
    if (forcedString.includes("object Object")) {
      return value as object;
    } else if (forcedString.includes("not_supported")) {
      return null;
    } else if (forcedString.includes("[]")) {
      return [];
    } else if (forcedString.includes('"')) {
      return JSON.parse(forcedString) as object;
    } else {
      try {
        const stringified = (value as object).toString();
        console.info(
          `[isParsableObject] Java object: ${stringified} - ${forcedString}`,
        );
        return tryParse(stringified);
      } catch (e) {
        console.error(
          `[isParsableObject] Failed to parse: ${String(e)} - checked if its java object`,
        );
        return null;
      }
    }
  }
  return null;
}
