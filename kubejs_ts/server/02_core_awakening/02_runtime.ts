import { runCoreAwakeningSimulation } from "kubejs_ts/shared/core_awakening/corruption";
import { tickDisintegrationBombsServer } from "kubejs_ts/shared/core_awakening/disintegration_bomb";
import { CoreAwakening } from "kubejs_ts/shared/core_awakening/runtime";

ServerEvents.loaded((event) => {
  CoreAwakening.Runtime.loadServerState(event.server);
});

ServerEvents.unloaded((event) => {
  CoreAwakening.Runtime.saveServerState(event.server);
});

ServerEvents.tick((event) => {
  const state = CoreAwakening.Runtime.getServerState();
  runCoreAwakeningSimulation(event.server, state);
  tickDisintegrationBombsServer(event.server);
});
