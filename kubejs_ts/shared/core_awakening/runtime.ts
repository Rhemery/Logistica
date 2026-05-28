import { LogisticsStationRef } from "kubejs_ts/types/logistica/logistics";
import { Minecraft } from "../minecraft/runtime";

export namespace CoreAwakening {
  export type Core = {
    health: number;
    energy: number;
    corruption: number;
    purity: number;
  };

  export type EntityData = {
    core: Core;
    nodesDisintigrated: number;
  };

  export type CorruptionNodeState = LogisticsStationRef & {
    strength: number;
    pulseProgress: number;
    pulseIntervalTicks: number;
    lastPulseTick: number;
  };

  export type PurityRefineryState = LogisticsStationRef & {
    potency: number;
    pulseIntervalTicks: number;
    lastPulseTick: number;
  };

  export type ChunkState = {
    key: string;
    dimension: string;
    chunkX: number;
    chunkZ: number;
    intensity: number;
    lastUpdatedTick: number;
  };
}

export namespace CoreAwakening.Runtime {
  export type ServerState = Minecraft.Runtime.ServerState & {
    corruptionNodes: CorruptionNodeState[];
    purityRefineries: PurityRefineryState[];
    chunks: ChunkState[];
    nodesDesintegrated: number;
  };

  export type EntityState = Minecraft.Runtime.EntityState & EntityData;
  export type State = Minecraft.Runtime.ModuleState<ServerState, EntityState>;

  export const SERVER_NBT_KEY = "core_awakening_runtime_state";
  export const ENTITY_NBT_KEY = "core_awakening_entity_state";

  const runtime = Minecraft.Runtime.createModuleRuntime({
    moduleKey: "core_awakening",
    serverNbtKey: SERVER_NBT_KEY,
    entityNbtKey: ENTITY_NBT_KEY,
    mergeWithMinecraftServerState: true,
    defaultServerState: (): ServerState => ({
      ...Minecraft.Runtime.defaultServerState(),
      corruptionNodes: [],
      purityRefineries: [],
      chunks: [],
      nodesDesintegrated: 0,
    }),
    defaultEntityState: (): EntityState =>
      ({
        ...Minecraft.Runtime.defaultEntityState(),
        core: {
          health: 0,
          energy: 0,
          corruption: 0,
          purity: 0,
        },
        nodesDisintigrated: 0,
      }) as EntityState,
    entityCacheTtlTicks: 20 * 60 * 10,
    entityCacheMaxEntries: 4096,
  });

  export const defaultServerState = runtime.defaultServerState;
  export const defaultEntityState = runtime.defaultEntityState;
  export const defaultState = runtime.defaultState;
  export const getState = runtime.getState;
  export const getServerState = runtime.getServerState;
  export const loadServerState = runtime.loadServerState;
  export const saveServerState = runtime.saveServerState;
  export const loadEntityState = runtime.loadEntityState;
  export const saveEntityState = runtime.saveEntityState;
  export const getEntityState = runtime.getEntityState;
  export const pruneEntityCache = runtime.pruneEntityCache;
}
