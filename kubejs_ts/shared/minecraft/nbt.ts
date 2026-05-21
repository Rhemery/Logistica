import { $CompoundTag } from "@package/net/minecraft/nbt";
import { assignObject, validateObject } from ".";

export function loadNbt<T extends Record<string, unknown>>(
  data: $CompoundTag,
  nbtKey: string,
  toDefault: T | (() => T),
): T {
  let fallback;
  if (typeof toDefault !== "function") {
    fallback = toDefault;
  } else {
    fallback = toDefault();
  }

  if (data.contains(nbtKey)) {
    const json = data.getString(nbtKey);
    if (json) {
      try {
        const result = JSON.parse(json) as T;
        if (!validateObject(fallback, result)) assignObject(fallback, result);
        return result;
      } catch (error) {
        throw new Error(`Failed to parse runtime state JSON: ${error}`, {
          cause: error,
        });
      }
    } else {
      return fallback;
    }
  } else {
    return fallback;
  }
}

export function saveNbt(data: $CompoundTag, nbtKey: string, value: object) {
  data.putString(nbtKey, JSON.stringify(value));
}
