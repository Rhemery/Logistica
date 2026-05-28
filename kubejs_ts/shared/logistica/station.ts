import { $LevelBlock } from "@package/dev/latvian/mods/kubejs/level";
import { $MinecraftServer } from "@package/net/minecraft/server";
import { Logistica } from "./runtime";

export function stationKey(
  dimension: string,
  x: number,
  y: number,
  z: number,
): string {
  return `${dimension}|${x}|${y}|${z}`;
}

export function toStationRef(block: $LevelBlock) {
  const dimension = String(block.getDimension());
  const x = block.getX();
  const y = block.getY();
  const z = block.getZ();

  return {
    key: stationKey(dimension, x, y, z),
    dimension,
    x,
    y,
    z,
  };
}

export function removeStation(server: $MinecraftServer, key: string): void {
  const state = Logistica.Runtime.getServerState();
  state.marketTerminals = state.marketTerminals.filter(
    (entry) => entry.key !== key,
  );
  state.miningOutposts = state.miningOutposts.filter(
    (entry) => entry.key !== key,
  );
  state.villageMarkets = state.villageMarkets.filter(
    (entry) => entry.key !== key,
  );
  state.hubs = state.hubs.filter((entry) => entry.key !== key);
  Logistica.Runtime.saveServerState(server);
}
