import { tickDisintegrationBombsClient } from "kubejs_ts/shared/core_awakening/disintegration_bomb";

ClientEvents.tick((event) => {
  tickDisintegrationBombsClient(event.level);
});
