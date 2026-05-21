import { $ArgumentBuilder } from "@package/com/mojang/brigadier/builder";
import { $CommandSourceStack } from "@package/net/minecraft/commands";
import {
  addOrGetCorruptionNode,
  addOrGetPurityRefinery,
  clearCorruptionState,
  getCorruptionSummary,
} from "kubejs_ts/shared/core_awakening/corruption";
import {
  getRuntimeCA,
  getRuntimeState,
  loadRuntimeState,
  RUNTIME_STATE_NBT_KEY,
  saveRuntimeState,
} from "kubejs_ts/shared/minecraft/runtime";

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
              server.persistentData.remove(RUNTIME_STATE_NBT_KEY);

              ctx.source.getPlayer().tell({
                text: "Cleared Logistica persistent data.",
                color: "green",
              });
              return 1;
            }) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
          )
          .then(
            Commands.literal("show").executes((ctx) => {
              ctx.source.getPlayer().tell({
                text: JSON.stringify(getRuntimeState(), null, 2),
                color: "yellow",
              });
              return 1;
            }) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
          )
          .then(
            Commands.literal("load").executes((ctx) => {
              loadRuntimeState(ctx.source.server);

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

              getRuntimeCA().nodesDesintegrated += 1;
              saveRuntimeState(ctx.source.server);
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
          ) as unknown as $ArgumentBuilder<$CommandSourceStack, never>,
      ),
  );
});
