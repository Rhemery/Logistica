import { $InventoryKJS } from "dev.latvian.mods.kubejs.core.InventoryKJS";
import { compressCoins } from "kubejs_ts/shared/utils";
import { MarketEntry } from "kubejs_ts/types/logistics";
import { $ResourceKey$$Type } from "net.minecraft.resources.ResourceKey";
import { $Player } from "net.minecraft.world.entity.player.Player";
import { $ItemStack$$Type } from "net.minecraft.world.item.ItemStack";
import { $Block } from "net.minecraft.world.level.block.Block";

// Change this per block later if you create more terminals.
// For now, one terminal = mining depot.
const TERMINAL_MARKET = "mining";

function getMarketEntries() {
  const entries = global.marketEntries;

  if (!entries) {
    console.warn("[Market] global.marketEntries is missing");
    return {};
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

    const itemId = stack.id;
    const entry = marketEntries[itemId];
    if (!entry) continue;

    if (!itemAcceptedAtMarket(entry, market)) continue;

    const count = stack.count;
    const priceEach = Math.max(1, Math.floor(entry.sellPrice || 0));
    const stackValue = count * priceEach;

    if (stackValue <= 0) continue;

    total += stackValue;
    soldStacks++;

    stack.count = 0;
    inv.setStackInSlot(slot, stack as any);
  }

  if (total > 0) {
    const money = compressCoins(total);
    money.forEach((coin) => {
      player.give(
        Item.of(
          coin.id as $ItemStack$$Type,
          coin.count,
        ) as unknown as $ItemStack$$Type,
      );
    });
    player.tell(Text.green(`Sold ${soldStacks} stacks for ${total} Spurs.`));
  } else {
    player.tell(
      Text.yellow(`This depot did not accept any items in the input barrel.`),
    );
  }
}

BlockEvents.rightClicked(
  "kubejs:market_terminal" as $ResourceKey$$Type<$Block>,
  (event) => {
    if (event.hand !== ("MAIN_HAND" as any)) return;
    if (event.level.isClientSide()) return;

    const player = event.player;
    const block = event.block;

    // Barrel/chest directly above terminal.
    const inputBlock = block.offset(0, 1, 0);

    if (!inputBlock || !inputBlock.getInventory()) {
      player.tell(
        Text.red(
          "No input inventory above terminal. Put a barrel/chest above it.",
        ),
      );
      return;
    }

    trySellInventory(inputBlock.getInventory(), player, TERMINAL_MARKET);

    event.cancel();
  },
);
