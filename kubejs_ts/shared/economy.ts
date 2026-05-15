import { clearObject } from ".";

import { ItemId, TagId } from "kubejs_ts/types";
import { Item, ItemStack } from "kubejs_ts/types/item";
import {
  getItems,
  getItem,
  getItemValue,
  ItemValueOperation,
  registerItemValueChange,
  tagHasItem,
  isTagId,
  itemExists,
  tagId,
} from "./item";
import { applyTagValueModifier } from "./config/economy";

export function priceItems() {
  console.info("[Economy] Pricing items...");
  clearObject(global.economyItemCosts);

  function resolveInputValue(
    input: ItemStack,
    cache: Record<
      string,
      {
        value: number;
        needsUpdate: boolean;
        outputs: string[];
        inputs: Record<string, number>;
      }
    >,
  ): number {
    const directValue = cache[input.id]?.value;
    if (typeof directValue === "number" && directValue > 0) {
      return directValue;
    }

    if (itemExists(input.id)) {
      return cache[input.id]?.value ?? getItemValue(input.id);
    }

    const tag = tagId(`#${input.id}`);
    if (!isTagId(tag)) return 0;

    const tagItems = getItems(tag);
    if (tagItems.length === 0) return 0;

    let value = 0;
    tagItems.forEach((tagItemId) => {
      value += cache[tagItemId]?.value ?? getItemValue(tagItemId);
    });

    return value / tagItems.length;
  }

  function applyModifiers(item: Item, input: ItemStack, value: number) {
    if (item.valueModifiers.length > 0) {
      item.valueModifiers.forEach((modifier) => {
        const inputRecipeInputModifiers = modifier.recipes?.inputs;
        if (!inputRecipeInputModifiers) return;

        Object.entries(inputRecipeInputModifiers).forEach(
          ([tag, valueModifier]) => {
            if (tag == "all" || tagHasItem(tag as TagId, input.id)) {
              value = applyTagValueModifier(value * input.count, valueModifier);

              registerItemValueChange(item.id, {
                by: `${input.id} + ${tag}`,
                type: "Modifier",
                change: ItemValueOperation.add,
                amount: value,
              });
            }
          },
        );
      });
    } else {
      registerItemValueChange(item.id, {
        by: input.id,
        type: "Ingredient",
        change: ItemValueOperation.add,
        amount: value * (input.count ?? 1),
      });
    }
  }

  const cache: Record<
    string,
    {
      value: number;
      needsUpdate: boolean;
      outputs: string[];
      inputs: Record<string, number>;
    }
  > = {};
  Object.values(global.items).forEach((item) => {
    cache[item.id] = {
      value: getItemValue(item.id),
      needsUpdate: true,
      outputs: [],
      inputs: {},
    };
  });
  for (let i = 0; i < 10; i++) {
    Object.values(global.items).forEach((item) => {
      const cachedItem = cache[item.id];
      if (!cachedItem || cachedItem.value != 0) return;

      cachedItem.value = getItemValue(item.id);
      cachedItem.outputs = [];
      item.recipes.asOutput.forEach((recipeId) => {
        const recipe = global.recipes[recipeId];
        if (!recipe) return;

        cachedItem.outputs.push(recipeId);
        let value = cachedItem.value;
        Object.values(recipe.inputs).forEach((input) => {
          const inputValue = resolveInputValue(input, cache);
          cachedItem.inputs[input.id] = inputValue;
          value += inputValue * (input.count ?? 1);
        });
        if (value > 0) {
          if (cachedItem.needsUpdate || cachedItem.value == 0) {
            cachedItem.value = value;
            cachedItem.needsUpdate = false;
            cache[item.id] = cachedItem;

            registerItemValueChange(item.id, {
              by: item.id,
              type: "Propagation",
              change: ItemValueOperation.set,
              amount: value / (recipe.outputs[item.id]?.count ?? 1),
            });
          }
        }
      });
    });

    const missingPricing = Object.entries(cache).filter(
      (entry) => entry[1].value == 0,
    );
    console.info(`[Economy] ${missingPricing.length} items without value`);
    JsonIO.write(
      "kubejs/exported/server/cache.json",
      JSON.parse(JSON.stringify(cache, null, 2)) as typeof cache,
    );
    JsonIO.write(
      "kubejs/exported/server/price_missing.json",
      JSON.parse(
        JSON.stringify(
          {
            items: missingPricing,
            tags: missingPricing.map(([id]) => {
              return {
                id,
                tags: (global.items[id as keyof typeof global.items] as Item)
                  .itemTags,
              };
            }),
          },
          null,
          2,
        ),
      ) as typeof global.items,
    );
  }

  Object.values(global.recipes).forEach((recipe) => {
    Object.values(recipe.outputs).forEach((output) => {
      const item = getItem(output.id);
      if (!item) return;

      Object.values(recipe.inputs).forEach((input) => {
        applyModifiers(
          item,
          input,
          cache[item.id]?.value ?? getItemValue(item.id),
        );
      });
    });
  });

  Object.values(global.items).forEach((item) => {
    const recipeCalculations = item.valueChanges.filter(
      (entry) => entry.type === "Recipe Input",
    );
    if (recipeCalculations.length > 0) {
      let value = 0;
      recipeCalculations.forEach((entry) => {
        value += entry.amount;
      });
      value /= recipeCalculations.length;
      registerItemValueChange(item.id, {
        by: item.id,
        type: "Recipes",
        change: ItemValueOperation.add,
        amount: value,
      });

      item.valueChanges
        .filter((entry) => entry.type === "Recipe Input")
        .forEach((entry) => {
          entry.change = ItemValueOperation.none;
        });
    }

    const final_value = getItemValue(item.id);
    global.economyItemCosts[item.id] = {
      value: Math.ceil(final_value),
      sellPrice: Math.ceil(final_value * 0.225),
      buyPrice: Math.ceil(final_value * 1.755),
    };
  });

  JsonIO.write(
    "kubejs/exported/server/economy_cost_items.json",
    JSON.parse(
      JSON.stringify(global.economyItemCosts, null, 2),
    ) as typeof global.economyItemCosts,
  );
}

export function isItemId(value: string): value is ItemId {
  return /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(value);
}
