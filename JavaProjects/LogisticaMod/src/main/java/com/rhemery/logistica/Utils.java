package com.rhemery.logistica;

import javax.annotation.Nonnull;
import net.minecraft.resources.ResourceLocation;

public class Utils {

  public static ResourceLocation getResourceLocation(@Nonnull String id) {
    return ResourceLocation.parse(id);
  }
}
