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
  if (isNaN(parsed)) return fallback;
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

export function normalizePositiveNumber(
  value: number | null | undefined,
  fallback: number,
): number {
  if (value == null) return fallback;
  if (value == undefined) return fallback;
  if (!Number.isFinite(value)) return fallback;
  if (value <= 0) return fallback;

  return value;
}

export function lengthdir(
  x: number,
  y: number,
  length: number,
  direction: number,
): [x: number, y: number] {
  return [
    x + Math.cos((direction * Math.PI) / 180) * length,
    y + Math.sin((direction * Math.PI) / 180) * length,
  ];
}
