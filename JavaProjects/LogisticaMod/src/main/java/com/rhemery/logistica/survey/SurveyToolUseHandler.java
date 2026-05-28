package com.rhemery.logistica.survey;

import com.rhemery.logistica.Logistica;
import com.rhemery.logistica.network.SurveyNetwork;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionResult;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;

@EventBusSubscriber(modid = Logistica.MODID)
public final class SurveyToolUseHandler {

  private SurveyToolUseHandler() {}

  @SubscribeEvent
  public static void onRightClickItem(PlayerInteractEvent.RightClickItem event) {
    if (event.getLevel().isClientSide()) {
      return;
    }
    if (!(event.getEntity() instanceof ServerPlayer player)) {
      return;
    }

    SurveyTier tier = SurveyToolRegistry.resolveTier(event.getItemStack());
    if (tier == null) {
      return;
    }
    SurveyNetwork.openSurvey(player, tier);
    event.setCanceled(true);
    event.setCancellationResult(InteractionResult.SUCCESS);
  }

  @SubscribeEvent
  public static void onRightClickBlock(PlayerInteractEvent.RightClickBlock event) {
    if (event.getLevel().isClientSide()) {
      return;
    }
    if (!(event.getEntity() instanceof ServerPlayer player)) {
      return;
    }

    SurveyTier tier = SurveyToolRegistry.resolveTier(event.getItemStack());
    if (tier == null) {
      return;
    }
    SurveyNetwork.openSurvey(player, tier);
    event.setCanceled(true);
    event.setCancellationResult(InteractionResult.SUCCESS);
  }
}
