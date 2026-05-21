import {
  ensureMarketEntries,
  handleMiningOutpost,
} from "kubejs_ts/shared/logistica/excavation";
import { handleHubDispatch } from "kubejs_ts/shared/logistica/hub";
import { handleVillageMarket } from "kubejs_ts/shared/logistica/village";
import {
  getRuntimeState,
  persistRuntimeState,
  SIM_INTERVAL_TICKS,
} from "kubejs_ts/shared/minecraft/runtime";
import { RuntimeState } from "kubejs_ts/types/minecraft";

const HARD_RULES = [
  "No force-loaded rail corridors.",
  "No always-on remote Create factories outside the main hub.",
  "No permanently loaded villages for economy simulation.",
  "Keep force-loaded chunk cap very low via FTB Chunks ranks/settings.",
  "Use Create 6.0.9+ on 1.21.1 (includes key railway and contraption optimizations).",
];

function hasRemoteUnloadFallback(state: RuntimeState): boolean {
  const miningUnloaded = state.miningOutposts.some(
    (outpost) => outpost.unloadedCycles > 0,
  );
  if (miningUnloaded) return true;

  return state.villageMarkets.some((market) => market.unloadedCycles > 0);
}

function writeRuleSnapshot(): void {
  JsonIO.write("kubejs/exported/server/logistica_mvp_rules.json", {
    generatedAt: new Date().toISOString(),
    loop: {
      mineOutpost:
        "1 loaded station chunk + scripted ore generation into vault",
      mainHub: "real Create hub district, intended force-loaded endpoint only",
      villageMarket:
        "1 loaded station chunk + scripted demand/orders, no villager simulation",
      trainLines: "never force-loaded between endpoints",
      schedule:
        "hub threshold/inactivity + remote chunk-unloaded fallback buffer",
    },
    hardRules: HARD_RULES,
  } as any);
}

ServerEvents.loaded(() => {
  writeRuleSnapshot();
});

ServerEvents.tick((event) => {
  const state = getRuntimeState();
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

  persistRuntimeState(event.server);
});
