import { $ArgumentBuilder } from "@package/com/mojang/brigadier/builder";
import { $CommandContext } from "@package/com/mojang/brigadier/context";
import { $ResourceOrTagArgument } from "@package/net/minecraft/commands/arguments";
import { $CommandSourceStack } from "@package/net/minecraft/commands";
import { $BlockPos } from "@package/net/minecraft/core";
import { $Registries } from "@package/net/minecraft/core/registries";

const BlockPos = Java.loadClass("net.minecraft.core.BlockPos") as typeof $BlockPos;
const ResourceOrTagArgument = Java.loadClass(
  "net.minecraft.commands.arguments.ResourceOrTagArgument",
) as typeof $ResourceOrTagArgument<any>;
const Registries = Java.loadClass("net.minecraft.core.registries.Registries") as typeof $Registries;

const MAX_BIOME_SEARCH_RADIUS = 6400;
const BIOME_SAMPLE_RESOLUTION_HORIZONTAL = 32;
const BIOME_SAMPLE_RESOLUTION_VERTICAL = 64;

function runBiomeTeleportCommand(ctx: $CommandContext<$CommandSourceStack>): number {
  const source = ctx.source;
  const player = source.getPlayer();

  if (!player) {
    source.server.tell("[BiomeTP] This command can only be executed by a player.");
    return 0;
  }

  const biome = ResourceOrTagArgument.getResourceOrTag(
    ctx,
    "biome",
    Registries.BIOME as never,
  ) as unknown as { asPrintable: () => string };

  const origin = BlockPos.containing(source.getPosition());
  const biomePredicate = biome as unknown as (arg0: unknown) => boolean;
  const result = source
    .getLevel()
    .findClosestBiome3d(
      biomePredicate,
      origin as never,
      MAX_BIOME_SEARCH_RADIUS,
      BIOME_SAMPLE_RESOLUTION_HORIZONTAL,
      BIOME_SAMPLE_RESOLUTION_VERTICAL,
    );

  if (!result) {
    player.tell({
      text: `[BiomeTP] Could not find biome ${biome.asPrintable()} within ${MAX_BIOME_SEARCH_RADIUS} blocks.`,
      color: "red",
    });
    return 0;
  }

  const target = result.getFirst() as unknown as $BlockPos;
  const tx = target.getX();
  const ty = target.getY();
  const tz = target.getZ();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-function-type
  (player.teleportTo as Function)(tx + 0.5, ty, tz + 0.5, player.yRot, player.xRotO);

  const dx = tx - origin.getX();
  const dy = ty - origin.getY();
  const dz = tz - origin.getZ();
  const distance = Math.floor(Math.sqrt(dx * dx + dy * dy + dz * dz));

  player.tell({
    text: `[BiomeTP] Teleported to ${biome.asPrintable()} at ${tx} ${ty} ${tz} (${distance} blocks).`,
    color: "green",
  });

  return Math.max(1, distance);
}

ServerEvents.commandRegistry((event) => {
  const { commands: Commands } = event;

  event.register(
    Commands.literal("biometp")
      .requires((source) => source.hasPermission(2))
      .then(
        Commands.argument(
          "biome",
          ResourceOrTagArgument.resourceOrTag(event.registry, Registries.BIOME as never) as never,
        ).executes(runBiomeTeleportCommand) as unknown as $ArgumentBuilder<
          $CommandSourceStack,
          never
        >,
      ),
  );
});
