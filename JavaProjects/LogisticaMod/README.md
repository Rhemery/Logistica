Logistica (NeoForge 1.21.1)
=======

This mod provides procedural ore-field data per chunk (no block generation) and a survey UI pipeline for ore excavation gameplay.

What is implemented
=======

- Deterministic ore profile generation per chunk using layered value-noise and biome tag bias.
- Persistent chunk ore data stored in level `SavedData`.
- Survey tool system with tiers (radius + allowed materials).
- Right-click interaction handler for registered survey tools.
- Client survey screen with:
  - material list
  - live heatmap
  - smooth interpolation between updates
  - movement while screen is open
- KubeJS-friendly static Java bridge (`LogisticaBridge`) to register materials, tiers, tools, and query chunk ore saturation.

KubeJS Bridge
=======

Main API class: `com.rhemery.logistica.LogisticaBridge`

Useful methods:

- `bootstrapDefaults()`
- `registerOreMaterial(String id, float baseChance, float maxSaturation, float noiseScale, float noisePower)`
- `registerOreMaterial(String id, ..., Map<String, Float> biomeTagBias)`
- `defineSurveyTier(String tierId, int radius, Collection<String> materialIds)`
- `registerSurveyTool(String itemId, String tierId)`
- `getChunkOres(ServerLevel level, int chunkX, int chunkZ)`
- `getChunkOreSaturation(ServerLevel level, int chunkX, int chunkZ, String materialId)`

Build
=======

- `gradlew compileJava`
