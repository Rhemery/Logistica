export type ResourceLocation = `${string}:${string}`;
export type ItemId = ResourceLocation;
export type TagId = ResourceLocation | `#${ResourceLocation}`;
export type BlockId = ResourceLocation;
export type FluidId = ResourceLocation;
export type EntityId = ResourceLocation;
export type RecipeTypeId = ResourceLocation;
export type ModId = string;

export type Recipe = {
  accept_mirrored?: boolean;
  addition?: {
    components?: {
      "minecraft:potion_contents": {
        potion: ResourceLocation;
      };
    };
    item?: ItemId;
    items?: ItemId;
    type?: RecipeTypeId;
  }[] | {
    count?: number;
    item?: ItemId;
    tag?: TagId;
  };
  allowed_vat_types?: ResourceLocation[];
  amountMultiplierMax?: number;
  amountMultiplierMin?: number;
  animation?: {
    model: ResourceLocation;
    type: RecipeTypeId;
  };
  attribute?: "Damage";
  base?: {
    item?: ItemId;
    tag?: TagId;
  };
  base_fluid?: {
    amount: number;
    ingredient: {
      tag: TagId;
    };
    unit: "millibuckets";
  };
  bee?: ResourceLocation;
  bee_bomb?: {
    id: ResourceLocation;
  };
  bees?: ResourceLocation[];
  biome?: TagId;
  biomes?: TagId | TagId[];
  biomeWhitelist?: ResourceLocation;
  block?: BlockId;
  blockInFront?: BlockId;
  blood?: {
    item: ItemId;
  };
  burn_time?: number;
  bypass?: {
    tag: TagId;
  };
  can_fill?: boolean;
  can_overfill?: boolean;
  catalyst?: {
    item: ItemId;
  };
  category?: "redstone" | "building" | "misc" | "equipment" | "food" | "blocks" | "freezable_blocks" | "enchanting_food" | "meals" | "freezable_misc" | "enchanting_misc" | "combinable_fodder" | "enchanting_blocks" | "combinable_misc";
  color?: {
    color: "lime" | "pink" | "yellow" | "gray" | "light_blue" | "white" | "green" | "orange" | "cyan" | "light_gray" | "black" | "blank" | "blue" | "rainbow" | "brown" | "purple" | "magenta" | "red";
  };
  components?: {
    "minecraft:block_state": {
      type: RecipeTypeId;
    };
  };
  conditions?: {
    modid?: ModId;
    type: RecipeTypeId;
    value?: boolean | {
      modid?: ModId;
      tag?: TagId;
      type: RecipeTypeId;
    };
  }[];
  consume_input?: boolean;
  consumes_offhand?: boolean;
  container?: {
    count?: number;
    id: ResourceLocation;
  };
  cookingtime?: number;
  cookTime?: number;
  count?: number;
  dimension?: ResourceLocation;
  display_level?: number;
  dragonType?: "fire" | "lightning" | "ice";
  drill?: {
    item?: ItemId;
    tag?: TagId;
  };
  dyed_items_amount?: number;
  effect?: ResourceLocation | {
    id: ResourceLocation;
  };
  effect_providers?: ResourceLocation[];
  energy?: number;
  energy_needed?: number;
  enchantment?: ResourceLocation;
  entity?: EntityId;
  exclusions?: ResourceLocation[];
  experience?: number;
  "fabric:load_conditions"?: {
    condition: ResourceLocation;
    flag?: string;
    modid?: ModId;
    namespaces?: "create"[];
    value?: {
      condition: ResourceLocation;
      modid?: ModId;
      tag?: TagId;
    };
    values?: ("savage_and_ravage" | {
      condition: ResourceLocation;
      flag?: "gold_bars";
      modid?: ModId;
    })[];
  }[];
  fermenting_time?: number;
  finite?: "never" | "default";
  fluid?: {
    amount: number;
    fluid?: FluidId;
    id?: FluidId;
    ingredient?: {
      fluid: FluidId;
    };
    tag?: TagId;
  };
  fluid_amount?: number;
  fluid_providers?: FluidId[];
  from?: {
    Name: ResourceLocation;
    Properties?: {
      dusted: number;
    };
  };
  gateway?: ResourceLocation;
  group?: string;
  heat_requirement?: "heated" | "superheated";
  heatRequirement?: "heated" | "none";
  hot_air_usage?: number;
  chance?: number;
  charge?: {
    item?: ItemId;
    tag?: TagId;
  };
  charges_per_item?: number;
  icon?: {
    count: number;
    id: ResourceLocation;
  };
  incubationtime?: number;
  ingot?: {
    item: ItemId;
  };
  ingredient?: ResourceLocation | {
    item: ItemId;
  }[] | {
    block?: BlockId;
    components?: {
      "minecraft:custom_data"?: {
        engineRecipeData: {
          exhaustPackType?: ResourceLocation;
          materialLevel?: number;
          powerPackType?: ResourceLocation;
        };
      };
      "productivebees:bee_type"?: ResourceLocation;
    };
    item?: ItemId;
    items?: ItemId;
    nbt?: "{Potion:\"minecraft:water\"}";
    properties?: {
      level?: string;
      lit?: string;
    };
    tag?: TagId;
    type?: RecipeTypeId;
  };
  ingredients?: ({
    item?: ItemId;
    tag?: TagId;
  }[] | {
    amount?: number;
    base?: {
      item?: ItemId;
      tag?: TagId;
    }[] | {
      tag: TagId;
    };
    block_type?: BlockId;
    components?: {
      "create:potion_fluid_bottle_type"?: "regular";
      "minecraft:potion_contents"?: {
        potion: ResourceLocation;
      };
      "productivebees:bee_type"?: ResourceLocation;
    };
    count?: number;
    fluid?: FluidId;
    fluid_tag?: TagId;
    fluids?: FluidId;
    from?: ResourceLocation;
    children?: {
      item?: ItemId;
      tag?: TagId;
    }[];
    id?: ResourceLocation;
    ingredient?: {
      item: ItemId;
    };
    ingredients?: {
      item: ItemId;
    }[];
    item?: ItemId | {
      item: ItemId;
    };
    items?: ItemId;
    nbt?: Record<string, never>;
    slot?: number;
    subtracted?: {
      item?: ItemId;
      tag?: TagId;
    };
    tag?: TagId;
    to?: ResourceLocation;
    type?: RecipeTypeId;
  })[];
  input?: {
    item?: ItemId;
    "max-saturation"?: number;
    "min-saturation"?: number;
    tag?: TagId;
    type?: RecipeTypeId;
  }[] | {
    components?: {
      "apothic_enchanting:leashed_entity_type"?: EntityId;
      "minecraft:entity_data"?: {
        id: EntityId;
        type: RecipeTypeId;
      };
    };
    item?: ItemId;
    items?: ItemId;
    purity?: "flawless" | "perfect" | "cracked" | "normal" | "flawed" | "chipped";
    rarity?: ResourceLocation;
    tag?: TagId;
    type?: RecipeTypeId;
  };
  inputCount?: number;
  inputs?: ResourceLocation;
  item?: {
    item: ItemId;
  }[] | {
    item?: ItemId;
    tag?: TagId;
  };
  keep_held_item?: boolean;
  keepNbt?: ("engineRecipeData" | "blockEntity")[];
  key?: ResourceLocation | {
    [key: string]: {
      item?: ItemId;
      tag?: TagId;
    }[] | {
      base?: {
        tag: TagId;
      };
      block_type?: BlockId;
      components?: {
        "gateways:gateway"?: ResourceLocation;
        "minecraft:attribute_modifiers"?: {
          modifiers: unknown[];
        };
        "minecraft:enchantments"?: {
          levels: Record<string, never>;
        };
        "minecraft:entity_data"?: {
          id: EntityId;
          type: RecipeTypeId;
        };
        "minecraft:lore"?: unknown[];
        "minecraft:max_stack_size"?: number;
        "minecraft:potion_contents"?: {
          potion: ResourceLocation;
        };
        "minecraft:rarity"?: "common";
        "minecraft:repair_cost"?: number;
        potion_contents?: {
          potion: "water";
        };
      };
      count?: number;
      data?: number;
      from?: ResourceLocation;
      ingredient?: {
        tag: TagId;
      };
      ingredients?: {
        item: ItemId;
      }[];
      item?: ItemId | {
        components: {
          "avaritia:singularity_id": ItemId;
        };
        count: number;
        id: ItemId;
      };
      items?: ItemId | ItemId[];
      subtracted?: {
        tag: TagId;
      };
      tag?: TagId;
      to?: ResourceLocation;
      type?: RecipeTypeId;
      upgradable?: boolean;
    };
  };
  leafA?: {
    item: ItemId;
  };
  leafB?: {
    item: ItemId;
  }[] | {
    item: ItemId;
  };
  left?: {
    count: number;
    item: ItemId;
  }[];
  level?: number;
  level_cost?: number;
  loops?: number;
  machines?: ResourceLocation[];
  mainhand?: {
    item?: ItemId;
    tag?: TagId;
  };
  material_cost?: number;
  materials?: {
    count: number;
    ingredient: {
      item?: ItemId;
      tag?: TagId;
    };
  }[];
  max_dyes?: number;
  max_charge_rate?: number;
  max_requirements?: {
    arcana: number;
    eterna: number;
    quanta: number;
  };
  max_sockets?: number;
  method?: "decrement";
  min?: number;
  min_size?: number;
  mold?: ResourceLocation;
  name?: "{\"translate\":\"block.minecraft.water\"}" | "{\"translate\":\"item.minecraft.coal\"}" | "{\"translate\":\"item.createoreexcavation.raw_redstone\"}" | "{\"translate\":\"item.minecraft.lapis_lazuli\"}" | "{\"translate\":\"ore.coe.hardenedDiamond\"}" | "{\"translate\":\"item.minecraft.raw_copper\"}" | "{\"translate\":\"item.create.raw_zinc\"}" | "{\"translate\":\"item.minecraft.gold_nugget\"}" | "{\"translate\":\"block.minecraft.ancient_debris\"}" | "{\"translate\":\"item.createoreexcavation.raw_diamond\"}" | "{\"translate\":\"item.minecraft.raw_gold\"}" | "{\"translate\":\"item.minecraft.glowstone_dust\"}" | "{\"translate\":\"item.createoreexcavation.raw_emerald\"}" | "{\"translate\":\"item.minecraft.raw_iron\"}" | "{\"translate\":\"item.minecraft.quartz\"}";
  namespace?: string;
  "neoc:conditions"?: {
    type: RecipeTypeId;
    value: {
      tag: TagId;
      type: RecipeTypeId;
    };
  }[];
  "neoforge:conditions"?: {
    conditions_met: boolean;
    original_conditions: {
      bee?: ResourceLocation;
      feature?: string;
      flag?: string;
      fluidTag?: TagId;
      id?: ResourceLocation;
      invert?: boolean;
      item?: ItemId;
      itemRegistryName?: ItemId;
      key?: "petrolsparts:common.recipes.colossalCogwheel" | "petrolsparts:common.recipes.planetaryGearset" | "petrolsparts:common.recipes.redstoneProgrammer" | "petrolsparts:common.recipes.brassDepot" | "petrolsparts:common.recipes.differential" | "petrolsparts:common.recipes.coaxialGears" | "petrolsparts:common.recipes.cornerShaft" | "petrolsparts:common.recipes.pneumaticTube" | "petrolsparts:common.recipes.hydraulicTransmission";
      modid?: ModId;
      tag?: TagId;
      type: RecipeTypeId;
      value?: {
        bee?: ResourceLocation;
        flag?: "iron_rod_pre_end";
        modid?: ModId;
        tag?: TagId;
        type: RecipeTypeId;
      };
      values?: {
        flag?: string;
        modid?: ModId;
        type: RecipeTypeId;
        value?: {
          modid: ModId;
          type: RecipeTypeId;
        };
      }[];
    }[];
    type: RecipeTypeId;
  }[];
  "neoforge:load_conditions"?: {
    flag: "awning" | "flax";
    type: RecipeTypeId;
  }[];
  offhand?: {
    item: ItemId;
  };
  offspring?: ResourceLocation;
  output?: {
    count?: number;
    chance?: number;
    id: ResourceLocation;
  }[] | {
    amount?: number;
    components?: {
      "deep_aether:moa_fodder"?: {
        effect: {
          amplifier: number;
          duration: number;
          id: ResourceLocation;
          "neoforge:cures": ("protected_by_totem" | "milk")[];
          show_icon: boolean;
        };
      };
      "minecraft:potion_contents"?: {
        potion: ResourceLocation;
      };
    };
    count?: number;
    id?: ResourceLocation;
    Name?: ResourceLocation;
  };
  outputs?: {
    chance?: number;
    item?: {
      item?: ItemId;
      tag?: TagId;
    };
    max?: number;
    max_count?: number;
    min?: number;
    min_count?: number;
    stack?: {
      count: number;
      id: ResourceLocation;
    };
  }[];
  parent?: {
    group: ResourceLocation;
    key: {
      [key: string]: {
        tag: TagId;
      };
    };
    pattern: string[];
    result: {
      id: ItemId;
    };
    type: RecipeTypeId;
  };
  parent1?: ResourceLocation;
  parent2?: ResourceLocation;
  pattern?: string[];
  placeholder?: {
    count: number;
    id: ResourceLocation;
  };
  placement?: {
    salt: number;
    separation: number;
    spacing: number;
  };
  power_required?: number;
  priority?: number;
  processing_time?: number;
  processingTime?: number;
  product?: {
    item: {
      id: ItemId;
    };
    type: RecipeTypeId;
  };
  providers?: {
    item?: ItemId;
    tag?: TagId;
  }[];
  purity?: "cracked" | "flawed" | "chipped" | "flawless" | "normal";
  rarity?: ResourceLocation;
  recipe_book_tab?: "meals" | "misc" | "drinks";
  recipes?: string[];
  repairTime?: number;
  replace?: boolean | "true";
  requirements?: {
    arcana: number;
    eterna: number;
    quanta: number;
  };
  result?: ItemId | {
    count?: number;
    chance?: number;
    id?: ItemId;
    item?: {
      count?: number;
      chance?: number;
      id: ItemId;
    };
  }[] | {
    amount?: number;
    block?: BlockId;
    components?: {
      "cold_sweat:fuel"?: number;
      "gateways:gateway"?: ItemId;
      "minecraft:banner_patterns"?: {
        color: "cyan" | "black" | "white" | "light_blue";
        pattern: string;
      }[];
      "minecraft:custom_name"?: "{\"italic\":false,\"translate\":\"\\\"%s\\\"\",\"with\":[{\"translate\":\"item.minecraft.pufferfish\"}]}";
      "minecraft:entity_data"?: {
        id: ItemId;
        type: RecipeTypeId;
      };
      "minecraft:hide_additional_tooltip"?: Record<string, never>;
      "minecraft:item_name"?: "{\"color\":\"gold\",\"translate\":\"aether.block.aether.swet_banner\"}";
      "patchouli:book"?: ItemId;
      "sophisticatedcore:accent_color"?: number;
      "sophisticatedcore:main_color"?: number;
      "sophisticatedstorage:wood_type"?: "oak" | "bamboo" | "birch" | "acacia" | "crimson" | "spruce" | "dark_oak" | "warped" | "mangrove" | "jungle" | "cherry";
      "tfmg:fuel_tags"?: {
        creosote?: TagId;
        diesel?: TagId;
        furnace_gas?: TagId;
        gasoline?: TagId;
        kerosene?: TagId;
        lpg?: TagId;
        naphtha?: TagId;
      };
      "tfmg:fuels"?: {
        creosote?: "Creosote";
        diesel?: "fluid.tfmg.diesel";
        furnace_gas?: "Furnace Gas";
        gasoline?: "Gasoline";
        kerosene?: "Kerosene";
        lpg?: "LPG";
        naphtha?: "Naphtha";
      };
      "tfmg:spool_amount"?: number;
    };
    count?: number;
    id?: ItemId;
    item?: ItemId;
    nbt?: "{\"Potion\": \"minecraft:water\"}" | {
      BlockEntityTag: {
        LighterUpgrade: boolean;
      };
    };
    properties?: {
      lit: string;
    };
    type?: RecipeTypeId;
  };
  results?: (ItemId | {
    amount?: number;
    components?: {
      "createbigcannons:power"?: number;
      "createdieselgenerators:mold_type"?: ItemId;
      "minecraft:potion_contents"?: {
        custom_effects?: {
          amplifier: number;
          duration: number;
          id: ItemId;
        }[];
        potion: "luck" | "minecraft:awkward";
      };
      "minecraft:stored_enchantments"?: {
        levels: {
          "minecraft:channeling": number;
        };
      };
      "tfmg:amount"?: number;
      "tfmg:coil_turns"?: number;
      "tfmg:resistance"?: number;
    };
    count?: number;
    chance?: number;
    id?: ItemId;
    item?: ItemId | {
      components?: {
        "productivebees:bee_type": ItemId;
      };
      id?: ItemId;
      item?: ItemId;
      items?: ItemId;
      tag?: TagId;
      type?: RecipeTypeId;
    };
    type?: RecipeTypeId;
  })[];
  right?: {
    count: number;
    item: ItemId;
  }[];
  secondary?: {
    count: number;
    id: ResourceLocation;
  };
  sequence?: {
    energy_needed?: number;
    ingredients: ({
      item?: ItemId;
      tag?: TagId;
    }[] | {
      amount?: number;
      fluid?: FluidId;
      fluid_tag?: TagId;
      children?: {
        item?: ItemId;
        tag?: TagId;
      }[];
      item?: ItemId;
      tag?: TagId;
      type?: RecipeTypeId;
    })[];
    machNbt?: ("engineRecipeData" | "blockEntity")[];
    processing_time?: number;
    results: {
      id?: ItemId;
      item?: {
        id: ItemId;
      };
    }[];
    type: RecipeTypeId;
  }[];
  set_antique?: boolean;
  set_lore?: boolean;
  show_notification?: boolean;
  shulker?: {
    tag: TagId;
  };
  sigil_cost?: number;
  sound?: ResourceLocation | {
    sound_id: ResourceLocation;
  };
  source?: ResourceLocation;
  spawn_item?: {
    item?: ItemId;
    tag?: TagId;
  };
  stat_changes?: {
    max?: number;
    min?: number;
    type: RecipeTypeId;
    value: number | boolean;
  }[];
  strength?: number;
  stress?: number;
  strict?: boolean;
  superheated?: boolean;
  tables?: ResourceLocation | ResourceLocation[];
  tag?: TagId | {
    Hungry: number;
    IsBaby: number;
    MoaType: TagId;
    PlayerGrown: number;
  };
  temperature?: number;
  template?: unknown[] | {
    item: ItemId;
  };
  tertiary?: {
    count?: number;
    id?: ResourceLocation;
  };
  ticks?: number;
  tier?: number;
  time?: number | {
    time: number;
    translation_key: "item.petrolpark.drying_item.remaining";
  };
  timeCost?: number;
  to?: "64k" | "16k" | "4k" | "1024b" | "256b" | "4096b" | {
    Name: ResourceLocation;
  };
  tool?: {
    action?: "axe_dig" | "axe_strip" | "shovel_dig" | "pickaxe_dig" | "axe_wax_off";
    item?: ItemId;
    tag?: TagId;
    type?: RecipeTypeId;
  };
  transitional_item?: {
    id?: ItemId;
    item?: {
      id: ItemId;
    };
  };
  type: "adpother:filter_change" | "aether:accessory_freezable" | "aether:ambrosium_enchanting" | "aether:block_placement_ban" | "aether:enchanting" | "aether:freezing" | "aether:icestone_freezable" | "aether:incubation" | "aether:item_placement_ban" | "aether:placement_conversion" | "aether:repairing" | "aether:swet_ball_conversion" | "alexscaves:cave_map" | "alexsmobs:bison_upgrade" | "alexsmobs:mimicream_repair" | "almostunified:client_recipe_tracker" | "amendments:dye_bottle" | "apotheosis:add_sockets" | "apotheosis:malice" | "apotheosis:potion_charm_crafting" | "apotheosis:potion_charm_infusion" | "apotheosis:purity_upgrade" | "apotheosis:reforging" | "apotheosis:salvaging" | "apotheosis:sized_upgrade_recipe" | "apotheosis:socketing" | "apotheosis:supremacy" | "apotheosis:unnaming" | "apotheosis:withdrawal" | "apothic_enchanting:infusion" | "apothic_enchanting:keep_nbt_infusion" | "apothic_spawners:spawner_modifier" | "aquaculture:crafting_special_fish_fillet" | "avaritia:compressor" | "avaritia:eternal_singularity" | "avaritia:extreme_smithing" | "avaritia:full_matter_cluster" | "avaritia:infinity_catalyst" | "avaritia:no_consume_catalyst_shaped" | "avaritia:shaped_table" | "avaritia:shapeless_table" | "brewinandchewin:create_potion_pouring" | "brewinandchewin:fermenting" | "brewinandchewin:keg_pouring" | "cataclysm:amethyst_bless" | "cataclysm:weapon_fusion" | "crafting_shaped" | "crafting_shapeless" | "create:compacting" | "create:crushing" | "create:cutting" | "create:deploying" | "create:emptying" | "create:filling" | "create:haunting" | "create:item_application" | "create:item_copying" | "create:mechanical_crafting" | "create:milling" | "create:mixing" | "create:pressing" | "create:sandpaper_polishing" | "create:sequenced_assembly" | "create:splashing" | "create:toolbox_dyeing" | "create_aquatic_ambitions:channeling" | "create_dragons_plus:ending" | "create_dragons_plus:freezing" | "create_enchantment_industry:grinding" | "create_factory_logistics:network_link_qualification" | "create_new_age:energising" | "createaddition:charging" | "createaddition:liquid_burning" | "createaddition:rolling" | "createbigcannons:autocannon_ammo_container_filling_deployer" | "createbigcannons:big_cartridge_filling" | "createbigcannons:big_cartridge_filling_deployer" | "createbigcannons:cartridge_assembly" | "createbigcannons:cartridge_assembly_deployer" | "createbigcannons:fuze_removal" | "createbigcannons:melting" | "createbigcannons:munition_fuzing" | "createbigcannons:munition_fuzing_deployer" | "createbigcannons:tracer_application" | "createbigcannons:tracer_application_deployer" | "createbigcannons:tracer_removal" | "createdieselgenerators:basin_fermenting" | "createdieselgenerators:bulk_fermenting" | "createdieselgenerators:casting" | "createdieselgenerators:compression_molding" | "createdieselgenerators:distillation" | "createdieselgenerators:hammering" | "createdieselgenerators:wire_cutting" | "createoreexcavation:drilling" | "createoreexcavation:extracting" | "createoreexcavation:vein" | "creatingspace:air_liquefying" | "creatingspace:chemical_synthesis" | "creatingspace:mechanical_electrolysis" | "deep_aether:combining" | "deep_aether:floaty_scarf_coloring" | "deep_aether:glowing_spores_recipe" | "deep_aether:golden_swet_ball_recipe" | "deep_aether:poison_recipe" | "deeperdarker:gloomslate_pot_recipe" | "deeperdarker:sculk_transmitter_coloring" | "dndesires:dragon_breathing" | "dndesires:freezing" | "dndesires:hydraulic_compacting" | "dndesires:sanding" | "dndesires:seething" | "domum_ornamentum:architects_cutter" | "extendedcrafting:shaped_ender_crafter" | "extendedcrafting:shaped_flux_crafter" | "extendedcrafting:shaped_table" | "extendedcrafting:ultimate_singularity" | "farmersdelight:cooking" | "farmersdelight:cutting" | "farmersdelight:dough" | "farmersdelight:food_serving" | "galosphere:preserved_transform_recipe" | "gateways:gate_recipe" | "iceandfire:dragonforge" | "ironfurnaces:generator_blasting" | "jeed:effect_provider" | "jeed:potion_provider" | "mechanical_botany:composting" | "mechanical_botany:insolating" | "minecolonies:composting" | "minecolonies:zero_waste" | "minecraft:blasting" | "minecraft:campfire_cooking" | "minecraft:crafting_decorated_pot" | "minecraft:crafting_shaped" | "minecraft:crafting_shapeless" | "minecraft:crafting_special_armordye" | "minecraft:crafting_special_bannerduplicate" | "minecraft:crafting_special_bookcloning" | "minecraft:crafting_special_firework_rocket" | "minecraft:crafting_special_firework_star" | "minecraft:crafting_special_firework_star_fade" | "minecraft:crafting_special_mapcloning" | "minecraft:crafting_special_mapextending" | "minecraft:crafting_special_repairitem" | "minecraft:crafting_special_shielddecoration" | "minecraft:crafting_special_shulkerboxcoloring" | "minecraft:crafting_special_suspiciousstew" | "minecraft:crafting_special_tippedarrow" | "minecraft:smelting" | "minecraft:smithing_transform" | "minecraft:smithing_trim" | "minecraft:smoking" | "minecraft:stonecutting" | "pantographsandwires:combine_wire" | "parcool:zipline_rope_dye" | "petrolpark:badge_duplication" | "petrolpark:drying" | "petrolpark:extrusion" | "petrolpark:lidded_basin" | "petrolpark:mandrel" | "pointblank:default" | "powergrid:crafting_special_string_light_cord" | "powergrid:magnetization" | "productivebees:advanced_beehive" | "productivebees:bee_breeding" | "productivebees:bee_cage_bomb" | "productivebees:bee_conversion" | "productivebees:bee_fishing" | "productivebees:bee_nbt_changer" | "productivebees:bee_spawning" | "productivebees:block_conversion" | "productivebees:bottler" | "productivebees:centrifuge" | "productivebees:configurable_comb_block" | "productivebees:configurable_honeycomb" | "productivebees:gene_gene" | "productivebees:gene_treat" | "productivetrees:sawmill" | "productivetrees:tree_pollination" | "quark:dye_item" | "quark:elytra_duplication" | "quark:exclusion" | "quark:mixed_exclusion" | "quark:slab_to_block" | "quark:smithing_rune" | "refinedstorage:fluid_storage_block_upgrade" | "refinedstorage:fluid_storage_disk_upgrade" | "refinedstorage:storage_block_upgrade" | "refinedstorage:storage_disk_upgrade" | "refinedstorage:upgrade_with_enchanted_book" | "refurbished_furniture:crafting_special_door_mat_copy" | "refurbished_furniture:cutting_board_combining" | "refurbished_furniture:cutting_board_slicing" | "refurbished_furniture:freezer_solidifying" | "refurbished_furniture:frying_pan_cooking" | "refurbished_furniture:microwave_heating" | "refurbished_furniture:oven_baking" | "refurbished_furniture:toaster_heating" | "refurbished_furniture:workbench_constructing" | "rubberworks:compressing" | "rubberworks:sapping" | "simplyswords:smithing_reroll" | "simplyswords:unique_upgrade" | "sophisticatedbackpacks:backpack_dye" | "sophisticatedbackpacks:backpack_upgrade" | "sophisticatedbackpacks:basic_backpack" | "sophisticatedbackpacks:smithing_backpack_upgrade" | "sophisticatedcore:upgrade_clear" | "sophisticatedcore:upgrade_next_tier" | "sophisticatedstorage:barrel_material" | "sophisticatedstorage:double_chest_tier_upgrade" | "sophisticatedstorage:double_chest_tier_upgrade_shapeless" | "sophisticatedstorage:flat_top_barrel_toggle" | "sophisticatedstorage:generic_wood_storage" | "sophisticatedstorage:shulker_box_from_chest" | "sophisticatedstorage:shulker_box_from_vanilla_shapeless" | "sophisticatedstorage:storage_dye" | "sophisticatedstorage:storage_tier_upgrade" | "sophisticatedstorage:storage_tier_upgrade_shapeless" | "spore:grafting" | "spore:surgery" | "supplementaries:add_charges" | "supplementaries:antique_book" | "supplementaries:bamboo_spikes_tipped" | "supplementaries:blackboard_duplicate" | "supplementaries:confetti_dye" | "supplementaries:flag_from_banner" | "supplementaries:item_lore" | "supplementaries:present_dye" | "supplementaries:safe" | "supplementaries:soap_clearing" | "supplementaries:sus_crafting" | "supplementaries:trapped_present" | "supplementaries:weathered_map" | "suppsquared:sack_dye" | "tfmg:casting" | "tfmg:coking" | "tfmg:distillation" | "tfmg:hot_blast" | "tfmg:industrial_blasting" | "tfmg:polarizing" | "tfmg:vat_machine_recipe" | "tfmg:winding";
  unit?: "millibuckets";
  value?: number;
  veinId?: ResourceLocation;
};
