import { $InventoryKJS } from "@package/dev/latvian/mods/kubejs/core";
import { $LevelBlock } from "@package/dev/latvian/mods/kubejs/level";
import { $MinecraftServer } from "@package/net/minecraft/server";
import { $Player } from "@package/net/minecraft/world/entity/player";
import {
  removeStation,
  toStationRef,
} from "kubejs_ts/shared/logistica/station";
import {
  MarketEntry,
  MarketTerminalState,
} from "kubejs_ts/types/logistica/logistics";
import { OUTPOST_PLACE_RULES } from "../logistica/config/outposts";
import { itemId } from "../minecraft/item";
import { compressCoins } from "../minecraft/utils";
import { getOutpostOwner, isOutpostPlaceable, OutpostOwner } from "./outpost";
import { getRuntimeState, persistRuntimeState } from "../minecraft/runtime";

// Change this per block later if you create more terminals.
// For now, one terminal = mining depot.
export const TERMINAL_MARKET = "mining";
export const MARKET_TERMINAL_BLOCK_ID = "kubejs:market_terminal" as const;

function getMarketEntries() {
  const entries = global.marketEntries;

  if (!entries) {
    console.warnf("[Market] global.marketEntries is missing");
    return {} as typeof entries;
  }

  return entries;
}

function itemAcceptedAtMarket(entry: MarketEntry, market: string) {
  if (!entry || !Array.isArray(entry.markets)) return false;
  return entry.markets.includes(market) || entry.markets.includes("general");
}

function trySellInventory(inv: $InventoryKJS, player: $Player, market: string) {
  const marketEntries = getMarketEntries();

  let total = 0;
  let soldStacks = 0;

  const slots = inv.getSlots();

  for (let slot = 0; slot < slots; slot++) {
    const stack = inv.getStackInSlot(slot);

    if (!stack || stack.empty) continue;

    const id = itemId(stack.id);
    const entry = marketEntries[id];
    if (!entry) continue;

    if (!itemAcceptedAtMarket(entry, market)) continue;

    const count = stack.getCount();
    const priceEach = Math.max(1, Math.floor(entry.sellPrice || 0));
    const stackValue = count * priceEach;

    if (stackValue <= 0) continue;

    total += stackValue;
    soldStacks++;

    stack.setCount(0);
    inv.setStackInSlot(slot, stack as any);
  }

  if (total > 0) {
    const money = compressCoins(total);
    money.forEach((coin) => {
      player.give({
        id: coin.id,
        count: coin.count,
      });
    });
    player.tell({
      text: `Sold ${soldStacks} stacks for ${total} Spurs.`,
      color: "green",
    });
  } else {
    player.tell({
      text: `This depot did not accept any items in the input barrel.`,
      color: "yellow",
    });
  }
}

export function addOrGetMarketTerminal(
  server: $MinecraftServer,
  block: $LevelBlock,
  owner: OutpostOwner,
): MarketTerminalState {
  const state = getRuntimeState();
  const ref = toStationRef(block);
  const existing = state.marketTerminals.find((entry) => entry.key === ref.key);
  if (existing) return existing;

  const created: MarketTerminalState = {
    key: ref.key,
    dimension: ref.dimension,
    x: ref.x,
    y: ref.y,
    z: ref.z,
    ownerId: owner.id,
    ownerName: owner.name,
  };

  state.marketTerminals.push(created);
  persistRuntimeState(server);
  return created;
}

BlockEvents.placed(MARKET_TERMINAL_BLOCK_ID, (event) => {
  if (event.level.isClientSide()) return;

  const owner = getOutpostOwner(event.player);
  if (!owner) {
    event.cancel();
    event.player?.tell({
      text: "Market Terminal placement requires a player owner.",
      color: "red",
    });
    return;
  }

  const state = getRuntimeState();
  const result = isOutpostPlaceable(
    {
      event,
      state,
      block: event.block,
      blockId: MARKET_TERMINAL_BLOCK_ID,
      owner,
    },
    OUTPOST_PLACE_RULES[MARKET_TERMINAL_BLOCK_ID],
  );

  if (!result.placeable) {
    event.cancel();
    event.player.tell({
      text: result.failedRule.message,
      color: "red",
    });
    return;
  }

  addOrGetMarketTerminal(event.server, event.block, owner);
});

BlockEvents.broken(MARKET_TERMINAL_BLOCK_ID, (event) => {
  if (event.level.isClientSide()) return;
  removeStation(event.server, toStationRef(event.block).key);
});

BlockEvents.rightClicked(MARKET_TERMINAL_BLOCK_ID, (event) => {
  if (event.hand !== ("MAIN_HAND" as any)) return;
  if (event.level.isClientSide()) return;

  const player = event.player;
  const block = event.block;

  // Barrel/chest directly above terminal.
  const inputBlock = block.offset(0, 1, 0);

  if (!inputBlock || !inputBlock.getInventory()) {
    player.tell({
      text: "No input inventory above terminal. Put a barrel/chest above it.",
      color: "red",
    });
    return;
  }

  trySellInventory(inputBlock.getInventory(), player, TERMINAL_MARKET);

  event.cancel();
});
