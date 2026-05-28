import { hashCoords32, hashToUnitFloat } from "./hashing";
import { clamp, lerp, smoothstep } from "./math";

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

export function getNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && isFinite(value)) {
    return value;
  }

  return fallback;
}
