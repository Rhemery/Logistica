export const INFER_MATERIAL_KEYWORDS = [
  "ingot",
  "nugget",
  "raw",
  "ore",
  "gem",
  "gemstone",
  "shard",
  "crushed",
  "dust",
] as const;

export const INFER_MATERIAL_CLEANUP_KEYWORDS = [
  "block",
  "nether",
  "deepslate",
] as const;

export const INFER_MATERIAL_BLACKLIST_KEYWORDS = [
  "command",
  "recipe",
  "coral",
  "experience",
  "echo",
] as const;

export const INFER_MATERIAL_OVERRIDE = [["lapis_lazuli", "lapis"]] as const;
