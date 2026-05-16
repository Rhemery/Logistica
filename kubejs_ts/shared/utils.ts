import { toPlainNumber } from "./math";

import { MONEY } from "./config/economy";
import { ItemStack } from "kubejs_ts/types/item";
import { $Player } from "@package/net/minecraft/world/entity/player";
import { $LevelBlock } from "@package/dev/latvian/mods/kubejs/level";
import { $MinecraftServer } from "@package/net/minecraft/server";
import { $ServerLevel } from "@package/net/minecraft/server/level";
import { $Level } from "@package/net/minecraft/world/level";

export function percentLabel(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function isCreativePlayer(player: $Player | null): boolean {
  if (!player) return false;
  return player.isCreative();
}

export function isMainHand(hand: string): boolean {
  return hand === "MAIN_HAND";
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

export function compressCoins(amount: number) {
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

export function decompressCoins(coins: ItemStack[]) {
  let amount = 0;
  for (const coin of coins) {
    const currency = MONEY.find((c) => c.id === coin.id);
    if (currency) {
      amount += currency.value * coin.count;
    }
  }

  return amount;
}
