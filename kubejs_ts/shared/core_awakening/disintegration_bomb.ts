import {
  DISINTEGRATION_BOMB_ARM_SOUND,
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

const DISINTEGRATION_BOMB_TAG = "kjs_disintegration_bomb";
const DISINTEGRATION_BOMB_FUSE_NBT_KEY = "kjs_disintegration_bomb_fuse_ticks";
const DISINTEGRATION_BOMB_GRAVITY = 0.04;
const DISINTEGRATION_BOMB_AIR_DRAG = 0.98;
const DISINTEGRATION_BOMB_GROUND_DRAG = 0.7;
const DISINTEGRATION_BOMB_BOUNCE = 0.35;
const DISINTEGRATION_BOMB_TERMINAL_VELOCITY = -2;

function toCommandNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function playBombSound(
  level: $Level,
  soundId: string,
  x: number,
  y: number,
  z: number,
  volume: number,
  pitch: number,
): void {
  const sx = toCommandNumber(x);
  const sy = toCommandNumber(y);
  const sz = toCommandNumber(z);

  level.runCommandSilent(
    `playsound ${soundId} block @a[x=${sx},y=${sy},z=${sz},distance=..${DISINTEGRATION_BOMB_SOUND_RADIUS}] ${sx} ${sy} ${sz} ${volume} ${pitch}`,
  );
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
    const numeric = Number(member.call(raw));
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

  entity.discard();

  level.explode(x, y, z, {
    strength: DISINTEGRATION_BOMB_EXPLOSION_STRENGTH,
    causesFire: false,
    mode: "tnt",
  });

  playBombSound(level, DISINTEGRATION_BOMB_EXPLODE_SOUND, x, y, z, 1.5, 1);
}

function initializeBombEntity(entity: $Entity, fuseTicks: number): void {
  const clampedFuse = Math.max(1, Math.floor(fuseTicks));
  const randomAngle = Math.random() * Math.PI * 2;
  const horizontalSpeed = 0.02;
  const motionX = -Math.sin(randomAngle) * horizontalSpeed;
  const motionZ = -Math.cos(randomAngle) * horizontalSpeed;

  entity.addTag(DISINTEGRATION_BOMB_TAG);
  entity.persistentData.putInt(DISINTEGRATION_BOMB_FUSE_NBT_KEY, clampedFuse);
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

  playBombSound(
    level,
    DISINTEGRATION_BOMB_ARM_SOUND,
    x + 0.5,
    y + 0.5,
    z + 0.5,
    1.35,
    1,
  );

  return true;
}

export function tickDisintegrationBombs(server: $MinecraftServer): void {
  const entities = server.getEntities();

  entities.forEach((entity) => {
    if (!entity.isAlive()) return;
    if (!isBombEntity(entity as $Entity)) return;

    const bomb = entity as $Entity;
    if (bomb.getLevel().isClientSide()) return;

    applyBombPhysics(bomb);

    const bombData = bomb.persistentData;
    if (!bombData.contains(DISINTEGRATION_BOMB_FUSE_NBT_KEY)) {
      bombData.putInt(
        DISINTEGRATION_BOMB_FUSE_NBT_KEY,
        DISINTEGRATION_BOMB_CHAIN_FUSE_TICKS,
      );
    }

    const remainingFuse = bombData.getInt(DISINTEGRATION_BOMB_FUSE_NBT_KEY) - 1;
    bombData.putInt(DISINTEGRATION_BOMB_FUSE_NBT_KEY, remainingFuse);

    if (remainingFuse <= 0) {
      explodeBombEntity(bomb);
    }
  });
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
