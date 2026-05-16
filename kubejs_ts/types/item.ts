import type { ItemId, TagId } from ".";
import type { Recipe, RecipeTreeItem } from "./recipe";
import type { Material, MaterialForm } from "./material";
import { ItemValueOperation } from "kubejs_ts/shared/item";
import { TagValueModifiers } from "kubejs_ts/shared/config/economy";

export type JavaItem = Record<string, unknown>;

export type Item = {
  id: ItemId;
  name: string;
  value: number;
  valueChanges: ValueChanges[];
  valueModifiers: TagValueModifiers[];
  kind: "resource" | "product" | null;
  itemTags: TagId[];
  blockTags: TagId[];
  materials: Record<string, Material>;
  recipes: {
    asInput: string[];
    asOutput: string[];
  };
};

export type ValueChanges = {
  by: string;
  type: string;
  change: ItemValueOperation;
  amount: number;
};

export type ItemCostEntry = {
  value: number;
  sellPrice: number;
  buyPrice: number;
};

export type Tag = {
  id: TagId;
  name: string;
  value: number;
  items: ItemId[];
};

export type ItemRecipe = {
  ingredients: ItemStack[];
  results: ItemStack[];
  recipe: Recipe;
};

export type ItemStack = {
  id: ItemId;
  count: number;
  chance?: number;
  amount?: number;
};

export type ItemStackRecipe = Omit<ItemStack, "id"> & {
  itemRecipe: ItemRecipe;
};

export type ScoreTable = {
  item: ItemId;
  value: number;
  components: ScoreTableItemComponent[];
}[];

export type ScoreTableItemComponent = {
  type: string;
  id: string;
  value: number;
};

export type ItemMaterialInfo = {
  form: MaterialForm;
  material: string;
};

export type ItemValueInput = {
  item: RecipeTreeItem;
  source: RecipeTreeItem["valueSource"];
  baseValue: number;
  recipeIngredientValue?: number;
  recipeResultCount?: number;
  recipeResultChance?: number;
  recipesAsIngredient: number;
  recipesAsResult: number;
};
