import type { ItemId } from "kubejs_ts/types/minecraft/index";
import { ItemStack } from "../minecraft/item";

export type ProductRecipe = {
  id: string;
  type: string;
  inputs: ItemStack[];
  outputs: ItemStack[];
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
