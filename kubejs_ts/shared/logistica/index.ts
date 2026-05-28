import { Block, Item } from "@side-only/startup/events/registry";
import { SURVEY_TOOLS } from "./config/items";

export function registerBlocks(event: Block) {
  event
    .create("market_terminal")
    .soundType("metal")
    .hardness(3.0)
    .requiresTool(true)
    .tagBlock(["logistica/market_terminal", "minable/pickaxe"])
    .texture(["up"], "kubejs:block/market_terminal/market_terminal_top")
    .texture(
      ["north", "east", "south", "west"],
      "kubejs:block/market_terminal/market_terminal_side",
    )
    .texture(["down"], "kubejs:block/market_terminal/market_terminal_bottom")
    .displayName("Market Terminal")
    .item((item) => {
      item.unstackable();
      item.rarity("rare");
    });

  event
    .create("mining_outpost_controller")
    .soundType("metal")
    .hardness(3.0)
    .requiresTool(true)
    .tagBlock(["logistica/mining_outpost_controller", "minable/pickaxe"])
    .texture(["up"], "kubejs:block/mining_outpost_controller/mining_outpost_controller_top")
    .texture(
      ["north", "east", "south", "west"],
      "kubejs:block/mining_outpost_controller/mining_outpost_controller_side",
    )
    .texture(["down"], "kubejs:block/mining_outpost_controller/mining_outpost_controller_bottom")
    .displayName("Mining Outpost Controller")
    .item((item) => {
      item.unstackable();
      item.rarity("rare");
    });

  event
    .create("village_market_controller")
    .soundType("metal")
    .hardness(3.0)
    .requiresTool(true)
    .tagBlock(["logistica/village_market_controller", "minable/pickaxe"])
    .texture(["up"], "kubejs:block/village_market_controller/village_market_controller_top")
    .texture(
      ["north", "east", "south", "west"],
      "kubejs:block/village_market_controller/village_market_controller_side",
    )
    .texture(["down"], "kubejs:block/village_market_controller/village_market_controller_bottom")
    .displayName("Village Market Controller")
    .item((item) => {
      item.unstackable();
      item.rarity("rare");
    });

  event
    .create("hub_dispatch_controller")
    .soundType("metal")
    .hardness(3.0)
    .requiresTool(true)
    .tagBlock(["logistica/hub_dispatch_controller", "minable/pickaxe"])
    .texture(["up"], "kubejs:block/hub_dispatch_controller/hub_dispatch_controller_top")
    .texture(
      ["north", "east", "south", "west"],
      "kubejs:block/hub_dispatch_controller/hub_dispatch_controller_side",
    )
    .texture(["down"], "kubejs:block/hub_dispatch_controller/hub_dispatch_controller_bottom")
    .displayName("Hub Dispatch Controller")
    .item((item) => {
      item.unstackable();
      item.rarity("rare");
    });
}

export function registerItems(event: Item) {
  SURVEY_TOOLS.forEach((item) =>
    event
      .create(item.id)
      .displayName(item.displayName)
      .maxStackSize(1)
      .tooltip(item.tooltip)
      .rarity(item.rarity)
      .texture(item.texture),
  );
}
