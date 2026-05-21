import { LogisticsStationRef } from "../logistica/logistics";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace CA {
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

  export type RuntimeState = {
    corruptionNodes: CorruptionNodeState[];
    purityRefineries: PurityRefineryState[];
    chunks: ChunkState[];
    nodesDesintegrated: number;
  };
}
