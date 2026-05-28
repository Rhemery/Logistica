import { toPlainNumber } from "kubejs_ts/shared/math";
import { CoreAwakening } from "kubejs_ts/shared/core_awakening/runtime";
import { Logistica } from "kubejs_ts/shared/logistica/runtime";
import {
  Minecraft,
  RUNTIME_STATE_SAVE_INTERVAL_TICKS,
} from "kubejs_ts/shared/minecraft/runtime";

const ENTITY_CACHE_PRUNE_INTERVAL_TICKS = 20 * 30;

ServerEvents.loaded((event) => {
  Minecraft.Runtime.loadServerState(event.server);
});

ServerEvents.unloaded((event) => {
  Minecraft.Runtime.saveServerState(event.server);
});

ServerEvents.tick((event) => {
  const state = Minecraft.Runtime.getServerState();
  state.tick = toPlainNumber(state.tick, 0) + 1;

  if (state.tick % RUNTIME_STATE_SAVE_INTERVAL_TICKS === 0) {
    Minecraft.Runtime.saveServerState(event.server);
  }

  if (state.tick % ENTITY_CACHE_PRUNE_INTERVAL_TICKS === 0) {
    CoreAwakening.Runtime.pruneEntityCache(event.server);
    Logistica.Runtime.pruneEntityCache(event.server);
  }
});
