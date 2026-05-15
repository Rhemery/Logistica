import { $LevelBlock } from "dev.latvian.mods.kubejs.level.LevelBlock";
import { $MinecraftServer } from "net.minecraft.server.MinecraftServer";
import { getRuntimeState, persistRuntimeState } from "./runtime";

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
  const x = Number(block.getX());
  const y = Number(block.getY());
  const z = Number(block.getZ());

  return {
    key: stationKey(dimension, x, y, z),
    dimension,
    x,
    y,
    z,
  };
}

export function removeStation(server: $MinecraftServer, key: string): void {
  const state = getRuntimeState(server);
  state.miningOutposts = state.miningOutposts.filter(
    (entry) => entry.key !== key,
  );
  state.villageMarkets = state.villageMarkets.filter(
    (entry) => entry.key !== key,
  );
  state.hubs = state.hubs.filter((entry) => entry.key !== key);
  persistRuntimeState(server);
}
