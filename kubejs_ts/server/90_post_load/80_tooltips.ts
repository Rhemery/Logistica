import { setKubeJsLoadingStatus } from "kubejs_ts/shared/logistica/bridge";
import { logProgress } from "kubejs_ts/shared/logs";
import { getItem } from "kubejs_ts/shared/minecraft/item";
import { ItemId } from "kubejs_ts/types/minecraft";
import { ItemValueOperation } from "kubejs_ts/types/minecraft/item";

ItemEvents.modifyTooltips((event) => {
  const costs = global.economyItemCosts;
  const itemIds = Object.keys(costs) as ItemId[];

  itemIds.forEach((itemId, index) => {
    logProgress("Adding Economy Tooltips", index, itemIds.length);
    const item = getItem(itemId);
    const entry = costs[itemId];
    if (!item || !entry) return;

    event.modify(itemId, { shift: "false" }, (tooltip) => {
      tooltip.add([
        {
          text: `Sell: ${entry.sellPrice}¤`,
          color: "gold",
        },
      ]);
    });
    event.modify(itemId, { shift: "true" }, (tooltip) => {
      tooltip.add([
        {
          text: `Sell: ${entry.sellPrice}¤`,
          color: "gold",
        },
        {
          text: `Buy: ${entry.buyPrice}¤`,
          color: "light_gray_dye",
        },
        {
          text: `Value: ${entry.value.toFixed(2)}`,
          color: "gray",
        },
      ]);
      let value = 0;
      item.valueChanges.forEach((change) => {
        let changeText = "";
        switch (change.change) {
          case ItemValueOperation.none:
            break;
          case ItemValueOperation.set:
            changeText = "=";
            value = change.amount;
            break;
          case ItemValueOperation.add:
            changeText = "+";
            value += change.amount;
            break;
          case ItemValueOperation.substract:
            changeText = "-";
            value -= change.amount;
            break;
        }
        tooltip.add([
          {
            text: `${change.type} (${change.by}): ${changeText}${change.amount.toFixed(2)} (${value.toFixed(
              2,
            )})`,
            color: "dark_gray",
          },
        ]);
      });
    });
  });

  setKubeJsLoadingStatus(false, "", 1.0);
});
