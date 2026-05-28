import { $ArgumentBuilder } from "@package/com/mojang/brigadier/builder";
import { $CommandSourceStack } from "@package/net/minecraft/commands";
import { $CompoundTag } from "@package/net/minecraft/nbt";
import { $MinecraftServer } from "@package/net/minecraft/server";
import { $Entity } from "@package/net/minecraft/world/entity";
import {
  addOrGetCorruptionNode,
  addOrGetPurityRefinery,
  clearCorruptionState,
  getCorruptionSummary,
} from "kubejs_ts/shared/core_awakening/corruption";
import { exportBlockPrototypeSnapshot } from "kubejs_ts/shared/core_awakening/block_snapshot";
import { CA_ENTITY_NBT_KEY } from "kubejs_ts/shared/core_awakening/core";
import { CoreAwakening } from "kubejs_ts/shared/core_awakening/runtime";
import { Logistica } from "kubejs_ts/shared/logistica/runtime";
import { toPlainNumber } from "kubejs_ts/shared/math";
import { Minecraft } from "kubejs_ts/shared/minecraft/runtime";

const RUNTIME_NBT_CHUNK_COUNT_SUFFIX = "__parts";
const RUNTIME_NBT_CHUNK_KEY_PREFIX = "__chunk_";

const SERVER_RUNTIME_NBT_KEYS = [
  Minecraft.Runtime.SERVER_NBT_KEY,
  Logistica.Runtime.SERVER_NBT_KEY,
  CoreAwakening.Runtime.SERVER_NBT_KEY,
] as const;

const ENTITY_RUNTIME_NBT_KEYS = [
  Logistica.Runtime.ENTITY_NBT_KEY,
  CoreAwakening.Runtime.ENTITY_NBT_KEY,
  CA_ENTITY_NBT_KEY,
  "kjs_disintegration_bomb_fuse_ticks",
] as const;

const ALL_RUNTIME_NBT_KEYS = [
  ...SERVER_RUNTIME_NBT_KEYS,
  ...ENTITY_RUNTIME_NBT_KEYS,
] as const;

function clearNbtKeyWithChunks(data: $CompoundTag, key: string): number {
  let removed = 0;

  if (data.contains(key)) {
    data.remove(key);
    removed += 1;
  }

  const chunkCountKey = `${key}${RUNTIME_NBT_CHUNK_COUNT_SUFFIX}`;
  if (!data.contains(chunkCountKey)) return removed;

  const count = Math.max(0, data.getInt(chunkCountKey));
  data.remove(chunkCountKey);
  removed += 1;

  for (let i = 0; i < count; i++) {
    const chunkKey = `${key}${RUNTIME_NBT_CHUNK_KEY_PREFIX}${i}`;
    if (!data.contains(chunkKey)) continue;

    data.remove(chunkKey);
    removed += 1;
  }

  return removed;
}

function clearRuntimeNbtFromTag(data: $CompoundTag): number {
  let removed = 0;
  ALL_RUNTIME_NBT_KEYS.forEach((key) => {
    removed += clearNbtKeyWithChunks(data, key);
  });
  return removed;
}

function resetRuntimeInMemoryCache(): void {
  global.runtimeStateCache = {
    minecraft: Minecraft.Runtime.defaultState(),
    core_awakening: CoreAwakening.Runtime.defaultState(),
    logistica: Logistica.Runtime.defaultState(),
  };

  global.__runtime_meta_cache = {
    modules: {},
  };
}

function wipeRuntimeData(server: $MinecraftServer): {
  removedServerKeys: number;
  removedEntityKeys: number;
  touchedEntities: number;
} {
  const removedServerKeys = clearRuntimeNbtFromTag(server.persistentData);

  const seen = new Set<string>();
  let touchedEntities = 0;
  let removedEntityKeys = 0;

  const wipeEntity = (entity: $Entity) => {
    const uuid = entity.getStringUuid();
    if (seen.has(uuid)) return;

    seen.add(uuid);
    touchedEntities += 1;
    removedEntityKeys += clearRuntimeNbtFromTag(entity.persistentData);
  };

  server.getEntities().forEach(wipeEntity);
  server.getPlayers().forEach(wipeEntity);

  resetRuntimeInMemoryCache();

  return {
    removedServerKeys,
    removedEntityKeys,
    touchedEntities,
  };
}

ServerEvents.commandRegistry((event) => {
  const { commands: Commands } = event;

  event.register(
    Commands.literal("logistica")
      // OP level 2+. Also hides command from non-OP command suggestions.
      .requires((source) => source.hasPermission(2))

      .then(
        Commands.literal("persistent")
          .then(
            Commands.literal("clear").executes((ctx) => {
              const server = ctx.source.server;

              // Best practice: keep all your data inside one key.
              server.persistentData.remove(Logistica.Runtime.SERVER_NBT_KEY);

              ctx.source.getPlayer().tell({
                text: "Cleared Logistica persistent data.",
                color: "green",
              });
              return 1;
            }) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
          )
          .then(
            Commands.literal("clear_all_runtime").executes((ctx) => {
              const { removedServerKeys, removedEntityKeys, touchedEntities } =
                wipeRuntimeData(ctx.source.server);
              const player = ctx.source.getPlayer();
              if (player) {
                player.tell({
                  text: `[Debug] Runtime wipe done. Removed server keys: ${removedServerKeys}, entity keys: ${removedEntityKeys}, touched loaded entities: ${touchedEntities}.`,
                  color: "green",
                });
                player.tell({
                  text: "[Debug] Note: unloaded entities/players keep their stored NBT until they load again.",
                  color: "yellow",
                });
              } else {
                ctx.source.server.tell(
                  `[Debug] Runtime wipe done. Removed server keys: ${removedServerKeys}, entity keys: ${removedEntityKeys}, touched loaded entities: ${touchedEntities}.`,
                );
              }
              return 1;
            }) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
          )
          .then(
            Commands.literal("show").executes((ctx) => {
              ctx.source.getPlayer().tell({
                text: JSON.stringify(
                  Logistica.Runtime.getServerState(),
                  null,
                  2,
                ),
                color: "yellow",
              });
              return 1;
            }) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
          )
          .then(
            Commands.literal("load").executes((ctx) => {
              Logistica.Runtime.loadServerState(ctx.source.server);

              ctx.source.getPlayer().tell({
                text: "Loaded Logistica persistent data.",
                color: "green",
              });
              return 1;
            }) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
          ) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
      )
      .then(
        Commands.literal("corruption")
          .then(
            Commands.literal("status").executes((ctx) => {
              const player = ctx.source.getPlayer();
              if (!player) return 0;

              getCorruptionSummary(player).forEach((line) => {
                player.tell({
                  text: `[Corruption] ${line}`,
                  color: "light_purple",
                });
              });
              return 1;
            }) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
          )
          .then(
            Commands.literal("node_here").executes((ctx) => {
              const player = ctx.source.getPlayer();
              if (!player) return 0;

              const level = player.getLevel();
              const x = Math.floor(player.getX());
              const y = Math.floor(player.getY()) - 1;
              const z = Math.floor(player.getZ());
              const block = level.getBlock(x, y, z);
              const node = addOrGetCorruptionNode(ctx.source.server, block, 10);

              player.tell({
                text: `Spawned corruption node at ${node.key}`,
                color: "dark_purple",
              });
              return 1;
            }) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
          )
          .then(
            Commands.literal("refinery_here").executes((ctx) => {
              const player = ctx.source.getPlayer();
              if (!player) return 0;

              const level = player.getLevel();
              const x = Math.floor(player.getX());
              const y = Math.floor(player.getY()) - 1;
              const z = Math.floor(player.getZ());
              const block = level.getBlock(x, y, z);
              const refinery = addOrGetPurityRefinery(ctx.source.server, block);

              player.tell({
                text: `Spawned purity refinery at ${refinery.key}`,
                color: "aqua",
              });
              return 1;
            }) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
          )
          .then(
            Commands.literal("cleanse").executes((ctx) => {
              const player = ctx.source.getPlayer();
              if (!player) return 0;

              const state = CoreAwakening.Runtime.getServerState();
              state.nodesDesintegrated =
                toPlainNumber(state.nodesDesintegrated, 0) + 1;
              CoreAwakening.Runtime.saveServerState(ctx.source.server);
              //applyPurityToPlayer(ctx.source.server, player, 25);
              player.tell({
                text: "Purity surge applied (+25).",
                color: "aqua",
              });
              return 1;
            }) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
          )
          .then(
            Commands.literal("clear_world").executes((ctx) => {
              clearCorruptionState(ctx.source.server);
              const player = ctx.source.getPlayer();
              if (player) {
                player.tell({
                  text: "Cleared tracked corruption nodes/chunks/refineries.",
                  color: "yellow",
                });
              }
              return 1;
            }) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
          )
          .then(
            Commands.literal("export_block_snapshot").executes((ctx) => {
              try {
                const result = exportBlockPrototypeSnapshot(ctx.source.server);
                const player = ctx.source.getPlayer();
                if (player) {
                  player.tell({
                    text: `[Corruption] Exported ${result.blocks} block prototypes to ${result.path}.`,
                    color: "green",
                  });
                }
              } catch (e) {
                const player = ctx.source.getPlayer();
                if (player) {
                  player.tell({
                    text: `[Corruption] Failed to export block prototypes: ${e}`,
                    color: "red",
                  });
                }
              }
              return 1;
            }) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
          ) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
      ),
  );
});
