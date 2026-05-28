package com.rhemery.logistica.client.survey;

import com.mojang.blaze3d.platform.InputConstants;
import com.rhemery.logistica.network.OpenSurveyPayload;
import com.rhemery.logistica.network.SurveyHeatmapPayload;
import java.util.Arrays;
import java.util.List;
import javax.annotation.Nonnull;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.util.Mth;
import net.minecraft.world.level.ChunkPos;

public final class SurveyScreen extends Screen {

  private static final int PANEL_MARGIN = 14;
  private static final int LIST_WIDTH = 150;
  private static final int LIST_ENTRY_HEIGHT = 14;
  private static final int LIST_HEADER_HEIGHT = 18;
  private static final int REQUEST_INTERVAL_TICKS = 4;

  private final long nonce;
  private final String tierId;
  private final int radius;
  private final int sideLength;
  private final List<ResourceLocation> materials;

  private ResourceLocation selectedMaterial;
  private int selectedIndex;
  private int scrollOffset;
  private int currentChunkX;
  private int currentChunkZ;

  private final float[] targetValues;
  private final float[] displayValues;
  private long lastRequestTick = Long.MIN_VALUE;

  public SurveyScreen(OpenSurveyPayload payload) {
    super(Component.literal("Survey Tool"));
    this.nonce = payload.nonce();
    this.tierId = payload.tierId();
    this.radius = payload.radius();
    this.sideLength = radius * 2 + 1;
    this.materials = List.copyOf(payload.materials());
    this.selectedMaterial = payload.selectedMaterial();
    this.selectedIndex = Math.max(0, this.materials.indexOf(this.selectedMaterial));
    if (this.selectedIndex >= 0 && this.selectedIndex < this.materials.size()) {
      this.selectedMaterial = this.materials.get(this.selectedIndex);
    }
    this.currentChunkX = payload.centerChunkX();
    this.currentChunkZ = payload.centerChunkZ();

    this.targetValues = new float[sideLength * sideLength];
    this.displayValues = new float[sideLength * sideLength];
  }

  public void apply(SurveyHeatmapPayload payload) {
    if (payload.nonce() != nonce) {
      return;
    }
    if (!payload.materialId().equals(selectedMaterial)) {
      return;
    }
    if (payload.radius() != radius || payload.saturations().length != targetValues.length) {
      return;
    }
    currentChunkX = payload.centerChunkX();
    currentChunkZ = payload.centerChunkZ();
    System.arraycopy(payload.saturations(), 0, targetValues, 0, targetValues.length);
  }

  @Override
  protected void init() {
    requestRefresh(true);
  }

  @Override
  public void tick() {
    Minecraft minecraft = this.minecraft;
    if (minecraft == null || minecraft.player == null) {
      return;
    }

    syncMovementKeys(minecraft);
    LocalPlayer player = minecraft.player;
    if (player == null) return;

    ChunkPos playerChunk = player.chunkPosition();
    boolean movedChunk = playerChunk.x != currentChunkX || playerChunk.z != currentChunkZ;
    long gameTick = minecraft.level != null ? minecraft.level.getGameTime() : 0L;
    if (movedChunk || gameTick - lastRequestTick >= REQUEST_INTERVAL_TICKS) {
      currentChunkX = playerChunk.x;
      currentChunkZ = playerChunk.z;
      requestRefresh(false);
      lastRequestTick = gameTick;
    }
  }

  private void requestRefresh(boolean force) {
    if (materials.isEmpty() || selectedMaterial == null) return;

    if (!force && minecraft != null && this.minecraft.level != null) {
      long gameTick = this.minecraft.level.getGameTime();
      if (gameTick - lastRequestTick < REQUEST_INTERVAL_TICKS) {
        return;
      }
    }

    ClientSurveyController.requestRefresh(
      nonce,
      selectedMaterial,
      currentChunkX,
      currentChunkZ,
      radius
    );
  }

  @Override
  public boolean mouseClicked(double mouseX, double mouseY, int button) {
    if (button == 0 && trySelectMaterial(mouseX, mouseY)) {
      requestRefresh(true);
      return true;
    }
    return super.mouseClicked(mouseX, mouseY, button);
  }

  @Override
  public boolean mouseScrolled(double mouseX, double mouseY, double scrollX, double scrollY) {
    int panelX = width - LIST_WIDTH - PANEL_MARGIN;
    int panelY = PANEL_MARGIN;
    int panelHeight = height - PANEL_MARGIN * 2;
    if (
      mouseX < panelX ||
      mouseX > panelX + LIST_WIDTH ||
      mouseY < panelY ||
      mouseY > panelY + panelHeight
    ) {
      return super.mouseScrolled(mouseX, mouseY, scrollX, scrollY);
    }

    int visibleEntries = Math.max(1, (panelHeight - LIST_HEADER_HEIGHT - 8) / LIST_ENTRY_HEIGHT);
    int maxOffset = Math.max(0, materials.size() - visibleEntries);
    if (scrollY < 0) {
      scrollOffset = Math.min(maxOffset, scrollOffset + 1);
    } else if (scrollY > 0) {
      scrollOffset = Math.max(0, scrollOffset - 1);
    }
    return true;
  }

  private boolean trySelectMaterial(double mouseX, double mouseY) {
    int panelX = width - LIST_WIDTH - PANEL_MARGIN;
    int panelY = PANEL_MARGIN;
    int contentY = panelY + LIST_HEADER_HEIGHT + 4;
    int panelHeight = height - PANEL_MARGIN * 2;
    int visibleEntries = Math.max(1, (panelHeight - LIST_HEADER_HEIGHT - 8) / LIST_ENTRY_HEIGHT);

    if (mouseX < panelX || mouseX > panelX + LIST_WIDTH || mouseY < contentY) {
      return false;
    }

    int relativeY = (int) mouseY - contentY;
    int row = relativeY / LIST_ENTRY_HEIGHT;
    if (row < 0 || row >= visibleEntries) {
      return false;
    }

    int materialIndex = scrollOffset + row;
    if (materialIndex < 0 || materialIndex >= materials.size()) {
      return false;
    }

    if (materialIndex == selectedIndex) {
      return true;
    }

    selectedIndex = materialIndex;
    selectedMaterial = materials.get(materialIndex);
    Arrays.fill(targetValues, 0.0F);
    Arrays.fill(displayValues, 0.0F);
    lastRequestTick = Long.MIN_VALUE;
    return true;
  }

  @Override
  public void render(@Nonnull GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
    graphics.fill(0, 0, width, height, 0x66101010);

    int heatmapLeft = PANEL_MARGIN;
    int heatmapTop = PANEL_MARGIN + 14;
    int heatmapRight = width - LIST_WIDTH - PANEL_MARGIN * 2;
    int heatmapSize = Math.max(
      48,
      Math.min(heatmapRight - heatmapLeft, height - heatmapTop - PANEL_MARGIN)
    );
    drawHeatmap(graphics, heatmapLeft, heatmapTop, heatmapSize);
    drawMaterialList(graphics, mouseX, mouseY);
    drawHeader(graphics, heatmapLeft, heatmapTop);
  }

  private void drawHeader(GuiGraphics graphics, int heatmapLeft, int heatmapTop) {
    if (selectedMaterial != null) {
      String selectedName = selectedMaterial.getNamespace().equals("logistica")
        ? selectedMaterial.getPath()
        : selectedMaterial.toString();
      graphics.drawString(
        font,
        Component.literal("Tier: " + tierId + "  Radius: " + radius),
        heatmapLeft,
        heatmapTop - 12,
        0xFFFFFFFF
      );
      graphics.drawString(
        font,
        Component.literal("Material: " + selectedName),
        heatmapLeft,
        heatmapTop - 2,
        0xFFE2E2E2
      );
    }
  }

  private void drawHeatmap(GuiGraphics graphics, int x, int y, int size) {
    graphics.fill(x - 2, y - 2, x + size + 2, y + size + 2, 0xCC202020);

    float cell = size / (float) sideLength;
    for (int row = 0; row < sideLength; row++) {
      for (int col = 0; col < sideLength; col++) {
        int index = row * sideLength + col;
        displayValues[index] += (targetValues[index] - displayValues[index]) * 0.20F;
        int color = heatColor(displayValues[index]);

        int cellMinX = x + (int) (col * cell);
        int cellMinY = y + (int) (row * cell);
        int cellMaxX = x + (int) ((col + 1) * cell);
        int cellMaxY = y + (int) ((row + 1) * cell);
        graphics.fill(cellMinX, cellMinY, cellMaxX, cellMaxY, color);
      }
    }

    int center = radius;
    int centerMinX = x + (int) (center * cell);
    int centerMinY = y + (int) (center * cell);
    int centerMaxX = x + (int) ((center + 1) * cell);
    int centerMaxY = y + (int) ((center + 1) * cell);
    graphics.fill(centerMinX, centerMinY, centerMaxX, centerMinY + 1, 0xFFFFFFFF);
    graphics.fill(centerMinX, centerMaxY - 1, centerMaxX, centerMaxY, 0xFFFFFFFF);
    graphics.fill(centerMinX, centerMinY, centerMinX + 1, centerMaxY, 0xFFFFFFFF);
    graphics.fill(centerMaxX - 1, centerMinY, centerMaxX, centerMaxY, 0xFFFFFFFF);
  }

  private void drawMaterialList(GuiGraphics graphics, int mouseX, int mouseY) {
    int panelX = width - LIST_WIDTH - PANEL_MARGIN;
    int panelY = PANEL_MARGIN;
    int panelHeight = height - PANEL_MARGIN * 2;

    graphics.fill(panelX, panelY, panelX + LIST_WIDTH, panelY + panelHeight, 0xB2171717);
    graphics.drawString(
      font,
      Component.literal("Scannable Materials"),
      panelX + 6,
      panelY + 5,
      0xFFFFFFFF
    );

    int visibleEntries = Math.max(1, (panelHeight - LIST_HEADER_HEIGHT - 8) / LIST_ENTRY_HEIGHT);
    int contentY = panelY + LIST_HEADER_HEIGHT + 4;
    for (int row = 0; row < visibleEntries; row++) {
      int index = scrollOffset + row;
      if (index >= materials.size()) {
        break;
      }

      int y = contentY + row * LIST_ENTRY_HEIGHT;
      int entryBottom = y + LIST_ENTRY_HEIGHT - 1;
      boolean selected = index == selectedIndex;
      boolean hovered =
        mouseX >= panelX && mouseX <= panelX + LIST_WIDTH && mouseY >= y && mouseY <= entryBottom;

      int background = selected ? 0xCC34515E : hovered ? 0x88404040 : 0x00000000;
      if (background != 0) {
        graphics.fill(panelX + 2, y, panelX + LIST_WIDTH - 2, entryBottom, background);
      }

      ResourceLocation material = materials.get(index);
      String shortName = material.getNamespace().equals("logistica")
        ? material.getPath()
        : material.toString();
      graphics.drawString(font, shortName, panelX + 6, y + 3, selected ? 0xFFFFFFFF : 0xFFDADADA);
    }
  }

  private int heatColor(float saturation) {
    float clamped = Mth.clamp(saturation, 0.0F, 1.0F);
    float r;
    float g;
    float b;
    if (clamped < 0.5F) {
      float t = clamped / 0.5F;
      r = 0.0F;
      g = t;
      b = 1.0F - t * 0.6F;
    } else {
      float t = (clamped - 0.5F) / 0.5F;
      r = t;
      g = 1.0F - t * 0.35F;
      b = 0.4F - t * 0.4F;
    }

    int ri = (int) (Mth.clamp(r, 0.0F, 1.0F) * 255.0F);
    int gi = (int) (Mth.clamp(g, 0.0F, 1.0F) * 255.0F);
    int bi = (int) (Mth.clamp(b, 0.0F, 1.0F) * 255.0F);
    return 0xFF000000 | (ri << 16) | (gi << 8) | bi;
  }

  private static void syncMovementKeys(Minecraft minecraft) {
    long window = minecraft.getWindow().getWindow();
    syncKey(minecraft.options.keyUp, window);
    syncKey(minecraft.options.keyDown, window);
    syncKey(minecraft.options.keyLeft, window);
    syncKey(minecraft.options.keyRight, window);
    syncKey(minecraft.options.keyJump, window);
    syncKey(minecraft.options.keyShift, window);
    syncKey(minecraft.options.keySprint, window);
  }

  private static void syncKey(KeyMapping keyMapping, long window) {
    keyMapping.setDown(InputConstants.isKeyDown(window, keyMapping.getKey().getValue()));
  }

  private static void releaseMovementKeys(Minecraft minecraft) {
    minecraft.options.keyUp.setDown(false);
    minecraft.options.keyDown.setDown(false);
    minecraft.options.keyLeft.setDown(false);
    minecraft.options.keyRight.setDown(false);
    minecraft.options.keyJump.setDown(false);
    minecraft.options.keyShift.setDown(false);
    minecraft.options.keySprint.setDown(false);
  }

  @Override
  public boolean isPauseScreen() {
    return false;
  }

  @Override
  public void onClose() {
    ClientSurveyController.close(nonce);
    if (minecraft != null) {
      releaseMovementKeys(minecraft);
    }
    super.onClose();
  }
}
