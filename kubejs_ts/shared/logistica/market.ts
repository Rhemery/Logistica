import { ItemId, TagId } from "kubejs_ts/types/minecraft";
import { Item } from "kubejs_ts/types/minecraft/item";
import { MarketEntry } from "kubejs_ts/types/logistica/logistics";
import { tagId } from "../minecraft/item";
import { clearObject } from "../minecraft";
import { logProgress } from "../minecraft/logs";

const MINING_TAG_PARTS = [
  "ores",
  "raw_materials",
  "crushed_raw_materials",
  "dusts",
  "ingots",
  "nuggets",
  "gems",
  "storage_blocks",
];

const VILLAGE_TAG_PARTS = [
  "foods",
  "crops",
  "seeds",
  "plantable",
  "tools",
  "weapons",
  "armors",
  "armor",
  "stones",
  "bricks",
  "glass_blocks",
];

function hasTagPart(item: Item, parts: string[]): boolean {
  return item.itemTags.some((tag) => {
    const path = tag.split(":")[1] ?? "";
    return parts.some((part) => path.includes(part));
  });
}

function hasExactTag(item: Item, tag: TagId): boolean {
  return item.itemTags.includes(tag);
}

function computeMarkets(itemId: ItemId, item: Item): string[] {
  const markets = new Set<string>(["general"]);

  if (hasTagPart(item, MINING_TAG_PARTS)) {
    markets.add("mining");
  }

  if (
    hasTagPart(item, VILLAGE_TAG_PARTS) ||
    hasExactTag(item, tagId("#minecraft:villager_plantable_seeds"))
  ) {
    markets.add("village");
  }

  if (
    itemId.startsWith("numismatics:") ||
    itemId.startsWith("kubejs:") ||
    itemId.includes("spawn_egg")
  ) {
    return ["general"];
  }

  return Array.from(markets);
}

export function buildMarketEntries(): Record<ItemId, MarketEntry> {
  if (Object.keys(global.economyItemCosts).length == 0) {
    console.errorf(
      "[Economy] buildMarketEntries() depends on loadItems(), but no items found.",
    );
  }
  console.infof("[Economy] Building market...");
  clearObject(global.marketEntries);

  Object.entries(global.economyItemCosts).forEach(
    ([rawItemId, cost], index) => {
      logProgress(
        "ItemPrices",
        index,
        Object.keys(global.economyItemCosts).length,
      );
      const itemId = rawItemId as ItemId;
      const item = global.items[itemId];
      if (!item || !cost) return;

      const sellPrice = Math.max(
        1,
        Math.floor(cost.sellPrice || cost.value || 0),
      );
      const buyPrice = Math.max(
        sellPrice,
        Math.ceil(cost.buyPrice || sellPrice),
      );

      global.marketEntries[itemId] = {
        sellPrice,
        buyPrice,
        markets: computeMarkets(itemId, item),
      };
    },
  );

  JsonIO.write(
    "kubejs/exported/server/market_entries.json",
    JSON.parse(JSON.stringify(global.marketEntries, null, 2)),
  );

  return global.marketEntries;
}
