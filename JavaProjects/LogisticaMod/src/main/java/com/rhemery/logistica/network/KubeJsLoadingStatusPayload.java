package com.rhemery.logistica.network;

import com.rhemery.logistica.Logistica;
import javax.annotation.Nonnull;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;

public record KubeJsLoadingStatusPayload(boolean visible, String text, float percentage)
  implements CustomPacketPayload {
  public static final Type<KubeJsLoadingStatusPayload> TYPE = new Type<>(
    ResourceLocation.fromNamespaceAndPath(Logistica.MODID, "kubejs_loading_status")
  );

  public static final StreamCodec<RegistryFriendlyByteBuf, KubeJsLoadingStatusPayload> STREAM_CODEC =
    new StreamCodec<>() {
      @Override
      public KubeJsLoadingStatusPayload decode(@Nonnull RegistryFriendlyByteBuf buf) {
        boolean visible = buf.readBoolean();
        String text = buf.readUtf(256);
        float percentage = buf.readFloat();
        return new KubeJsLoadingStatusPayload(visible, text, percentage);
      }

      @Override
      public void encode(
        @Nonnull RegistryFriendlyByteBuf buf,
        @Nonnull KubeJsLoadingStatusPayload payload
      ) {
        buf.writeBoolean(payload.visible);
        buf.writeUtf(payload.text, 256);
        buf.writeFloat(payload.percentage);
      }
    };

  @Override
  public Type<KubeJsLoadingStatusPayload> type() {
    return TYPE;
  }
}
