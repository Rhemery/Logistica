import { ItemId, TagId } from "kubejs_ts/types/minecraft";
import { Item, ItemStack, ItemValueOperation } from "kubejs_ts/types/minecraft/item";
import {
  getItems,
  getItem,
  getItemValue,
  registerItemValueChange,
  tagHasItem,
  isTagId,
  itemExists,
  toTagId,
} from "../minecraft/item";
import { applyTagValueModifier } from "./config/economy";
import { logProgress } from "../logs";
import { clearObject } from "../object";
import { saveJson, tryLoadJson } from "../files";
import { setKubeJsLoadingStatus } from "./bridge";

export function priceItems() {
  if (
    tryLoadJson(
      "kubejs/exported/server/economy_cost_items.json",
      "EconomyItemCosts",
      global.economyItemCosts,
    )
  )
    return;
  console.infof("[Economy] Pricing items...");
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

    const tag = toTagId(`#${input.id}`);
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
    function resolveInputTag(inputId: string): TagId | null {
      if (inputId.startsWith("#")) {
        return inputId as TagId;
      }

      if (itemExists(inputId as ItemId)) {
        return null;
      }

      try {
        return toTagId(`#${inputId}`);
      } catch (e) {
        console.errorf(String(e));
        return null;
      }
    }

    function inputMatchesModifierTag(tag: TagId, inputStack: ItemStack): boolean {
      if (tagHasItem(tag, inputStack.id)) {
        return true;
      }

      const inputTag = resolveInputTag(inputStack.id);
      return inputTag === tag;
    }

    if (item.valueModifiers.length > 0) {
      item.valueModifiers.forEach((modifiers) => {
        modifiers.forEach((modifier) => {
          const inputRecipeInputModifiers = modifier.recipes?.inputs;
          if (!inputRecipeInputModifiers) return;

          Object.entries(inputRecipeInputModifiers).forEach(([tag, valueModifier]) => {
            if (tag == "all" || inputMatchesModifierTag(tag as TagId, input)) {
              const modifiedValue = applyTagValueModifier(value * input.count, valueModifier);

              registerItemValueChange(item.id, {
                by: `${input.id} + ${tag}`,
                type: "Modifier",
                change: ItemValueOperation.add,
                amount: modifiedValue,
              });
            }
          });
        });
      });
    } else {
      registerItemValueChange(item.id, {
        by: input.id,
        type: "Ingredient",
        change: ItemValueOperation.add,
        amount: value * input.count,
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
  const items = Object.values(global.items);
  items.forEach((item, index) => {
    logProgress("Pricing Items", index, items.length);
    cache[item.id] = {
      value: getItemValue(item.id),
      needsUpdate: true,
      outputs: [],
      inputs: {},
    };
  });
  for (let i = 0; i < 3; i++) {
    items.forEach((item, index) => {
      logProgress("Propagating Prices", index + items.length * i, items.length * 3);
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
          value += inputValue * input.count;
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

    const missingPricing = Object.entries(cache).filter((entry) => entry[1].value == 0);
    console.infof(`[Economy] ${missingPricing.length} items without value`);
    JsonIO.write("kubejs/exported/server/cache.json", JSON.parse(JSON.stringify(cache, null, 2)));
    JsonIO.write(
      "kubejs/exported/server/price_missing.json",
      JSON.parse(
        JSON.stringify(
          {
            items: missingPricing,
            tags: missingPricing.map(([id]) => {
              return {
                id,
                tags: global.items[id as keyof typeof global.items].itemTags,
              };
            }),
          },
          null,
          2,
        ),
      ),
    );
  }

  Object.values(global.recipes).forEach((recipe) => {
    Object.values(recipe.outputs).forEach((output) => {
      const item = getItem(output.id);
      if (!item) return;

      Object.values(recipe.inputs).forEach((input) => {
        const inputValue = resolveInputValue(input, cache);
        applyModifiers(item, input, inputValue);
      });
    });
  });

  Object.values(global.items).forEach((item) => {
    const recipeCalculations = item.valueChanges.filter((entry) => entry.type === "Recipe Input");
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

  setKubeJsLoadingStatus(false, "", 1);
  saveJson("kubejs/exported/server/economy_cost_items.json", global.economyItemCosts);
}

export function isItemId(value: string): value is ItemId {
  return /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(value);
}
