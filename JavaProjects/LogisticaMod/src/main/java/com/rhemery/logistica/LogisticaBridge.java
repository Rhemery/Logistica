package com.rhemery.logistica;

import com.rhemery.logistica.ore.OreChunkData;
import com.rhemery.logistica.ore.OreDataService;
import com.rhemery.logistica.ore.OreMaterialDefinition;
import com.rhemery.logistica.ore.OreMaterialRegistry;
import com.rhemery.logistica.network.SurveyNetwork;
import com.rhemery.logistica.survey.SurveyTier;
import com.rhemery.logistica.survey.SurveyToolRegistry;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.tags.TagKey;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.biome.Biome;

/**
 * Public static API meant to be called from scripts (for example KubeJS).
 */
public final class LogisticaBridge {

  private LogisticaBridge() {}

  public static void clearOreMaterials() {
    OreMaterialRegistry.clear();
  }

  public static void setKubeJsLoadingStatus(boolean visible, String text, float percentage) {
    SurveyNetwork.setKubeJsLoadingStatus(visible, text, percentage);
  }

  public static void setKubeJsLoadingStatus(boolean visible, String text, double percentage) {
    setKubeJsLoadingStatus(visible, text, (float) percentage);
  }

  public static void registerOreMaterial(
    String itemId,
    float baseChance,
    float maxSaturation,
    float noiseScale,
    float noisePower
  ) {
    registerOreMaterial(
      itemId,
      OreMaterialDefinition.defaultDisplayName(itemId),
      baseChance,
      maxSaturation,
      noiseScale,
      noisePower,
      Map.of()
    );
  }

  public static void registerOreMaterial(
    String itemId,
    float baseChance,
    float maxSaturation,
    float noiseScale,
    float noisePower,
    Map<String, Float> biomeTagBias
  ) {
    registerOreMaterial(
      itemId,
      OreMaterialDefinition.defaultDisplayName(itemId),
      baseChance,
      maxSaturation,
      noiseScale,
      noisePower,
      biomeTagBias
    );
  }

  public static void registerOreMaterial(
    String itemId,
    String displayName,
    float baseChance,
    float maxSaturation,
    float noiseScale,
    float noisePower
  ) {
    registerOreMaterial(
      itemId,
      displayName,
      baseChance,
      maxSaturation,
      noiseScale,
      noisePower,
      Map.of()
    );
  }

  public static void registerOreMaterial(
    String itemId,
    String displayName,
    float baseChance,
    float maxSaturation,
    float noiseScale,
    float noisePower,
    Map<String, Float> biomeTagBias
  ) {
    ResourceLocation outputItemId = ResourceLocation.parse(itemId);
    Map<TagKey<Biome>, Float> modifiers = new LinkedHashMap<>();
    biomeTagBias.forEach((tagId, value) ->
      modifiers.put(TagKey.create(Registries.BIOME, ResourceLocation.parse(tagId)), value)
    );

    // Material identity is intentionally the output item id.
    OreMaterialRegistry.register(
      new OreMaterialDefinition(
        outputItemId,
        displayName,
        outputItemId,
        baseChance,
        maxSaturation,
        noiseScale,
        noisePower,
        modifiers
      )
    );
  }

  public static void unregisterOreMaterial(String itemId) {
    OreMaterialRegistry.unregister(ResourceLocation.parse(itemId));
  }

  public static List<String> getOreMaterials() {
    List<String> list = OreDataService.allMaterialIds()
      .stream()
      .map(ResourceLocation::toString)
      .toList();
    if (list.isEmpty()) {
      throw new IllegalStateException("No materials registered");
    }
    return list;
  }

  public static OreMaterialDefinition getOreMaterial(String itemId) {
    return OreMaterialRegistry.get(Utils.getResourceLocation(itemId));
  }

  public static String getOreMaterialDisplayName(String itemId) {
    return getOreMaterial(itemId).displayName();
  }

  public static String getOreMaterialItemId(String itemId) {
    String resolvedItemId = getOreMaterial(itemId).itemId().toString();
    if (resolvedItemId == null) {
      throw new IllegalStateException("Material " + itemId + " has no item id");
    }
    return resolvedItemId;
  }

  public static Map<String, Map<String, String>> getOreMaterialCatalog() {
    Map<String, Map<String, String>> catalog = new LinkedHashMap<>();
    OreMaterialRegistry.all().forEach(definition -> {
      Map<String, String> row = new LinkedHashMap<>();
      row.put("displayName", definition.displayName());
      row.put("itemId", definition.itemId().toString());
      catalog.put(definition.id().toString(), row);
    });
    return catalog;
  }

  public static void clearSurveyTiers() {
    SurveyToolRegistry.clearTiers();
  }

  public static void defineSurveyTier(String tierId, int radius, Collection<String> materialIds) {
    Set<ResourceLocation> materials = materialIds
      .stream()
      .map(ResourceLocation::parse)
      .filter(Objects::nonNull)
      .collect(Collectors.toSet());

    SurveyToolRegistry.registerTier(new SurveyTier(tierId, radius, materials));
  }

  public static void defineSurveyTier(String tierId, int radius, String... materialIds) {
    defineSurveyTier(tierId, radius, List.of(materialIds));
  }

  public static void defineSurveyTierCsv(String tierId, int radius, String materialIdsCsv) {
    List<String> materialIds = Arrays.stream(materialIdsCsv.split(","))
      .map(String::trim)
      .filter(id -> !id.isEmpty())
      .toList();
    defineSurveyTier(tierId, radius, materialIds);
  }

  public static void clearSurveyTools() {
    SurveyToolRegistry.clearTools();
  }

  public static void registerSurveyTool(String itemId, String tierId) {
    SurveyToolRegistry.registerTool(ResourceLocation.parse(itemId), tierId);
  }

  public static void unregisterSurveyTool(String itemId) {
    SurveyToolRegistry.unregisterTool(ResourceLocation.parse(itemId));
  }

  public static Map<String, Float> getChunkOres(ServerLevel level, int chunkX, int chunkZ) {
    OreChunkData data = OreDataService.getChunkData(level, chunkX, chunkZ);
    Map<String, Float> result = new LinkedHashMap<>();
    data.saturations().forEach((id, saturation) -> result.put(id.toString(), saturation));
    return result;
  }

  public static float getChunkOreSaturation(
    ServerLevel level,
    int chunkX,
    int chunkZ,
    String materialId
  ) {
    return OreDataService.getSaturation(
      level,
      new ChunkPos(chunkX, chunkZ),
      ResourceLocation.parse(materialId)
    );
  }
}
