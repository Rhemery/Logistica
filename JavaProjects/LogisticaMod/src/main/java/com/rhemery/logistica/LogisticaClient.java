package com.rhemery.logistica;

import com.rhemery.logistica.client.loading.KubeJsLoadingStatusHud;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.event.lifecycle.FMLClientSetupEvent;
import net.neoforged.neoforge.common.NeoForge;

@Mod(value = Logistica.MODID, dist = Dist.CLIENT)
public class LogisticaClient {

  public LogisticaClient(IEventBus modEventBus) {
    modEventBus.addListener(LogisticaClient::onClientSetup);
    NeoForge.EVENT_BUS.addListener(KubeJsLoadingStatusHud::onRenderGui);
    NeoForge.EVENT_BUS.addListener(KubeJsLoadingStatusHud::onRenderScreen);
    NeoForge.EVENT_BUS.addListener(KubeJsLoadingStatusHud::onPlayerLoggingOut);
  }

  private static void onClientSetup(FMLClientSetupEvent event) {
    Logistica.LOGGER.info("Logistica client setup complete");
  }
}
