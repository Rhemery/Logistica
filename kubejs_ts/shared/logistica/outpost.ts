import {
  MiningOutpostState,
  VillageMarketState,
} from "kubejs_ts/types/logistica/logistics";
import { $LevelBlock } from "@package/dev/latvian/mods/kubejs/level";
import { $Player } from "@package/net/minecraft/world/entity/player";
import { $BlockPlacedKubeEvent } from "@package/dev/latvian/mods/kubejs/block";
import { toChunkCoord } from "../minecraft/chunk";
import { Logistica } from "./runtime";

export type OutpostBlockId =
  | "kubejs:market_terminal"
  | "kubejs:mining_outpost_controller"
  | "kubejs:village_market_controller";

export type OutpostOwner = {
  id: string;
  name: string;
};

export type OutpostPlacementContext = {
  event: $BlockPlacedKubeEvent;
  state: Logistica.Runtime.ServerState;
  block: $LevelBlock;
  blockId: OutpostBlockId;
  owner: OutpostOwner;
};

export type OutpostPlacementRule = {
  id: string;
  message: string;
  isAllowed: (context: OutpostPlacementContext) => boolean;
};

export type OutpostPlacementResult =
  | { placeable: true }
  | { placeable: false; failedRule: OutpostPlacementRule };

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function getOutpostOwner(player: $Player | null): OutpostOwner | null {
  if (!player) return null;

  const profile = player.getGameProfile();
  const ownerId = normalizeNonEmptyString(String(profile.getId()));
  if (!ownerId) return null;

  const ownerName =
    normalizeNonEmptyString(profile.getName()) ??
    normalizeNonEmptyString(player.getName().getString()) ??
    "Unknown";

  return {
    id: ownerId,
    name: ownerName,
  };
}

export function countPlayerOutpostsOverall(
  state: Logistica.Runtime.ServerState,
  ownerId: string,
): number {
  const marketTerminals = state.marketTerminals.filter(
    (entry) => entry.ownerId === ownerId,
  ).length;
  const miningOutposts = state.miningOutposts.filter(
    (entry) => entry.ownerId === ownerId,
  ).length;
  const villageMarkets = state.villageMarkets.filter(
    (entry) => entry.ownerId === ownerId,
  ).length;
  return marketTerminals + miningOutposts + villageMarkets;
}

export function countPlayerOutpostsByBlockId(
  state: Logistica.Runtime.ServerState,
  ownerId: string,
  blockId: OutpostBlockId,
): number {
  if (blockId === "kubejs:market_terminal") {
    return state.marketTerminals.filter((entry) => entry.ownerId === ownerId)
      .length;
  }
  if (blockId === "kubejs:mining_outpost_controller") {
    return state.miningOutposts.filter((entry) => entry.ownerId === ownerId)
      .length;
  }
  return state.villageMarkets.filter((entry) => entry.ownerId === ownerId)
    .length;
}

export function countPlayerOutpostsInRadius(
  state: Logistica.Runtime.ServerState,
  ownerId: string,
  centerDimension: string,
  centerX: number,
  centerZ: number,
  radius: number,
  blockId: OutpostBlockId | null = null,
): number {
  const radiusSq = radius * radius;
  let count = 0;

  const includeEntry = (entry: {
    ownerId?: string;
    x: number;
    z: number;
    dimension: string;
  }): boolean => {
    if (entry.ownerId !== ownerId) return false;
    if (entry.dimension !== centerDimension) return false;
    const dx = entry.x - centerX;
    const dz = entry.z - centerZ;
    return dx * dx + dz * dz <= radiusSq;
  };

  if (blockId == null || blockId === "kubejs:market_terminal") {
    count += state.marketTerminals.filter((entry) =>
      includeEntry(entry),
    ).length;
  }
  if (blockId == null || blockId === "kubejs:mining_outpost_controller") {
    count += state.miningOutposts.filter((entry) => includeEntry(entry)).length;
  }
  if (blockId == null || blockId === "kubejs:village_market_controller") {
    count += state.villageMarkets.filter((entry) => includeEntry(entry)).length;
  }

  return count;
}

export function sameChunk(
  left: { x: number; z: number; dimension: string },
  right: { x: number; z: number; dimension: string },
): boolean {
  if (left.dimension !== right.dimension) return false;
  return (
    toChunkCoord(left.x) === toChunkCoord(right.x) &&
    toChunkCoord(left.z) === toChunkCoord(right.z)
  );
}

export function isOutpostPlaceable(
  context: OutpostPlacementContext,
  rules: OutpostPlacementRule[],
): OutpostPlacementResult {
  for (const rule of rules) {
    if (!rule.isAllowed(context)) {
      context.event.player.tell({
        text: rule.message,
        color: "red",
      });
      return {
        placeable: false,
        failedRule: rule,
      };
    }
  }

  console.infof(`[isOutpostPlaceable] All rules passed: ${context.blockId}`);

  return { placeable: true };
}

export function maxPlayerOutpostsRule(
  max: number,
  message: string,
  blockId: OutpostBlockId | null = null,
): OutpostPlacementRule {
  return {
    id:
      blockId == null
        ? `max_player_outposts_${max}`
        : `max_player_outposts_${blockId}_${max}`,
    message,
    isAllowed: (context) => {
      const placedCount =
        blockId == null
          ? countPlayerOutpostsOverall(context.state, context.owner.id)
          : countPlayerOutpostsByBlockId(
              context.state,
              context.owner.id,
              blockId,
            );
      return placedCount < max;
    },
  };
}

export function maxPlayerOutpostsInRadiusRule(
  max: number,
  radius: number,
  message: string,
  blockId: OutpostBlockId | null = null,
): OutpostPlacementRule {
  return {
    id:
      blockId == null
        ? `max_player_outposts_in_${radius}_radius_${max}`
        : `max_player_outposts_in_${radius}_radius_${blockId}_${max}`,
    message,
    isAllowed: (context) =>
      countPlayerOutpostsInRadius(
        context.state,
        context.owner.id,
        String(context.block.getDimension()),
        context.block.getX(),
        context.block.getZ(),
        radius,
        blockId,
      ) < max,
  };
}

export function oneMiningOutpostPerChunkRule(
  message: string,
): OutpostPlacementRule {
  return {
    id: "one_mining_outpost_per_chunk",
    message,
    isAllowed: (context) =>
      !context.state.miningOutposts.some((entry) =>
        sameChunk(
          {
            x: context.block.getX(),
            z: context.block.getZ(),
            dimension: String(context.block.getDimension()),
          },
          entry,
        ),
      ),
  };
}

export function oneVillageMarketPerRegisteredVillageRule(
  message: string,
  villageChunkRadius: number,
): OutpostPlacementRule {
  return {
    id: "one_village_market_per_registered_village",
    message,
    isAllowed: (context) => {
      const dimension = String(context.block.getDimension());
      const chunkX = toChunkCoord(context.block.getX());
      const chunkZ = toChunkCoord(context.block.getZ());

      return !context.state.villageMarkets.some((entry) => {
        if (entry.dimension !== dimension) return false;
        const entryChunkX = toChunkCoord(entry.x);
        const entryChunkZ = toChunkCoord(entry.z);
        return (
          Math.abs(entryChunkX - chunkX) <= villageChunkRadius &&
          Math.abs(entryChunkZ - chunkZ) <= villageChunkRadius
        );
      });
    },
  };
}

export function stampOutpostOwner(
  outpost: MiningOutpostState | VillageMarketState,
  owner: OutpostOwner,
): void {
  outpost.ownerId = owner.id;
  outpost.ownerName = owner.name;
}
