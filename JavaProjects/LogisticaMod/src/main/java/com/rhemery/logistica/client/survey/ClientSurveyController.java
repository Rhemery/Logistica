package com.rhemery.logistica.client.survey;

import com.rhemery.logistica.network.CloseSurveyPayload;
import com.rhemery.logistica.network.OpenSurveyPayload;
import com.rhemery.logistica.network.RequestSurveyRefreshPayload;
import com.rhemery.logistica.network.SurveyHeatmapPayload;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.ResourceLocation;
import net.neoforged.neoforge.network.PacketDistributor;

public final class ClientSurveyController {
    private ClientSurveyController() {}

    public static void open(OpenSurveyPayload payload) {
        Minecraft minecraft = Minecraft.getInstance();
        minecraft.setScreen(new SurveyScreen(payload));
    }

    public static void apply(SurveyHeatmapPayload payload) {
        Minecraft minecraft = Minecraft.getInstance();
        if (minecraft.screen instanceof SurveyScreen surveyScreen) {
            surveyScreen.apply(payload);
        }
    }

    public static void requestRefresh(long nonce, ResourceLocation materialId, int centerChunkX, int centerChunkZ, int radius) {
        PacketDistributor.sendToServer(new RequestSurveyRefreshPayload(nonce, materialId, centerChunkX, centerChunkZ, radius));
    }

    public static void close(long nonce) {
        PacketDistributor.sendToServer(new CloseSurveyPayload(nonce));
    }
}
