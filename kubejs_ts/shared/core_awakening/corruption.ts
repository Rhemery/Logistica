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
  CORRUPTION_SAVE_SNAPSHOT_INTERVAL_TICKS,
  CORRUPTION_SIM_INTERVAL_TICKS,
  CORRUPTION_SPREAD_SHARE,
  PURITY_CURE_ITEMS,
  PURITY_REFINERY_BASE_PULSE,
  PURITY_REFINERY_BLOCK_IDS,
  PURITY_REFINERY_DEFAULT_POTENCY,
  PURITY_REFINERY_PULSE_INTERVAL_TICKS,
} from "../core_awakening/config/corruption";
import { CA } from "kubejs_ts/types/core_awakening";
import { createCore } from "./core";
import { chunkKey, toChunkCoord } from "../minecraft/chunk";
import { clamp, randomInt, toPlainNumber } from "../minecraft/math";
import {
  getRuntimeCA,
  getRuntimeEntity,
  persistRuntimeState,
  saveRuntimeEntity,
} from "../minecraft/runtime";
import { findSurfaceY, getBlockDimension } from "../minecraft/utils";
import {
  GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_DOWN,
  GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_UP,
} from "./generated/corruption_block_conversion";
import { $ServerPlayer } from "@package/net/minecraft/server/level";

type CorruptionPressure = {
  chunkIntensity: number;
  nodeAura: number;
  exposure: number;
};

function isCorruptionNodeBlockId(blockId: string): boolean {
  return CORRUPTION_NODE_BLOCK_IDS.includes(blockId as BlockId);
}

function isPurityRefineryBlockId(blockId: string): boolean {
  return PURITY_REFINERY_BLOCK_IDS.includes(blockId as BlockId);
}

function getNodeByKey(
  state: CA.RuntimeState,
  key: string,
): CA.CorruptionNodeState | null {
  return state.corruptionNodes.find((entry) => entry.key === key) ?? null;
}

function getRefineryByKey(
  state: CA.RuntimeState,
  key: string,
): CA.PurityRefineryState | null {
  return state.purityRefineries.find((entry) => entry.key === key) ?? null;
}

function getOrCreateCorruptionChunk(
  state: CA.RuntimeState,
  dimension: string,
  chunkX: number,
  chunkZ: number,
  tick: number,
): CA.ChunkState {
  const key = chunkKey(dimension, chunkX, chunkZ);
  const existing = state.chunks.find((entry) => entry.key === key);
  if (existing) return existing;

  const created: CA.ChunkState = {
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
  state: CA.RuntimeState,
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
  state: CA.RuntimeState,
  dimension: string,
  chunkX: number,
  chunkZ: number,
): number {
  const key = chunkKey(dimension, chunkX, chunkZ);
  return state.chunks.find((entry) => entry.key === key)?.intensity ?? 0;
}

function computeCorruptionPressure(
  state: CA.RuntimeState,
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

function updateLivingCoreByPressure(
  living: $LivingEntity,
  pressure: CorruptionPressure,
  corruptionScale: number,
  purityScale: number,
): { corruption: number; purity: number } {
  const entityData = getRuntimeEntity(living);
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
  saveRuntimeEntity(living);

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
  const state = getRuntimeCA();
  const players = server.getPlayers();

  players.forEach((entity) => {
    if (!entity.isLiving()) return;
    if (!entity.isPlayer()) return;

    const player = entity as $Player & $LivingEntity;
    createCore(player);

    const pressure = computeCorruptionPressure(
      state,
      String(player.getLevel().getDimension()),
      Math.floor(toPlainNumber(player.getX(), 0)),
      Math.floor(toPlainNumber(player.getY(), 0)),
      Math.floor(toPlainNumber(player.getZ(), 0)),
    );

    const core = updateLivingCoreByPressure(player, pressure, 0.06, 0.04);
    let energy = getRuntimeEntity(player).core.energy;

    if (toPlainNumber(player.getSleepTimer(), 0) > 0) {
      energy = clamp(energy + CORE_SLEEP_RESTORE_PER_STEP, 0, CORE_MAX_ENERGY);
    } else {
      energy = clamp(
        energy - (CORE_BASE_ENERGY_DRAIN_PER_STEP + pressure.exposure * 0.01),
        0,
        CORE_MAX_ENERGY,
      );
    }
    saveRuntimeEntity(player);

    applyCorruptionPowerEffects(player, core.corruption);
    applyEnergyPenalty(player, energy);
    applyCorruptionFog(player, pressure);
  });
}

function processMobs(server: $MinecraftServer): void {
  const state = getRuntimeCA();
  const entities = server.getEntities();
  let processed = 0;

  entities.forEach((entity) => {
    if (processed >= 260) return;
    if (!entity.isLiving()) return;
    if (entity.isPlayer()) return;

    const living = entity as $LivingEntity;
    createCore(living);

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
    saveRuntimeEntity(living);
  });
}

function pulseCorruptionNodes(server: $MinecraftServer, tick: number): boolean {
  const state = getRuntimeCA();
  let changed = false;

  const aliveNodes: CA.CorruptionNodeState[] = [];
  for (const node of state.corruptionNodes) {
    const level = server.getLevel(node.dimension);
    if (!level) continue;
    console.infof(
      `[pulseCorruptionNodes] Processing node: ${node.x}, ${node.y}, ${node.z}`,
    );

    const block = level.getBlock(node.x, node.y, node.z);
    if (!isCorruptionNodeBlockId(block.getId())) {
      changed = true;
      continue;
    }

    console.infof(
      `[pulseCorruptionNodes] Adding node: ${node.x}, ${node.y}, ${node.z}`,
    );
    aliveNodes.push(node);
    if (tick - node.lastPulseTick < node.pulseIntervalTicks) continue;

    const chunkX = toChunkCoord(node.x);
    const chunkZ = toChunkCoord(node.z);
    const pulse = CORRUPTION_NODE_BASE_PULSE * node.strength;

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
  const state = getRuntimeCA();
  let changed = false;

  const aliveRefineries: CA.PurityRefineryState[] = [];
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
  const state = getRuntimeCA();
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

function infectBlocksFromNodes(server: $MinecraftServer): boolean {
  const state = getRuntimeCA();
  let changed = false;

  for (const node of state.corruptionNodes) {
    const level = server.getLevel(node.dimension);
    if (!level) continue;

    node.strength += 0.005;

    for (let i = 0; i < 10 + node.strength; i++) {
      const direction = randomInt(0, 360);
      const distance = randomInt(0, node.strength * 4);
      const x = Math.round(
        node.x + Math.cos((direction * Math.PI) / 180) * distance,
      );
      const z = Math.round(
        node.z + Math.sin((direction * Math.PI) / 180) * distance,
      );
      const y = findSurfaceY(level, x, z);
      if (y == null) continue;

      const source = level.getBlock(x, y, z);
      const replacement =
        GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_UP[source.getId() as BlockId];
      if (!replacement || replacement === source.getId()) continue;

      level.runCommand(`setblock ${x} ${y} ${z} ${replacement} replace`);
      level.runCommandSilent(
        `particle minecraft:dragon_breath ${x + 0.5} ${y + 1.1} ${z + 0.5} 0.2 0.12 0.2 0.001 5 force`,
      );
      changed = true;
    }
  }

  return changed;
}

function infectBlocks(server: $MinecraftServer): boolean {
  const state = getRuntimeCA();
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

      const source = level.getBlock(x, y, z);
      const replacement =
        GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_UP[source.getId() as BlockId];
      if (!replacement || replacement === source.getId()) continue;

      level.runCommandSilent(`setblock ${x} ${y} ${z} ${replacement} replace`);
      level.runCommandSilent(
        `particle minecraft:dragon_breath ${x + 0.5} ${y + 1.1} ${z + 0.5} 0.2 0.12 0.2 0.001 5 force`,
      );
      changed = true;
    }
  }

  return changed;
}

function deinfectBlocks(server: $MinecraftServer): boolean {
  const state = getRuntimeCA();
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

      const source = level.getBlock(x, y, z);
      const replacement =
        GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_DOWN[
          source.getId() as BlockId
        ];
      if (!replacement || replacement === source.getId()) continue;

      level.runCommandSilent(`setblock ${x} ${y} ${z} ${replacement} replace`);
      level.runCommandSilent(
        `particle minecraft:dragon_breath ${x + 0.5} ${y + 1.1} ${z + 0.5} 0.2 0.12 0.2 0.001 5 force`,
      );
      changed = true;
    }
  }

  return changed;
}

function writeRuntimeSnapshot(): void {
  const state = getRuntimeCA();
  const data: CA.RuntimeState = {
    corruptionNodes: state.corruptionNodes,
    purityRefineries: state.purityRefineries,
    chunks: Array.from(state.chunks).sort(
      (left, right) => right.intensity - left.intensity,
    ),
    nodesDesintegrated: state.nodesDesintegrated,
  };
  JsonIO.write(
    "kubejs/exported/server/logistica_corruption_state.json",
    JSON.parse(JSON.stringify(data, null, 2)),
  );
}

export function runCoreAwakeningSimulation(
  server: $MinecraftServer,
  tick: number,
): boolean {
  if (tick % CORRUPTION_SIM_INTERVAL_TICKS !== 0) return false;

  let changed = false;
  changed = pulseCorruptionNodes(server, tick) || changed;
  changed = pulsePurityRefineries(server, tick) || changed;
  changed = spreadAndDecayCorruption(tick) || changed;
  changed = infectBlocksFromNodes(server) || changed;

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
): CA.CorruptionNodeState {
  const state = getRuntimeCA();
  const ref = toStationRef(block);
  const existing = getNodeByKey(state, ref.key);
  if (existing) {
    existing.strength = clamp(strength, 0.1, 2.5);
    persistRuntimeState(server);
    return existing;
  }

  const created: CA.CorruptionNodeState = {
    key: ref.key,
    dimension: ref.dimension,
    x: ref.x,
    y: ref.y,
    z: ref.z,
    strength: clamp(strength, 0.1, 2.5),
    pulseIntervalTicks: CORRUPTION_NODE_PULSE_INTERVAL_TICKS,
    lastPulseTick: 0,
  };

  state.corruptionNodes.push(created);
  persistRuntimeState(server);
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

  const state = getRuntimeCA();
  const before = state.corruptionNodes.length;
  state.corruptionNodes = state.corruptionNodes.filter(
    (entry) => entry.key !== key,
  );

  if (state.corruptionNodes.length !== before) {
    persistRuntimeState(server);
    return true;
  }

  return false;
}

export function addOrGetPurityRefinery(
  server: $MinecraftServer,
  block: $LevelBlock,
  potency: number = PURITY_REFINERY_DEFAULT_POTENCY,
): CA.PurityRefineryState {
  const state = getRuntimeCA();
  const ref = toStationRef(block);
  const existing = getRefineryByKey(state, ref.key);
  if (existing) {
    existing.potency = clamp(potency, 0.1, 3);
    persistRuntimeState(server);
    return existing;
  }

  const created: CA.PurityRefineryState = {
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
  persistRuntimeState(server);
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

  const state = getRuntimeCA();
  const before = state.purityRefineries.length;
  state.purityRefineries = state.purityRefineries.filter(
    (entry) => entry.key !== key,
  );

  if (state.purityRefineries.length !== before) {
    persistRuntimeState(server);
    return true;
  }

  return false;
}

function applyPurityToLiving(living: $LivingEntity, purity: number): void {
  const entityData = getRuntimeEntity(living);
  const currentPurity = entityData.core.purity;
  const currentCorruption = entityData.core.corruption;

  entityData.core.purity = clamp(currentPurity + purity, 0, CORE_MAX_PURITY);
  entityData.core.corruption = clamp(
    currentCorruption - purity * 0.8,
    0,
    CORE_MAX_CORRUPTION,
  );

  saveRuntimeEntity(living);
}

export function applyPurityToPlayer(
  server: $MinecraftServer,
  player: $Player & $LivingEntity,
  purity: number,
): void {
  applyPurityToLiving(player, purity);
  persistRuntimeState(server);
}

export function clearCorruptionState(server: $MinecraftServer): void {
  const state = getRuntimeCA();
  state.corruptionNodes = [];
  state.purityRefineries = [];
  state.chunks = [];
  state.nodesDesintegrated = 0;
  persistRuntimeState(server);
}

export function getCorruptionSummary(
  player: $Player | $LivingEntity | $ServerPlayer,
): string[] {
  createCore(player as $LivingEntity);

  const state = getRuntimeCA();
  const pressure = computeCorruptionPressure(
    state,
    String(player.getLevel().getDimension()),
    Math.floor(toPlainNumber(player.getX(), 0)),
    Math.floor(toPlainNumber(player.getY(), 0)),
    Math.floor(toPlainNumber(player.getZ(), 0)),
  );

  const enetityData = getRuntimeEntity(player as $LivingEntity);
  const corruption = enetityData.core.corruption;
  const purity = enetityData.core.purity;
  const energy = enetityData.core.energy;
  const nodesDisintigrated = enetityData.nodesDisintigrated;

  return [
    `Core corruption: ${corruption.toFixed(1)} | purity: ${purity.toFixed(1)}`,
    `Core energy (player): ${energy.toFixed(1)}`,
    `Local chunk corruption: ${pressure.chunkIntensity.toFixed(2)} | exposure: ${pressure.exposure.toFixed(1)}`,
    `Nodes: ${state.corruptionNodes.length} | refineries: ${state.purityRefineries.length} | tracked chunks: ${state.chunks.length}`,
    `Node disintegrations: ${nodesDisintigrated} (global ${state.nodesDesintegrated})`,
  ];
}

export function handleCorruptionNodeBroken(
  server: $MinecraftServer,
  block: $LevelBlock,
  player: ($Player & $LivingEntity) | null,
): void {
  const removed = removeCorruptionNode(server, block);
  if (!removed || !player) return;

  const entityData = getRuntimeEntity(player);
  applyPurityToLiving(player, 8);
  entityData.nodesDisintigrated += 1;
  getRuntimeCA().nodesDesintegrated += 1;
  persistRuntimeState(server);

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
