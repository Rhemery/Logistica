import { normalizeChunkKey } from "kubejs_ts/shared/core/chunk";
import {
  ensureMarketEntries,
  EXCAVATION_RICHNESS_MAX,
  EXCAVATION_RICHNESS_MIN,
  handleMiningOutpost,
} from "kubejs_ts/shared/core/excavation";
import {
  handleHubDispatch,
  HUB_DEFAULT_THRESHOLD,
  HUB_DEFAULT_WATCH_ITEMS,
  HUB_INACTIVITY_TICKS,
} from "kubejs_ts/shared/core/hub";
import {
  handleVillageMarket,
  VILLAGE_REFRESH_TICKS,
} from "kubejs_ts/shared/core/village";
import { clamp, toPlainNumber } from "kubejs_ts/shared/math";
import {
  getRuntimeState,
  persistRuntimeState,
  resetStateCache,
  RUNTIME_STATE_SAVE_INTERVAL_TICKS,
  runtimeStateCache,
} from "kubejs_ts/shared/runtime";
import type { ItemId } from "kubejs_ts/types";
import type {
  ExcavationChunkState,
  ExcavationResourceShare,
  HubDispatchState,
  LogisticsRuntimeState,
  MarketEntry,
  MiningOutpostState,
  VillageDemandOrder,
  VillageMarketState,
} from "kubejs_ts/types/logistics";
import type { $CompoundTag } from "net.minecraft.nbt.CompoundTag";
import type { $MinecraftServer } from "net.minecraft.server.MinecraftServer";

const SIM_INTERVAL_TICKS = 20 * 10;

const HARD_RULES = [
  "No force-loaded rail corridors.",
  "No always-on remote Create factories outside the main hub.",
  "No permanently loaded villages for economy simulation.",
  "Keep force-loaded chunk cap very low via FTB Chunks ranks/settings.",
  "Use Create 6.0.9+ on 1.21.1 (includes key railway and contraption optimizations).",
];

function hasRemoteUnloadFallback(state: LogisticsRuntimeState): boolean {
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
  });
}

ServerEvents.loaded((event) => {
  resetStateCache();
  getRuntimeState(event.server);
  ensureMarketEntries();
  writeRuleSnapshot();
  console.info("[Logistica] MVP station simulation loaded.");
});

ServerEvents.unloaded((event) => {
  const state = getRuntimeState(event.server);
  persistRuntimeState(event.server);
  JsonIO.write(
    "kubejs/exported/server/logistica_runtime_state.json",
    JSON.parse(JSON.stringify(state, null, 2)) as LogisticsRuntimeState,
  );
});

ServerEvents.tick((event) => {
  const state = getRuntimeState(event.server);
  state.tick = toPlainNumber(state.tick, 0) + 1;

  if (state.tick % RUNTIME_STATE_SAVE_INTERVAL_TICKS === 0) {
    persistRuntimeState(event.server);
  }

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
