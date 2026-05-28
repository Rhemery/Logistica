package com.rhemery.logistica.survey;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;

public final class SurveyToolRegistry {

  private static final Map<String, SurveyTier> TIERS = new LinkedHashMap<>();
  private static final Map<ResourceLocation, String> TOOL_TO_TIER = new LinkedHashMap<>();

  private SurveyToolRegistry() {}

  public static synchronized void clearTools() {
    TOOL_TO_TIER.clear();
  }

  public static synchronized void clearTiers() {
    TIERS.clear();
  }

  public static synchronized void registerTier(SurveyTier tier) {
    TIERS.put(tier.id(), tier);
  }

  public static synchronized void registerTier(
    String id,
    int radius,
    Collection<ResourceLocation> materials
  ) {
    registerTier(new SurveyTier(id, radius, Set.copyOf(materials)));
  }

  public static synchronized void unregisterTier(String id) {
    TIERS.remove(id);
    TOOL_TO_TIER.entrySet().removeIf(entry -> entry.getValue().equals(id));
  }

  public static synchronized SurveyTier getTier(String id) {
    return TIERS.get(id);
  }

  public static synchronized Map<String, SurveyTier> tiers() {
    return Map.copyOf(TIERS);
  }

  public static synchronized void registerTool(ResourceLocation itemId, String tierId) {
    if (!TIERS.containsKey(tierId)) {
      throw new IllegalArgumentException("Unknown survey tier: " + tierId);
    }
    TOOL_TO_TIER.put(itemId, tierId);
  }

  public static synchronized void unregisterTool(ResourceLocation itemId) {
    TOOL_TO_TIER.remove(itemId);
  }

  public static synchronized SurveyTier resolveTier(ItemStack stack) {
    Item item = stack.getItem();
    if (item == null) {
      throw new IllegalArgumentException("Invalid item: " + stack);
    }

    ResourceLocation itemId = BuiltInRegistries.ITEM.getKey(item);
    String tierId = TOOL_TO_TIER.get(itemId);
    return TIERS.get(tierId);
  }
}
