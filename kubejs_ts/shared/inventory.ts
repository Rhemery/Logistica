import { $InventoryKJS } from "@package/dev/latvian/mods/kubejs/core";
import { $LevelBlock } from "@package/dev/latvian/mods/kubejs/level";

export function getRelativeInventory(
  block: $LevelBlock,
  x: number,
  y: number,
  z: number,
): $InventoryKJS | null {
  const target = block.offset(x, y, z);
  if (!target || !target.getInventory()) return null;
  return target.getInventory();
}

export function describeInventoryPresent(
  block: $LevelBlock,
  x: number,
  y: number,
  z: number,
): string {
  return getRelativeInventory(block, x, y, z) ? "yes" : "no";
}
