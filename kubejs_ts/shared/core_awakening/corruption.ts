import { $LevelBlock } from "@package/dev/latvian/mods/kubejs/level";
import { $MinecraftServer } from "@package/net/minecraft/server";
import { $LivingEntity } from "@package/net/minecraft/world/entity";
import { $Player } from "@package/net/minecraft/world/entity/player";
import { BlockId, ItemId } from "kubejs_ts/types/minecraft";
import { stationKey, toStationRef } from "../logistica/station";
import {
  CORE_BASE_ENERGY_DRAIN_PER_STEP,
  CORE_CORRUPTION_CRITICAL_THRESHOLD,
  CORE_CORRUPTION_MUTATION_THRESHOLD,
  CORE_CORRUPTION_OVERDRIVE_THRESHOLD,
  CORE_CORRUPTION_PASSIVE_DECAY,
  CORE_MAX_CORRUPTION,
  CORE_MAX_ENERGY,
  CORE_MAX_PURITY,
  CORE_PURITY_DECAY_PER_STEP,
  CORE_SLEEP_RESTORE_PER_STEP,
  CORRUPTION_BLOCK_INTERVAL_TICKS,
  CORRUPTION_CONVERSION_EXCLUDED_BLOCK_IDS,
  CORRUPTION_CONVERSION_EXCLUDED_BLOCK_TAGS,
  CORRUPTION_DECAY_PER_STEP,
  CORRUPTION_FOG_THRESHOLD,
  CORRUPTION_MAX_INTENSITY,
  CORRUPTION_MAX_TRACKED_CHUNKS,
  CORRUPTION_MIN_TRACKED_INTENSITY,
  CORRUPTION_MOB_INTERVAL_TICKS,
  CORRUPTION_MOB_THRESHOLD,
  CORRUPTION_NODE_BASE_PULSE,
  CORRUPTION_NODE_BLOCK_IDS,
  CORRUPTION_NODE_DEFAULT_STRENGTH,
  CORRUPTION_NODE_PULSE_INTERVAL_TICKS,
  CORRUPTION_PLAYER_INTERVAL_TICKS,
  CORRUPTION_REPLACEABLE_HANDLING_MODE,
  CORRUPTION_REPLACEABLE_SCAN_HEIGHT,
  CORRUPTION_SAVE_SNAPSHOT_INTERVAL_TICKS,
  CORRUPTION_SPREAD_SHARE,
  NODE_PULSE_SOUND,
  PURITY_CURE_ITEMS,
  PURITY_REFINERY_BASE_PULSE,
  PURITY_REFINERY_BLOCK_IDS,
  PURITY_REFINERY_DEFAULT_POTENCY,
  PURITY_REFINERY_PULSE_INTERVAL_TICKS,
} from "../core_awakening/config/corruption";
import { chunkKey, toChunkCoord } from "../minecraft/chunk";
import { clamp, lengthdir, randomInt, toPlainNumber } from "../math";
import {
  findSurfaceY,
  getBlockDimension,
  toCommandNumber,
} from "../minecraft/utils";
import {
  GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_DOWN,
  GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_UP,
} from "./generated/corruption_block_conversion";
import { isBlockPrototypeReplaceable } from "./block_snapshot";
import { $ServerPlayer } from "@package/net/minecraft/server/level";
import { CoreAwakening } from "./runtime";
import { $ServerLevel } from "@package/net/minecraft/server/level";

type CorruptionPressure = {
  chunkIntensity: number;
  nodeAura: number;
  exposure: number;
};

type CorruptionConversionDirection = "up" | "down";

function isCorruptionNodeBlockId(blockId: string): boolean {
  return CORRUPTION_NODE_BLOCK_IDS.includes(blockId as BlockId);
}

function isPurityRefineryBlockId(blockId: string): boolean {
  return PURITY_REFINERY_BLOCK_IDS.includes(blockId as BlockId);
}

function getNodeByKey(
  state: CoreAwakening.Runtime.ServerState,
  key: string,
): CoreAwakening.CorruptionNodeState | null {
  return state.corruptionNodes.find((entry) => entry.key === key) ?? null;
}

function getRefineryByKey(
  state: CoreAwakening.Runtime.ServerState,
  key: string,
): CoreAwakening.PurityRefineryState | null {
  return state.purityRefineries.find((entry) => entry.key === key) ?? null;
}

function getOrCreateCorruptionChunk(
  state: CoreAwakening.Runtime.ServerState,
  dimension: string,
  chunkX: number,
  chunkZ: number,
  tick: number,
): CoreAwakening.ChunkState {
  const key = chunkKey(dimension, chunkX, chunkZ);
  const existing = state.chunks.find((entry) => entry.key === key);
  if (existing) return existing;

  const created: CoreAwakening.ChunkState = {
    key,
    dimension,
    chunkX,
    chunkZ,
    intensity: 0,
    lastUpdatedTick: tick,
  };

  state.chunks.push(created);
  return created;
}

function addCorruptionAtChunk(
  state: CoreAwakening.Runtime.ServerState,
  dimension: string,
  chunkX: number,
  chunkZ: number,
  delta: number,
  tick: number,
): boolean {
  if (!Number.isFinite(delta) || delta === 0) return false;

  const chunk = getOrCreateCorruptionChunk(
    state,
    dimension,
    chunkX,
    chunkZ,
    tick,
  );
  const before = chunk.intensity;
  chunk.intensity = clamp(chunk.intensity + delta, 0, CORRUPTION_MAX_INTENSITY);
  chunk.lastUpdatedTick = tick;

  return Math.abs(chunk.intensity - before) >= 0.0001;
}

function getChunkIntensity(
  state: CoreAwakening.Runtime.ServerState,
  dimension: string,
  chunkX: number,
  chunkZ: number,
): number {
  const key = chunkKey(dimension, chunkX, chunkZ);
  return state.chunks.find((entry) => entry.key === key)?.intensity ?? 0;
}

function computeCorruptionPressure(
  state: CoreAwakening.Runtime.ServerState,
  dimension: string,
  x: number,
  y: number,
  z: number,
): CorruptionPressure {
  const chunkIntensity = getChunkIntensity(
    state,
    dimension,
    toChunkCoord(x),
    toChunkCoord(z),
  );

  let nodeAura = 0;
  for (const node of state.corruptionNodes) {
    if (node.dimension !== dimension) continue;

    const dx = node.x - x;
    const dy = node.y - y;
    const dz = node.z - z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > 64) continue;

    nodeAura += (node.strength * 18) / Math.max(4, distance);
  }

  return {
    chunkIntensity,
    nodeAura,
    exposure: clamp(chunkIntensity * 60 + nodeAura, 0, CORE_MAX_CORRUPTION),
  };
}

function resolveSnapshotSourceBlockId(blockId: string): string {
  if (!blockId) return blockId;

  const visited = new Set<string>();
  let current = blockId;

  while (!visited.has(current)) {
    visited.add(current);
    const previous = GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_DOWN[current];
    if (!previous || previous === current) break;
    current = previous;
  }

  return current;
}

function isAirOrFluidBlockId(blockId: string): boolean {
  return (
    blockId === "minecraft:air" ||
    blockId === "minecraft:cave_air" ||
    blockId === "minecraft:void_air" ||
    blockId === "minecraft:water" ||
    blockId === "minecraft:lava"
  );
}

function isCorruptionConversionExcludedSourceBlock(
  sourceBlockId: string,
  block: $LevelBlock | null,
): boolean {
  if (
    CORRUPTION_CONVERSION_EXCLUDED_BLOCK_IDS.includes(sourceBlockId as BlockId)
  ) {
    return true;
  }

  if (!block) return false;
  for (const tag of CORRUPTION_CONVERSION_EXCLUDED_BLOCK_TAGS) {
    if (block.hasTag(tag)) {
      return true;
    }
  }

  return false;
}

function isReplaceableAttachmentBlock(block: $LevelBlock | null): boolean {
  if (!block) return false;

  const blockId = block.getId();
  if (isAirOrFluidBlockId(blockId)) return false;
  if (block.hasTag("minecraft:replaceable")) return true;
  if (block.hasTag("minecraft:flowers")) return true;
  if (isBlockPrototypeReplaceable(resolveSnapshotSourceBlockId(blockId))) {
    return true;
  }

  const state = block.getBlockState();
  if (!state) return false;
  if (state.isAir()) return false;
  if (state.canBeReplaced()) return true;

  return false;
}

function getCorruptionConversionReplacement(
  block: $LevelBlock | null,
  direction: CorruptionConversionDirection,
): string | null {
  if (!block) return null;

  const blockId = block.getId() as BlockId;
  const sourceBlockId = resolveSnapshotSourceBlockId(blockId);
  if (
    direction === "up" &&
    isCorruptionConversionExcludedSourceBlock(sourceBlockId, block)
  ) {
    return null;
  }

  const map =
    direction === "up"
      ? GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_UP
      : GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_DOWN;
  const replacement = map[blockId];
  if (!replacement || replacement === blockId) return null;

  return replacement;
}

function handleReplaceableBlocksAboveConvertedGround(
  level: $ServerLevel,
  x: number,
  y: number,
  z: number,
  direction: CorruptionConversionDirection,
): boolean {
  if (CORRUPTION_REPLACEABLE_HANDLING_MODE === "ignore") {
    return false;
  }

  let changed = false;
  for (let offset = 1; offset <= CORRUPTION_REPLACEABLE_SCAN_HEIGHT; offset++) {
    const ay = y + offset;
    const attached = level.getBlock(x, ay, z);
    if (!isReplaceableAttachmentBlock(attached)) {
      break;
    }

    if (CORRUPTION_REPLACEABLE_HANDLING_MODE === "convert_or_remove") {
      const replacement = getCorruptionConversionReplacement(attached, direction);
      if (replacement) {
        level.runCommandSilent(`setblock ${x} ${ay} ${z} ${replacement} replace`);
        changed = true;
        continue;
      }

      // During de-infection we keep non-convertible replaceables in place.
      if (direction === "down") {
        break;
      }
    }

    // No conversion target (or mode is remove_only): remove without drops.
    level.runCommandSilent(`setblock ${x} ${ay} ${z} minecraft:air replace`);
    changed = true;
  }

  return changed;
}

function applyCorruptionConversionAt(
  level: $ServerLevel,
  x: number,
  y: number,
  z: number,
  direction: CorruptionConversionDirection,
): boolean {
  const source = level.getBlock(x, y, z);
  const replacement = getCorruptionConversionReplacement(source, direction);
  if (!replacement) return false;

  let changed = false;
  changed =
    handleReplaceableBlocksAboveConvertedGround(level, x, y, z, direction) ||
    changed;
  level.runCommandSilent(`setblock ${x} ${y} ${z} ${replacement} replace`);
  changed = true;

  return changed;
}

function isPassThroughCorruptionBlock(block: $LevelBlock | null): boolean {
  if (!block) return true;

  const blockId = block.getId();
  if (isAirOrFluidBlockId(blockId)) return true;

  if (block.hasTag("minecraft:replaceable")) return true;
  if (block.hasTag("minecraft:flowers")) return true;
  if (isBlockPrototypeReplaceable(resolveSnapshotSourceBlockId(blockId))) {
    return true;
  }

  const state = block.getBlockState();
  if (!state) return true;
  if (state.isAir()) return true;
  if (state.canBeReplaced()) return true;
  if (state.getFluidState().getType().getId() !== "minecraft:empty") {
    return true;
  }

  return false;
}

function updateLivingCoreByPressure(
  living: $LivingEntity,
  pressure: CorruptionPressure,
  corruptionScale: number,
  purityScale: number,
): { corruption: number; purity: number } {
  const entityData = CoreAwakening.Runtime.getEntityState(living);
  const corruptionBefore = entityData.core.corruption;
  const purityBefore = entityData.core.purity;

  const corruptionGain =
    pressure.exposure * corruptionScale -
    purityBefore * purityScale -
    CORE_CORRUPTION_PASSIVE_DECAY;
  const corruptionAfter = clamp(
    corruptionBefore + corruptionGain,
    0,
    CORE_MAX_CORRUPTION,
  );
  const purityAfter = clamp(
    purityBefore - CORE_PURITY_DECAY_PER_STEP,
    0,
    CORE_MAX_PURITY,
  );

  entityData.core.corruption = corruptionAfter;
  entityData.core.purity = purityAfter;

  return {
    corruption: corruptionAfter,
    purity: purityAfter,
  };
}

function applyCorruptionPowerEffects(
  entity: $LivingEntity,
  corruption: number,
): void {
  if (corruption >= CORE_CORRUPTION_CRITICAL_THRESHOLD) {
    entity.runCommandSilent("effect give @s minecraft:wither 4 2 true");
    entity.runCommandSilent("effect give @s minecraft:darkness 3 0 true");
    return;
  }

  if (corruption >= CORE_CORRUPTION_OVERDRIVE_THRESHOLD) {
    entity.runCommandSilent("effect give @s minecraft:strength 4 1 true");
    entity.runCommandSilent("effect give @s minecraft:resistance 4 0 true");
    entity.runCommandSilent("effect give @s minecraft:wither 4 0 true");
    return;
  }

  if (corruption >= CORE_CORRUPTION_MUTATION_THRESHOLD) {
    entity.runCommandSilent("effect give @s minecraft:weakness 4 0 true");
    entity.runCommandSilent("effect give @s minecraft:wither 4 0 true");
  }
}

function applyCorruptionFog(
  player: $Player,
  pressure: CorruptionPressure,
): void {
  if (pressure.chunkIntensity < CORRUPTION_FOG_THRESHOLD) return;

  //player.runCommandSilent("effect give @s minecraft:blindness 3 0 true");
  player.runCommandSilent(
    "particle minecraft:dragon_breath ~ ~1 ~ 0.35 0.15 0.35 0.001 8 force",
  );
}

function applyEnergyPenalty(player: $Player, energy: number): void {
  if (energy <= 10) {
    player.runCommandSilent("effect give @s minecraft:mining_fatigue 3 1 true");
    player.runCommandSilent("effect give @s minecraft:slowness 3 0 true");
    return;
  }

  if (energy <= 25) {
    player.runCommandSilent("effect give @s minecraft:slowness 3 0 true");
  }
}

function processPlayers(server: $MinecraftServer): void {
  const state = CoreAwakening.Runtime.getServerState();
  const players = server.getPlayers();

  players.forEach((entity) => {
    if (!entity.isLiving()) return;
    if (!entity.isPlayer()) return;

    const player = entity as $Player & $LivingEntity;
    const playerData = CoreAwakening.Runtime.getEntityState(player);

    const pressure = computeCorruptionPressure(
      state,
      String(player.getLevel().getDimension()),
      Math.floor(toPlainNumber(player.getX(), 0)),
      Math.floor(toPlainNumber(player.getY(), 0)),
      Math.floor(toPlainNumber(player.getZ(), 0)),
    );

    const core = updateLivingCoreByPressure(player, pressure, 0.06, 0.04);
    let energy = playerData.core.energy;

    if (toPlainNumber(player.getSleepTimer(), 0) > 0) {
      energy = clamp(energy + CORE_SLEEP_RESTORE_PER_STEP, 0, CORE_MAX_ENERGY);
    } else {
      energy = clamp(
        energy - (CORE_BASE_ENERGY_DRAIN_PER_STEP + pressure.exposure * 0.01),
        0,
        CORE_MAX_ENERGY,
      );
    }
    playerData.core.energy = energy;
    CoreAwakening.Runtime.saveEntityState(player);

    applyCorruptionPowerEffects(player, core.corruption);
    applyEnergyPenalty(player, energy);
    applyCorruptionFog(player, pressure);
  });
}

function processMobs(server: $MinecraftServer): void {
  const state = CoreAwakening.Runtime.getServerState();
  const entities = server.getEntities();
  let processed = 0;

  entities.forEach((entity) => {
    if (processed >= 260) return;
    if (!entity.isLiving()) return;
    if (entity.isPlayer()) return;

    const living = entity as $LivingEntity;
    CoreAwakening.Runtime.getEntityState(living);

    const pressure = computeCorruptionPressure(
      state,
      String(living.getLevel().getDimension()),
      Math.floor(toPlainNumber(living.getX(), 0)),
      Math.floor(toPlainNumber(living.getY(), 0)),
      Math.floor(toPlainNumber(living.getZ(), 0)),
    );

    if (pressure.chunkIntensity < CORRUPTION_MOB_THRESHOLD) return;
    processed += 1;

    const core = updateLivingCoreByPressure(living, pressure, 0.05, 0.03);
    applyCorruptionPowerEffects(living, core.corruption);
    CoreAwakening.Runtime.saveEntityState(living);
  });
}

function updateCorruptionNode(
  server: $MinecraftServer,
  node: CoreAwakening.CorruptionNodeState,
) {
  function findGroundY(
    level: $ServerLevel,
    x: number,
    y: number,
    z: number,
  ): number | null {
    const minY = level.getMinBuildHeight();
    const maxY = level.getMaxBuildHeight() - 1;
    y = clamp(Math.floor(y), minY, maxY);

    let block = level.getBlock(x, y, z);
    while (y < maxY && block && !isPassThroughCorruptionBlock(block)) {
      y += 1;
      block = level.getBlock(x, y, z);
    }

    while (y > minY && (!block || isPassThroughCorruptionBlock(block))) {
      y -= 1;
      block = level.getBlock(x, y, z);
    }

    if (!block || isPassThroughCorruptionBlock(block)) {
      return null;
    }

    return y;
  }

  let changed = false;
  if (node.pulseProgress > 0) {
    const maxProgress = CORRUPTION_NODE_PULSE_INTERVAL_TICKS * node.strength;
    const normalizedProgress = node.pulseProgress / maxProgress;
    const invertedProgress = 1 - normalizedProgress;
    const attemptsPerTick = normalizedProgress * node.strength;
    const maxDistance = invertedProgress * node.strength * 10;
    const chanceToReplace = Math.random();
    const level = server.getLevel(node.dimension);
    if (!level) return changed;

    for (let i = 0; i < attemptsPerTick * 2; i++) {
      const direction = randomInt(0, 360);
      const height = randomInt(node.y, maxDistance);
      const distance = maxDistance;
      const [x, z] = lengthdir(node.x, node.z, distance, direction).map((v) =>
        Math.floor(v),
      ) as [number, number];
      const foundY = findGroundY(level, x, height, z);
      if (foundY == null) continue;
      const y = Math.floor(foundY);

      const source = level.getBlock(x, y, z);
      const replacement = getCorruptionConversionReplacement(source, "up");
      if (!replacement) continue;
      if (replacement.includes("light_corrupted_") && chanceToReplace > 0.08)
        continue;
      if (replacement.includes("heavy_corrupted_") && chanceToReplace > 0.01)
        continue;

      const didConvert = applyCorruptionConversionAt(level, x, y, z, "up");
      if (!didConvert) continue;
      level.runCommandSilent(
        `particle minecraft:dragon_breath ${x + 0.5} ${y + 1.1} ${z + 0.5} 0.2 0.12 0.2 0.001 5 force`,
      );
      changed = true;
    }

    node.pulseProgress -= 1;
  }

  return changed;
}

function pulseCorruptionNodes(server: $MinecraftServer, tick: number): boolean {
  const state = CoreAwakening.Runtime.getServerState();
  let changed = false;

  const aliveNodes: CoreAwakening.CorruptionNodeState[] = [];
  for (const node of state.corruptionNodes) {
    const level = server.getLevel(node.dimension);
    if (!level) continue;

    const block = level.getBlock(node.x, node.y, node.z);
    if (!isCorruptionNodeBlockId(block.getId())) {
      changed = true;
      continue;
    }

    updateCorruptionNode(server, node);

    aliveNodes.push(node);
    if (tick - node.lastPulseTick < node.pulseIntervalTicks) continue;

    const sx = toCommandNumber(node.x);
    const sy = toCommandNumber(node.y);
    const sz = toCommandNumber(node.z);

    level.runCommandSilent(
      `playsound ${NODE_PULSE_SOUND} block @a[x=${sx},y=${sy},z=${sz},distance=..24] ${sx} ${sy} ${sz} 0.1 0.8`,
    );

    const chunkX = toChunkCoord(node.x);
    const chunkZ = toChunkCoord(node.z);
    const pulse = CORRUPTION_NODE_BASE_PULSE * node.strength;
    node.pulseProgress = CORRUPTION_NODE_PULSE_INTERVAL_TICKS * node.strength;

    addCorruptionAtChunk(state, node.dimension, chunkX, chunkZ, pulse, tick);
    addCorruptionAtChunk(
      state,
      node.dimension,
      chunkX + 1,
      chunkZ,
      pulse * 0.35,
      tick,
    );
    addCorruptionAtChunk(
      state,
      node.dimension,
      chunkX - 1,
      chunkZ,
      pulse * 0.35,
      tick,
    );
    addCorruptionAtChunk(
      state,
      node.dimension,
      chunkX,
      chunkZ + 1,
      pulse * 0.35,
      tick,
    );
    addCorruptionAtChunk(
      state,
      node.dimension,
      chunkX,
      chunkZ - 1,
      pulse * 0.35,
      tick,
    );

    node.lastPulseTick = tick;
    changed = true;
  }

  if (aliveNodes.length !== state.corruptionNodes.length) {
    state.corruptionNodes = aliveNodes;
    changed = true;
  }

  return changed;
}

function pulsePurityRefineries(
  server: $MinecraftServer,
  tick: number,
): boolean {
  const state = CoreAwakening.Runtime.getServerState();
  let changed = false;

  const aliveRefineries: CoreAwakening.PurityRefineryState[] = [];
  for (const refinery of state.purityRefineries) {
    const level = server.getLevel(refinery.dimension);
    if (!level) continue;

    const block = level.getBlock(refinery.x, refinery.y, refinery.z);
    if (!isPurityRefineryBlockId(block.getId())) {
      changed = true;
      continue;
    }

    aliveRefineries.push(refinery);
    if (tick - refinery.lastPulseTick < refinery.pulseIntervalTicks) continue;

    const chunkX = toChunkCoord(refinery.x);
    const chunkZ = toChunkCoord(refinery.z);
    const pulse = PURITY_REFINERY_BASE_PULSE * refinery.potency;

    addCorruptionAtChunk(
      state,
      refinery.dimension,
      chunkX,
      chunkZ,
      -pulse,
      tick,
    );
    addCorruptionAtChunk(
      state,
      refinery.dimension,
      chunkX + 1,
      chunkZ,
      -pulse * 0.45,
      tick,
    );
    addCorruptionAtChunk(
      state,
      refinery.dimension,
      chunkX - 1,
      chunkZ,
      -pulse * 0.45,
      tick,
    );
    addCorruptionAtChunk(
      state,
      refinery.dimension,
      chunkX,
      chunkZ + 1,
      -pulse * 0.45,
      tick,
    );
    addCorruptionAtChunk(
      state,
      refinery.dimension,
      chunkX,
      chunkZ - 1,
      -pulse * 0.45,
      tick,
    );

    refinery.lastPulseTick = tick;
    changed = true;
  }

  if (aliveRefineries.length !== state.purityRefineries.length) {
    state.purityRefineries = aliveRefineries;
    changed = true;
  }

  return changed;
}

function spreadAndDecayCorruption(tick: number): boolean {
  const state = CoreAwakening.Runtime.getServerState();
  if (state.chunks.length === 0) return false;

  let changed = false;
  const source = Array.from(state.chunks);

  for (const chunk of source) {
    if (chunk.intensity <= 0) continue;

    const original = chunk.intensity;
    const decayed = Math.max(0, original - CORRUPTION_DECAY_PER_STEP);
    const outward = decayed * CORRUPTION_SPREAD_SHARE;
    chunk.intensity = decayed - outward;
    chunk.lastUpdatedTick = tick;

    if (Math.abs(original - chunk.intensity) >= 0.0001) {
      changed = true;
    }

    if (outward <= 0) continue;
    const spread = outward / 4;
    changed =
      addCorruptionAtChunk(
        state,
        chunk.dimension,
        chunk.chunkX + 1,
        chunk.chunkZ,
        spread,
        tick,
      ) || changed;
    changed =
      addCorruptionAtChunk(
        state,
        chunk.dimension,
        chunk.chunkX - 1,
        chunk.chunkZ,
        spread,
        tick,
      ) || changed;
    changed =
      addCorruptionAtChunk(
        state,
        chunk.dimension,
        chunk.chunkX,
        chunk.chunkZ + 1,
        spread,
        tick,
      ) || changed;
    changed =
      addCorruptionAtChunk(
        state,
        chunk.dimension,
        chunk.chunkX,
        chunk.chunkZ - 1,
        spread,
        tick,
      ) || changed;
  }

  const sizeBeforePrune = state.chunks.length;
  state.chunks = state.chunks.filter(
    (chunk) => chunk.intensity >= CORRUPTION_MIN_TRACKED_INTENSITY,
  );
  if (state.chunks.length !== sizeBeforePrune) {
    changed = true;
  }

  if (state.chunks.length > CORRUPTION_MAX_TRACKED_CHUNKS) {
    state.chunks.sort((left, right) => right.intensity - left.intensity);
    state.chunks = state.chunks.slice(0, CORRUPTION_MAX_TRACKED_CHUNKS);
    changed = true;
  }

  return changed;
}

function infectBlocks(server: $MinecraftServer): boolean {
  const state = CoreAwakening.Runtime.getServerState();
  if (state.chunks.length === 0) return false;

  const candidateChunks = Array.from(state.chunks)
    .filter((chunk) => chunk.intensity >= CORRUPTION_FOG_THRESHOLD)
    .sort((left, right) => right.intensity - left.intensity)
    .slice(0, 14);

  let changed = false;

  for (const chunk of candidateChunks) {
    const level = server.getLevel(chunk.dimension);
    if (!level) continue;

    const attempts = Math.max(1, Math.round(chunk.intensity * 3));
    for (let i = 0; i < attempts; i++) {
      const x = chunk.chunkX * 16 + randomInt(0, 15);
      const z = chunk.chunkZ * 16 + randomInt(0, 15);
      const y = findSurfaceY(level, x, z);
      if (y == null) continue;

      const didConvert = applyCorruptionConversionAt(level, x, y, z, "up");
      if (!didConvert) continue;
      level.runCommandSilent(
        `particle minecraft:dragon_breath ${x + 0.5} ${y + 1.1} ${z + 0.5} 0.2 0.12 0.2 0.001 5 force`,
      );
      changed = true;
    }
  }

  return changed;
}

function deinfectBlocks(server: $MinecraftServer): boolean {
  const state = CoreAwakening.Runtime.getServerState();
  if (state.chunks.length === 0) return false;

  const candidateChunks = Array.from(state.chunks)
    .filter((chunk) => chunk.intensity < CORRUPTION_FOG_THRESHOLD)
    .sort((left, right) => right.intensity - left.intensity)
    .slice(0, 14);

  let changed = false;

  for (const chunk of candidateChunks) {
    const level = server.getLevel(chunk.dimension);
    if (!level) continue;

    const attempts = Math.max(1, Math.round(chunk.intensity * 3));
    for (let i = 0; i < attempts; i++) {
      const x = chunk.chunkX * 16 + randomInt(0, 15);
      const z = chunk.chunkZ * 16 + randomInt(0, 15);
      const y = findSurfaceY(level, x, z);
      if (y == null) continue;

      const didConvert = applyCorruptionConversionAt(level, x, y, z, "down");
      if (!didConvert) continue;
      level.runCommandSilent(
        `particle minecraft:dragon_breath ${x + 0.5} ${y + 1.1} ${z + 0.5} 0.2 0.12 0.2 0.001 5 force`,
      );
      changed = true;
    }
  }

  return changed;
}

function writeRuntimeSnapshot(): void {
  const state = CoreAwakening.Runtime.getServerState();
  const nodesDesintegrated = toPlainNumber(state.nodesDesintegrated, 0);
  state.nodesDesintegrated = nodesDesintegrated;
  const data: CoreAwakening.Runtime.ServerState = {
    tick: state.tick,
    corruptionNodes: state.corruptionNodes,
    purityRefineries: state.purityRefineries,
    chunks: Array.from(state.chunks).sort(
      (left, right) => right.intensity - left.intensity,
    ),
    nodesDesintegrated,
  };
  JsonIO.write(
    "kubejs/exported/server/logistica_corruption_state.json",
    JSON.parse(JSON.stringify(data, null, 2)),
  );
}

export function runCoreAwakeningSimulation(
  server: $MinecraftServer,
  state: CoreAwakening.Runtime.ServerState,
): boolean {
  const tick = state.tick;
  state.nodesDesintegrated = toPlainNumber(state.nodesDesintegrated, 0);

  let changed = false;
  changed = pulseCorruptionNodes(server, tick) || changed;
  changed = pulsePurityRefineries(server, tick) || changed;
  changed = spreadAndDecayCorruption(tick) || changed;

  if (tick % CORRUPTION_BLOCK_INTERVAL_TICKS === 0) {
    changed = infectBlocks(server) || changed;
    changed = deinfectBlocks(server) || changed;
  }

  if (tick % CORRUPTION_PLAYER_INTERVAL_TICKS === 0) {
    processPlayers(server);
  }

  if (tick % CORRUPTION_MOB_INTERVAL_TICKS === 0) {
    processMobs(server);
  }

  if (tick % CORRUPTION_SAVE_SNAPSHOT_INTERVAL_TICKS === 0) {
    writeRuntimeSnapshot();
  }

  return changed;
}

export function addOrGetCorruptionNode(
  server: $MinecraftServer,
  block: $LevelBlock,
  strength: number = CORRUPTION_NODE_DEFAULT_STRENGTH,
): CoreAwakening.CorruptionNodeState {
  const state = CoreAwakening.Runtime.getServerState();
  const ref = toStationRef(block);
  const existing = getNodeByKey(state, ref.key);
  if (existing) {
    existing.strength = clamp(strength, 0.1, 2.5);
    CoreAwakening.Runtime.saveServerState(server);
    return existing;
  }

  const created: CoreAwakening.CorruptionNodeState = {
    key: ref.key,
    dimension: ref.dimension,
    x: ref.x,
    y: ref.y,
    z: ref.z,
    strength: clamp(strength, 0.1, 2.5),
    pulseProgress: 0,
    pulseIntervalTicks: CORRUPTION_NODE_PULSE_INTERVAL_TICKS,
    lastPulseTick: 0,
  };

  state.corruptionNodes.push(created);
  CoreAwakening.Runtime.saveServerState(server);
  return created;
}

export function removeCorruptionNode(
  server: $MinecraftServer,
  block: $LevelBlock,
): boolean {
  const key = stationKey(
    getBlockDimension(block),
    block.getX(),
    block.getY(),
    block.getZ(),
  );

  const state = CoreAwakening.Runtime.getServerState();
  const before = state.corruptionNodes.length;
  state.corruptionNodes = state.corruptionNodes.filter(
    (entry) => entry.key !== key,
  );

  if (state.corruptionNodes.length !== before) {
    CoreAwakening.Runtime.saveServerState(server);
    return true;
  }

  return false;
}

export function addOrGetPurityRefinery(
  server: $MinecraftServer,
  block: $LevelBlock,
  potency: number = PURITY_REFINERY_DEFAULT_POTENCY,
): CoreAwakening.PurityRefineryState {
  const state = CoreAwakening.Runtime.getServerState();
  const ref = toStationRef(block);
  const existing = getRefineryByKey(state, ref.key);
  if (existing) {
    existing.potency = clamp(potency, 0.1, 3);
    CoreAwakening.Runtime.saveServerState(server);
    return existing;
  }

  const created: CoreAwakening.PurityRefineryState = {
    key: ref.key,
    dimension: ref.dimension,
    x: ref.x,
    y: ref.y,
    z: ref.z,
    potency: clamp(potency, 0.1, 3),
    pulseIntervalTicks: PURITY_REFINERY_PULSE_INTERVAL_TICKS,
    lastPulseTick: 0,
  };

  state.purityRefineries.push(created);
  CoreAwakening.Runtime.saveServerState(server);
  return created;
}

export function removePurityRefinery(
  server: $MinecraftServer,
  block: $LevelBlock,
): boolean {
  const key = stationKey(
    getBlockDimension(block),
    block.getX(),
    block.getY(),
    block.getZ(),
  );

  const state = CoreAwakening.Runtime.getServerState();
  const before = state.purityRefineries.length;
  state.purityRefineries = state.purityRefineries.filter(
    (entry) => entry.key !== key,
  );

  if (state.purityRefineries.length !== before) {
    CoreAwakening.Runtime.saveServerState(server);
    return true;
  }

  return false;
}

function applyPurityToLiving(living: $LivingEntity, purity: number): void {
  const entityData = CoreAwakening.Runtime.getEntityState(living);
  const currentPurity = entityData.core.purity;
  const currentCorruption = entityData.core.corruption;

  entityData.core.purity = clamp(currentPurity + purity, 0, CORE_MAX_PURITY);
  entityData.core.corruption = clamp(
    currentCorruption - purity * 0.8,
    0,
    CORE_MAX_CORRUPTION,
  );

  CoreAwakening.Runtime.saveEntityState(living);
}

export function applyPurityToPlayer(
  server: $MinecraftServer,
  player: $Player & $LivingEntity,
  purity: number,
): void {
  applyPurityToLiving(player, purity);
  CoreAwakening.Runtime.saveServerState(server);
}

export function clearCorruptionState(server: $MinecraftServer): void {
  const state = CoreAwakening.Runtime.getServerState();
  state.corruptionNodes = [];
  state.purityRefineries = [];
  state.chunks = [];
  state.nodesDesintegrated = 0;
  CoreAwakening.Runtime.saveServerState(server);
}

export function getCorruptionSummary(
  player: $Player | $LivingEntity | $ServerPlayer,
): string[] {
  const state = CoreAwakening.Runtime.getServerState();
  const nodesDesintegrated = toPlainNumber(state.nodesDesintegrated, 0);
  state.nodesDesintegrated = nodesDesintegrated;
  const pressure = computeCorruptionPressure(
    state,
    String(player.getLevel().getDimension()),
    Math.floor(toPlainNumber(player.getX(), 0)),
    Math.floor(toPlainNumber(player.getY(), 0)),
    Math.floor(toPlainNumber(player.getZ(), 0)),
  );

  const enetityData = CoreAwakening.Runtime.getEntityState(
    player as $LivingEntity,
  );
  const corruption = enetityData.core.corruption;
  const purity = enetityData.core.purity;
  const energy = enetityData.core.energy;
  const nodesDisintigrated = toPlainNumber(enetityData.nodesDisintigrated, 0);

  return [
    `Core corruption: ${corruption.toFixed(1)} | purity: ${purity.toFixed(1)}`,
    `Core energy (player): ${energy.toFixed(1)}`,
    `Local chunk corruption: ${pressure.chunkIntensity.toFixed(2)} | exposure: ${pressure.exposure.toFixed(1)}`,
    `Nodes: ${state.corruptionNodes.length} | refineries: ${state.purityRefineries.length} | tracked chunks: ${state.chunks.length}`,
    `Node disintegrations: ${nodesDisintigrated} (global ${nodesDesintegrated})`,
  ];
}

export function handleCorruptionNodeBroken(
  server: $MinecraftServer,
  block: $LevelBlock,
  player: ($Player & $LivingEntity) | null,
): void {
  const removed = removeCorruptionNode(server, block);
  if (!removed || !player) return;

  const entityData = CoreAwakening.Runtime.getEntityState(player);
  applyPurityToLiving(player, 8);
  entityData.nodesDisintigrated =
    toPlainNumber(entityData.nodesDisintigrated, 0) + 1;
  CoreAwakening.Runtime.getServerState().nodesDesintegrated =
    toPlainNumber(
      CoreAwakening.Runtime.getServerState().nodesDesintegrated,
      0,
    ) + 1;
  CoreAwakening.Runtime.saveServerState(server);

  player.tell({
    text: `[Core] Corruption node disintegrated (+purity). Total: ${entityData.nodesDisintigrated}`,
    color: "aqua",
  });
}

export function handleCorruptionNodePlacement(
  server: $MinecraftServer,
  block: $LevelBlock,
): void {
  addOrGetCorruptionNode(server, block);
}

export function handlePurityRefineryPlacement(
  server: $MinecraftServer,
  block: $LevelBlock,
): void {
  addOrGetPurityRefinery(server, block);
}

export function handlePurityFoodEaten(
  server: $MinecraftServer,
  player: $Player & $LivingEntity,
  itemId: ItemId,
): boolean {
  const purity = PURITY_CURE_ITEMS[itemId];
  if (purity == null || purity <= 0) return false;

  applyPurityToPlayer(server, player, purity);
  player.tell({
    text: `[Core] Purity surged by ${purity}.`,
    color: "aqua",
  });
  return true;
}
