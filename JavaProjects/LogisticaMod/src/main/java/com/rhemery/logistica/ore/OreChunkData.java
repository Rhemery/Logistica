package com.rhemery.logistica.ore;

import java.util.LinkedHashMap;
import java.util.Map;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.Tag;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.util.Mth;

public final class OreChunkData {

  private static final String ENTRIES_TAG = "entries";
  private static final String ID_TAG = "id";
  private static final String SATURATION_TAG = "saturation";

  private final Map<ResourceLocation, Float> saturationByMaterial;

  public OreChunkData(Map<ResourceLocation, Float> saturationByMaterial) {
    Map<ResourceLocation, Float> copy = new LinkedHashMap<>();
    saturationByMaterial.forEach((id, saturation) -> {
      float clamped = Mth.clamp(saturation, 0.0F, 1.0F);
      if (clamped > 0.0001F) {
        copy.put(id, clamped);
      }
    });
    this.saturationByMaterial = Map.copyOf(copy);
  }

  public Map<ResourceLocation, Float> saturations() {
    return saturationByMaterial;
  }

  public float saturation(ResourceLocation materialId) {
    return saturationByMaterial.getOrDefault(materialId, 0.0F);
  }

  public CompoundTag toTag() {
    CompoundTag tag = new CompoundTag();
    ListTag entries = new ListTag();
    saturationByMaterial.forEach((material, saturation) -> {
      String materialString = material.toString();
      if (materialString == null) return;

      CompoundTag entry = new CompoundTag();
      entry.putString(ID_TAG, materialString);
      entry.putFloat(SATURATION_TAG, saturation);
      entries.add(entry);
    });
    tag.put(ENTRIES_TAG, entries);
    return tag;
  }

  public static OreChunkData fromTag(CompoundTag tag) {
    Map<ResourceLocation, Float> saturations = new LinkedHashMap<>();
    ListTag entries = tag.getList(ENTRIES_TAG, Tag.TAG_COMPOUND);
    for (int i = 0; i < entries.size(); i++) {
      CompoundTag entry = entries.getCompound(i);
      String str = entry.getString(ID_TAG);
      if (str == null) continue;

      ResourceLocation id = ResourceLocation.parse(str);
      float saturation = entry.getFloat(SATURATION_TAG);
      saturations.put(id, saturation);
    }
    return new OreChunkData(saturations);
  }
}
