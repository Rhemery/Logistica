package com.rhemery.logistica;

import com.mojang.logging.LogUtils;
import com.rhemery.logistica.network.SurveyNetwork;
import org.slf4j.Logger;

import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.event.lifecycle.FMLCommonSetupEvent;
import net.neoforged.neoforge.common.NeoForge;

@Mod(Logistica.MODID)
public class Logistica {
    public static final String MODID = "logistica";
    public static final Logger LOGGER = LogUtils.getLogger();

    public Logistica(IEventBus modEventBus, ModContainer modContainer) {
        modEventBus.addListener(this::commonSetup);
        modEventBus.addListener(SurveyNetwork::registerPayloads);
        NeoForge.EVENT_BUS.addListener(SurveyNetwork::onPlayerLoggedIn);
    }

    private void commonSetup(FMLCommonSetupEvent event) {
        // Registration is script-driven through LogisticaBridge (e.g. KubeJS).
    }
}
