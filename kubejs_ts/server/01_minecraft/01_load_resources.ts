import { priceItems } from "kubejs_ts/shared/logistica/economy";
import { buildMarketEntries } from "kubejs_ts/shared/logistica/market";
import { setKubeJsLoadingStatus } from "kubejs_ts/shared/logistica/bridge";
import { loadItems } from "kubejs_ts/shared/minecraft/item";
import { LoadMaterials } from "kubejs_ts/shared/minecraft/material";
import { loadRecipes } from "kubejs_ts/shared/minecraft/recipe";

const DEFER_KUBEJS_LOAD_UNTIL_WORLD_IS_LOADED = true;
const DEFERRED_RELOAD_DELAY_TICKS_AFTER_LOGIN = 60;

ServerEvents.recipes((event) => {
  if (DEFER_KUBEJS_LOAD_UNTIL_WORLD_IS_LOADED && !global.kubejs.deferredReloadCompleted) {
    global.kubejs.deferredReloadRequested = true;
    console.infof("[KubeJS] Deferring heavy resource load until post-load /reload.");
    return;
  }

  try {
    setKubeJsLoadingStatus(true, "Loading items...", 0.0);
    loadItems();

    setKubeJsLoadingStatus(true, "Loading materials...", 0.2);
    LoadMaterials();

    setKubeJsLoadingStatus(true, "Loading recipes...", 0.4);
    loadRecipes(event);

    setKubeJsLoadingStatus(true, "Loading item prices...", 0.6);
    priceItems();

    setKubeJsLoadingStatus(true, "Loading market entries...", 0.8);
    buildMarketEntries();

    setKubeJsLoadingStatus(true, "Done", 1.0);
  } finally {
    setKubeJsLoadingStatus(false, "", 1.0);
  }
});

PlayerEvents.loggedIn((event) => {
  if (!DEFER_KUBEJS_LOAD_UNTIL_WORLD_IS_LOADED) return;
  if (!global.kubejs.deferredReloadRequested) return;
  if (global.kubejs.deferredReloadCompleted) return;
  if (global.kubejs.deferredReloadTick >= 0) return;

  global.kubejs.deferredReloadTick =
    event.server.getTickCount() + DEFERRED_RELOAD_DELAY_TICKS_AFTER_LOGIN;

  console.infof(
    `[KubeJS] Player joined. Deferred /reload scheduled in ${DEFERRED_RELOAD_DELAY_TICKS_AFTER_LOGIN} ticks.`,
  );
});

ServerEvents.tick((event) => {
  if (!DEFER_KUBEJS_LOAD_UNTIL_WORLD_IS_LOADED) return;
  if (!global.kubejs.deferredReloadRequested) return;
  if (global.kubejs.deferredReloadCompleted) return;
  if (global.kubejs.deferredReloadTick < 0) return;
  if (event.server.getTickCount() < global.kubejs.deferredReloadTick) return;

  global.kubejs.deferredReloadTick = -1;
  global.kubejs.deferredReloadRequested = false;
  global.kubejs.deferredReloadCompleted = true;

  console.infof("[KubeJS] Running deferred silent /reload for resource load.");
  event.server.runCommandSilent("reload");
});

ServerEvents.unloaded(() => {
  global.kubejs.deferredReloadRequested = false;
  global.kubejs.deferredReloadCompleted = false;
  global.kubejs.deferredReloadTick = -1;
});
