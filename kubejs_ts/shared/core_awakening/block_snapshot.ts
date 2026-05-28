/* eslint-disable
  @typescript-eslint/no-unsafe-assignment,
  @typescript-eslint/no-unsafe-call,
  @typescript-eslint/no-unsafe-member-access,
  @typescript-eslint/no-unsafe-return,
  @typescript-eslint/no-deprecated
*/
import { $MinecraftServer } from "@package/net/minecraft/server";
import { $ServerLevel } from "@package/net/minecraft/server/level";
import { $Block } from "@package/net/minecraft/world/level/block";
import { $BlockState } from "@package/net/minecraft/world/level/block/state";
import { toPlainNumber } from "../math";

const BuiltInRegistries = Java.loadClass(
  "net.minecraft.core.registries.BuiltInRegistries",
);

type BlockSnapshotProperty = {
  name: string;
  default: string;
  possible: string[];
};

type BlockSnapshotEntry = {
  id: string;
  defaultState: string;
  stateCount: number;
  states: string[];
  tags: string[];
  properties: BlockSnapshotProperty[];
  flags: {
    air: boolean;
    replaceable: boolean;
    blocksMotion: boolean;
    solid: boolean;
    fullCollision: boolean;
    randomlyTicking: boolean;
    hasBlockEntity: boolean;
    liquid: boolean;
    requiresTool: boolean;
  };
  stats: {
    lightEmission: number;
    destroySpeed: number;
    explosionResistance: number;
    friction: number;
    speedFactor: number;
    jumpFactor: number;
  };
  soundType: string;
  renderShape: string;
  pushReaction: string;
  mapColor: string;
};

type BlockSnapshotResult = {
  blocks: number;
  path: string;
};

const BLOCK_SNAPSHOT_PATH =
  "kubejs/exported/server/core_awakening_block_snapshot.json";
const REPLACEABLE_TAG = "minecraft:replaceable";

type BlockSnapshotPayload = {
  blocks?: BlockSnapshotEntry[];
};

let snapshotLookupLoaded = false;
let snapshotLookupById: Record<string, BlockSnapshotEntry> = {};

function safeCall<T>(fn: () => T, fallback: T): T {
  try {
    const value = fn();
    if (value == null) return fallback;
    return value;
  } catch (error) {
    console.errorf(String(error));
    return fallback;
  }
}

function getSnapshotLookupById(): Record<string, BlockSnapshotEntry> {
  if (snapshotLookupLoaded) return snapshotLookupById;
  snapshotLookupLoaded = true;
  snapshotLookupById = {};

  const raw = safeCall(() => JsonIO.readString(BLOCK_SNAPSHOT_PATH), "");
  if (!raw || typeof raw !== "string") return snapshotLookupById;

  try {
    const parsed = JSON.parse(raw) as BlockSnapshotPayload;
    if (!parsed || !Array.isArray(parsed.blocks)) return snapshotLookupById;

    for (const block of parsed.blocks) {
      if (!block || typeof block.id !== "string" || block.id.length === 0) {
        continue;
      }

      snapshotLookupById[block.id] = block;
    }
  } catch (error) {
    console.errorf(String(error));
  }

  return snapshotLookupById;
}

export function clearBlockPrototypeSnapshotCache(): void {
  snapshotLookupLoaded = false;
  snapshotLookupById = {};
}

export function getBlockPrototypeSnapshotEntry(
  blockId: string,
): BlockSnapshotEntry | null {
  if (!blockId || typeof blockId !== "string") return null;
  const lookup = getSnapshotLookupById();
  return lookup[blockId] ?? null;
}

export function isBlockPrototypeReplaceable(blockId: string): boolean {
  const entry = getBlockPrototypeSnapshotEntry(blockId);
  if (!entry) return false;

  if (entry.flags?.replaceable) return true;
  if (!Array.isArray(entry.tags)) return false;

  return entry.tags.includes(REPLACEABLE_TAG);
}

function toJavaArray<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];

  const out: T[] = [];
  try {
    const iter = (
      value as { iterator: () => { hasNext(): boolean; next(): T } }
    ).iterator();
    if (iter) {
      while (iter.hasNext()) out.push(iter.next());
      return out;
    }
  } catch (error) {
    console.errorf(String(error));
  }

  try {
    (value as { forEach: (fn: (entry: T) => void) => void }).forEach((entry) =>
      out.push(entry),
    );
    if (out.length > 0) return out;
  } catch (error) {
    console.errorf(String(error));
  }

  try {
    for (const entry of value as Iterable<T>) {
      out.push(entry);
    }
  } catch (error) {
    console.errorf(String(error));
  }

  return out;
}

function getDefaultSnapshotLevel(
  server: $MinecraftServer,
): $ServerLevel | null {
  const overworld = safeCall(
    () => server.overworld(),
    null as $ServerLevel | null,
  );
  if (overworld) return overworld;

  const levels = toJavaArray<$ServerLevel>(
    safeCall(() => server.getAllLevels(), null as any),
  );
  return levels[0] ?? null;
}

function getStateProperties(state: $BlockState): BlockSnapshotProperty[] {
  const properties = toJavaArray<any>(
    safeCall(() => state.getProperties(), null as any),
  );

  return properties
    .map((property): BlockSnapshotProperty => {
      const defaultValueRaw = safeCall(
        () => state.getValue(property),
        null as any,
      );
      const possibleValues = toJavaArray<any>(
        safeCall(() => property.getPossibleValues(), null as any),
      );

      return {
        name: String(safeCall(() => property.getName(), "")),
        default: String(
          safeCall(() => property.getName(defaultValueRaw), defaultValueRaw),
        ),
        possible: possibleValues.map((value) =>
          String(safeCall(() => property.getName(value), value)),
        ),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function factoryBlockSnapshotEntry(): BlockSnapshotEntry {
  return {
    id: "",
    defaultState: "",
    stateCount: 0,
    states: [],
    tags: [],
    properties: [],
    flags: {
      air: false,
      replaceable: false,
      blocksMotion: false,
      solid: false,
      fullCollision: false,
      randomlyTicking: false,
      hasBlockEntity: false,
      liquid: false,
      requiresTool: false,
    },
    stats: {
      lightEmission: 0,
      destroySpeed: 0,
      explosionResistance: 0,
      friction: 0,
      speedFactor: 0,
      jumpFactor: 0,
    },
    soundType: "",
    renderShape: "",
    pushReaction: "",
    mapColor: "",
  };
}

function buildSnapshotEntry(
  block: $Block,
  level: $ServerLevel | null,
  samplePos: [number, number, number] | null,
): BlockSnapshotEntry {
  const state = safeCall(
    () => block.defaultBlockState(),
    null as unknown as $BlockState,
  );
  if (!state) return factoryBlockSnapshotEntry();
  const tags = toJavaArray<any>(
    safeCall(() => block.getTags(), null as any),
  ).map((tag) => String(tag));
  //.sort();

  const possibleStates = toJavaArray<any>(
    safeCall(() => block.getStateDefinition().getPossibleStates(), null as any),
  );
  const possibleStateStrings = possibleStates.map((entry) => String(entry));

  const props = safeCall(() => block.getProperties(), null as any);

  return {
    id: safeCall(() => block.getId(), ""),
    defaultState: String(state),
    stateCount: possibleStateStrings.length,
    states: possibleStateStrings,
    tags,
    properties: getStateProperties(state),
    flags: {
      air: safeCall(() => state.isAir(), false),
      replaceable: safeCall(() => state.canBeReplaced(), false),
      blocksMotion: safeCall(() => state.blocksMotion(), false),
      solid: safeCall(() => state.isSolid(), false),
      fullCollision:
        level && samplePos
          ? safeCall(
              () =>
                state.isCollisionShapeFullBlock(
                  level as unknown as any,
                  samplePos,
                ),
              false,
            )
          : false,
      randomlyTicking: safeCall(() => state.isRandomlyTicking(), false),
      hasBlockEntity: safeCall(() => state.hasBlockEntity(), false),
      liquid: safeCall(() => state.liquid(), false),
      requiresTool: safeCall(() => state.requiresCorrectToolForDrops(), false),
    },
    stats: {
      lightEmission:
        level && samplePos
          ? toPlainNumber(
              safeCall(
                () =>
                  state.getLightEmission(level as unknown as any, samplePos),
                0,
              ),
              0,
            )
          : 0,
      destroySpeed:
        level && samplePos
          ? toPlainNumber(
              safeCall(
                () => state.getDestroySpeed(level as unknown as any, samplePos),
                0,
              ),
              0,
            )
          : toPlainNumber(
              safeCall(() => props.getDestroyTime(), 0),
              0,
            ),
      explosionResistance: toPlainNumber(
        safeCall(() => props.getExplosionResistance(), 0),
        0,
      ),
      friction: toPlainNumber(
        safeCall(() => props.getFriction(), 0),
        0,
      ),
      speedFactor: toPlainNumber(
        safeCall(() => props.getSpeedFactor(), 0),
        0,
      ),
      jumpFactor: toPlainNumber(
        safeCall(() => props.getJumpFactor(), 0),
        0,
      ),
    },
    soundType: String(safeCall(() => props.getSoundType(), null as any) ?? ""),
    renderShape: String(
      safeCall(() => state.getRenderShape(), null as any) ?? "",
    ),
    pushReaction: String(
      safeCall(() => state.getPistonPushReaction(), null as any) ?? "",
    ),
    mapColor:
      level && samplePos
        ? String(
            safeCall(
              () => state.getMapColor(level as unknown as any, samplePos),
              null as any,
            ) ?? "",
          )
        : "",
  };
}

export function exportBlockPrototypeSnapshot(
  server: $MinecraftServer,
): BlockSnapshotResult {
  const level = getDefaultSnapshotLevel(server);
  if (!level) return { blocks: 0, path: "" };

  const samplePos = [0, Math.max(level.getMinBuildHeight(), 64), 0] as [
    number,
    number,
    number,
  ];

  const blocks = toJavaArray<$Block>(BuiltInRegistries.BLOCK).map((block) =>
    buildSnapshotEntry(block, level, samplePos),
  );
  //.sort((left, right) => left.id.localeCompare(right.id));

  const payload = {
    generatedAt: new Date().toISOString(),
    minecraftVersion: "1.21.1",
    blockCount: blocks.length,
    sampleDimension: String(level.getDimension() ?? ""),
    blocks,
  };

  JsonIO.write(BLOCK_SNAPSHOT_PATH, JSON.parse(JSON.stringify(payload)));

  return {
    blocks: blocks.length,
    path: BLOCK_SNAPSHOT_PATH,
  };
}
