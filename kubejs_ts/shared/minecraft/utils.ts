import { toPlainNumber } from "../math";

import { ItemStack } from "kubejs_ts/types/minecraft/item";
import { $Player } from "@package/net/minecraft/world/entity/player";
import { $LevelBlock } from "@package/dev/latvian/mods/kubejs/level";
import { $MinecraftServer } from "@package/net/minecraft/server";
import { $ServerLevel } from "@package/net/minecraft/server/level";
import { $Level } from "@package/net/minecraft/world/level";
import { MONEY } from "../logistica/config/economy";
import { $InteractionHand } from "@package/net/minecraft/world";

export function percentLabel(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function isCreativePlayer(player: $Player | null): boolean {
  if (!player) return false;
  return player.isCreative();
}

export function isMainHand(hand: string | $InteractionHand): boolean {
  if (typeof hand === "string") return hand === "MAIN_HAND";
  return hand.name() === "MAIN_HAND";
}

export function getPlayerStandingBlock(
  level: $ServerLevel | $Level,
  player: $Player,
): $LevelBlock | null {
  if (!level || !player) return null;

  const x = Math.floor(toPlainNumber(player.getX(), 0));
  const y = Math.floor(toPlainNumber(player.getY(), 0));
  const z = Math.floor(toPlainNumber(player.getZ(), 0));

  return level.getBlock(x, y - 1, z);
}

export function getControllerBlock(
  server: $MinecraftServer,
  entry: { dimension: string; x: number; y: number; z: number },
) {
  const level = server.getLevel(entry.dimension);
  if (!level) return null;

  return level.getBlock(entry.x, entry.y, entry.z);
}

export function getBlockDimension(block: $LevelBlock): string {
  return String(block.getDimension());
}

export function compressMoney(amount: number) {
  const result: Record<string, ItemStack> = {};
  for (const currency of MONEY) {
    while (amount >= currency.value) {
      const stack = result[currency.id];
      if (stack) {
        stack.count += 1;
      } else {
        result[currency.id] = { id: currency.id, count: 1 };
      }
      amount -= currency.value;
    }
  }

  return Object.values(result);
}

export function decompressMoney(coins: ItemStack[]) {
  let amount = 0;
  for (const coin of coins) {
    const currency = MONEY.find((c) => c.id === coin.id);
    if (currency) {
      amount += currency.value * coin.count;
    }
  }

  return amount;
}

export function isSolidCandidateBlock(block: $LevelBlock): boolean {
  if (!block) return false;

  const id = block.getId();
  if (id === "minecraft:air") return false;
  if (id === "minecraft:cave_air") return false;
  if (id === "minecraft:void_air") return false;
  if (id === "minecraft:water") return false;
  if (id === "minecraft:lava") return false;

  if (block.hasTag("minecraft:replaceable")) return false;

  const state = block.getBlockState();
  if (!state) return false;
  if (state.isAir()) return false;
  if (state.canBeReplaced()) return false;
  if (state.getFluidState().getType().getId() !== "minecraft:empty") {
    return false;
  }

  return true;
}

export function findSurfaceY(
  level: $ServerLevel,
  x: number,
  z: number,
): number | null {
  const maxY = level.getMaxBuildHeight() - 1;
  const minY = level.getMinBuildHeight();

  for (let y = maxY; y >= minY; y--) {
    const block = level.getBlock(x, y, z);
    if (!block) continue;
    if (!isSolidCandidateBlock(block)) continue;
    return y;
  }

  return null;
}

export function isInterval(tick: number, interval: number): boolean {
  return tick % interval === 0;
}

export function toCommandNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}
