import { registerBlocks, registerItems } from "kubejs_ts/shared/logistica";

StartupEvents.registry("block", (event) => registerBlocks(event));
StartupEvents.registry("item", (event) => registerItems(event));
