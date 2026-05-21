import { toPlainNumber } from "kubejs_ts/shared/minecraft/math";
import {
  getRuntimeState,
  loadRuntimeState,
  persistRuntimeState,
  RUNTIME_STATE_SAVE_INTERVAL_TICKS,
  saveRuntimeState,
} from "kubejs_ts/shared/minecraft/runtime";

ServerEvents.loaded((event) => {
  loadRuntimeState(event.server);
});

ServerEvents.unloaded((event) => {
  saveRuntimeState(event.server);
});

ServerEvents.tick((event) => {
  const state = getRuntimeState();
  state.tick = toPlainNumber(state.tick, 0) + 1;

  if (state.tick % RUNTIME_STATE_SAVE_INTERVAL_TICKS === 0) {
    persistRuntimeState(event.server);
  }
});
