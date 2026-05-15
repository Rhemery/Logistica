import type { ItemMaterialInfo, ItemStack } from "./item";

export type ResourceLocation = `${string}:${string}`;
export type ItemId = ResourceLocation;
export type TagId = ResourceLocation | `#${ResourceLocation}`;
export type BlockId = ResourceLocation;
export type FluidId = ResourceLocation;
export type EntityId = ResourceLocation;
export type RecipeTypeId = ResourceLocation;
export type ModId = string;
export type UnknownRecipeType = string & {};

export type RecipeType =
  | "create:compacting"
  | "create:crushing"
  | "create:cutting"
  | "create:deploying"
  | "create:emptying"
  | "create:filling"
  | "create:haunting"
  | "create:item_application"
  | "create:item_copying"
  | "create:mechanical_crafting"
  | "create:milling"
  | "create:mixing"
  | "create:pressing"
  | "create:sandpaper_polishing"
  | "create:sequenced_assembly"
  | "create:splashing"
  | "create:toolbox_dyeing"
  | "minecraft:blasting"
  | "minecraft:campfire_cooking"
  | "minecraft:crafting_decorated_pot"
  | "minecraft:crafting_shaped"
  | "minecraft:crafting_shapeless"
  | "minecraft:crafting_special_armordye"
  | "minecraft:crafting_special_bannerduplicate"
  | "minecraft:crafting_special_bookcloning"
  | "minecraft:crafting_special_firework_rocket"
  | "minecraft:crafting_special_firework_star"
  | "minecraft:crafting_special_firework_star_fade"
  | "minecraft:crafting_special_mapcloning"
  | "minecraft:crafting_special_mapextending"
  | "minecraft:crafting_special_repairitem"
  | "minecraft:crafting_special_shielddecoration"
  | "minecraft:crafting_special_shulkerboxcoloring"
  | "minecraft:crafting_special_suspiciousstew"
  | "minecraft:crafting_special_tippedarrow"
  | "minecraft:smelting"
  | "minecraft:smithing_transform"
  | "minecraft:smithing_trim"
  | "minecraft:smoking"
  | "minecraft:stonecutting";

export type CombinedJavaRecipe = {
  accept_mirrored?: boolean;
  addition?: {
    item?: ItemId;
    tag?: TagId;
  };
  base?: {
    item?: ItemId;
    tag?: TagId;
  };
  category?: "misc" | "building" | "blocks" | "food" | "redstone" | "equipment";
  cookingtime?: number;
  experience?: number;
  group?: string;
  heat_requirement?: "superheated" | "heated";
  ingredient?:
    | {
        item: ItemId;
      }[]
    | {
        item?: ItemId;
        tag?: TagId;
      };
  ingredients?: (
    | {
        item: ItemId;
      }[]
    | {
        amount?: number;
        base?: {
          tag: TagId;
        };
        components?: {
          "create:potion_fluid_bottle_type": "regular";
          "minecraft:potion_contents": {
            potion: ResourceLocation;
          };
        };
        fluid?: FluidId;
        fluids?: FluidId;
        item?: ItemId;
        subtracted?: {
          tag: TagId;
        };
        tag?: TagId;
        type?: RecipeTypeId;
      }
  )[];
  keep_held_item?: boolean;
  key?: {
    [key: string]:
      | {
          item: ItemId;
        }[]
      | {
          base?: {
            tag: TagId;
          };
          item?: ItemId;
          subtracted?: {
            tag: TagId;
          };
          tag?: TagId;
          type?: RecipeTypeId;
        };
  };
  loops?: number;
  "neoforge:conditions"?: {
    type: RecipeTypeId;
    value: {
      modid: ModId;
      type: RecipeTypeId;
    };
  }[];
  pattern?: string[];
  processing_time?: number;
  result?: {
    count?: number;
    id: ItemId;
  };
  results?: {
    amount?: number;
    count?: number;
    chance?: number;
    id: ItemId;
  }[];
  sequence?: {
    ingredients: (
      | {
          tag: TagId;
        }[]
      | {
          amount?: number;
          fluid?: FluidId;
          item?: ItemId;
          tag?: TagId;
          type?: RecipeTypeId;
        }
    )[];
    results: {
      id: ItemId;
    }[];
    type: RecipeTypeId;
  }[];
  show_notification?: boolean;
  template?: {
    item: ItemId;
  };
  transitional_item?: {
    id: ItemId;
  };
  type: RecipeType;
};

export type UnknownJavaRecipe = Omit<CombinedJavaRecipe, "type"> & {
  type: UnknownRecipeType;
};

export type KnownJavaRecipe =
  | CreateCompactingRecipe
  | CreateCrushingRecipe
  | CreateCuttingRecipe
  | CreateDeployingRecipe
  | CreateEmptyingRecipe
  | CreateFillingRecipe
  | CreateHauntingRecipe
  | CreateItemApplicationRecipe
  | CreateItemCopyingRecipe
  | CreateMechanicalCraftingRecipe
  | CreateMillingRecipe
  | CreateMixingRecipe
  | CreatePressingRecipe
  | CreateSandpaperPolishingRecipe
  | CreateSequencedAssemblyRecipe
  | CreateSplashingRecipe
  | CreateToolboxDyeingRecipe
  | MinecraftBlastingRecipe
  | MinecraftCampfireCookingRecipe
  | MinecraftCraftingDecoratedPotRecipe
  | MinecraftCraftingShapedRecipe
  | MinecraftCraftingShapelessRecipe
  | MinecraftCraftingSpecialArmordyeRecipe
  | MinecraftCraftingSpecialBannerduplicateRecipe
  | MinecraftCraftingSpecialBookcloningRecipe
  | MinecraftCraftingSpecialFireworkRocketRecipe
  | MinecraftCraftingSpecialFireworkStarRecipe
  | MinecraftCraftingSpecialFireworkStarFadeRecipe
  | MinecraftCraftingSpecialMapcloningRecipe
  | MinecraftCraftingSpecialMapextendingRecipe
  | MinecraftCraftingSpecialRepairitemRecipe
  | MinecraftCraftingSpecialShielddecorationRecipe
  | MinecraftCraftingSpecialShulkerboxcoloringRecipe
  | MinecraftCraftingSpecialSuspiciousstewRecipe
  | MinecraftCraftingSpecialTippedarrowRecipe
  | MinecraftSmeltingRecipe
  | MinecraftSmithingTransformRecipe
  | MinecraftSmithingTrimRecipe
  | MinecraftSmokingRecipe
  | MinecraftStonecuttingRecipe;

export type JavaRecipe = KnownJavaRecipe | UnknownJavaRecipe;

export type CreateCompactingRecipe = {
  ingredients: {
    amount?: number;
    fluid?: FluidId;
    item?: ItemId;
    tag?: TagId;
    type?: RecipeTypeId;
  }[];
  results: {
    id: ItemId;
  }[];
  type: "create:compacting";
};

export type CreateCrushingRecipe = {
  ingredients: {
    item?: ItemId;
    tag?: TagId;
  }[];
  "neoforge:conditions"?: {
    type: RecipeTypeId;
    value: {
      modid: ModId;
      type: RecipeTypeId;
    };
  }[];
  processing_time: number;
  results: {
    count?: number;
    chance?: number;
    id: ItemId;
  }[];
  type: "create:crushing";
};

export type CreateCuttingRecipe = {
  ingredients: {
    item: ItemId;
  }[];
  processing_time: number;
  results: {
    count?: number;
    id: ItemId;
  }[];
  type: "create:cutting";
};

export type CreateDeployingRecipe = {
  ingredients: {
    item?: ItemId;
    tag?: TagId;
  }[];
  keep_held_item?: boolean;
  results: {
    id: ItemId;
  }[];
  type: "create:deploying";
};

export type CreateEmptyingRecipe = {
  ingredients: {
    item: ItemId;
  }[];
  results: {
    amount?: number;
    id: ItemId;
  }[];
  type: "create:emptying";
};

export type CreateFillingRecipe = {
  ingredients: {
    amount?: number;
    components?: {
      "create:potion_fluid_bottle_type": "regular";
      "minecraft:potion_contents": {
        potion: ResourceLocation;
      };
    };
    fluid?: FluidId;
    fluids?: FluidId;
    item?: ItemId;
    tag?: TagId;
    type?: RecipeTypeId;
  }[];
  results: {
    id: ItemId;
  }[];
  type: "create:filling";
};

export type CreateHauntingRecipe = {
  ingredients: {
    item?: ItemId;
    tag?: TagId;
  }[];
  results: {
    chance?: number;
    id: ItemId;
  }[];
  type: "create:haunting";
};

export type CreateItemApplicationRecipe = {
  ingredients: {
    item?: ItemId;
    tag?: TagId;
  }[];
  results: {
    id: ItemId;
  }[];
  type: "create:item_application";
};

export type CreateItemCopyingRecipe = {
  category: "misc";
  type: "create:item_copying";
};

export type CreateMechanicalCraftingRecipe = {
  accept_mirrored: boolean;
  category: "misc";
  key: {
    [key: string]: {
      item?: ItemId;
      tag?: TagId;
    };
  };
  pattern: string[];
  result: {
    count: number;
    id: ItemId;
  };
  show_notification?: boolean;
  type: "create:mechanical_crafting";
};

export type CreateMillingRecipe = {
  ingredients: {
    item?: ItemId;
    tag?: TagId;
  }[];
  processing_time: number;
  results: {
    count?: number;
    chance?: number;
    id: ItemId;
  }[];
  type: "create:milling";
};

export type CreateMixingRecipe = {
  heat_requirement?: "superheated" | "heated";
  ingredients: {
    amount?: number;
    fluid?: FluidId;
    item?: ItemId;
    tag?: TagId;
    type?: RecipeTypeId;
  }[];
  results: {
    amount?: number;
    count?: number;
    id: ItemId;
  }[];
  type: "create:mixing";
};

export type CreatePressingRecipe = {
  ingredients: (
    | {
        item: ItemId;
      }[]
    | {
        item?: ItemId;
        tag?: TagId;
      }
  )[];
  "neoforge:conditions"?: {
    type: RecipeTypeId;
    value: {
      modid: ModId;
      type: RecipeTypeId;
    };
  }[];
  results: {
    id: ItemId;
  }[];
  type: "create:pressing";
};

export type CreateSandpaperPolishingRecipe = {
  ingredients: {
    item: ItemId;
  }[];
  results: {
    id: ItemId;
  }[];
  type: "create:sandpaper_polishing";
};

export type CreateSequencedAssemblyRecipe = {
  ingredient: {
    tag: TagId;
  };
  loops?: number;
  results: {
    chance?: number;
    id: ItemId;
  }[];
  sequence: {
    ingredients: (
      | {
          tag: TagId;
        }[]
      | {
          amount?: number;
          fluid?: FluidId;
          item?: ItemId;
          tag?: TagId;
          type?: RecipeTypeId;
        }
    )[];
    results: {
      id: ItemId;
    }[];
    type: RecipeTypeId;
  }[];
  transitional_item: {
    id: ItemId;
  };
  type: "create:sequenced_assembly";
};

export type CreateSplashingRecipe = {
  ingredients: {
    item?: ItemId;
    tag?: TagId;
  }[];
  results: {
    count?: number;
    chance?: number;
    id: ItemId;
  }[];
  type: "create:splashing";
};

export type CreateToolboxDyeingRecipe = {
  category: "misc";
  type: "create:toolbox_dyeing";
};

export type MinecraftBlastingRecipe = {
  category: "misc" | "blocks";
  cookingtime: number;
  experience: number;
  group?:
    | "coal"
    | "redstone"
    | "lapis_lazuli"
    | "diamond"
    | "iron_ingot"
    | "emerald"
    | "gold_ingot"
    | "copper_ingot";
  ingredient:
    | {
        item: ItemId;
      }[]
    | {
        item?: ItemId;
        tag?: TagId;
      };
  result: {
    count?: number;
    id: ItemId;
  };
  type: "minecraft:blasting";
};

export type MinecraftCampfireCookingRecipe = {
  category: "food";
  cookingtime: number;
  experience: number;
  ingredient: {
    item: ItemId;
  };
  result: {
    count?: number;
    id: ItemId;
  };
  type: "minecraft:campfire_cooking";
};

export type MinecraftCraftingDecoratedPotRecipe = {
  category: "misc";
  type: "minecraft:crafting_decorated_pot";
};

export type MinecraftCraftingShapedRecipe = {
  category: "building" | "misc" | "redstone" | "equipment";
  group?: string;
  key: {
    [key: string]:
      | {
          item: ItemId;
        }[]
      | {
          base?: {
            tag: TagId;
          };
          item?: ItemId;
          subtracted?: {
            tag: TagId;
          };
          tag?: TagId;
          type?: RecipeTypeId;
        };
  };
  pattern: string[];
  result: {
    count: number;
    id: ItemId;
  };
  show_notification?: boolean;
  type: "minecraft:crafting_shaped";
};

export type MinecraftCraftingShapelessRecipe = {
  category: "misc" | "building" | "redstone" | "equipment";
  group?: string;
  ingredients: (
    | {
        item: ItemId;
      }[]
    | {
        base?: {
          tag: TagId;
        };
        item?: ItemId;
        subtracted?: {
          tag: TagId;
        };
        tag?: TagId;
        type?: RecipeTypeId;
      }
  )[];
  result: {
    count: number;
    id: ItemId;
  };
  type: "minecraft:crafting_shapeless";
};

export type MinecraftCraftingSpecialArmordyeRecipe = {
  category: "misc";
  type: "minecraft:crafting_special_armordye";
};

export type MinecraftCraftingSpecialBannerduplicateRecipe = {
  category: "misc";
  type: "minecraft:crafting_special_bannerduplicate";
};

export type MinecraftCraftingSpecialBookcloningRecipe = {
  category: "misc";
  type: "minecraft:crafting_special_bookcloning";
};

export type MinecraftCraftingSpecialFireworkRocketRecipe = {
  category: "misc";
  type: "minecraft:crafting_special_firework_rocket";
};

export type MinecraftCraftingSpecialFireworkStarRecipe = {
  category: "misc";
  type: "minecraft:crafting_special_firework_star";
};

export type MinecraftCraftingSpecialFireworkStarFadeRecipe = {
  category: "misc";
  type: "minecraft:crafting_special_firework_star_fade";
};

export type MinecraftCraftingSpecialMapcloningRecipe = {
  category: "misc";
  type: "minecraft:crafting_special_mapcloning";
};

export type MinecraftCraftingSpecialMapextendingRecipe = {
  category: "misc";
  type: "minecraft:crafting_special_mapextending";
};

export type MinecraftCraftingSpecialRepairitemRecipe = {
  category: "misc";
  type: "minecraft:crafting_special_repairitem";
};

export type MinecraftCraftingSpecialShielddecorationRecipe = {
  category: "misc";
  type: "minecraft:crafting_special_shielddecoration";
};

export type MinecraftCraftingSpecialShulkerboxcoloringRecipe = {
  category: "misc";
  type: "minecraft:crafting_special_shulkerboxcoloring";
};

export type MinecraftCraftingSpecialSuspiciousstewRecipe = {
  category: "misc";
  type: "minecraft:crafting_special_suspiciousstew";
};

export type MinecraftCraftingSpecialTippedarrowRecipe = {
  category: "misc";
  type: "minecraft:crafting_special_tippedarrow";
};

export type MinecraftSmeltingRecipe = {
  category: "blocks" | "misc" | "food";
  cookingtime: number;
  experience: number;
  group?:
    | "lapis_lazuli"
    | "redstone"
    | "gold_ingot"
    | "iron_ingot"
    | "diamond"
    | "emerald"
    | "coal"
    | "copper_ingot";
  ingredient:
    | {
        item: ItemId;
      }[]
    | {
        item?: ItemId;
        tag?: TagId;
      };
  result: {
    count?: number;
    id: ItemId;
  };
  type: "minecraft:smelting";
};

export type MinecraftSmithingTransformRecipe = {
  addition: {
    item?: ItemId;
    tag?: TagId;
  };
  base: {
    item: ItemId;
  };
  result: {
    count: number;
    id: ItemId;
  };
  template: {
    item: ItemId;
  };
  type: "minecraft:smithing_transform";
};

export type MinecraftSmithingTrimRecipe = {
  addition: {
    tag: TagId;
  };
  base: {
    tag: TagId;
  };
  template: {
    item: ItemId;
  };
  type: "minecraft:smithing_trim";
};

export type MinecraftSmokingRecipe = {
  category: "food";
  cookingtime: number;
  experience: number;
  ingredient: {
    item: ItemId;
  };
  result: {
    count?: number;
    id: ItemId;
  };
  type: "minecraft:smoking";
};

export type MinecraftStonecuttingRecipe = {
  ingredient: {
    item?: ItemId;
    tag?: TagId;
  };
  result: {
    count: number;
    id: ItemId;
  };
  type: "minecraft:stonecutting";
};

export type RecipeRecord = {
  id: string;
  type: string;
  json: Recipe;
};

export type Recipe = {
  id: string;
  type: string;
  kind:
    | "unknown"
    | "compression"
    | "decompression"
    | "processing"
    | "manufacturing"
    | "coloring";
  category?: string | undefined;
  group?: string | undefined;
  items: ItemId[];
  inputs: Record<ItemId, ItemStack>;
  outputs: Record<ItemId, ItemStack>;
};

export type RecipeTree = {
  items: RecipeTreeItem[];
  recipes: typeof global.recipes;
  roots: number[];
  passes: number;
};

export type RecipeTreeItem = {
  id: ItemId;
  value: number;
  baseValue: number;
  valueSource: "base" | "recipe" | "fallback" | "excluded" | "unknown";
  valueRecipe: number | null;
  valueTree: RecipeValueTree | null;
  valueCalculations: ValueCalculation[];
  recipesAsIngredient: number[];
  recipesAsResult: number[];
};

export type RecipeValueTree = {
  item: number;
  id: ItemId;
  value: number;
  source: RecipeTreeItem["valueSource"];
  recipe: number | null;
  recipeId: string | null;
  valueMode: RecipeValueMode | null;
  inputValue: number;
  outputCount: number;
  outputChance: number;
  ingredients: RecipeValueIngredient[];
};

export type RecipeValueIngredient = {
  item: number;
  id: ItemId;
  value: number;
  source: RecipeTreeItem["valueSource"];
  count: number;
  contribution: number;
};

export type RecipeTreeStack = {
  items: number[];
  count: number;
  chance: number;
};

export type RecipeGraphRecipeEntry = {
  id: string;
  recipe: Recipe;
  ingredients: RecipeTreeStack[];
  results: RecipeTreeStack[];
};

export type RecipeValueMode = "production" | "compact" | "fraction";

export type RecipeIngredientSelection = {
  itemIndex: number;
  value: number;
  count: number;
  info: ItemMaterialInfo | null;
};
