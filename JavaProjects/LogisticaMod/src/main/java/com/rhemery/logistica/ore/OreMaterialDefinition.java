package com.rhemery.logistica.ore;

import com.rhemery.logistica.Utils;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import net.minecraft.core.Holder;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.tags.TagKey;
import net.minecraft.util.Mth;
import net.minecraft.world.level.biome.Biome;

public record OreMaterialDefinition(
  ResourceLocation id,
  String displayName,
  ResourceLocation itemId,
  float baseChance,
  float maxSaturation,
  float noiseScale,
  float noisePower,
  Map<TagKey<Biome>, Float> biomeModifiers
) {
  private static final ResourceLocation FALLBACK_ITEM = ResourceLocation.withDefaultNamespace(
    "air"
  );

  public OreMaterialDefinition(
    ResourceLocation id,
    float baseChance,
    float maxSaturation,
    float noiseScale,
    float noisePower,
    Map<TagKey<Biome>, Float> biomeModifiers
  ) {
    this(
      id,
      defaultDisplayName(id),
      FALLBACK_ITEM,
      baseChance,
      maxSaturation,
      noiseScale,
      noisePower,
      biomeModifiers
    );
  }

  public OreMaterialDefinition {
    Objects.requireNonNull(id, "id");
    displayName =
      displayName != null && !displayName.isBlank() ? displayName : defaultDisplayName(id);
    itemId = itemId != null ? itemId : FALLBACK_ITEM;
    baseChance = Mth.clamp(baseChance, 0.0F, 1.0F);
    maxSaturation = Mth.clamp(maxSaturation, 0.0F, 1.0F);
    noiseScale = Math.max(0.0001F, noiseScale);
    noisePower = Math.max(0.1F, noisePower);

    if (biomeModifiers != null) {
      LinkedHashMap<TagKey<Biome>, Float> newBiomeModifiers = new LinkedHashMap<>(biomeModifiers);
      biomeModifiers = Map.copyOf(newBiomeModifiers);
    } else {
      biomeModifiers = Map.of();
    }
  }

  public float biomeModifier(Holder<Biome> biome) {
    float modifier = 1.0F;
    for (var entry : biomeModifiers.entrySet()) {
      var key = entry.getKey();
      if (key == null) {
        continue;
      }

      if (biome.is(key)) {
        modifier *= entry.getValue();
      }
    }
    return modifier;
  }

  public static String defaultDisplayName(String id) {
    if (id == null) {
      return "";
    }

    return defaultDisplayName(Utils.getResourceLocation(id));
  }

  public static String defaultDisplayName(ResourceLocation id) {
    String path = id.getPath().replace('_', ' ');
    if (path.isEmpty()) {
      String str = id.toString();
      if (str != null) return str;
      return "";
    }
    return Character.toUpperCase(path.charAt(0)) + path.substring(1);
  }
}
