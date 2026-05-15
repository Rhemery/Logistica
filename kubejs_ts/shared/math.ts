export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function toPlainNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const sanitized = value.trim().replace(/[dDfFlLsSbB]$/, "");
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function randomInt(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

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

export function sampleValueNoise2D(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;

  const tx = x - x0;
  const tz = z - z0;
  const sx = smoothstep(tx);
  const sz = smoothstep(tz);

  const n00 = hashToUnitFloat(hashCoords32(x0, z0, seed));
  const n10 = hashToUnitFloat(hashCoords32(x1, z0, seed));
  const n01 = hashToUnitFloat(hashCoords32(x0, z1, seed));
  const n11 = hashToUnitFloat(hashCoords32(x1, z1, seed));

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sz) * 2 - 1;
}

export function sampleFractalNoise2D(
  x: number,
  z: number,
  seed: number,
  octaves: number,
  baseFrequency: number,
): number {
  let value = 0;
  let amplitude = 1;
  let maxAmplitude = 0;
  let frequency = baseFrequency;

  for (let octave = 0; octave < octaves; octave++) {
    const octaveSeed = (seed + octave * 1013) >>> 0;
    value +=
      sampleValueNoise2D(x * frequency, z * frequency, octaveSeed) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  if (maxAmplitude <= 0) return 0;
  return value / maxAmplitude;
}

export function sampleNormalizedNoise(
  x: number,
  z: number,
  seed: number,
  scale: number,
): number {
  const noise = sampleFractalNoise2D(x, z, seed, 4, scale);
  return clamp((noise + 1) * 0.5, 0, 1);
}

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
