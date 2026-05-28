package com.rhemery.logistica.loading;

import net.minecraft.util.Mth;

public final class KubeJsLoadingStatusState {
  private static volatile boolean visible = false;
  private static volatile String text = "";
  private static volatile float percentage = 0.0F;

  private KubeJsLoadingStatusState() {}

  public static void set(boolean visibleState, String textState, float percentageState) {
    visible = visibleState;
    text = textState == null ? "" : textState;
    percentage = Mth.clamp(percentageState, 0.0F, 1.0F);
  }

  public static Snapshot snapshot() {
    return new Snapshot(visible, text, percentage);
  }

  public static void clear() {
    set(false, "", 0.0F);
  }

  public record Snapshot(boolean visible, String text, float percentage) {}
}
