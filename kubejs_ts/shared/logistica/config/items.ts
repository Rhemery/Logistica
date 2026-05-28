import { $Rarity_ } from "@package/net/minecraft/world/item";
import { ItemId } from "kubejs_ts/types/minecraft";

export const SURVEY_TOOL_TOOLTIP = "Right-click to open the Logistica survey scanner.";
export const SURVEY_TOOLS: {
  id: string;
  displayName: string;
  tooltip: string;
  rarity: $Rarity_;
  texture: string;
  range: number;
  materials: ItemId[];
}[] = [
  {
    id: "basic_excavation_survey_tool",
    displayName: "Basic Excavation Survey Tool",
    tooltip: SURVEY_TOOL_TOOLTIP,
    rarity: "uncommon" as $Rarity_,
    texture: "kubejs:item/excavation_survey_tool",
    range: 3,
    materials: ["minecraft:coal", "minecraft:raw_copper", "minecraft:raw_iron"],
  },
  {
    id: "iron_excavation_survey_tool",
    displayName: "Intermediate Excavation Survey Tool",
    tooltip: SURVEY_TOOL_TOOLTIP,
    rarity: "uncommon" as $Rarity_,
    texture: "kubejs:item/iron_excavation_survey_tool",
    range: 6,
    materials: [
      "minecraft:coal",
      "minecraft:raw_copper",
      "minecraft:raw_iron",
      "create:raw_zinc",
      "minecraft:raw_gold",
    ],
  },
  {
    id: "gold_excavation_survey_tool",
    displayName: "Advanced Excavation Survey Tool",
    tooltip: SURVEY_TOOL_TOOLTIP,
    rarity: "rare" as $Rarity_,
    texture: "kubejs:item/gold_excavation_survey_tool",
    range: 12,
    materials: [
      "minecraft:coal",
      "minecraft:raw_copper",
      "minecraft:raw_iron",
      "create:raw_zinc",
      "minecraft:raw_gold",
      "minecraft:redstone",
      "minecraft:lapis_lazuli",
    ],
  },
  {
    id: "diamond_excavation_survey_tool",
    displayName: "Military Excavation Survey Tool",
    tooltip: SURVEY_TOOL_TOOLTIP,
    rarity: "rare" as $Rarity_,
    texture: "kubejs:item/diamond_excavation_survey_tool",
    range: 24,
    materials: [
      "minecraft:coal",
      "minecraft:raw_copper",
      "minecraft:raw_iron",
      "create:raw_zinc",
      "minecraft:raw_gold",
      "minecraft:redstone",
      "minecraft:lapis_lazuli",
      "minecraft:diamond",
      "minecraft:emerald",
    ],
  },
  {
    id: "netherite_excavation_survey_tool",
    displayName: "Experimental Excavation Survey Tool",
    tooltip: SURVEY_TOOL_TOOLTIP,
    rarity: "epic" as $Rarity_,
    texture: "kubejs:item/netherite_excavation_survey_tool",
    range: 48,
    materials: [
      "minecraft:coal",
      "minecraft:raw_copper",
      "minecraft:raw_iron",
      "create:raw_zinc",
      "minecraft:raw_gold",
      "minecraft:redstone",
      "minecraft:lapis_lazuli",
      "minecraft:diamond",
      "minecraft:emerald",
      "minecraft:quartz",
      "minecraft:netherite_scrap",
    ],
  },
];
