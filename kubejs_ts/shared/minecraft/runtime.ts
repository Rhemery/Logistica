import { RUNTIME_STATE_NBT_KEY } from "./config/runtime_state";
import { $MinecraftServer } from "@package/net/minecraft/server";
import { assignObject } from ".";
import { loadNbt, saveNbt } from "./nbt";
import { RuntimeState } from "kubejs_ts/types/minecraft";
import { $LivingEntity } from "@package/net/minecraft/world/entity";
import { CA } from "kubejs_ts/types/core_awakening";
import { CA_ENTITY_NBT_KEY } from "../core_awakening/core";
export { RUNTIME_STATE_NBT_KEY };

export const DEBUG_RUNTIME_STATE = true;

export const RUNTIME_STATE_SAVE_INTERVAL_TICKS = 20 * 15;
export const SIM_INTERVAL_TICKS = 20 * 10;
export const OUTPOST_DEFAULT_MAX_BACKLOG = 16;

export const COMPATIBILITY_TRANSFORMS = [];

export function createDefaultEntityState(): RuntimeState["entities"][string] {
  return {
    core: {
      health: 0,
      energy: 0,
      corruption: 0,
      purity: 0,
    },
    nodesDisintigrated: 0,
  };
}
export function createDefaultRuntimeState(): RuntimeState {
  return {
    tick: 0,
    marketTerminals: [],
    miningOutposts: [],
    villageMarkets: [],
    hubs: [],
    allowedVillageChunks: [],
    excavationChunks: [],
    caState: {
      corruptionNodes: [],
      purityRefineries: [],
      chunks: [],
      nodesDesintegrated: 0,
    },
    entities: {},
  };
}

function debugRuntimeState() {
  if (!DEBUG_RUNTIME_STATE) return;

  JsonIO.write(
    "kubejs/exported/server/logistica_runtime_state.json",
    JSON.parse(JSON.stringify(global.runtimeStateCache, null, 2)),
  );
}

export function loadRuntimeState(server: $MinecraftServer): void {
  assignObject(
    loadNbt(
      server.persistentData,
      RUNTIME_STATE_NBT_KEY,
      createDefaultRuntimeState,
    ),
    global.runtimeStateCache,
  );

  debugRuntimeState();
}

export function saveRuntimeState(server: $MinecraftServer): void {
  saveNbt(
    server.persistentData,
    RUNTIME_STATE_NBT_KEY,
    global.runtimeStateCache,
  );

  debugRuntimeState();
}

export function persistRuntimeState(server: $MinecraftServer): void {
  saveRuntimeState(server);
  debugRuntimeState();
}

export function getRuntimeState(): RuntimeState {
  debugRuntimeState();
  return global.runtimeStateCache;
}

export function getRuntimeEntity(entity: $LivingEntity): CA.EntityData {
  const id = entity.getStringUuid();
  const state = getRuntimeState();
  if (!state.entities[id]) {
    state.entities[id] = loadNbt(
      entity.persistentData,
      CA_ENTITY_NBT_KEY,
      createDefaultEntityState,
    );
  }

  return state.entities[id];
}

export function saveRuntimeEntity(entity: $LivingEntity) {
  saveNbt(entity.persistentData, CA_ENTITY_NBT_KEY, getRuntimeEntity(entity));
}

export function getRuntimeCA() {
  const state = getRuntimeState();
  return state.caState;
}
