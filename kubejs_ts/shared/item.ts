import type { ItemId, TagId } from "kubejs_ts/types";
import type { Item } from "kubejs_ts/types/item";
import { clearObject } from ".";
import {
  BASE_TAG_VALUES,
  CATEGORY_WEIGHTS,
  ITEM_VALUES,
  SPECIFIC_TAG_VALUES,
  TagValues,
} from "./config/economy";
import { $InventoryKJS } from "dev.latvian.mods.kubejs.core.InventoryKJS";
import { toPlainNumber } from "./math";
import { $ItemStack$$Type } from "net.minecraft.world.item.ItemStack";

export const DEFAULT_ROOT_ITEM_VALUE = 25;
export const MIN_MEANINGFUL_ITEM_VALUE = 5;
export const MAX_NATURAL_ITEM_VALUE = 250;
export const MAX_ITEM_VALUE = 100000;
export const EXCLUDED_ITEM_KEYWORDS = [
  ":air",
  "creative",
  "command_block",
  "barrier",
  "spawn_egg",
  "music_disc",
  "structure_void",
  "structure_block",
  "jigsaw",
  "debug_stick",
  "bedrock",
];

export function loadItems() {
  console.info("[Economy] Collecting items...");
  clearObject(global.items);
  clearObject(global.tags);

  Item.getList().forEach((itemStack) => {
    const javaItem = itemStack.getItem();
    if (!isItemId(javaItem.id)) return;

    const tags: TagId[] = [];
    javaItem.tags.forEach((tagResourceLocation) => {
      const tag =
        `#${tagResourceLocation.namespace as string}:${tagResourceLocation.path as string}` as TagId;
      tags.push(tag);
      if (
        global.tags[tag] &&
        !global.tags[tag].includes(javaItem.id as ItemId)
      ) {
        global.tags[tag].push(javaItem.id as ItemId);
      } else {
        global.tags[tag] = [javaItem.id];
      }
    });

    const item: Item = {
      id: javaItem.id,
      name: javaItem.id,
      blockTags: [] as TagId[],
      itemTags: tags,
      kind: determineItemKind(javaItem.id),
      recipes: {
        asInput: [],
        asOutput: [],
      },
      value: 0,
      valueChanges: [],
      valueModifiers: [],
      materials: {},
    };
    global.items[item.id] = item;

    processTags(item, BASE_TAG_VALUES, "Base Tags");
    processTags(item, SPECIFIC_TAG_VALUES, "Specific Tags");

    if (ITEM_VALUES[item.id]) {
      const value = ITEM_VALUES[item.id] ?? 0;
      registerItemValueChange(item.id, {
        by: item.id,
        type: "ID",
        change: ItemValueOperation.set,
        amount: value,
      });
    } /*else {
      const specificTags = item.itemTags.filter((tag) => {
        return isTagId(tag) && tag.includes("/");
      });
      const baseTags = item.itemTags.filter((tag) => {
        return isTagId(tag) && !tag.includes("/");
      });
      const tagsValues = new Map<string, number>();

      baseTags.forEach((tag) => {
        tagsValues.set(tag, BASE_TAG_VALUES[tag] ?? 0);
      });
      specificTags.forEach((tag) => {
        const baseTag = tag.split("/")[0] as string;
        if (tagsValues.has(baseTag)) {
          tagsValues.delete(baseTag);
        }

        tagsValues.set(tag, SPECIFIC_TAG_VALUES[tag] ?? 0);
      });

      tagsValues.forEach((value, id) => {
        registerItemValueChange(item.id, {
          by: id,
          type: "Tag",
          change: ItemValueOperation.add,
          amount: value,
        });
      });
    }*/

    global.items[item.id] = item;
  });

  JsonIO.write(
    "kubejs/exported/server/items.json",
    JSON.parse(JSON.stringify(global.items, null, 2)) as typeof global.items,
  );

  JsonIO.write(
    "kubejs/exported/server/tags.json",
    JSON.parse(JSON.stringify(global.tags, null, 2)) as typeof global.tags,
  );
}

export function getAllItemIds(): ItemId[] {
  return Object.keys(global.items) as ItemId[];
}

export function getItem(id: ItemId) {
  if (!isItemId(id))
    throw new Error(`Expected item ID ('namespace:item'), got ${String(id)}`);

  return global.items[id];
}

export function itemExists(id: ItemId) {
  if (isItemId(id) && global.items[id]) return true;
  return false;
}

export function tagExists(tag: TagId) {
  if (isTagId(tag) && global.tags[tag]) return true;
  return false;
}

export function isItemId(id: string): id is ItemId {
  if (typeof id !== "string") {
    id = String(id);
  }

  if (!id.includes(":")) return false;
  if (id === "minecraft:air") return false;
  if (id === "minecraft:barrier") return false;

  const [namespace, path] = id.split(":");
  if (!namespace || !/^[a-z0-9_.-]+$/.test(namespace)) return false;
  if (!path || !/^[a-z0-9_./-]+$/.test(path)) return false;

  return true;
}

export function isTagId(id: string): boolean {
  if (id.startsWith("#")) return true;
  return false;
}

export function isTag(tag: string): tag is TagId {
  if (typeof tag !== "string") return false;
  if (!tag.startsWith("#")) return false;

  const [namespace, path] = tag.replace("#", "").split(":");
  if (!namespace || !/^[a-z0-9_.-]+$/.test(namespace)) return false;
  if (!path || !/^[a-z0-9_./-]+$/.test(path)) return false;

  const [category, subcategory] = path.split("/");
  if (!category || !/^[a-z0-9_.-]+$/.test(category)) return false;
  if (subcategory && !/^[a-z0-9_.-]+$/.test(subcategory)) return false;

  return true;
}

export function tagId(id: string): TagId {
  if (!id.includes(":")) id = `minecraft:${id.replace("#", "")}`;
  if (isTag(id)) return id as TagId;
  if (isTag(`#${id}`)) return `#${id}` as TagId;

  throw new Error(
    `Expected tag ID ('#namespace:tag', '#namespace:category/subcategory'), got ${id}`,
  );
}

export function hasItems(tag: TagId) {
  if (isTag(tag)) return (global.tags[tag]?.length ?? 0) > 0;
  return false;
}

export function getItems(tag: TagId) {
  if (hasItems(tag)) return global.tags[tag] as ItemId[];
  return [];
}

export function tagHasItem(tag: TagId, item: ItemId) {
  if (hasItems(tag)) return global.tags[tag]?.includes(item) ?? false;
  return false;
}

export enum ItemValueOperation {
  none,
  set,
  add,
  substract,
}
export function registerItemValueChange(
  id: ItemId,
  input: Item["valueChanges"][number],
) {
  const item = getItem(id);
  if (!item) return;

  item.valueChanges.push(input);
}

export function getItemValue(id: ItemId) {
  const item = getItem(id);
  if (!item) return 0;

  let value = 0;
  item.valueChanges.forEach((change) => {
    switch (change.change) {
      case ItemValueOperation.none:
        break;
      case ItemValueOperation.set:
        value = change.amount;
        break;
      case ItemValueOperation.add:
        value += change.amount;
        break;
      case ItemValueOperation.substract:
        value -= change.amount;
        break;
    }
  });

  return value;
}

export function processTags(item: Item, tags: TagValues, type: string) {
  const processTags = Object.keys(tags).filter(
    (tag) => tags[tag] && item.itemTags.includes(tag as TagId),
  );
  const count = processTags.length;
  processTags.forEach((tag) => {
    if (item.itemTags.includes(tag as TagId)) {
      const tagValue = tags[tag];
      if (!tagValue) return;

      if (tagValue.modifiers) item.valueModifiers.push(tagValue.modifiers);

      registerItemValueChange(item.id, {
        by: tag,
        type: type,
        change: ItemValueOperation.add,
        amount: tagValue.base / count,
      });
    }
  });
}

export function normalizeTagLookupKey(id: string): TagId {
  return (id.startsWith("#") ? id : `#${id}`) as TagId;
}

export function getPreferredItem(tag: TagId) {
  const items = getItems(tag);
  if (items.length === 0) return null;

  const priority = [
    "minecraft",
    "alltheores",
    "create",
    "tfmg",
    "creatingspace",
    "allthemodium",
    "aether",
    "deep_aether",
    "iceandfire",
    "extendedcrafting",
  ];

  let found: ItemId | undefined;
  for (const modid of priority) {
    found = items.find((id) => id.startsWith(`${modid}:`));
    if (found) return found;
  }

  return items[0];
}

export function determineItemKind(item: ItemId): Item["kind"] {
  if (
    global.biomeData.naturalBlocks[
      item as keyof typeof global.biomeData.naturalBlocks
    ] ||
    global.biomeData.naturalItems[
      item as keyof typeof global.biomeData.naturalItems
    ]
  ) {
    return "resource";
  } else {
    return "product";
  }
}

export function getNaturalItemAbundance(itemId: string): number {
  const sources =
    global.biomeData.naturalItems[
      itemId as keyof typeof global.biomeData.naturalItems
    ];

  if (sources === undefined) return 0;
  if (Array.isArray(sources)) {
    if (sources.length === (0 as number)) return 0;
  }

  let best = 0;

  for (const source of sources) {
    if (source.abundance > best) {
      best = source.abundance;
    }
  }

  return abundanceToScore(best);
}

export function abundanceToScore(abundance: number): number {
  if (!Number.isFinite(abundance) || abundance <= 0) return 0;

  const inverseScore = 10000 / Math.max(0.001, abundance);
  const logScore = Math.log10(inverseScore + 1) * 25;

  return Math.max(1, Math.min(MAX_NATURAL_ITEM_VALUE, logScore));
}

export function getInitialItemValue(itemId: ItemId): number {
  const excludedValue = getExcludedItemValue(itemId);
  if (excludedValue != null) return excludedValue;

  return getNaturalItemAbundance(itemId);
}

export function getExcludedItemValue(itemId: ItemId): number | null {
  for (const keyword of EXCLUDED_ITEM_KEYWORDS) {
    if (itemId.includes(keyword)) return 0;
  }

  return null;
}

export function getStackItemIds(id: string): ItemId[] {
  if (!isItemId(id)) {
    return global.items[id as ItemId] ? [id as ItemId] : [];
  }

  const normalized = normalizeTagLookupKey(id);
  const result: ItemId[] = [];

  Object.values(global.items).forEach((item) => {
    if (
      item.itemTags.includes(normalized as TagId) ||
      item.blockTags.includes(normalized as TagId)
    ) {
      result.push(item.id);
    }
  });

  return result;
}

export function normalizeItemValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= MIN_MEANINGFUL_ITEM_VALUE) return 0;

  return Math.min(MAX_ITEM_VALUE, value);
}

export function getItemCategoryWeightMultiplier(itemId: ItemId): number {
  const item = global.items[itemId] as Item | undefined;
  if (item == null) return 1;

  let multiplier = 1;

  Object.entries(CATEGORY_WEIGHTS).forEach(([resourceCategory, weight]) => {
    const hasTag = item.itemTags.some((tag) => {
      const tagCategory = tag.split(":")[1] as string;
      if (tagCategory == null) return false;

      return tagCategory.split("/").includes(resourceCategory);
    });

    if (hasTag) {
      multiplier *= weight;
    }
  });

  return multiplier;
}

export function insertItem(
  inventory: $InventoryKJS,
  itemId: ItemId,
  amount: number,
): number {
  if (amount <= 0) return 0;

  const stack = Item.of(itemId as $ItemStack$$Type, amount);
  const remaining = inventory.insertItem(
    stack as unknown as $ItemStack$$Type,
    false,
  );
  const leftover = toPlainNumber(remaining?.count, 0);

  return Math.max(0, amount - leftover);
}

export function countItem(inventory: $InventoryKJS, itemId: ItemId): number {
  let total = 0;

  for (let slot = 0; slot < inventory.getSlots(); slot++) {
    const stack = inventory.getStackInSlot(slot);
    if (!stack || stack.empty) continue;
    if (stack.id !== itemId) continue;
    total += toPlainNumber(stack.count, 0);
  }

  return total;
}

export function extractItem(
  inventory: $InventoryKJS,
  itemId: ItemId,
  amount: number,
): number {
  if (amount <= 0) return 0;

  let remaining = amount;
  let extracted = 0;

  for (let slot = 0; slot < inventory.getSlots(); slot++) {
    if (remaining <= 0) break;

    const stack = inventory.getStackInSlot(slot);
    if (!stack || stack.empty) continue;
    if (stack.id !== itemId) continue;

    const slotCount = toPlainNumber(stack.count, 0);
    if (slotCount <= 0) continue;

    const take = Math.min(remaining, slotCount);
    stack.count = slotCount - take;
    inventory.setStackInSlot(slot, stack as unknown as $ItemStack$$Type);

    extracted += take;
    remaining -= take;
  }

  return extracted;
}
