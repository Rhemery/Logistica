import { configureSurveyBridge } from "kubejs_ts/shared/logistica/bridge";
import {
  ensureMarketEntries,
  handleMiningOutpost,
} from "kubejs_ts/shared/logistica/excavation";
import { handleHubDispatch } from "kubejs_ts/shared/logistica/hub";
import { Logistica } from "kubejs_ts/shared/logistica/runtime";
import { handleVillageMarket } from "kubejs_ts/shared/logistica/village";
import { SIM_INTERVAL_TICKS } from "kubejs_ts/shared/minecraft/runtime";

function hasRemoteUnloadFallback(
  state: Logistica.Runtime.ServerState,
): boolean {
  const miningUnloaded = state.miningOutposts.some(
    (outpost) => outpost.unloadedCycles > 0,
  );
  if (miningUnloaded) return true;

  return state.villageMarkets.some((market) => market.unloadedCycles > 0);
}

configureSurveyBridge();

ServerEvents.loaded((event) => {
  configureSurveyBridge();
  Logistica.Runtime.loadServerState(event.server);
});

ServerEvents.unloaded((event) => {
  Logistica.Runtime.saveServerState(event.server);
});

ServerEvents.tick((event) => {
  const state = Logistica.Runtime.getServerState();
  if (state.tick % SIM_INTERVAL_TICKS !== 0) return;

  ensureMarketEntries();

  state.miningOutposts.forEach((outpost) => {
    handleMiningOutpost(event.server, outpost, state.tick);
  });

  state.villageMarkets.forEach((market) => {
    handleVillageMarket(event.server, market, state.tick);
  });

  const fallbackEnabled = hasRemoteUnloadFallback(state);

  state.hubs.forEach((hub) => {
    handleHubDispatch(event.server, hub, state.tick, fallbackEnabled);
  });

  Logistica.Runtime.saveServerState(event.server);
});