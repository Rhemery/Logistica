import { $InventoryKJS } from "@package/dev/latvian/mods/kubejs/core";
import { $Player } from "@package/net/minecraft/world/entity/player";
import { itemId } from "kubejs_ts/shared/item";
import { compressCoins } from "kubejs_ts/shared/utils";
import { MarketEntry } from "kubejs_ts/types/logistics";

// Change this per block later if you create more terminals.
// For now, one terminal = mining depot.
const TERMINAL_MARKET = "mining";

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

BlockEvents.rightClicked("kubejs:market_terminal", (event) => {
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
