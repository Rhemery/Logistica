import { $RecipesKubeEvent } from "@package/dev/latvian/mods/kubejs/recipe";
import { Recipe, UnknownJavaRecipe } from "kubejs_ts/types/recipe";
import { clearObject, deepSearch, tryParse } from ".";
import { DeepSearchObject, ItemId } from "kubejs_ts/types";
import { ItemStack } from "kubejs_ts/types/item";
import { tagHasItem, tagId } from "./item";

export function loadRecipes(event: $RecipesKubeEvent) {
  if (Object.keys(global.items).length == 0) {
    console.errorf(
      "[Economy] loadRecipes() depends on loadItems(), but no items found.",
    );
  }
  console.infof("[Economy] Collecting recipes...");
  clearObject(global.recipes);

  const recipes: Record<string, UnknownJavaRecipe> = {};

  const javaRecipes = {};
  event.forEachRecipe({}, (javaRecipe) => {
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

  JsonIO.write(
    "kubejs/exported/server/java_recipes.json",
    JSON.parse(JSON.stringify(javaRecipes, null, 2)),
  );
  JsonIO.write(
    "kubejs/exported/server/recipes.json",
    JSON.parse(JSON.stringify(global.recipes, null, 2)),
  );
}

export function normalizeRecipe(id: string, recipe: UnknownJavaRecipe): Recipe {
  function processRecipe(
    paths: string[],
    expect: Parameters<typeof deepSearch>[3],
    callback: (
      search: (input: DeepSearchObject, output: any[]) => void,
    ) => void,
  ) {
    paths.forEach((path) => {
      callback((input, output) => {
        deepSearch(path, input, output, expect);
      });
    });
  }

  function findRecipeResult(
    input: (ItemStack & {
      item?: string;
      tag?: string;
    })[],
    output: ItemStack[],
  ) {
    input.forEach((r) => {
      const stack: ItemStack = {
        id: r.id ?? r.item ?? r.tag,
        count: 1,
      };
      if (output.find((s) => s.id === stack.id)) return;
      if (r.count) stack.count = r.count;
      if (r.chance) stack.chance = r.chance;
      if (r.amount) stack.amount = r.amount;

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
  const resultPaths = ["result", "results[]", "sequence[].results[]"];

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
      [
        "addition.item",
        "addition.tag",
        "base.item",
        "base.tag",
        "template.item",
        "template.tag",
      ],
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

  function recipeKind(
    inputs: ItemStack[],
    outputs: ItemStack[],
  ): Recipe["kind"] {
    for (const input of inputs) {
      if (tagHasItem(tagId("#c:storage_blocks"), input.id))
        return "decompression";
    }

    for (const output of outputs) {
      if (tagHasItem(tagId("#c:storage_blocks"), output.id))
        return "compression";
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
