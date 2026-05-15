import { $InventoryKJS } from "dev.latvian.mods.kubejs.core.InventoryKJS";
import { $LevelBlock } from "dev.latvian.mods.kubejs.level.LevelBlock";

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
