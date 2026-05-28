import { $RecipesKubeEvent } from "@package/dev/latvian/mods/kubejs/recipe";
import { DeepSearchObject, ItemId } from "kubejs_ts/types/minecraft";
import { tagHasItem, toTagId } from "./item";
import { logProgress } from "../logs";
import { Recipe, UnknownJavaRecipe } from "kubejs_ts/types/minecraft/recipe";
import { ItemStack } from "kubejs_ts/types/minecraft/item";
import { clearObject, deepSearch, tryParse } from "../object";
import { saveJson, tryLoadJson } from "../files";

export function loadRecipes(event: $RecipesKubeEvent) {
  if (tryLoadJson("kubejs/exported/server/recipes.json", "Recipes", global.recipes)) return;
  if (Object.keys(global.items).length == 0) {
    console.errorf("[Economy] loadRecipes() depends on loadItems(), but no items found.");
  }
  console.infof("[Economy] Collecting recipes...");
  clearObject(global.recipes);

  const recipes: Record<string, UnknownJavaRecipe> = {};

  const javaRecipes = {};
  let index = 0;
  const recipesCount = event.countRecipes({});
  event.forEachRecipe({}, (javaRecipe) => {
    logProgress("Recipes", index, recipesCount);
    index++;
    const id = javaRecipe.getId();
    const json = tryParse(javaRecipe.json) as UnknownJavaRecipe | null;
    if (!json) return;

    recipes[id] = json;

    const recipe = normalizeRecipe(id, json);

    Object.values(recipe.inputs).forEach((input) => {
      const itemId = input.id;
      if (!global.items[itemId]) return;

      global.items[itemId].recipes.asInput.push(id);
    });
    Object.values(recipe.outputs).forEach((output) => {
      const itemId = output.id;
      if (!global.items[itemId]) return;

      global.items[itemId].recipes.asOutput.push(id);
    });

    global.recipes[id] = recipe;

    // @ts-expect-error dddddddddd
    javaRecipes[id] = javaRecipe.json;
  });

  saveJson("kubejs/exported/server/recipes.json", global.recipes);
  saveJson("kubejs/exported/server/java_recipes.json", javaRecipes);
}

export function normalizeRecipe(id: string, recipe: UnknownJavaRecipe): Recipe {
  function processRecipe(
    paths: string[],
    expect: Parameters<typeof deepSearch>[3],
    callback: (search: (input: DeepSearchObject, output: any[]) => void) => void,
  ) {
    paths.forEach((path) => {
      callback((input, output) => {
        deepSearch(path, input, output, expect);
      });
    });
  }
  type FindRecipeResultInput = Omit<ItemStack, "id"> & {
    id?: string;
    item?: string;
    tag?: string;
  };

  function findRecipeResult(
    input: (
      | FindRecipeResultInput
      | {
          item: Omit<FindRecipeResultInput, "item">;
        }
    )[],
    output: ItemStack[],
  ) {
    function findData(stack: ItemStack, r: FindRecipeResultInput) {
      if (r.count) stack.count = r.count;
      if (r.chance) stack.chance = r.chance;
      if (r.amount) stack.amount = r.amount;
    }

    input.forEach((r) => {
      const stack: ItemStack = {
        id: "" as ItemId,
        count: 1,
      };
      if (r.item) {
        if (typeof r.item === "string") {
          stack.id = r.item as ItemId;
          findData(stack, r as FindRecipeResultInput);
        } else {
          stack.id = r.item.id as ItemId;
          findData(stack, r.item);
        }
      } else {
        const rr = r as FindRecipeResultInput;
        const id = (rr.id ?? rr.item ?? rr.tag) as ItemId | undefined;
        if (!id) return;

        stack.id = id;
        findData(stack, rr);
      }

      if (output.find((s) => s.id === stack.id)) return;

      output.push(stack);
    });
  }

  function normalizeIO(
    ingredients: string[],
    results: ItemStack[],
  ): {
    inputs: ItemStack[];
    outputs: ItemStack[];
  } {
    const inputs: ItemStack[] = [];
    ingredients.filter(Boolean).forEach((i) => {
      const input = inputs.find((input) => input.id === i);
      if (input) input.count += 1;
      else inputs.push({ id: i as ItemId, count: 1 });
    });

    const outputs: ItemStack[] = Array.from(new Set(results.filter(Boolean)));

    return { inputs, outputs };
  }

  const ingredientPaths = [
    "ingredient[].item",
    "ingredient.item",
    "ingredient.tag",
    "ingredient.base.item",
    "ingredient.base.tag",
    "ingredient.addition.item",
    "ingredient.addition.tag",
    "ingredient.template.item",
    "ingredients[].[].item",
    "ingredients[].fluid",
    "ingredients[].fluids",
    "ingredients[].item",
    "ingredients[].tag",
    "sequence[].ingredients[].[].tag",
    "sequence[].ingredients[].fluid",
    "sequence[].ingredients[].item",
    "sequence[].ingredients[].tag",
  ];
  const resultPaths = ["result", "result[]", "results[]", "sequence[].results[]"];

  const ingredientSearchResult: string[] = [];
  const resultSearchResult: ItemStack[] = [];

  processRecipe(ingredientPaths, ["string"], (search) => {
    search(recipe, ingredientSearchResult);
  });
  processRecipe(resultPaths, ["object"], (search) => {
    const result: ItemStack[] = [];
    search(recipe, result);
    findRecipeResult(result.filter(Boolean), resultSearchResult);
  });

  if (recipe.key && recipe.pattern) {
    const pattern = recipe.pattern;
    const keyMap = recipe.key;

    processRecipe(["item", "tag"], ["string"], (search) => {
      const counts: Record<string, number> = {};
      pattern.forEach((row) => {
        row.split("").forEach((key) => {
          if (key === " ") return;

          counts[key] = (counts[key] ?? 0) + 1;
        });
      });

      Object.entries(counts).forEach(([key, count]) => {
        if (!keyMap[key]) return;

        for (let i = 0; i < count; i++) {
          search(keyMap[key], ingredientSearchResult);
        }
      });
    });
  }

  if (recipe.addition && recipe.base && recipe.template) {
    processRecipe(
      ["addition.item", "addition.tag", "base.item", "base.tag", "template.item", "template.tag"],
      ["string"],
      (search) => {
        search(recipe, ingredientSearchResult);
      },
    );
  }

  const { inputs: normalizeInputs, outputs: normalizedOutputs } = normalizeIO(
    ingredientSearchResult,
    resultSearchResult,
  );
  const items = normalizeInputs.concat(normalizedOutputs).map((i) => i.id);
  const inputs = normalizeInputs.reduce<Record<ItemId, ItemStack>>(
    (map, input) => {
      map[input.id] = input;
      return map;
    },
    {} as Record<ItemId, ItemStack>,
  );
  const outputs = normalizedOutputs.reduce<Record<ItemId, ItemStack>>(
    (map, input) => {
      map[input.id] = input;
      return map;
    },
    {} as Record<ItemId, ItemStack>,
  );

  function recipeKind(inputs: ItemStack[], outputs: ItemStack[]): Recipe["kind"] {
    for (const input of inputs) {
      if (tagHasItem(toTagId("#c:storage_blocks"), input.id)) return "decompression";
    }

    for (const output of outputs) {
      if (tagHasItem(toTagId("#c:storage_blocks"), output.id)) return "compression";
    }

    return "unknown";
  }

  return {
    id: id,
    type: recipe.type,
    category: recipe.category,
    group: recipe.group,
    kind: recipeKind(normalizeInputs, normalizedOutputs),
    items: items,
    inputs: inputs,
    outputs: outputs,
  };
}
