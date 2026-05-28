import { BlockId, ItemId } from "kubejs_ts/types/minecraft";

export const INSERT_CELL_SOUND = "kubejs:insert_cell";
export const NODE_PULSE_SOUND = "kubejs:node_pulse";
export const NODE_PULSE_SOUND_RADIUS = 48;

export const CORRUPTION_SIM_INTERVAL_TICKS = 20;
export const CORRUPTION_PLAYER_INTERVAL_TICKS = 20;
export const CORRUPTION_MOB_INTERVAL_TICKS = 20 * 2;
export const CORRUPTION_BLOCK_INTERVAL_TICKS = 20 * 2;
export const CORRUPTION_SAVE_SNAPSHOT_INTERVAL_TICKS = 20 * 60;

export const CORRUPTION_MAX_TRACKED_CHUNKS = 2048;
export const CORRUPTION_MIN_TRACKED_INTENSITY = 0.02;
export const CORRUPTION_MAX_INTENSITY = 1.75;
export const CORRUPTION_DECAY_PER_STEP = 0.012;
export const CORRUPTION_SPREAD_SHARE = 0.18;

export const CORRUPTION_NODE_DEFAULT_STRENGTH = 1;
export const CORRUPTION_NODE_PULSE_INTERVAL_TICKS = 20 * 8;
export const CORRUPTION_NODE_BASE_PULSE = 0.35;

export const PURITY_REFINERY_DEFAULT_POTENCY = 1;
export const PURITY_REFINERY_PULSE_INTERVAL_TICKS = 20 * 6;
export const PURITY_REFINERY_BASE_PULSE = 0.28;

export const CORE_MAX_CORRUPTION = 100;
export const CORE_MAX_PURITY = 100;
export const CORE_MAX_ENERGY = 100;
export const CORE_CORRUPTION_MUTATION_THRESHOLD = 34;
export const CORE_CORRUPTION_OVERDRIVE_THRESHOLD = 72;
export const CORE_CORRUPTION_CRITICAL_THRESHOLD = 95;

export const CORE_BASE_ENERGY_DRAIN_PER_STEP = 0.65;
export const CORE_SLEEP_RESTORE_PER_STEP = 5;
export const CORE_PURITY_DECAY_PER_STEP = 0.25;
export const CORE_CORRUPTION_PASSIVE_DECAY = 0.06;

export const CORRUPTION_FOG_THRESHOLD = 1;
export const CORRUPTION_MOB_THRESHOLD = 1;

// Global conversion filter:
// - source block id is resolved through conversion-down map first, so this also
//   affects previously generated dead/corrupted variants of the same source.
export const CORRUPTION_CONVERSION_EXCLUDED_BLOCK_IDS: BlockId[] = [
  "minecraft:ice" as BlockId,
  "minecraft:packed_ice" as BlockId,
  "minecraft:blue_ice" as BlockId,
  "minecraft:frosted_ice" as BlockId,
  "minecraft:snow" as BlockId,
  "minecraft:snow_block" as BlockId,
  "minecraft:powder_snow" as BlockId,
];

// Optional extra tag-level exclusions.
export const CORRUPTION_CONVERSION_EXCLUDED_BLOCK_TAGS = [
  "minecraft:ice",
  "minecraft:snow",
] as const;

export type CorruptionReplaceableHandlingMode =
  | "convert_or_remove"
  | "remove_only"
  | "ignore";

// If a support block is converted and a replaceable block sits above it:
// - convert_or_remove: try to convert the above block; if not possible, remove without drops.
// - remove_only: remove above block without drops.
// - ignore: leave above block as-is.
export const CORRUPTION_REPLACEABLE_HANDLING_MODE: CorruptionReplaceableHandlingMode =
  "convert_or_remove";

// Max number of blocks above converted ground to scan for replaceable stacks
// (flowers, grasses, etc.).
export const CORRUPTION_REPLACEABLE_SCAN_HEIGHT = 3;

export const CORRUPTION_NODE_BLOCK_IDS: BlockId[] = [
  "kubejs:corruption_node" as BlockId,
  "coreawakening:corruption_node" as BlockId,
];

export const PURITY_REFINERY_BLOCK_IDS: BlockId[] = [
  "kubejs:purity_refinery" as BlockId,
  "coreawakening:purity_refinery" as BlockId,
];

export const PURITY_CURE_ITEMS: Partial<Record<ItemId, number>> = {
  "minecraft:honey_bottle": 7,
  "minecraft:milk_bucket": 14,
  "minecraft:golden_apple": 16,
  "minecraft:enchanted_golden_apple": 35,
  "minecraft:potion": 10,
};
