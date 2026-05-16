import { getItem, ItemValueOperation } from "kubejs_ts/shared/item";
import { ItemId } from "kubejs_ts/types";

ItemEvents.modifyTooltips((event) => {
  const costs = global.economyItemCosts;
  const itemIds = Object.keys(costs) as ItemId[];

  itemIds.forEach((itemId) => {
    const item = getItem(itemId);
    const entry = costs[itemId];

    if (!item) return;

    if (!Object.keys(global.items).includes(itemId)) return;

    if (entry === undefined) {
      return;
    }

    //event.(itemId as any);
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
});

/*
ItemEvents.modifyTooltips((event) => {
  const costs = global.economyItemCosts;

  if (costs === undefined) {
    console.warn(
      "[ItemCost] economyItemCosts is not ready; no price tooltips registered",
    );
    return;
  }

  const itemIds = Object.keys(costs);

  for (const itemId of itemIds) {
    const entry = costs[itemId];

    if (!Object.keys(global.items).includes(itemId)) continue;

    if (entry === undefined) {
      continue;
    }

    if (entry.value === 0) continue;

    event.add(itemId as any, [
      Text.gold(`Buy: ${entry.buyPrice}¤`),
      Text.gray(`Sell: ${entry.sellPrice}¤`),
      Text.darkGray(`Value: ${entry.value.toFixed(2)}`),
    ]);
  }
});
*/
