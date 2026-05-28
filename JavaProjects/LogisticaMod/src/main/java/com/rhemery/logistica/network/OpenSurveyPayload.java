package com.rhemery.logistica.network;

import com.rhemery.logistica.Logistica;
import java.util.ArrayList;
import java.util.List;
import javax.annotation.Nonnull;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;

public record OpenSurveyPayload(
  long nonce,
  String tierId,
  int radius,
  List<ResourceLocation> materials,
  ResourceLocation selectedMaterial,
  int centerChunkX,
  int centerChunkZ
) implements CustomPacketPayload {
  public static final Type<OpenSurveyPayload> TYPE = new Type<>(
    ResourceLocation.fromNamespaceAndPath(Logistica.MODID, "open_survey")
  );

  public static final StreamCodec<RegistryFriendlyByteBuf, OpenSurveyPayload> STREAM_CODEC =
    new StreamCodec<>() {
      @Override
      public OpenSurveyPayload decode(@Nonnull RegistryFriendlyByteBuf buf) {
        long nonce = buf.readLong();
        String tierId = buf.readUtf(64);
        int radius = buf.readVarInt();
        int materialCount = buf.readVarInt();
        List<ResourceLocation> materials = new ArrayList<>(materialCount);
        for (int i = 0; i < materialCount; i++) {
          materials.add(buf.readResourceLocation());
        }
        ResourceLocation selectedMaterial = buf.readResourceLocation();
        int centerChunkX = buf.readVarInt();
        int centerChunkZ = buf.readVarInt();
        return new OpenSurveyPayload(
          nonce,
          tierId,
          radius,
          materials,
          selectedMaterial,
          centerChunkX,
          centerChunkZ
        );
      }

      @Override
      public void encode(@Nonnull RegistryFriendlyByteBuf buf, @Nonnull OpenSurveyPayload payload) {
        buf.writeLong(payload.nonce);
        buf.writeUtf(payload.tierId, 64);
        buf.writeVarInt(payload.radius);
        buf.writeVarInt(payload.materials.size());
        for (ResourceLocation material : payload.materials) {
          buf.writeResourceLocation(material);
        }
        buf.writeResourceLocation(payload.selectedMaterial);
        buf.writeVarInt(payload.centerChunkX);
        buf.writeVarInt(payload.centerChunkZ);
      }
    };

  @Override
  public Type<OpenSurveyPayload> type() {
    return TYPE;
  }
}
