package com.rhemery.logistica.ore;

import it.unimi.dsi.fastutil.longs.Long2ObjectMap;
import it.unimi.dsi.fastutil.longs.Long2ObjectOpenHashMap;
import javax.annotation.Nonnull;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.Tag;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.saveddata.SavedData;
import org.eclipse.jdt.annotation.Nullable;

public final class OreChunkSavedData extends SavedData {

  private static final String DATA_NAME = "logistica_ore_chunk_data";
  private static final String CHUNKS_TAG = "chunks";
  private static final String CHUNK_KEY_TAG = "chunk_key";
  private static final String CHUNK_DATA_TAG = "chunk_data";

  private final Long2ObjectMap<@Nullable OreChunkData> dataByChunk = new Long2ObjectOpenHashMap<>();

  public static OreChunkSavedData get(ServerLevel level) {
    SavedData.Factory<OreChunkSavedData> factory = new SavedData.Factory<>(
      OreChunkSavedData::new,
      OreChunkSavedData::load
    );

    return level.getDataStorage().computeIfAbsent(factory, DATA_NAME);
  }

  private static OreChunkSavedData load(CompoundTag tag, HolderLookup.Provider provider) {
    OreChunkSavedData data = new OreChunkSavedData();
    ListTag list = tag.getList(CHUNKS_TAG, Tag.TAG_COMPOUND);
    for (int i = 0; i < list.size(); i++) {
      CompoundTag entry = list.getCompound(i);
      CompoundTag tag1 = entry.getCompound(CHUNK_DATA_TAG);
      long chunkKey = entry.getLong(CHUNK_KEY_TAG);
      OreChunkData chunkData = OreChunkData.fromTag(tag1);
      data.dataByChunk.put(chunkKey, chunkData);
    }
    return data;
  }

  public OreChunkData getOrCreate(ServerLevel level, ChunkPos chunkPos) {
    long key = chunkPos.toLong();
    OreChunkData existing = dataByChunk.get(key);
    if (existing != null) {
      return existing;
    }

    OreChunkData generated = OreFieldGenerator.INSTANCE.generate(level, chunkPos);
    dataByChunk.put(key, generated);
    setDirty();
    return generated;
  }

  @Override
  public CompoundTag save(@Nonnull CompoundTag tag, @Nonnull HolderLookup.Provider provider) {
    ListTag list = new ListTag();
    dataByChunk.forEach((chunkKey, chunkData) -> {
      if (chunkData == null) return;

      CompoundTag tag1 = chunkData.toTag();
      if (tag1.isEmpty()) return;

      CompoundTag entry = new CompoundTag();
      entry.putLong(CHUNK_KEY_TAG, chunkKey);
      entry.put(CHUNK_DATA_TAG, tag1);
      list.add(entry);
    });
    tag.put(CHUNKS_TAG, list);
    return tag;
  }
}
