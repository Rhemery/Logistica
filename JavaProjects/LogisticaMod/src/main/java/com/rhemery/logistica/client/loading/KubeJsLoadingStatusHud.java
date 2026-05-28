package com.rhemery.logistica.client.loading;

import com.rhemery.logistica.loading.KubeJsLoadingStatusState;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.neoforged.neoforge.client.event.ClientPlayerNetworkEvent;
import net.neoforged.neoforge.client.event.ScreenEvent;
import net.neoforged.neoforge.client.event.RenderGuiEvent;

public final class KubeJsLoadingStatusHud {
  private KubeJsLoadingStatusHud() {}

  public static void onPlayerLoggingOut(ClientPlayerNetworkEvent.LoggingOut event) {
    KubeJsLoadingStatusState.clear();
  }

  public static void onRenderGui(RenderGuiEvent.Post event) {
    draw(event.getGuiGraphics());
  }

  public static void onRenderScreen(ScreenEvent.Render.Post event) {
    Minecraft minecraft = Minecraft.getInstance();
    if (minecraft.player != null) return;
    draw(event.getGuiGraphics());
  }

  private static void draw(GuiGraphics graphics) {
    KubeJsLoadingStatusState.Snapshot snapshot = KubeJsLoadingStatusState.snapshot();
    if (!snapshot.visible()) return;

    Minecraft minecraft = Minecraft.getInstance();
    if (minecraft.font == null) return;
    String shownText = snapshot.text().isBlank() ? "Loading..." : snapshot.text();
    String percentText = Math.round(snapshot.percentage() * 100.0F) + "%";

    int screenWidth = graphics.guiWidth();
    int boxWidth = Math.max(220, minecraft.font.width(shownText) + 40);
    int boxHeight = 34;
    int boxX = (screenWidth - boxWidth) / 2;
    int boxY = 8;

    int barX = boxX + 10;
    int barY = boxY + 20;
    int barWidth = boxWidth - 20;
    int barHeight = 8;
    int fillWidth = Math.round(barWidth * snapshot.percentage());

    graphics.fill(boxX, boxY, boxX + boxWidth, boxY + boxHeight, 0xAA000000);
    graphics.drawString(minecraft.font, shownText, boxX + 10, boxY + 6, 0xFFFFFFFF, false);
    graphics.drawString(
      minecraft.font,
      percentText,
      boxX + boxWidth - minecraft.font.width(percentText) - 10,
      boxY + 6,
      0xFFD6D6D6,
      false
    );
    graphics.fill(barX, barY, barX + barWidth, barY + barHeight, 0x80383838);
    graphics.fill(barX, barY, barX + fillWidth, barY + barHeight, 0xFF4CAF50);
  }
}
