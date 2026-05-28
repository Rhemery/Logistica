export function hashString32(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

export function hashCoords32(x: number, z: number, seed: number): number {
  const xi = x | 0;
  const zi = z | 0;
  let hash = seed >>> 0;
  hash = Math.imul(hash ^ xi, 374761393);
  hash = Math.imul(hash ^ zi, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return hash >>> 0;
}

export function hashToUnitFloat(hash: number): number {
  return (hash >>> 0) / 4294967295;
}
