package com.rhemery.logistica.ore;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.ChunkPos;

public final class OreDataService {
    private OreDataService() {}

    public static OreChunkData getChunkData(ServerLevel level, ChunkPos chunkPos) {
        return OreChunkSavedData.get(level).getOrCreate(level, chunkPos);
    }

    public static OreChunkData getChunkData(ServerLevel level, int chunkX, int chunkZ) {
        return getChunkData(level, new ChunkPos(chunkX, chunkZ));
    }

    public static Map<ResourceLocation, Float> getChunkSaturations(ServerLevel level, ChunkPos chunkPos) {
        return getChunkData(level, chunkPos).saturations();
    }

    public static float getSaturation(ServerLevel level, ChunkPos chunkPos, ResourceLocation materialId) {
        return getChunkData(level, chunkPos).saturation(materialId);
    }

    public static float[] sampleSquare(ServerLevel level, ChunkPos center, int radius, ResourceLocation materialId) {
        int size = radius * 2 + 1;
        float[] values = new float[size * size];
        int index = 0;
        for (int z = -radius; z <= radius; z++) {
            for (int x = -radius; x <= radius; x++) {
                ChunkPos samplePos = new ChunkPos(center.x + x, center.z + z);
                values[index++] = getSaturation(level, samplePos, materialId);
            }
        }
        return values;
    }

    public static List<ResourceLocation> allMaterialIds() {
        List<ResourceLocation> ids = new ArrayList<>();
        for (OreMaterialDefinition definition : OreMaterialRegistry.all()) {
            ids.add(definition.id());
        }
        return ids;
    }
}
