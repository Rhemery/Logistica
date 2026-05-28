package com.rhemery.logistica.network;

import com.rhemery.logistica.client.survey.ClientSurveyController;
import com.rhemery.logistica.loading.KubeJsLoadingStatusState;
import com.rhemery.logistica.ore.OreDataService;
import com.rhemery.logistica.survey.SurveySessionManager;
import com.rhemery.logistica.survey.SurveyTier;
import java.util.List;
import net.minecraft.server.MinecraftServer;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.ChunkPos;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.network.PacketDistributor;
import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;
import net.neoforged.neoforge.network.handling.IPayloadContext;
import net.neoforged.neoforge.network.registration.PayloadRegistrar;
import net.neoforged.neoforge.server.ServerLifecycleHooks;

public final class SurveyNetwork {
    private SurveyNetwork() {}

    public static void registerPayloads(RegisterPayloadHandlersEvent event) {
        PayloadRegistrar registrar = event.registrar("1");
        registrar.playToClient(OpenSurveyPayload.TYPE, OpenSurveyPayload.STREAM_CODEC, SurveyNetwork::handleOpenSurveyClient);
        registrar.playToClient(SurveyHeatmapPayload.TYPE, SurveyHeatmapPayload.STREAM_CODEC, SurveyNetwork::handleSurveyHeatmapClient);
        registrar.playToClient(KubeJsLoadingStatusPayload.TYPE, KubeJsLoadingStatusPayload.STREAM_CODEC, SurveyNetwork::handleKubeJsLoadingStatusClient);
        registrar.playToServer(RequestSurveyRefreshPayload.TYPE, RequestSurveyRefreshPayload.STREAM_CODEC, SurveyNetwork::handleRefreshServer);
        registrar.playToServer(CloseSurveyPayload.TYPE, CloseSurveyPayload.STREAM_CODEC, SurveyNetwork::handleCloseServer);
    }

    public static void onPlayerLoggedIn(PlayerEvent.PlayerLoggedInEvent event) {
        if (event.getEntity() instanceof ServerPlayer player) {
            syncKubeJsLoadingStatusTo(player);
        }
    }

    public static void setKubeJsLoadingStatus(boolean visible, String text, float percentage) {
        KubeJsLoadingStatusState.set(visible, text, percentage);
        broadcastKubeJsLoadingStatus();
    }

    public static void syncKubeJsLoadingStatusTo(ServerPlayer player) {
        KubeJsLoadingStatusState.Snapshot snapshot = KubeJsLoadingStatusState.snapshot();
        PacketDistributor.sendToPlayer(
            player,
            new KubeJsLoadingStatusPayload(
                snapshot.visible(),
                snapshot.text(),
                snapshot.percentage()
            )
        );
    }

    private static void broadcastKubeJsLoadingStatus() {
        MinecraftServer server = ServerLifecycleHooks.getCurrentServer();
        if (server == null) return;

        KubeJsLoadingStatusState.Snapshot snapshot = KubeJsLoadingStatusState.snapshot();
        KubeJsLoadingStatusPayload payload = new KubeJsLoadingStatusPayload(
            snapshot.visible(),
            snapshot.text(),
            snapshot.percentage()
        );

        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            PacketDistributor.sendToPlayer(player, payload);
        }
    }

    public static void openSurvey(ServerPlayer player, SurveyTier tier) {
        if (tier.scannableMaterials().isEmpty()) {
            return;
        }

        SurveySessionManager.Session session = SurveySessionManager.open(player, tier);
        List<ResourceLocation> materials = tier.scannableMaterials().stream().sorted().toList();
        ChunkPos center = player.chunkPosition();

        PacketDistributor.sendToPlayer(player, new OpenSurveyPayload(
                session.nonce(),
                tier.id(),
                tier.radius(),
                materials,
                session.selectedMaterial(),
                center.x,
                center.z));
        sendHeatmap(player, session, session.selectedMaterial(), center);
    }

    private static void sendHeatmap(ServerPlayer player, SurveySessionManager.Session session, ResourceLocation materialId, ChunkPos center) {
        float[] saturation = OreDataService.sampleSquare(player.serverLevel(), center, session.tier().radius(), materialId);
        PacketDistributor.sendToPlayer(player, new SurveyHeatmapPayload(
                session.nonce(),
                materialId,
                session.tier().radius(),
                center.x,
                center.z,
                saturation));
    }

    private static void handleRefreshServer(RequestSurveyRefreshPayload payload, IPayloadContext context) {
        context.enqueueWork(() -> {
            if (!(context.player() instanceof ServerPlayer player)) {
                return;
            }

            SurveySessionManager.Session session = SurveySessionManager.get(player);
            if (session == null || session.nonce() != payload.nonce()) {
                return;
            }
            ResourceLocation materialId = resolveAllowedMaterial(session, payload.materialId());
            boolean changedSelection = !materialId.equals(session.selectedMaterial());
            if (!changedSelection && !SurveySessionManager.isRequestAllowed(session, player.serverLevel().getGameTime())) {
                return;
            }

            SurveySessionManager.updateSelectedMaterial(player, session, materialId);
            ChunkPos center = new ChunkPos(payload.centerChunkX(), payload.centerChunkZ());
            sendHeatmap(player, session, materialId, center);
        });
    }

    private static ResourceLocation resolveAllowedMaterial(SurveySessionManager.Session session, ResourceLocation requestedMaterial) {
        for (ResourceLocation allowed : session.tier().scannableMaterials()) {
            if (allowed.equals(requestedMaterial)) {
                return allowed;
            }
        }
        return session.selectedMaterial() != null ? session.selectedMaterial() : session.fallbackMaterial();
    }

    private static void handleCloseServer(CloseSurveyPayload payload, IPayloadContext context) {
        context.enqueueWork(() -> {
            if (!(context.player() instanceof ServerPlayer player)) {
                return;
            }
            SurveySessionManager.Session session = SurveySessionManager.get(player);
            if (session != null && session.nonce() == payload.nonce()) {
                SurveySessionManager.close(player);
            }
        });
    }

    private static void handleOpenSurveyClient(OpenSurveyPayload payload, IPayloadContext context) {
        context.enqueueWork(() -> ClientSurveyController.open(payload));
    }

    private static void handleSurveyHeatmapClient(SurveyHeatmapPayload payload, IPayloadContext context) {
        context.enqueueWork(() -> ClientSurveyController.apply(payload));
    }

    private static void handleKubeJsLoadingStatusClient(
        KubeJsLoadingStatusPayload payload,
        IPayloadContext context
    ) {
        context.enqueueWork(() ->
            KubeJsLoadingStatusState.set(payload.visible(), payload.text(), payload.percentage())
        );
    }
}
