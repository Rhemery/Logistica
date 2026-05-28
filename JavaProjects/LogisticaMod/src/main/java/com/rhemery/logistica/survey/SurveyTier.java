package com.rhemery.logistica.survey;

import java.util.LinkedHashSet;
import java.util.Set;

import net.minecraft.resources.ResourceLocation;

public record SurveyTier(String id, int radius, Set<ResourceLocation> scannableMaterials) {
  public SurveyTier {
    radius = Math.max(1, radius);
    scannableMaterials = Set.copyOf(new LinkedHashSet<>(scannableMaterials));
  }
}