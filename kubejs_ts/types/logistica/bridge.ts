import { $ServerLevel } from "@package/net/minecraft/server/level";

export type LogisticaBridgeApi = {
  setKubeJsLoadingStatus(visible: boolean, text: string, percentage: number): void;
  clearOreMaterials(): void;
  clearSurveyTiers(): void;
  clearSurveyTools(): void;
  registerOreMaterial(
    itemId: string,
    displayName: string,
    baseChance: number,
    maxSaturation: number,
    noiseScale: number,
    noisePower: number,
  ): void;
  defineSurveyTierCsv(tierId: string, radius: number, materialIdsCsv: string): void;
  registerSurveyTool(itemId: string, tierId: string): void;
  getChunkOres(level: $ServerLevel, chunkX: number, chunkZ: number): unknown;
};

export type MaterialConfig = {
  displayName: string;
  baseChance: number;
  maxSaturation: number;
  noiseScale: number;
  noisePower: number;
};
