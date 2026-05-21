import { ItemId } from "kubejs_ts/types/minecraft/index";
import { PropagationConfig } from "kubejs_ts/types/logistica/economy";

export type TagValues = Record<
  string,
  {
    base: number;
    modifiers?: TagValueModifiers[];
  }
>;
export type TagValueModifiers = {
  recipes?: {
    inputs?:
      | {
          all?: TagValueModifier;
        }
      | Record<string, TagValueModifier>;
    types?: {
      [key: string]: TagValueModifier;
    };
  };
};
export type TagValueModifier = {
  type: TagValueModifierType;
  value: number;
};
export enum TagValueModifierType {
  none,
  add,
  multiply,
  divide,
}

export function applyTagValueModifier(
  value: number,
  modifier: TagValueModifier | undefined,
): number {
  if (!modifier) return value;

  switch (modifier.type) {
    case TagValueModifierType.none:
      return value;
    case TagValueModifierType.add:
      return value + modifier.value;
    case TagValueModifierType.multiply:
      return value * modifier.value;
    case TagValueModifierType.divide:
      return value / modifier.value;
  }
}

export const MONEY: { id: ItemId; value: number }[] = [
  {
    id: "numismatics:sun",
    value: 4096,
  },
  {
    id: "numismatics:crown",
    value: 512,
  },
  {
    id: "numismatics:cog",
    value: 64,
  },
  {
    id: "numismatics:sprocket",
    value: 16,
  },
  {
    id: "numismatics:bevel",
    value: 8,
  },
  {
    id: "numismatics:spur",
    value: 1,
  },
];

export const DEFAULT_PROPAGATION_CONFIG: PropagationConfig = {
  craftingTax: 1.08,
  maxPasses: 128,
  preferCheapestRecipe: true,
};

export const RECIPE_KIND_MODIFIERS: Record<string, number> = {
  compression: 0,
  decompression: 0,
  recolor: 0.1,
  decoration: 0.15,
  processing: 1,
  manufacturing: 1,
} as const;

export const FORM_BASE_VALUES = {
  "#c:ores": 10,
  "#c:raw_materials": 12,
  "#c:dusts": 15,
  "#c:nuggets": 40,
  "#c:ingots": 80,
  "#c:gems": 100,
  "#c:storage_blocks": 120,
  "#c:dyes": 1,
  "#c:dyed": 1,
} as const;

export const FORM_PROPAGATION_RULES = {
  "#c:raw_materials": {
    inputMultiplier: 1,
    ignoredInputs: ["#c:storage_blocks"],
  },
  "#c:dusts": {
    inputMultiplier: 1,
    ignoredInputs: ["#c:storage_blocks"],
  },
  "#c:ingots": {
    inputMultiplier: 1,
    ignoredInputs: ["#c:storage_blocks"],
  },
  "#c:gems": {
    inputMultiplier: 1,
    ignoredInputs: ["#c:storage_blocks"],
  },
  "#c:storage_blocks": {
    inputMultiplier: 1,
    ignoredInputs: ["#c:ingots", "#c:dusts"],
  },
  "#c:dyes": {
    inputMultiplier: 0.1,
    ignoredInputs: ["all"],
  },
  "#c:dyed": {
    inputMultiplier: 0.1,
    ignoredInputs: ["all"],
  },
} as const;

export const MATERIAL_MULTIPLIERS = {
  coal: 1.1,
  copper: 1.5,
  zinc: 3,
  iron: 8,
  brass: 12,
  redstone: 15,
  lapis: 16,
  sapphire: 18,
  gold: 20,
  diamond: 40,
  emerald: 70,
  netherite: 180,
};

const noInputModifier = {
  recipes: {
    inputs: {
      all: {
        type: TagValueModifierType.multiply,
        value: 0,
      },
    },
  },
};
const defaultMaterialModifiers = [
  {
    recipes: {
      inputs: {
        "#c:storage_blocks": {
          type: TagValueModifierType.multiply,
          value: 0,
        },
      },
    },
  },
];
export const MATERIAL_FORM_VALUES: TagValues = {
  ores: { base: 10 },
  raw_materials: {
    base: 12,
    modifiers: defaultMaterialModifiers,
  },
  dusts: {
    base: 15,
    modifiers: defaultMaterialModifiers,
  },
  nuggets: {
    base: 40,
  },
  ingots: {
    base: 80,
    modifiers: defaultMaterialModifiers,
  },
  gems: { base: 100, modifiers: defaultMaterialModifiers },
  storage_blocks: {
    base: 120,
    modifiers: [
      {
        recipes: {
          inputs: {
            "#c:ingots": {
              type: TagValueModifierType.multiply,
              value: 0,
            },
            "#c:dusts": {
              type: TagValueModifierType.multiply,
              value: 0,
            },
          },
        },
      },
    ],
  },
};

export const BASE_MATERIAL_FORM_RULES = Object.entries(
  MATERIAL_FORM_VALUES,
).reduce<TagValues>((acc, [key, value]) => {
  acc[`#c:${key}`] = value;
  return acc;
}, {});

export const BASE_TAG_VALUES: TagValues = {
  "#c:furnaces": {
    base: 20,
  },
  "#c:enchantables": {
    base: 50,
  },
  "#spore:weapons": {
    base: 120 * 4,
  },
  "#c:armors": {
    base: 80 * 8,
  },
  "#c:bones": {
    base: 1,
  },
  "#c:leathers": {
    base: 22,
  },
  "#c:crops": {
    base: 5,
  },
  "#c:animal_foods": {
    base: 2,
  },
  "#c:coal": {
    base: 10,
    modifiers: [noInputModifier],
  },
  "#c:ores": {
    base: 5,
    modifiers: [noInputModifier],
  },
  "#minecraft:logs": {
    base: 5,
  },
  "#minecraft:walls": {
    base: 10,
  },
  "#minecraft:slabs": {
    base: 12,
  },
  "#minecraft:stairs": {
    base: 12,
  },
  "#minecraft:boats": {
    base: 20,
  },
  "#minecraft:leaves": {
    base: 1,
  },
  "#c:nutrients": {
    base: 12,
  },
  "#c:dyes": {
    base: 1,
    modifiers: [
      {
        recipes: {
          inputs: {
            all: {
              type: TagValueModifierType.multiply,
              value: 0.1,
            },
          },
        },
      },
    ],
  },
  "#c:dyed": {
    base: 1,
    modifiers: [
      {
        recipes: {
          inputs: {
            all: {
              type: TagValueModifierType.multiply,
              value: 0.1,
            },
          },
        },
      },
    ],
  },
};

export const SPECIFIC_TAG_VALUES: TagValues = {
  "#c:foods/vegetables": {
    base: 12,
  },
  "#c:foods/fruits": {
    base: 10,
  },
};

export const ITEM_VALUES: Record<string, number> = {
  "minecraft:white_wool": 5,
};

/*const base_tags: Record<string, number> = {};
Object.keys(SPECIFIC_TAG_VALUES).forEach((key) => {
  const tag = key.split("/")[0];
  if (!tag) return;

  if (base_tags[tag]) {
    base_tags[tag]++;
  } else {
    base_tags[tag] = 1;
  }
});
Object.entries(base_tags).forEach(([tag, count]) => {
  let finalValue = 0;
  Object.entries(SPECIFIC_TAG_VALUES).forEach(([key, value]) => {
    if (key.includes(tag)) {
      finalValue += value;
    }
  });
  BASE_TAG_VALUES[tag] = Math.ceil(finalValue / count);
});*/

Object.entries(MATERIAL_MULTIPLIERS).forEach(([material, multiplier]) => {
  Object.entries(MATERIAL_FORM_VALUES).forEach(([form, value]) => {
    SPECIFIC_TAG_VALUES[`#c:${form}/${material}`] = {
      base: value.base * multiplier,
    };
  });
});

Object.entries(BASE_MATERIAL_FORM_RULES).forEach(([tag, modifier]) => {
  BASE_TAG_VALUES[tag] = modifier;
});

export const PROFESSION_MARKETS = {
  "minecraft:farmer": {
    buys: ["c:crops", "c:foods", "minecraft:villager_plantable_seeds"],
    sells: ["c:foods/bread", "c:foods"],
    buyMultiplier: 0.65,
    sellMultiplier: 1.8,
  },

  "minecraft:toolsmith": {
    buys: ["c:raw_materials", "c:nuggets", "c:ingots", "c:plates"],
    sells: ["c:tools", "c:tools/pickaxes", "c:tools/axes", "c:tools/shovels"],
    buyMultiplier: 0.75,
    sellMultiplier: 2.2,
  },

  "minecraft:weaponsmith": {
    buys: ["c:ingots", "c:plates", "c:gems"],
    sells: ["c:tools/swords", "c:tools/axes", "c:weapons"],
    buyMultiplier: 0.75,
    sellMultiplier: 2.4,
  },

  "minecraft:armorer": {
    buys: ["c:ingots", "c:plates", "c:gems"],
    sells: ["c:armors", "c:armor"],
    buyMultiplier: 0.75,
    sellMultiplier: 2.5,
  },

  "minecraft:mason": {
    buys: ["c:stones", "c:cobblestones", "c:bricks", "c:storage_blocks"],
    sells: ["c:bricks", "c:glass_blocks", "c:stones"],
    buyMultiplier: 0.55,
    sellMultiplier: 1.6,
  },

  "minecraft:cleric": {
    buys: ["c:bones", "c:rotten_flesh", "c:gunpowders", "c:gems"],
    sells: ["c:dusts/glowstone", "c:dusts/redstone", "c:gems/lapis"],
    buyMultiplier: 0.7,
    sellMultiplier: 2.0,
  },
};

export const CATEGORY_WEIGHTS = {
  tools: 1.3,
  "tools/melee_weapons": 1.1,
  armors: 1.2,

  "foods/soups": 1.1,
  "foods/fruits": 1,
  "foods/vegetables": 1,
  "foods/berries": 0.7,
  "foods/cooked_meats": 1.2,
  "foods/cooked_fishes": 1,
  "foods/raw_meats": 0.8,
  "foods/raw_fishes": 0.6,

  ores: 0.5,
  raw: 0.7,
  crushed_raw_materials: 0.8,
  dusts: 0.8,
  nuggets: 1,
  shards: 1.1,
  gems: 1.2,
  gemstones: 1.2,
  ingots: 1.5,
  storage_blocks: 1.8,
};

JsonIO.write("kubejs/exported/server/config.json", {
  SPECIFIC_TAG_VALUES,
  ITEM_VALUES,
  BASE_TAG_VALUES,
  CATEGORY_WEIGHTS,
  PROFESSION_MARKETS,
} as any);
