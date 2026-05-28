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
