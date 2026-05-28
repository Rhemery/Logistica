import type { ItemId } from "kubejs_ts/types/minecraft";

// Keep normalization defaults side-effect free so helper scripts can import
// persistence keys without registering gameplay event handlers.
export const DEFAULT_VILLAGE_REFRESH_TICKS = 20 * 45;
export const DEFAULT_HUB_THRESHOLD = 128;
export const DEFAULT_HUB_INACTIVITY_TICKS = 20 * 90;
export const DEFAULT_HUB_WATCH_ITEMS: ItemId[] = [
  "minecraft:raw_iron",
  "minecraft:raw_copper",
  "minecraft:coal",
  "create:raw_zinc",
];
export const DEFAULT_EXCAVATION_RICHNESS_MIN = 0.6;
export const DEFAULT_EXCAVATION_RICHNESS_MAX = 1.8;
