import type { ItemId } from ".";

export type MarketEntry = {
  sellPrice: number;
  buyPrice: number;
  markets: string[];
};

export type LogisticsStationRef = {
  key: string;
  dimension: string;
  x: number;
  y: number;
  z: number;
};

export type MiningOutpostState = LogisticsStationRef & {
  backlogCycles: number;
  maxBacklogCycles: number;
  unloadedCycles: number;
  lastRunTick: number;
  totalProduced: number;
};

export type ExcavationResourceShare = {
  itemId: ItemId;
  weight: number;
  percent: number;
};

export type ExcavationChunkState = {
  key: string;
  dimension: string;
  chunkX: number;
  chunkZ: number;
  biomeId: string;
  richness: number;
  empty: boolean;
  resources: ExcavationResourceShare[];
};

export type ExcavationResourceDefinition = {
  itemId: ItemId;
  baseWeight: number;
  noiseScale: number;
  minNoise: number;
  minAmount: number;
  maxAmount: number;
  whitelistBiomeKeywords: string[];
  blacklistBiomeKeywords: string[];
};

export type VillageDemandOrder = {
  itemId: ItemId;
  remaining: number;
  unitPrice: number;
};

export type VillageMarketState = LogisticsStationRef & {
  refreshEveryTicks: number;
  backlogRefreshes: number;
  unloadedCycles: number;
  lastRefreshTick: number;
  totalPurchased: number;
  totalPaid: number;
  pendingPayout: number;
  orders: VillageDemandOrder[];
};

export type HubDispatchState = LogisticsStationRef & {
  watchItems: ItemId[];
  thresholdPerItem: number;
  inactivityTicks: number;
  lastDispatchTick: number;
  dispatchCount: number;
};

export type LogisticsRuntimeState = {
  tick: number;
  miningOutposts: MiningOutpostState[];
  villageMarkets: VillageMarketState[];
  hubs: HubDispatchState[];
  allowedVillageChunks: string[];
  excavationChunks: ExcavationChunkState[];
};
