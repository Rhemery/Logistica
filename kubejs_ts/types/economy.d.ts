import type { ItemId } from "kubejs_ts/types";
import type { IngredientCostPart, RecipeOutputPart } from "./recipe";

export type ProductRecipe = {
  id: string;
  type: string;
  inputs: IngredientCostPart[];
  outputs: RecipeOutputPart[];
};

export type ItemValueEntry = {
  itemId: ItemId;
  value: number;
  source: "base" | "recipe";
  recipeId: string | null;
  recipeType: string | null;
  generation: number;
};

export type MissingBaseCandidate = {
  itemId: ItemId;
  reason: "no_recipe" | "needed_by_recipe" | "unresolved_output";
  neededByRecipeIds: string[];
  producedByRecipeIds: string[];
};

export type PropagationResult = {
  values: Map<ItemId, ItemValueEntry>;
  unresolvedRecipes: ProductRecipe[];
  missingBaseCandidates: MissingBaseCandidate[];
};

export type PropagationConfig = {
  craftingTax: number;
  maxPasses: number;
  preferCheapestRecipe: boolean;
};
