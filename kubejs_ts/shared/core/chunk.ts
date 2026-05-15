import { $MinecraftServer } from "net.minecraft.server.MinecraftServer";

export function chunkKey(
  dimension: string,
  chunkX: number,
  chunkZ: number,
): string {
  return `${dimension}|${chunkX}|${chunkZ}`;
}

export function toChunkCoord(blockCoord: number): number {
  return Math.floor(blockCoord / 16);
}

export function normalizeChunkKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveBiomeIdAtChunk(
  server: $MinecraftServer,
  dimension: string,
  chunkX: number,
  chunkZ: number,
): string {
  const level = server.getLevel(dimension);
  if (!level) return "minecraft:unknown";

  const sampleX = chunkX * 16 + 8;
  const sampleZ = chunkZ * 16 + 8;
  const sampleY = 64;
  const block = level.getBlock(sampleX, sampleY, sampleZ);

  if (!block) return "minecraft:unknown";
  return String(block.getBiomeId());
}
