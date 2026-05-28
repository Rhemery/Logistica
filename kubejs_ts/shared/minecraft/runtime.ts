import { $MinecraftServer } from "@package/net/minecraft/server";
import { $Entity, $LivingEntity } from "@package/net/minecraft/world/entity";
import type { CoreAwakening } from "../core_awakening/runtime";
import type { Logistica } from "../logistica/runtime";
import { assignObject } from "../object";
import { loadNbt, saveNbt } from "./nbt";
import { toPlainNumber } from "../math";

export const DEBUG_RUNTIME_STATE = false;

export const RUNTIME_STATE_SAVE_INTERVAL_TICKS = 20 * 15;
export const SIM_INTERVAL_TICKS = 20 * 10;
export const OUTPOST_DEFAULT_MAX_BACKLOG = 16;

export const COMPATIBILITY_TRANSFORMS = [];

const RUNTIME_META_KEY = "__runtime_meta_cache";
const DEFAULT_ENTITY_CACHE_TTL_TICKS = 20 * 60 * 10;
const DEFAULT_ENTITY_CACHE_MAX_ENTRIES = 2048;

type EntityCacheMeta = {
  lastSeenTick: number;
  isPlayer: boolean;
};

type ModuleRuntimeMeta = {
  entities: Record<string, EntityCacheMeta>;
};

type RuntimeMetaCache = {
  modules: Record<string, ModuleRuntimeMeta>;
};

function getRuntimeStateCacheRecord() {
  const existing = global.runtimeStateCache;
  if (existing && typeof existing === "object") {
    return existing;
  }

  const created = {
    minecraft: Minecraft.Runtime.defaultState(),
  };
  global.runtimeStateCache = created as unknown as Minecraft.Runtime.State;
  return created as unknown as Minecraft.Runtime.State;
}

function getRuntimeMetaCache(): RuntimeMetaCache {
  const existing = global[RUNTIME_META_KEY];
  if (existing && typeof existing === "object") {
    return existing;
  }

  const created: RuntimeMetaCache = { modules: {} };
  global[RUNTIME_META_KEY] = created;
  return created;
}

function getOrCreateModuleMeta(moduleKey: string): ModuleRuntimeMeta {
  const cache = getRuntimeMetaCache();
  if (!cache.modules[moduleKey]) {
    cache.modules[moduleKey] = { entities: {} };
  }
  return cache.modules[moduleKey];
}

function safeIsPlayer(entity: $Entity | $LivingEntity): boolean {
  try {
    return entity.isPlayer();
  } catch (e) {
    console.errorf(String(e));
    return false;
  }
}

function debugRuntimeState() {
  if (!DEBUG_RUNTIME_STATE) return;

  console.infof(JSON.stringify(global.runtimeStateCache, null, 2));

  JsonIO.write(
    "kubejs/exported/server/logistica_runtime_state.json",
    JSON.parse(JSON.stringify(global.runtimeStateCache, null, 2)),
  );
}

export namespace Minecraft.Runtime {
  export type StateTarget = $MinecraftServer | $Entity | $LivingEntity;
  export type EntityTarget = $Entity | $LivingEntity;

  export type ModuleState<
    S extends Record<string, unknown>,
    E extends Record<string, unknown>,
  > = {
    server: S;
    entities: Record<string, E>;
  };

  export type State = {
    minecraft: ModuleState<ServerState, EntityState>;
    logistica: Logistica.Runtime.State;
    core_awakening: CoreAwakening.Runtime.State;
  };

  export type ServerState = {
    tick: number;
  };

  export type EntityState = Record<string, never>;

  export type ModuleRuntime<
    S extends Record<string, unknown>,
    E extends Record<string, unknown>,
  > = {
    defaultServerState: () => S;
    defaultEntityState: () => E;
    defaultState: () => ModuleState<S, E>;
    getState: () => ModuleState<S, E>;
    getServerState: () => S;
    loadServerState: (server: $MinecraftServer) => void;
    saveServerState: (server: $MinecraftServer) => void;
    loadEntityState: (entity: EntityTarget) => E;
    saveEntityState: (entity: EntityTarget) => void;
    getEntityState: (entity: EntityTarget) => E;
    pruneEntityCache: (server: $MinecraftServer) => number;
  };

  export type ModuleRuntimeOptions<
    K extends keyof State,
    S extends Record<string, unknown>,
    E extends Record<string, unknown>,
  > = {
    moduleKey: K;
    serverNbtKey: string;
    entityNbtKey: string;
    defaultServerState: () => S;
    defaultEntityState: () => E;
    mergeWithMinecraftServerState?: boolean;
    entityCacheTtlTicks?: number;
    entityCacheMaxEntries?: number;
  };

  export const SERVER_NBT_KEY = "minecraft_runtime_state";

  export function defaultServerState(): ServerState {
    return {
      tick: 0,
    };
  }

  export function defaultEntityState(): EntityState {
    return {};
  }

  export function defaultState(): ModuleState<ServerState, EntityState> {
    return {
      server: defaultServerState(),
      entities: {},
    };
  }

  export function loadState<
    T extends StateTarget,
    D extends Record<string, unknown>,
    R extends Record<string, unknown>,
  >(target: T, key: string, data: D, defaultState: () => R): void {
    assignObject(loadNbt(target.persistentData, key, defaultState), data);
    debugRuntimeState();
  }

  export function saveState<
    T extends StateTarget,
    D extends Record<string, unknown>,
  >(target: T, key: string, data: D): void {
    saveNbt(target.persistentData, key, data);
    debugRuntimeState();
  }

  export function getState<K extends keyof State>(key: K): State[K] {
    debugRuntimeState();
    return getRuntimeStateCacheRecord()[key] as State[K];
  }

  export function loadServerState(server: $MinecraftServer): void {
    Minecraft.Runtime.loadState(
      server,
      SERVER_NBT_KEY,
      getServerState(),
      defaultServerState,
    );
  }

  export function saveServerState(server: $MinecraftServer): void {
    Minecraft.Runtime.saveState(server, SERVER_NBT_KEY, getServerState());
  }

  export function getServerState(): ServerState {
    const stateCache = getRuntimeStateCacheRecord();
    if (!stateCache.minecraft) {
      stateCache.minecraft = defaultState();
    }
    return stateCache.minecraft.server;
  }

  export function createModuleRuntime<
    K extends keyof State,
    S extends Record<string, unknown>,
    E extends Record<string, unknown>,
  >(options: ModuleRuntimeOptions<K, S, E>): ModuleRuntime<S, E> {
    const moduleKey = options.moduleKey;
    const entityCacheTtlTicks =
      options.entityCacheTtlTicks ?? DEFAULT_ENTITY_CACHE_TTL_TICKS;
    const entityCacheMaxEntries =
      options.entityCacheMaxEntries ?? DEFAULT_ENTITY_CACHE_MAX_ENTRIES;

    function getModuleState(): ModuleState<S, E> {
      const stateCache = getRuntimeStateCacheRecord() as unknown as Record<
        K,
        ModuleState<S, E>
      >;
      const key = options.moduleKey;
      if (!stateCache[key]) {
        stateCache[key] = defaultState();
      }
      return stateCache[key];
    }

    function getModuleMeta() {
      return getOrCreateModuleMeta(moduleKey);
    }

    function getTick() {
      return toPlainNumber(getServerState().tick, 0);
    }

    function touchEntity(entity: EntityTarget): string {
      const id = entity.getStringUuid();
      const meta = getModuleMeta().entities;
      const entry = meta[id];
      if (!entry) {
        meta[id] = {
          lastSeenTick: getTick(),
          isPlayer: safeIsPlayer(entity),
        };
        return id;
      }

      entry.lastSeenTick = getTick();
      if (!entry.isPlayer) {
        entry.isPlayer = safeIsPlayer(entity);
      }
      return id;
    }

    function defaultState() {
      return {
        server: options.defaultServerState(),
        entities: {},
      };
    }

    function getServerStateInternal() {
      const state = getModuleState().server;
      if (options.mergeWithMinecraftServerState) {
        (state as Record<"tick", number>).tick =
          Minecraft.Runtime.getServerState().tick;
      }
      return state;
    }

    function loadServerStateInternal(server: $MinecraftServer): void {
      Minecraft.Runtime.loadState(
        server,
        options.serverNbtKey,
        getModuleState().server,
        options.defaultServerState,
      );
      getServerStateInternal();
    }

    function saveServerStateInternal(server: $MinecraftServer): void {
      Minecraft.Runtime.saveState(
        server,
        options.serverNbtKey,
        getServerStateInternal(),
      );
    }

    function loadEntityStateInternal(entity: EntityTarget): E {
      const id = entity.getStringUuid();
      const state = getModuleState().entities;
      state[id] = loadNbt(
        entity.persistentData,
        options.entityNbtKey,
        options.defaultEntityState,
      );
      touchEntity(entity);
      return state[id];
    }

    function getEntityStateInternal(entity: EntityTarget): E {
      const id = entity.getStringUuid();
      const state = getModuleState().entities;
      if (!state[id]) {
        state[id] = loadNbt(
          entity.persistentData,
          options.entityNbtKey,
          options.defaultEntityState,
        );
      }

      touchEntity(entity);
      return state[id];
    }

    function saveEntityStateInternal(entity: EntityTarget): void {
      const id = touchEntity(entity);
      const state = getModuleState().entities;
      if (!state[id]) {
        state[id] = options.defaultEntityState();
      }
      saveNbt(entity.persistentData, options.entityNbtKey, state[id]);
      debugRuntimeState();
    }

    function pruneEntityCacheInternal(server: $MinecraftServer): number {
      const tick = getTick();
      const meta = getModuleMeta().entities;
      const entities = getModuleState().entities;
      const loaded = new Set<string>();

      server.getEntities().forEach((entity) => {
        const id = entity.getStringUuid();
        loaded.add(id);

        if (!meta[id]) {
          meta[id] = {
            lastSeenTick: tick,
            isPlayer: entity.isPlayer(),
          };
        } else {
          meta[id].lastSeenTick = tick;
          if (!meta[id].isPlayer) meta[id].isPlayer = entity.isPlayer();
        }
      });

      let removed = 0;

      for (const [id, entityState] of Object.entries(entities)) {
        if (!entityState) {
          delete entities[id];
          delete meta[id];
          removed += 1;
          continue;
        }

        if (loaded.has(id)) continue;

        const entry = meta[id];
        if (!entry) {
          delete entities[id];
          removed += 1;
          continue;
        }

        if (entry.isPlayer) continue;
        if (tick - entry.lastSeenTick < entityCacheTtlTicks) continue;

        delete entities[id];
        delete meta[id];
        removed += 1;
      }

      const entityIds = Object.keys(entities);
      if (entityIds.length > entityCacheMaxEntries) {
        const overflow = entityIds.length - entityCacheMaxEntries;
        const candidates = entityIds
          .filter((id) => !meta[id]?.isPlayer)
          .sort(
            (left, right) =>
              (meta[left]?.lastSeenTick ?? 0) -
              (meta[right]?.lastSeenTick ?? 0),
          );

        const removeCount = Math.min(overflow, candidates.length);
        for (let i = 0; i < removeCount; i++) {
          const id = candidates[i];
          if (!id) continue;

          delete entities[id];
          delete meta[id];
          removed += 1;
        }
      }

      return removed;
    }

    return {
      defaultServerState: options.defaultServerState,
      defaultEntityState: options.defaultEntityState,
      defaultState,
      getState: getModuleState,
      getServerState: getServerStateInternal,
      loadServerState: loadServerStateInternal,
      saveServerState: saveServerStateInternal,
      loadEntityState: loadEntityStateInternal,
      saveEntityState: saveEntityStateInternal,
      getEntityState: getEntityStateInternal,
      pruneEntityCache: pruneEntityCacheInternal,
    };
  }
}
