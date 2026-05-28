import { $Object } from "@package/java/lang";
import {
  Block,
  Item,
  EntityType,
  SoundEvent,
} from "@side-only/startup/events/registry/index";

export function registerBlocks(event: Block) {
  event
    .create("corruption_node")
    .soundType("gravel")
    .hardness(0.6)
    .requiresTool(false)
    .tagBlock(["logistica/corrupted", "minable/shovel"])
    .parentModel("kubejs:block/corruption_node/corruption_node")
    .displayName("Corrupted Node");

  event
    .create("disintegration_bomb")
    .soundType("grass")
    .hardness(0.0)
    .requiresTool(false)
    .tagBlock(["logistica/corrupted"])
    .texture(
      ["up"],
      "kubejs:block/disintegration_bomb/disintegration_bomb_top_texture",
    )
    .texture(
      ["north", "east", "south", "west"],
      "kubejs:block/disintegration_bomb/disintegration_bomb_side_texture",
    )
    .texture(
      ["down"],
      "kubejs:block/disintegration_bomb/disintegration_bomb_bottom_texture",
    )
    .fullBlock(true)
    .displayName("Disintegration Bomb")
    .item((item) => {
      item.unstackable();
      item.rarity("epic");
    });

  event
    .create("dead_grass_block")
    .soundType("grass")
    .hardness(0.6)
    .requiresTool(false)
    .tagBlock(["logistica/corrupted", "minable/shovel"])
    .texture(
      ["up"],
      "kubejs:block/dead_grass_block/dead_grass_block_top_texture",
    )
    .texture(
      ["north", "east", "south", "west"],
      "kubejs:block/dead_grass_block/dead_grass_block_side_texture",
    )
    .texture(["down"], "minecraft:block/dirt")
    .fullBlock(true)
    .displayName("Dead Grass Block")
    .item((item) => {
      item.rarity("common");
    });
}

export function registerEntityTypes(event: EntityType) {
  event
    .create("disintegration_bomb", "entityjs:nonliving")
    .sized(0.98, 0.98)
    .clientTrackingRange(10)
    .updateInterval(1)
    .modelResource(
      () =>
        "kubejs:geo/entity/disintegration_bomb.geo.json" as unknown as $Object,
    )
    .textureResource(
      () =>
        "kubejs:textures/entity/disintegration_bomb.png" as unknown as $Object,
    )
    .animationResource(
      () =>
        "kubejs:animations/entity/disintegration_bomb.animation.json" as unknown as $Object,
    )
    .setSummonable(true)
    .displayName("Disintegration Bomb");
}

export function registerItems(event: Item) {
  event
    .create("purity_cell")
    .displayName("Purity Cell")
    .unstackable()
    .rarity("epic")
    .texture("kubejs:item/purity_cell");
}

export function registerSoundEffects(event: SoundEvent) {
  event.create("disintegration_bomb_armed");
  event.create("disintegration_bomb_explode");
  event.create("insert_cell");
  event.create("node_pulse");
}
