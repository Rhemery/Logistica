import { ItemId } from "kubejs_ts/types";
import { HubDispatchState } from "kubejs_ts/types/logistics";
import { getControllerBlock, isMainHand } from "../utils";
import { describeInventoryPresent, getRelativeInventory } from "../inventory";
import { getRuntimeState, persistRuntimeState } from "../runtime";
import { removeStation, toStationRef } from "../station";
import { toPlainNumber } from "../math";
import { countItem, itemId } from "../item";
import { $MinecraftServer } from "@package/net/minecraft/server";
import { $LevelBlock } from "@package/dev/latvian/mods/kubejs/level";
import { $InventoryKJS } from "@package/dev/latvian/mods/kubejs/core";

export const HUB_DISPATCH_BLOCK_ID = "kubejs:hub_dispatch_controller";
export const DISPATCH_TOKEN_ITEM = "minecraft:paper" as ItemId;

export const HUB_INACTIVITY_TICKS = 20 * 90;
export const HUB_REMOTE_FALLBACK_TICKS = 20 * 60;

export const HUB_DEFAULT_THRESHOLD = 128;

export const DISPATCH_TOKEN_NAME = "Logistica Dispatch Token";
export const DISPATCH_TOKEN_FLAG = "logistica_dispatch_token";
export const DISPATCH_TOKEN_SOURCE = "logistica_dispatch_source";
export const MAX_TOKENS_PER_STEP = 8;

export const HUB_DEFAULT_WATCH_ITEMS: ItemId[] = [
  "minecraft:raw_iron",
  "minecraft:raw_copper",
  "minecraft:coal",
  "create:raw_zinc",
];

export function handleHubDispatch(
  server: $MinecraftServer,
  hub: HubDispatchState,
  tick: number,
  fallbackEnabled: boolean,
): void {
  const block = getControllerBlock(server, hub);
  if (!block || block.getId() !== HUB_DISPATCH_BLOCK_ID) {
    return;
  }

  const stockInventory = getRelativeInventory(block, 0, 1, 0);
  const dispatchInventory = getRelativeInventory(block, 0, -1, 0);
  if (!dispatchInventory) return;

  let reason: "threshold" | "inactivity" | "fallback" | null = null;

  if (
    stockInventory &&
    isThresholdTriggered(stockInventory, hub.watchItems, hub.thresholdPerItem)
  ) {
    reason = "threshold";
  }

  if (!reason && tick - hub.lastDispatchTick >= hub.inactivityTicks) {
    reason = "inactivity";
  }

  if (
    !reason &&
    fallbackEnabled &&
    tick - hub.lastDispatchTick >= HUB_REMOTE_FALLBACK_TICKS
  ) {
    reason = "fallback";
  }

  if (!reason) return;

  const pendingTokens = countDispatchTokens(dispatchInventory);
  if (pendingTokens > 0) return;

  const inserted = insertDispatchToken(dispatchInventory, hub.key, reason);
  if (inserted <= 0) return;

  hub.lastDispatchTick = tick;
  hub.dispatchCount += 1;

  console.infof(
    `[Logistica] Hub dispatch token queued (${reason}) at ${hub.key}`,
  );
}

export function addOrGetHubDispatch(
  server: $MinecraftServer,
  block: $LevelBlock,
): HubDispatchState {
  const state = getRuntimeState(server);
  const ref = toStationRef(block);
  const existing = state.hubs.find((entry) => entry.key === ref.key);
  if (existing) return existing;

  const created: HubDispatchState = {
    key: ref.key,
    dimension: ref.dimension,
    x: ref.x,
    y: ref.y,
    z: ref.z,
    watchItems: HUB_DEFAULT_WATCH_ITEMS,
    thresholdPerItem: HUB_DEFAULT_THRESHOLD,
    inactivityTicks: HUB_INACTIVITY_TICKS,
    lastDispatchTick: 0,
    dispatchCount: 0,
  };

  state.hubs.push(created);
  persistRuntimeState(server);
  return created;
}

export function createDispatchTokenStack(
  amount: number,
  sourceKey: string,
  reason: string,
) {
  const stack = Item.of(DISPATCH_TOKEN_ITEM, amount);

  stack.withCustomName(Text.gold(DISPATCH_TOKEN_NAME).getString());

  stack.withLore([
    Text.gray("Place below outpost/village controller").getString(),
    Text.darkGray(`Source: ${sourceKey}`).getString(),
    Text.darkGray(`Reason: ${reason}`).getString(),
  ]);

  try {
    const customData = stack.getCustomData();
    customData.putBoolean(DISPATCH_TOKEN_FLAG, true);
    customData.putString(DISPATCH_TOKEN_SOURCE, sourceKey);
    stack.setCustomData(customData);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    // Custom data can fail on some KubeJS/loader combos; fallback is ID check.
  }

  return stack;
}

export function isDispatchTokenStack(
  stack: ReturnType<typeof Item.of>,
): boolean {
  if (!stack || stack.empty) return false;
  if (stack.id !== DISPATCH_TOKEN_ITEM) return false;

  try {
    const customData = stack.getCustomData();
    if (customData.contains(DISPATCH_TOKEN_FLAG)) {
      return customData.getBoolean(DISPATCH_TOKEN_FLAG);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    // Fallback below.
  }

  return true;
}

export function countDispatchTokens(inventory: $InventoryKJS): number {
  let total = 0;

  for (let slot = 0; slot < inventory.getSlots(); slot++) {
    const stack = inventory.getStackInSlot(slot);
    if (!isDispatchTokenStack(stack)) continue;
    total += toPlainNumber(stack.getCount(), 0);
  }

  return total;
}

export function extractDispatchTokens(
  inventory: $InventoryKJS,
  amount: number,
): number {
  if (amount <= 0) return 0;

  let remaining = amount;
  let extracted = 0;

  for (let slot = 0; slot < inventory.getSlots(); slot++) {
    if (remaining <= 0) break;

    const stack = inventory.getStackInSlot(slot);
    if (!isDispatchTokenStack(stack)) continue;

    const slotCount = toPlainNumber(stack.getCount(), 0);
    if (slotCount <= 0) continue;

    const take = Math.min(remaining, slotCount);
    stack.setCount(slotCount - take);
    inventory.setStackInSlot(slot, {
      id: itemId(stack.id),
      count: stack.getCount(),
    });

    extracted += take;
    remaining -= take;
  }

  return extracted;
}

export function insertDispatchToken(
  inventory: $InventoryKJS,
  sourceKey: string,
  reason: string,
): number {
  const token = createDispatchTokenStack(1, sourceKey, reason);
  const remaining = inventory.insertItem(
    {
      id: itemId(token.id),
      count: token.getCount(),
    },
    false,
  );
  const leftover = toPlainNumber(remaining.getCount(), 0);
  return Math.max(0, 1 - leftover);
}

export function isThresholdTriggered(
  inventory: $InventoryKJS,
  watchItems: ItemId[],
  thresholdPerItem: number,
): boolean {
  const validWatchItems = watchItems.filter((itemId) => global.items[itemId]);
  if (validWatchItems.length === 0) return false;

  return validWatchItems.some((itemId) => {
    const count = countItem(inventory, itemId);
    return count <= thresholdPerItem;
  });
}

BlockEvents.placed(HUB_DISPATCH_BLOCK_ID, (event) => {
  if (event.level.isClientSide()) return;
  addOrGetHubDispatch(event.server, event.block);
});

BlockEvents.broken(HUB_DISPATCH_BLOCK_ID, (event) => {
  if (event.level.isClientSide()) return;
  removeStation(event.server, toStationRef(event.block).key);
});

BlockEvents.rightClicked(HUB_DISPATCH_BLOCK_ID, (event) => {
  if (!isMainHand(String(event.hand))) return;
  if (event.level.isClientSide()) return;

  const hub = addOrGetHubDispatch(event.server, event.block);
  const dispatchInventory = getRelativeInventory(event.block, 0, -1, 0);
  const tokenCount = dispatchInventory
    ? countDispatchTokens(dispatchInventory)
    : 0;

  event.player.tell({
    text: `[Logistica] Hub dispatch ${hub.key}`,
    color: "gold",
  });
  event.player.tell({
    text: `Stock above: ${describeInventoryPresent(event.block, 0, 1, 0)} | dispatch buffer below: ${describeInventoryPresent(event.block, 0, -1, 0)} (${tokenCount})`,
    color: "gray",
  });
  event.player.tell({
    text: `Tokens sent lifetime: ${hub.dispatchCount} | threshold/item: ${hub.thresholdPerItem} | inactivity: ${hub.inactivityTicks}t`,
    color: "gray",
  });
  event.player.tell({
    text: `Usage: move ${DISPATCH_TOKEN_NAME} papers from this buffer to the inventory below remote mining/village controllers.`,
    color: "dark_gray",
  });
});
