import { toChunkCoord } from "kubejs_ts/shared/minecraft/chunk";
import { MARKET_TERMINAL_BLOCK_ID } from "../market_terminal";
import {
  maxPlayerOutpostsRule,
  oneMiningOutpostPerChunkRule,
  OutpostBlockId,
  OutpostPlacementContext,
  OutpostPlacementRule,
} from "../outpost";
import {
  discoverVillageChunksFromPlacement,
  isVillageChunkAllowed,
  VILLAGE_REGISTER_CHUNK_RADIUS,
} from "../village";

export const OUTPOST_PLACE_RULES = {
  "kubejs:market_terminal": [
    maxPlayerOutpostsRule(
      1,
      "For now, each player can place only one Market Terminal.",
      MARKET_TERMINAL_BLOCK_ID,
    ),
  ],
  "kubejs:mining_outpost_controller": [
    oneMiningOutpostPerChunkRule(
      "Only one Mining Outpost Controller can be placed per chunk.",
    ),
  ],
  "kubejs:village_market_controller": [
    {
      id: "village_chunk_detected",
      message:
        "Village Market Controller can only be placed in a detected village chunk.",
      isAllowed: (ctx: OutpostPlacementContext) => {
        const inAllowedChunk = isVillageChunkAllowed(
          ctx.state,
          String(ctx.block.getDimension()),
          ctx.block.getX(),
          ctx.block.getZ(),
        );
        const discoveredNow = discoverVillageChunksFromPlacement(
          ctx.event.server,
          ctx.block,
        );

        return inAllowedChunk || discoveredNow;
      },
    },
    {
      id: "one_village_market_per_registered_village",
      message:
        "Only one Village Market Controller can be placed per detected village.",
      isAllowed: (ctx: OutpostPlacementContext) => {
        const dimension = String(ctx.block.getDimension());
        const chunkX = toChunkCoord(ctx.block.getX());
        const chunkZ = toChunkCoord(ctx.block.getZ());

        return !ctx.state.villageMarkets.some((entry) => {
          if (entry.dimension !== dimension) return false;
          const entryChunkX = toChunkCoord(entry.x);
          const entryChunkZ = toChunkCoord(entry.z);
          return (
            Math.abs(entryChunkX - chunkX) <= VILLAGE_REGISTER_CHUNK_RADIUS &&
            Math.abs(entryChunkZ - chunkZ) <= VILLAGE_REGISTER_CHUNK_RADIUS
          );
        });
      },
    },
  ],
} as Record<OutpostBlockId, OutpostPlacementRule[]>;
