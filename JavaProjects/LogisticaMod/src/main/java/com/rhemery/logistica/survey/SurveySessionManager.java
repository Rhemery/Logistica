package com.rhemery.logistica.survey;

import com.rhemery.logistica.Logistica;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import javax.annotation.Nullable;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;

@EventBusSubscriber(modid = Logistica.MODID)
public final class SurveySessionManager {

  private static final Map<UUID, Session> SESSIONS = new ConcurrentHashMap<>();
  private static final Map<UUID, Map<String, ResourceLocation>> LAST_SELECTED_BY_PLAYER_AND_TIER =
    new ConcurrentHashMap<>();

  private SurveySessionManager() {}

  public static Session open(ServerPlayer player, SurveyTier tier) {
    UUID uuid = player.getUUID();
    if (uuid == null) {
      throw new IllegalStateException("Player has no UUID");
    }

    ResourceLocation fallback = tier
      .scannableMaterials()
      .stream()
      .sorted()
      .findFirst()
      .orElseThrow(() -> new IllegalStateException("Survey tier has no materials: " + tier.id()));

    ResourceLocation preferred = getRememberedMaterial(player, tier.id());
    ResourceLocation selected = preferred != null ? preferred : fallback;

    Session session = new Session(makeNonce(player), tier, fallback, selected);
    SESSIONS.put(uuid, session);
    return session;
  }

  public static @Nullable Session get(ServerPlayer player) {
    return SESSIONS.get(player.getUUID());
  }

  public static void close(ServerPlayer player) {
    Session removed = SESSIONS.remove(player.getUUID());
    if (removed != null) {
      rememberMaterial(player, removed.tier().id(), removed.selectedMaterial());
    }
  }

  public static void updateSelectedMaterial(
    ServerPlayer player,
    Session session,
    ResourceLocation materialId
  ) {
    if (!session.tier().scannableMaterials().contains(materialId)) {
      return;
    }
    session.selectedMaterial = materialId;
    rememberMaterial(player, session.tier().id(), materialId);
  }

  public static boolean isRequestAllowed(Session session, long currentGameTime) {
    if (currentGameTime - session.lastRequestGameTime < 1L) {
      return false;
    }
    session.lastRequestGameTime = currentGameTime;
    return true;
  }

  private static long makeNonce(ServerPlayer player) {
    long partA = player.getUUID().getMostSignificantBits();
    long partB = player.getUUID().getLeastSignificantBits();
    long worldTime = player.serverLevel().getGameTime();
    return partA ^ Long.rotateLeft(partB, 21) ^ Long.rotateLeft(worldTime, 13);
  }

  private static ResourceLocation getRememberedMaterial(ServerPlayer player, String tierId) {
    @Nullable
    Map<String, ResourceLocation> byTier = LAST_SELECTED_BY_PLAYER_AND_TIER.get(player.getUUID());
    if (byTier == null) return null;

    return byTier.get(tierId);
  }

  private static void rememberMaterial(
    ServerPlayer player,
    String tierId,
    ResourceLocation materialId
  ) {
    UUID uuid = player.getUUID();
    if (uuid == null) {
      throw new IllegalStateException("Player has no UUID");
    }
    LAST_SELECTED_BY_PLAYER_AND_TIER.computeIfAbsent(uuid, key -> new LinkedHashMap<>()).put(
      tierId,
      materialId
    );
  }

  @SubscribeEvent
  public static void onPlayerLogout(PlayerEvent.PlayerLoggedOutEvent event) {
    if (event.getEntity() instanceof ServerPlayer player) {
      close(player);
      LAST_SELECTED_BY_PLAYER_AND_TIER.remove(player.getUUID());
    }
  }

  public static final class Session {

    private final long nonce;
    private final SurveyTier tier;
    private final ResourceLocation fallbackMaterial;
    private ResourceLocation selectedMaterial;
    private long lastRequestGameTime = Long.MIN_VALUE;

    private Session(
      long nonce,
      SurveyTier tier,
      ResourceLocation fallbackMaterial,
      ResourceLocation selectedMaterial
    ) {
      this.nonce = nonce;
      this.tier = tier;
      this.fallbackMaterial = fallbackMaterial;
      this.selectedMaterial = selectedMaterial;
    }

    public long nonce() {
      return nonce;
    }

    public SurveyTier tier() {
      return tier;
    }

    public ResourceLocation fallbackMaterial() {
      return fallbackMaterial;
    }

    public ResourceLocation selectedMaterial() {
      return selectedMaterial;
    }
  }
}
