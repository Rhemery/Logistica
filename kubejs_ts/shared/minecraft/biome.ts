import { $MinecraftServer } from "@package/net/minecraft/server";

export function biomeMatchesKeywords(
  biomeId: string,
  includeKeywords: string[],
  excludeKeywords: string[],
): boolean {
  const loweredBiome = biomeId.toLowerCase();

  if (includeKeywords.length > 0) {
    let includeMatch = false;
    for (const keyword of includeKeywords) {
      if (loweredBiome.includes(keyword)) {
        includeMatch = true;
        break;
      }
    }
    if (!includeMatch) return false;
  }

  for (const keyword of excludeKeywords) {
    if (loweredBiome.includes(keyword)) {
      return false;
    }
  }

  return true;
}

export function resolveBiomeIdAtChunk(
  server: $MinecraftServer,
  dimension: string,
  chunkX: number,
  chunkZ: number,
): string {
  const level = server.getLevel(dimension);

  const sampleX = chunkX * 16 + 8;
  const sampleZ = chunkZ * 16 + 8;
  const sampleY = 64;
  const block = level.getBlock(sampleX, sampleY, sampleZ);

  return String(block.getBiomeId());
}
