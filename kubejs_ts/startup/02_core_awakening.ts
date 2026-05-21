import {
  registerBlocks,
  registerEntityTypes,
  registerSoundEffects,
} from "kubejs_ts/shared/core_awakening";

StartupEvents.registry("block", (event) => registerBlocks(event));
StartupEvents.registry("entity_type", (event) => registerEntityTypes(event));
StartupEvents.registry("sound_event", (event) => registerSoundEffects(event));
