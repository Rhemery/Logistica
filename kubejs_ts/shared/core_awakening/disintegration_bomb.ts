import {
  DISINTEGRATION_BOMB_ARM_SOUND,
  DISINTEGRATION_BOMB_BEEP_RATE_END,
  DISINTEGRATION_BOMB_BEEP_RATE_START,
  DISINTEGRATION_BOMB_BLOCK_ID,
  DISINTEGRATION_BOMB_CHAIN_FUSE_TICKS,
  DISINTEGRATION_BOMB_ENTITY_ID,
  DISINTEGRATION_BOMB_EXPLODE_SOUND,
  DISINTEGRATION_BOMB_EXPLOSION_STRENGTH,
  DISINTEGRATION_BOMB_IGNITER_ITEM_ID,
  DISINTEGRATION_BOMB_SOUND_RADIUS,
} from "kubejs_ts/shared/core_awakening/config/disintegration_bomb";
import { $MinecraftServer } from "@package/net/minecraft/server";
import { $Entity } from "@package/net/minecraft/world/entity";
import { $Level } from "@package/net/minecraft/world/level";
import { INSERT_CELL_SOUND } from "./config/corruption";
import { toPlainNumber } from "../math";
import { playSound } from "../minecraft/sound";

const DISINTEGRATION_BOMB_TAG = "kjs_disintegration_bomb";
const DISINTEGRATION_BOMB_FUSE_NBT_KEY = "kjs_disintegration_bomb_fuse_ticks";
const DISINTEGRATION_BOMB_INITIAL_FUSE_NBT_KEY =
  "kjs_disintegration_bomb_initial_fuse_ticks";
const DISINTEGRATION_BOMB_FUSE_TICK_NEXT_KEY =
  "kjs_disintegration_bomb_fuse_tick_next_tick";
const DISINTEGRATION_BOMB_FUSE_TICK_NEXT_REMAINING_KEY =
  "kjs_disintegration_bomb_fuse_tick_next_remaining";
const DISINTEGRATION_BOMB_GRAVITY = 0.04;
const DISINTEGRATION_BOMB_AIR_DRAG = 0.985;
const DISINTEGRATION_BOMB_GROUND_DRAG = 0.7;
const DISINTEGRATION_BOMB_BOUNCE = 0.35;
const DISINTEGRATION_BOMB_TERMINAL_VELOCITY = -2;
const DISINTEGRATION_BOMB_TICKS_PER_SECOND = 20;
const DISINTEGRATION_BOMB_MIN_BEEP_RATE = 0.05;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toBeepIntervalTicks(beepRatePerSecond: number): number {
  const safeRate = Math.max(
    DISINTEGRATION_BOMB_MIN_BEEP_RATE,
    beepRatePerSecond,
  );
  return Math.max(
    1,
    Math.round(DISINTEGRATION_BOMB_TICKS_PER_SECOND / safeRate),
  );
}

function getBeepIntervalTicks(
  remainingFuse: number,
  initialFuse: number,
): number {
  const safeInitialFuse = Math.max(1, Math.floor(initialFuse));
  const progress = clamp(1 - remainingFuse / safeInitialFuse, 0, 1);

  const startInterval = toBeepIntervalTicks(
    DISINTEGRATION_BOMB_BEEP_RATE_START,
  );
  const endInterval = toBeepIntervalTicks(DISINTEGRATION_BOMB_BEEP_RATE_END);
  const interpolated =
    startInterval + (endInterval - startInterval) * (progress + 0.01);

  return Math.max(1, Math.round(interpolated));
}

function playServerTickSound(entity: $Entity, fuseProgress: number): void {
  playSound(entity.getLevel(), DISINTEGRATION_BOMB_ARM_SOUND, {
    source: "block",
    x: entity.getX(),
    y: entity.getY(),
    z: entity.getZ(),
    distance: DISINTEGRATION_BOMB_SOUND_RADIUS,
    volume: 1,
    pitch: 1,
    minVolume: Math.pow(fuseProgress, 2),
  });
}

export function isDisintegrationBombIgniter(itemId: string): boolean {
  return itemId === DISINTEGRATION_BOMB_IGNITER_ITEM_ID;
}

function readVec3Component(value: unknown, axis: "x" | "y" | "z"): number {
  const raw = value as
    | {
        [key in "x" | "y" | "z"]?: number | (() => number);
      }
    | undefined;
  if (!raw) return 0;

  const member = raw[axis];
  if (typeof member === "function") {
    const numeric = toPlainNumber(member.call(raw), 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const numeric = Number(member);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isBombEntity(entity: $Entity): boolean {
  const tags = entity.getTags();
  if (tags.contains(DISINTEGRATION_BOMB_TAG as any)) return true;

  const typeId = String(entity.getEntityType());
  return typeId.includes(DISINTEGRATION_BOMB_ENTITY_ID);
}

function applyBombPhysics(entity: $Entity): void {
  entity.setNoGravity(false);

  const motion = entity.getDeltaMovement();
  const motionX = readVec3Component(motion, "x");
  const motionY = readVec3Component(motion, "y");
  const motionZ = readVec3Component(motion, "z");

  const nextY = Math.max(
    DISINTEGRATION_BOMB_TERMINAL_VELOCITY,
    motionY - DISINTEGRATION_BOMB_GRAVITY,
  );

  entity.setMotion(motionX, nextY, motionZ);
  entity.move("self", [motionX, nextY, motionZ]);

  const onGround = entity.onGround();
  const drag = onGround
    ? DISINTEGRATION_BOMB_GROUND_DRAG
    : DISINTEGRATION_BOMB_AIR_DRAG;

  const draggedX = motionX * drag;
  const draggedZ = motionZ * drag;

  let draggedY = nextY * DISINTEGRATION_BOMB_AIR_DRAG;
  if (onGround && draggedY < 0) {
    draggedY = -draggedY * DISINTEGRATION_BOMB_BOUNCE;
    if (Math.abs(draggedY) < 0.02) draggedY = 0;
  }

  entity.setMotion(draggedX, draggedY, draggedZ);
  entity.hasImpulse = true;
}

function explodeBombEntity(entity: $Entity): void {
  if (!entity.isAlive()) return;

  const level = entity.getLevel();
  const x = entity.getX();
  const y = entity.getY();
  const z = entity.getZ();

  level.explode(x, y, z, {
    strength: DISINTEGRATION_BOMB_EXPLOSION_STRENGTH,
    causesFire: false,
    mode: "tnt",
    particles: true,
  });

  playSound(level, DISINTEGRATION_BOMB_EXPLODE_SOUND, {
    source: "block",
    x,
    y,
    z,
    distance: 200,
    volume: 4,
    pitch: 1,
    minVolume: 0.75,
  });

  entity.discard();
}

function initializeBombEntity(entity: $Entity, fuseTicks: number): void {
  const clampedFuse = Math.max(1, Math.floor(fuseTicks));
  const initialBeepInterval = getBeepIntervalTicks(clampedFuse, clampedFuse);
  const randomAngle = Math.random() * Math.PI * 2;
  const horizontalSpeed = 0.02;
  const motionX = -Math.sin(randomAngle) * horizontalSpeed;
  const motionZ = -Math.cos(randomAngle) * horizontalSpeed;

  entity.addTag(DISINTEGRATION_BOMB_TAG);
  entity.persistentData.putInt(DISINTEGRATION_BOMB_FUSE_NBT_KEY, clampedFuse);
  entity.persistentData.putInt(
    DISINTEGRATION_BOMB_INITIAL_FUSE_NBT_KEY,
    clampedFuse,
  );
  entity.persistentData.putInt(
    DISINTEGRATION_BOMB_FUSE_TICK_NEXT_KEY,
    initialBeepInterval,
  );
  entity.persistentData.putInt(
    DISINTEGRATION_BOMB_FUSE_TICK_NEXT_REMAINING_KEY,
    initialBeepInterval,
  );
  entity.setNoGravity(false);
  entity.setMotion(motionX, 0.2, motionZ);
  entity.hasImpulse = true;
}

export function armDisintegrationBomb(
  _server: $MinecraftServer,
  level: $Level,
  x: number,
  y: number,
  z: number,
  fuseTicks: number,
): boolean {
  if (level.isClientSide()) return false;

  if (level.getBlock(x, y, z).id === DISINTEGRATION_BOMB_BLOCK_ID) {
    level.runCommandSilent(`setblock ${x} ${y} ${z} minecraft:air replace`);
  }

  const primed = level.createEntity(DISINTEGRATION_BOMB_ENTITY_ID as any);
  primed.setPos(x + 0.5, y, z + 0.5);
  initializeBombEntity(primed, fuseTicks);
  level.addFreshEntity(primed);

  playServerTickSound(primed, 1);

  playSound(level, INSERT_CELL_SOUND, {
    source: "block",
    x,
    y,
    z,
    volume: 1,
    pitch: 1,
  });

  return true;
}

export function tickDisintegrationBombsServer(server: $MinecraftServer): void {
  const entities = server.getEntities();

  entities.forEach((entity) => {
    if (!entity.isAlive()) return;
    if (!isBombEntity(entity)) return;

    const bomb = entity;
    if (bomb.getLevel().isClientSide()) return;

    applyBombPhysics(bomb);

    const bombData = bomb.persistentData;
    if (!bombData.contains(DISINTEGRATION_BOMB_FUSE_NBT_KEY)) {
      bombData.putInt(
        DISINTEGRATION_BOMB_FUSE_NBT_KEY,
        DISINTEGRATION_BOMB_CHAIN_FUSE_TICKS,
      );
    }

    if (!bombData.contains(DISINTEGRATION_BOMB_INITIAL_FUSE_NBT_KEY)) {
      bombData.putInt(
        DISINTEGRATION_BOMB_INITIAL_FUSE_NBT_KEY,
        Math.max(1, bombData.getInt(DISINTEGRATION_BOMB_FUSE_NBT_KEY)),
      );
    }

    const initialFuse = Math.max(
      1,
      bombData.getInt(DISINTEGRATION_BOMB_INITIAL_FUSE_NBT_KEY),
    );

    if (!bombData.contains(DISINTEGRATION_BOMB_FUSE_TICK_NEXT_KEY)) {
      const fallbackFuse = Math.max(
        1,
        bombData.getInt(DISINTEGRATION_BOMB_FUSE_NBT_KEY),
      );
      const fallbackInterval = getBeepIntervalTicks(fallbackFuse, initialFuse);
      bombData.putInt(DISINTEGRATION_BOMB_FUSE_TICK_NEXT_KEY, fallbackInterval);
    }

    if (!bombData.contains(DISINTEGRATION_BOMB_FUSE_TICK_NEXT_REMAINING_KEY)) {
      const fallbackFuse = Math.max(
        1,
        bombData.getInt(DISINTEGRATION_BOMB_FUSE_NBT_KEY),
      );
      const fallbackInterval = getBeepIntervalTicks(fallbackFuse, initialFuse);
      bombData.putInt(
        DISINTEGRATION_BOMB_FUSE_TICK_NEXT_REMAINING_KEY,
        fallbackInterval,
      );
    }

    const remainingFuse = bombData.getInt(DISINTEGRATION_BOMB_FUSE_NBT_KEY) - 1;
    bombData.putInt(DISINTEGRATION_BOMB_FUSE_NBT_KEY, remainingFuse);

    const beepRemaining =
      bombData.getInt(DISINTEGRATION_BOMB_FUSE_TICK_NEXT_REMAINING_KEY) - 1;
    bombData.putInt(
      DISINTEGRATION_BOMB_FUSE_TICK_NEXT_REMAINING_KEY,
      beepRemaining,
    );

    const fuseProgress = 1 - remainingFuse / initialFuse;
    if (remainingFuse > 0 && beepRemaining <= 0) {
      const nextInterval = getBeepIntervalTicks(remainingFuse, initialFuse);
      bombData.putInt(DISINTEGRATION_BOMB_FUSE_TICK_NEXT_KEY, nextInterval);
      bombData.putInt(
        DISINTEGRATION_BOMB_FUSE_TICK_NEXT_REMAINING_KEY,
        nextInterval,
      );
      playServerTickSound(bomb, fuseProgress);
    }

    if (remainingFuse <= 0) {
      explodeBombEntity(bomb);
    }
  });
}

export function tickDisintegrationBombsClient(_level: $Level): void {
  void _level;
  // Disabled for now. EntityJS synced-data mutation is not safe on nonliving entities.
}

export function armChainDisintegrationBomb(
  server: $MinecraftServer,
  level: $Level,
  x: number,
  y: number,
  z: number,
): void {
  armDisintegrationBomb(
    server,
    level,
    x,
    y,
    z,
    DISINTEGRATION_BOMB_CHAIN_FUSE_TICKS,
  );
}
