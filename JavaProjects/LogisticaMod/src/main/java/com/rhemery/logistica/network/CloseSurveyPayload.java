package com.rhemery.logistica.network;

import com.rhemery.logistica.Logistica;
import javax.annotation.Nonnull;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;

public record CloseSurveyPayload(long nonce) implements CustomPacketPayload {
  public static final Type<CloseSurveyPayload> TYPE = new Type<>(
    ResourceLocation.fromNamespaceAndPath(Logistica.MODID, "close_survey")
  );

  public static final StreamCodec<RegistryFriendlyByteBuf, CloseSurveyPayload> STREAM_CODEC =
    new StreamCodec<>() {
      @Override
      public CloseSurveyPayload decode(@Nonnull RegistryFriendlyByteBuf buf) {
        return new CloseSurveyPayload(buf.readLong());
      }

      @Override
      public void encode(
        @Nonnull RegistryFriendlyByteBuf buf,
        @Nonnull CloseSurveyPayload payload
      ) {
        buf.writeLong(payload.nonce);
      }
    };

  @Override
  public Type<CloseSurveyPayload> type() {
    return TYPE;
  }
}
