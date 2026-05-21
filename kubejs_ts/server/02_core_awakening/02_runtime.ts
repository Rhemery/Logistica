import { runCoreAwakeningSimulation } from "kubejs_ts/shared/core_awakening/corruption";
import { tickDisintegrationBombs } from "kubejs_ts/shared/core_awakening/disintegration_bomb";
import {
  getRuntimeState,
  persistRuntimeState,
  SIM_INTERVAL_TICKS,
} from "kubejs_ts/shared/minecraft/runtime";

ServerEvents.tick((event) => {
  const state = getRuntimeState();
  if (state.tick % SIM_INTERVAL_TICKS !== 0) return;
  runCoreAwakeningSimulation(event.server, state.tick);
  persistRuntimeState(event.server);
});

ServerEvents.tick((event) => {
  tickDisintegrationBombs(event.server);
});
