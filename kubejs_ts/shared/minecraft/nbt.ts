import { $CompoundTag } from "@package/net/minecraft/nbt";
import { assignObject, validateObject } from "../object";

const NBT_CHUNK_COUNT_SUFFIX = "__parts";
const NBT_CHUNK_KEY_PREFIX = "__chunk_";
// Keep each chunk comfortably below the 65,535-byte writeUTF boundary.
// With multi-byte characters this remains safe in practice.
const NBT_CHUNK_SAFE_CHAR_LIMIT = 16_000;

function toChunkCountKey(nbtKey: string): string {
  return `${nbtKey}${NBT_CHUNK_COUNT_SUFFIX}`;
}

function toChunkKey(nbtKey: string, index: number): string {
  return `${nbtKey}${NBT_CHUNK_KEY_PREFIX}${index}`;
}

function readChunkedString(data: $CompoundTag, nbtKey: string): string | null {
  const chunkCountKey = toChunkCountKey(nbtKey);
  if (!data.contains(chunkCountKey)) return null;

  const count = data.getInt(chunkCountKey);
  if (!Number.isInteger(count) || count < 0) return null;
  if (count === 0) return "";

  let value = "";
  for (let i = 0; i < count; i++) {
    const chunkKey = toChunkKey(nbtKey, i);
    if (!data.contains(chunkKey)) return null;
    value += data.getString(chunkKey);
  }

  return value;
}

function removeChunkedString(data: $CompoundTag, nbtKey: string): void {
  const chunkCountKey = toChunkCountKey(nbtKey);
  if (!data.contains(chunkCountKey)) return;

  const count = data.getInt(chunkCountKey);
  if (Number.isInteger(count) && count >= 0) {
    for (let i = 0; i < count; i++) {
      data.remove(toChunkKey(nbtKey, i));
    }
  }

  data.remove(chunkCountKey);
}

function writeChunkedString(
  data: $CompoundTag,
  nbtKey: string,
  value: string,
): void {
  removeChunkedString(data, nbtKey);

  if (value.length <= NBT_CHUNK_SAFE_CHAR_LIMIT) {
    data.putString(nbtKey, value);
    return;
  }

  data.remove(nbtKey);

  const chunkCount = Math.ceil(value.length / NBT_CHUNK_SAFE_CHAR_LIMIT);
  data.putInt(toChunkCountKey(nbtKey), chunkCount);

  for (let i = 0; i < chunkCount; i++) {
    const start = i * NBT_CHUNK_SAFE_CHAR_LIMIT;
    const end = start + NBT_CHUNK_SAFE_CHAR_LIMIT;
    data.putString(toChunkKey(nbtKey, i), value.slice(start, end));
  }
}

export function loadNbt<T extends Record<string, unknown>>(
  data: $CompoundTag,
  nbtKey: string,
  toDefault: () => T,
): T {
  let fallback;
  if (typeof toDefault !== "function") {
    fallback = toDefault;
  } else {
    fallback = toDefault();
  }

  const json = data.contains(nbtKey)
    ? data.getString(nbtKey)
    : readChunkedString(data, nbtKey);
  if (!json) return fallback;

  try {
    const result = JSON.parse(json) as T;
    if (!validateObject(fallback, result)) {
      assignObject(result, fallback);
      return fallback;
    }

    return result;
  } catch (error) {
    throw new Error(
      `Failed to parse runtime state JSON for key '${nbtKey}': ${error}`,
      {
        cause: error,
      },
    );
  }
}

export function saveNbt(data: $CompoundTag, nbtKey: string, value: object) {
  writeChunkedString(data, nbtKey, JSON.stringify(value));
}
