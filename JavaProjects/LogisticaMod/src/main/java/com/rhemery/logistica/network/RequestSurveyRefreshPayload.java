package com.rhemery.logistica.network;

import com.rhemery.logistica.Logistica;
import javax.annotation.Nonnull;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;

public record RequestSurveyRefreshPayload(
  long nonce,
  ResourceLocation materialId,
  int centerChunkX,
  int centerChunkZ,
  int radius
) implements CustomPacketPayload {
  public static final Type<RequestSurveyRefreshPayload> TYPE = new Type<>(
    ResourceLocation.fromNamespaceAndPath(Logistica.MODID, "request_survey_refresh")
  );

  public static final StreamCodec<
    RegistryFriendlyByteBuf,
    RequestSurveyRefreshPayload
  > STREAM_CODEC = new StreamCodec<>() {
    @Override
    public RequestSurveyRefreshPayload decode(@Nonnull RegistryFriendlyByteBuf buf) {
      long nonce = buf.readLong();
      ResourceLocation materialId = buf.readResourceLocation();
      int centerChunkX = buf.readVarInt();
      int centerChunkZ = buf.readVarInt();
      int radius = buf.readVarInt();
      return new RequestSurveyRefreshPayload(nonce, materialId, centerChunkX, centerChunkZ, radius);
    }

    @Override
    public void encode(
      @Nonnull RegistryFriendlyByteBuf buf,
      @Nonnull RequestSurveyRefreshPayload payload
    ) {
      buf.writeLong(payload.nonce);
      buf.writeResourceLocation(payload.materialId);
      buf.writeVarInt(payload.centerChunkX);
      buf.writeVarInt(payload.centerChunkZ);
      buf.writeVarInt(payload.radius);
    }
  };

  @Override
  public Type<RequestSurveyRefreshPayload> type() {
    return TYPE;
  }
}
