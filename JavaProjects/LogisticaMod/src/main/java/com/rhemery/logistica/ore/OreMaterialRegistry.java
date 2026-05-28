package com.rhemery.logistica.ore;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import net.minecraft.resources.ResourceLocation;

public final class OreMaterialRegistry {

  private static final Map<ResourceLocation, OreMaterialDefinition> MATERIALS =
    new LinkedHashMap<>();

  private OreMaterialRegistry() {}

  public static synchronized void register(OreMaterialDefinition definition) {
    MATERIALS.put(definition.id(), definition);
  }

  public static synchronized void clear() {
    MATERIALS.clear();
  }

  public static synchronized void unregister(ResourceLocation id) {
    MATERIALS.remove(id);
  }

  public static synchronized OreMaterialDefinition get(ResourceLocation id) {
    return MATERIALS.get(id);
  }

  public static synchronized Collection<OreMaterialDefinition> all() {
    return Collections.unmodifiableCollection(MATERIALS.values());
  }

  public static synchronized Map<ResourceLocation, OreMaterialDefinition> asMap() {
    return Collections.unmodifiableMap(MATERIALS);
  }
}
