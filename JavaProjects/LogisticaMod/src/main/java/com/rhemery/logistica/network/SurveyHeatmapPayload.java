package com.rhemery.logistica.network;

import com.rhemery.logistica.Logistica;
import javax.annotation.Nonnull;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;

public record SurveyHeatmapPayload(
  long nonce,
  ResourceLocation materialId,
  int radius,
  int centerChunkX,
  int centerChunkZ,
  float[] saturations
) implements CustomPacketPayload {
  public static final Type<SurveyHeatmapPayload> TYPE = new Type<>(
    ResourceLocation.fromNamespaceAndPath(Logistica.MODID, "survey_heatmap")
  );

  public static final StreamCodec<RegistryFriendlyByteBuf, SurveyHeatmapPayload> STREAM_CODEC =
    new StreamCodec<>() {
      @Override
      public SurveyHeatmapPayload decode(@Nonnull RegistryFriendlyByteBuf buf) {
        long nonce = buf.readLong();
        ResourceLocation materialId = buf.readResourceLocation();
        int radius = buf.readVarInt();
        int centerChunkX = buf.readVarInt();
        int centerChunkZ = buf.readVarInt();
        int length = buf.readVarInt();
        float[] saturations = new float[length];
        for (int i = 0; i < length; i++) {
          saturations[i] = buf.readFloat();
        }
        return new SurveyHeatmapPayload(
          nonce,
          materialId,
          radius,
          centerChunkX,
          centerChunkZ,
          saturations
        );
      }

      @Override
      public void encode(
        @Nonnull RegistryFriendlyByteBuf buf,
        @Nonnull SurveyHeatmapPayload payload
      ) {
        buf.writeLong(payload.nonce);
        buf.writeResourceLocation(payload.materialId);
        buf.writeVarInt(payload.radius);
        buf.writeVarInt(payload.centerChunkX);
        buf.writeVarInt(payload.centerChunkZ);
        buf.writeVarInt(payload.saturations.length);
        for (float saturation : payload.saturations) {
          buf.writeFloat(saturation);
        }
      }
    };

  @Override
  public Type<SurveyHeatmapPayload> type() {
    return TYPE;
  }
}
