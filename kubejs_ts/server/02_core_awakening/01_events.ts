import { ItemId } from "kubejs_ts/types/minecraft";
import {
  CORRUPTION_NODE_BLOCK_IDS,
  PURITY_REFINERY_BLOCK_IDS,
} from "kubejs_ts/shared/core_awakening/config/corruption";
import { $LivingEntity } from "@package/net/minecraft/world/entity";
import { $Player } from "@package/net/minecraft/world/entity/player";
import {
  handleCorruptionNodeBroken,
  handleCorruptionNodePlacement,
  handlePurityFoodEaten,
  handlePurityRefineryPlacement,
  removePurityRefinery,
} from "kubejs_ts/shared/core_awakening/corruption";
import { CoreAwakening } from "kubejs_ts/shared/core_awakening/runtime";
import {
  DISINTEGRATION_BOMB_BLOCK_ID,
  DISINTEGRATION_BOMB_DEFAULT_FUSE_TICKS,
} from "kubejs_ts/shared/core_awakening/config/disintegration_bomb";
import { isMainHand } from "kubejs_ts/shared/minecraft/utils";
import {
  armChainDisintegrationBomb,
  armDisintegrationBomb,
  isDisintegrationBombIgniter,
} from "kubejs_ts/shared/core_awakening/disintegration_bomb";

CORRUPTION_NODE_BLOCK_IDS.forEach((blockId) => {
  BlockEvents.placed(blockId, (event) => {
    if (event.level.isClientSide()) return;
    handleCorruptionNodePlacement(event.server, event.block);
  });

  BlockEvents.broken(blockId, (event) => {
    if (event.level.isClientSide()) return;
    handleCorruptionNodeBroken(
      event.server,
      event.block,
      event.player as $Player & $LivingEntity,
    );
  });
});

PURITY_REFINERY_BLOCK_IDS.forEach((blockId) => {
  BlockEvents.placed(blockId, (event) => {
    if (event.level.isClientSide()) return;
    handlePurityRefineryPlacement(event.server, event.block);
  });

  BlockEvents.broken(blockId, (event) => {
    if (event.level.isClientSide()) return;
    removePurityRefinery(event.server, event.block);
  });
});

ItemEvents.foodEaten((event) => {
  if (!event.entity.isLiving()) return;
  if (!event.entity.isPlayer()) return;
  handlePurityFoodEaten(event.server, event.entity, event.item.id as ItemId);
});

EntityEvents.spawned((event) => {
  if (event.level.isClientSide()) return;
  if (!event.entity.isLiving()) return;

  CoreAwakening.Runtime.loadEntityState(event.entity);
  CoreAwakening.Runtime.saveEntityState(event.entity);
});

BlockEvents.rightClicked(DISINTEGRATION_BOMB_BLOCK_ID, (event) => {
  if (event.level.isClientSide()) return;
  if (!isMainHand(event.hand)) return;

  const itemId = event.item.getId();
  if (!isDisintegrationBombIgniter(itemId)) return;

  const armed = armDisintegrationBomb(
    event.server,
    event.level,
    event.block.x,
    event.block.y,
    event.block.z,
    DISINTEGRATION_BOMB_DEFAULT_FUSE_TICKS,
  );
  if (!armed) return;

  if (!event.player.isCreative()) {
    event.player.getItemInHand("main_hand").shrink(1);
  }

  event.success();
});

LevelEvents.afterExplosion((event) => {
  if (event.level.isClientSide()) return;

  event.affectedBlocks.forEach((affectedBlock) => {
    if (affectedBlock.id !== DISINTEGRATION_BOMB_BLOCK_ID) return;

    armChainDisintegrationBomb(
      event.server,
      event.level,
      affectedBlock.x,
      affectedBlock.y,
      affectedBlock.z,
    );
  });
});
