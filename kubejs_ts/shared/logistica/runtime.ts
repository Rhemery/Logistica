import {
  HubDispatchState,
  MarketTerminalState,
  MiningOutpostState,
  VillageMarketState,
} from "kubejs_ts/types/logistica/logistics";
import { Minecraft } from "../minecraft/runtime";

export namespace Logistica.Runtime {
  export type ServerState = Minecraft.Runtime.ServerState & {
    marketTerminals: MarketTerminalState[];
    miningOutposts: MiningOutpostState[];
    villageMarkets: VillageMarketState[];
    hubs: HubDispatchState[];
    allowedVillageChunks: string[];
  };

  export type EntityState = Minecraft.Runtime.EntityState &
    Record<string, never>;
  export type State = Minecraft.Runtime.ModuleState<ServerState, EntityState>;

  export const SERVER_NBT_KEY = "logistica_server_state";
  export const ENTITY_NBT_KEY = "logistica_entity_state";

  const runtime = Minecraft.Runtime.createModuleRuntime({
    moduleKey: "logistica",
    serverNbtKey: SERVER_NBT_KEY,
    entityNbtKey: ENTITY_NBT_KEY,
    mergeWithMinecraftServerState: true,
    defaultServerState: (): ServerState => ({
      ...Minecraft.Runtime.defaultServerState(),
      marketTerminals: [],
      miningOutposts: [],
      villageMarkets: [],
      hubs: [],
      allowedVillageChunks: [],
    }),
    defaultEntityState: (): EntityState => ({
      ...Minecraft.Runtime.defaultEntityState(),
    }),
    entityCacheTtlTicks: 20 * 60 * 15,
    entityCacheMaxEntries: 2048,
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
