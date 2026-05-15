// When using normal smelting, the result is small yield.
/*
import { snakeCase } from "change-case";
import { $RecipesKubeEvent } from "dev.latvian.mods.kubejs.recipe.RecipesKubeEvent";
import {
  getPreferredItem,
  ITEM_GROUP_NAMESPACE,
  unique,
} from "kubejs_ts/shared";
import {
  INFER_RESOURCE_KEYWORDS,
  RESOURCE_GROUPS,
} from "kubejs_ts/shared/config";
import { Material } from "kubejs_ts/types/material";
import { ItemId, Recipe } from "kubejs_ts/types/recipe";

const InputForms = ["ores", "raw_materials", "crushed_raw_materials", "dusts"];

function addRecipe(recipe: Recipe) {
  const idBase = `kubejs:${recipe.form}_${recipe.material}_${snakeCase(recipe.input)}_to_${snakeCase(recipe.output)}`;

  if (recipeIds.has(idBase)) return;
  recipeIds.add(idBase);

  const result = {
    input: recipe.input,
    output: recipe.output,
    xp: recipe.xp,
    cook: recipe.cook,
    blast: recipe.blast,
  } as Recipe;
  result.idBase = idBase;

  recipesToAdd.push(result);
}

ServerEvents.recipes((event) => {
  const inputTagsToRemove = new Set<string>();
  const recipesToAdd: Recipe[] = [];
  const recipeIds = new Set<string>();
  const skipped = new Set<string>();

  global.materials.forEach((material) => {
    const xp = processXp(material);
    const cook = smeltingTime(material);
    const blast = blastingTime(material);

    // Remove by tag, so all variants including deepslate are removed.
    InputForms.forEach((form) => {
      const group = `${form}/${material}`;

      ITEM_GROUP_NAMESPACE.forEach((namespace) => {
        const namespacedTag = `${namespace}:${group}`;

        if (getIngredientItems(`#${namespacedTag}`).length > 0) {
          inputTagsToRemove.add(`#${namespacedTag}`);
        }
      });
    });

    ITEM_GROUP_NAMESPACE.forEach((namespace) => {
      const storageTag = `${namespace}:storage_blocks/raw_${material}`;

      if (getIngredientItems(`#${storageTag}`).length > 0) {
        inputTagsToRemove.add(`#${storageTag}`);
      }
    });

    // Add per concrete input item, not only preferred item.
    InputForms.forEach((form) => {
      const inputTag = `${form}/${material}`;
      const outputTag = `${getSmallestPossibleOutput(material)}/${material}`;

      if (!hasItems(itemGroup(inputTag))) {
        skipped.add(inputTag);
        return;
      }

      if (!hasItems(itemGroup(outputTag))) {
        skipped.add(outputTag);
        return;
      }

      const output = getPreferredItem(itemGroup(outputTag));

      if (!output || !isItem(output)) {
        skipped.add(outputTag);
        return;
      }

      getItems(itemGroup(inputTag)).forEach((input) => {
        if (!isItem(input)) return;

        const result = {} as Recipe;
        result.input = input;
        result.output = output;
        result.form = form;
        result.xp = xp;
        result.cook = cook;
        result.blast = blast;
        result.material = material;

        addRecipe(result);
      });
    });

    // Raw storage block -> ingot, also per concrete storage block item.
    const storageInputTag = `storage_blocks/raw_${material}`;
    const output = getPreferredItem(itemGroup(`ingots/${material}`));

    if (hasItems(itemGroup(storageInputTag)) && output && isItem(output)) {
      getItems(itemGroup(storageInputTag)).forEach((input) => {
        if (!isItem(input)) return;

        const result = {} as Recipe;
        result.input = input;
        result.output = output;
        result.form = "storage_blocks_raw";
        result.xp = xp;
        result.cook = cook;
        result.blast = blast;
        result.material = material;

        addRecipe(result);
      });
    }
  });

  console.info(
    `[WorsenSmelting] Removing (${inputTagsToRemove.size}) ${Array.from(inputTagsToRemove).join(", ")}`,
  );

  inputTagsToRemove.forEach((_input) => {
    event.remove(
      targetEvent({
        type: "minecraft:smelting",
        ingredient: itemOrTagIngredient(_input),
      }),
    );

    event.remove(
      targetEvent({
        type: "minecraft:blasting",
        ingredient: itemOrTagIngredient(_input),
      }),
    );
  });

  console.info(
    `[WorsenSmelting] Adding (${recipesToAdd.length}) ${recipesToAdd
      .map((r) => `${r.input} -> ${r.output}`)
      .join(", ")}`,
  );

  recipesToAdd.forEach((recipe) => {
    event
      .custom(
        defineRecipe({
          type: "minecraft:smelting",
          cookingtime: recipe.cook,
          experience: recipe.xp,
          ingredient: itemOrTagIngredient(recipe.input),
          result: {
            id: recipe.output,
          },
        }),
      )
      .id(`${recipe.idBase}_smelting`);

    event
      .custom(
        defineRecipe({
          type: "minecraft:blasting",
          cookingtime: recipe.blast,
          experience: recipe.xp,
          ingredient: itemOrTagIngredient(recipe.input),
          result: {
            id: recipe.output,
          },
        }),
      )
      .id(`${recipe.idBase}_blasting`);
  });

  console.info(
    `[WorsenSmelting] Skipped (${skipped.size}) ${Array.from(skipped).join(", ")}`,
  );
});
*/
