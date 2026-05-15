import { getItem, ItemValueOperation } from "kubejs_ts/shared/item";
import { ItemId } from "kubejs_ts/types";

ItemEvents.modifyTooltips((event) => {
  const costs = global.economyItemCosts;

  if (costs === undefined) {
    console.warn(
      "[ItemCost] economyItemCosts is not ready; no price tooltips registered",
    );
    return;
  }

  const itemIds = Object.keys(costs);

  itemIds.forEach((itemId) => {
    const item = getItem(itemId as ItemId);
    const entry = costs[itemId];

    if (!item) return;

    if (!Object.keys(global.items).includes(itemId)) return;

    if (entry === undefined) {
      return;
    }

    //event.(itemId as any);
    event.modify({ item: itemId as any }, { shift: "false" }, (tooltip) => {
      tooltip.add(Text.gold(`Sell: ${entry.sellPrice}¤`));
    });
    event.modify({ item: itemId as any }, { shift: "true" }, (tooltip) => {
      tooltip.add(Text.gold(`Sell: ${entry.sellPrice}¤`));
      tooltip.add(Text.gray(`Buy: ${entry.buyPrice}¤`));
      tooltip.add(Text.darkGray(`Value: ${entry.value.toFixed(2)}`));
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
        tooltip.add(
          Text.darkGray(
            `${change.type} (${change.by}): ${changeText}${change.amount.toFixed(2)} (${value.toFixed(
              2,
            )})`,
          ),
        );
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
