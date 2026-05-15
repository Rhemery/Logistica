import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import os from "node:os";

const CONFIG = {
  minecraftVersion: "1.21.1",

  outputDir: "kubejs_ts/server/exported",

  rootsToScan: [
    "mods",
    "kubejs/data",
    "config/openloader/data",
    "config/paxi/datapacks",
    "saves",
  ],

  extraArchives: [],
};

const RESOURCE_KINDS = [
  {
    kind: "configured_feature",
    regex: /^data\/([^/]+)\/worldgen\/configured_feature\/(.+)\.json$/,
  },
  {
    kind: "placed_feature",
    regex: /^data\/([^/]+)\/worldgen\/placed_feature\/(.+)\.json$/,
  },
  {
    kind: "biome_modifier",
    regex: /^data\/([^/]+)\/neoforge\/biome_modifier\/(.+)\.json$/,
  },
  {
    kind: "biome",
    regex: /^data\/([^/]+)\/worldgen\/biome\/(.+)\.json$/,
  },
  {
    kind: "structure",
    regex: /^data\/([^/]+)\/worldgen\/structure\/(.+)\.json$/,
  },
  {
    kind: "structure_set",
    regex: /^data\/([^/]+)\/worldgen\/structure_set\/(.+)\.json$/,
  },
  {
    kind: "block_loot_table",
    regex: /^data\/([^/]+)\/loot_tables?\/blocks\/(.+)\.json$/,
  },
  {
    kind: "entity_loot_table",
    regex: /^data\/([^/]+)\/loot_tables?\/entities\/(.+)\.json$/,
  },
  {
    kind: "chest_loot_table",
    regex: /^data\/([^/]+)\/loot_tables?\/chests\/(.+)\.json$/,
  },
  {
    kind: "item_tag",
    regex: /^data\/([^/]+)\/tags\/items?\/(.+)\.json$/,
  },
  {
    kind: "block_tag",
    regex: /^data\/([^/]+)\/tags\/blocks?\/(.+)\.json$/,
  },
  {
    kind: "biome_tag",
    regex: /^data\/([^/]+)\/tags\/worldgen\/biome\/(.+)\.json$/,
  },
  {
    kind: "recipe",
    regex: /^data\/([^/]+)\/recipes?\/(.+)\.json$/,
  },
];

function normalizePath(value: string) {
  return value.replaceAll("\\", "/");
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function isArchive(filePath: string) {
  return filePath.endsWith(".jar") || filePath.endsWith(".zip");
}

function isJson(filePath: string) {
  return filePath.endsWith(".json");
}

function walkFiles(root: string) {
  const out: string[] = [];

  if (!fs.existsSync(root)) {
    return out;
  }

  const stat = fs.statSync(root);

  if (stat.isFile()) {
    return [root];
  }

  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        out.push(fullPath);
      }
    }
  }

  return out;
}

function classifyResource(resourcePath: string) {
  const normalized = normalizePath(resourcePath);

  for (const def of RESOURCE_KINDS) {
    const match = normalized.match(def.regex);

    if (match === null) {
      continue;
    }

    const namespace = match[1];
    const localPath = match[2];
    const id = `${namespace}:${localPath}`;

    return {
      kind: def.kind,
      namespace,
      id,
    };
  }

  return null;
}

function safeParseJson(text: string, source: string, resourcePath: string) {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn(`[WorldgenScanner] Invalid JSON: ${source}!/${resourcePath}`);
    console.warn(error);
    return null;
  }
}

function addResource(
  records: object[],
  source: string,
  resourcePath: string,
  text: string,
) {
  const normalizedPath = normalizePath(resourcePath);
  const classification = classifyResource(normalizedPath);

  if (classification === null) {
    return;
  }

  const json = safeParseJson(text, source, normalizedPath);

  if (json === null) {
    return;
  }

  records.push({
    kind: classification.kind,
    id: classification.id,
    namespace: classification.namespace,
    path: normalizedPath,
    json,
  });
}

function scanArchive(filePath: string, records: object[]) {
  let zip;

  try {
    zip = new AdmZip(filePath);
  } catch (error) {
    console.warn(`[WorldgenScanner] Failed to open archive: ${filePath}`);
    console.warn(error);
    return;
  }

  const entries = zip.getEntries();

  for (const entry of entries) {
    if (entry.isDirectory) {
      continue;
    }

    const entryPath = normalizePath(entry.entryName);

    if (!entryPath.startsWith("data/") || !entryPath.endsWith(".json")) {
      continue;
    }

    const classification = classifyResource(entryPath);

    if (classification === null) {
      continue;
    }

    try {
      const text = entry.getData().toString("utf8");
      addResource(records, normalizePath(filePath), entryPath, text);
    } catch (error) {
      console.warn(
        `[WorldgenScanner] Failed to read ${entryPath} in ${filePath}`,
      );
      console.warn(error);
    }
  }
}

function scanLooseFile(filePath: string, records: object[]) {
  const normalized = normalizePath(filePath);
  const dataIndex = normalized.indexOf("/data/");

  let resourcePath = normalized;

  if (dataIndex !== -1) {
    resourcePath = normalized.slice(dataIndex + 1);
  } else if (normalized.startsWith("data/")) {
    resourcePath = normalized;
  } else {
    return;
  }

  const classification = classifyResource(resourcePath);

  if (classification === null) {
    return;
  }

  try {
    const text = fs.readFileSync(filePath, "utf8");
    addResource(records, "loose-file", resourcePath, text);
  } catch (error) {
    console.warn(`[WorldgenScanner] Failed to read loose file: ${filePath}`);
    console.warn(error);
  }
}

function scanAllResources() {
  const records: object[] = [];
  const files: string[] = [];

  for (const root of CONFIG.rootsToScan) {
    files.push(...walkFiles(root));
  }

  for (const extraArchive of resolveExtraArchives()) {
    if (fs.existsSync(extraArchive)) {
      files.push(extraArchive);
    }
  }

  const uniqueFiles = [...new Set(files.map(normalizePath))];

  for (const file of uniqueFiles) {
    if (isArchive(file)) {
      scanArchive(file, records);
    } else if (isJson(file)) {
      scanLooseFile(file, records);
    }
  }

  return records;
}

function groupByKind(records: object[]) {
  const grouped: Record<string, object[]> = {};

  for (const record of records) {
    if (grouped[record.kind] === undefined) {
      grouped[record.kind] = [];
    }

    grouped[record.kind].push(record);
  }

  return grouped;
}

function extractPlacedBlocksFromConfiguredFeature(
  record: Record<string, unknown>,
) {
  const json = record.json;
  const found = new Set();

  function visit(value) {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      for (const child of value) {
        visit(child);
      }
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    if (
      typeof value.Name === "string" &&
      /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(value.Name)
    ) {
      found.add(value.Name);
    }

    for (const child of Object.values(value)) {
      visit(child);
    }
  }

  visit(json);

  return [...found].sort();
}

function extractOreSize(configuredFeatureJson: Record<string, any>) {
  const config = configuredFeatureJson?.config;

  if (
    config !== null &&
    typeof config === "object" &&
    typeof config.size === "number"
  ) {
    return config.size;
  }

  return null;
}

function normalizeFeatureRef(value: string | Record<string, unknown>) {
  if (typeof value === "string") {
    return value;
  }

  if (
    value !== null &&
    typeof value === "object" &&
    typeof value.id === "string"
  ) {
    return value.id;
  }

  return null;
}

function parseHeightValue(value: string | number | Record<string, unknown>) {
  if (typeof value === "number") {
    return value;
  }

  if (value !== null && typeof value === "object") {
    if (typeof value.absolute === "number") return value.absolute;
    if (typeof value.above_bottom === "number") return value.above_bottom;
    if (typeof value.below_top === "number") return -value.below_top;
  }

  return null;
}

function extractPlacementInfo(placedFeatureJson: Record<string, any>) {
  const placement = Array.isArray(placedFeatureJson?.placement)
    ? placedFeatureJson.placement
    : [];

  let count = 1;
  let rarityChance = null;
  let minY = null;
  let maxY = null;
  const modifiers = [];

  for (const modifier of placement) {
    if (modifier === null || typeof modifier !== "object") {
      continue;
    }

    const type = String(modifier.type ?? "unknown");
    modifiers.push(type);

    if (type === "minecraft:count") {
      if (typeof modifier.count === "number") {
        count *= modifier.count;
      } else if (
        modifier.count !== null &&
        typeof modifier.count === "object"
      ) {
        const value =
          typeof modifier.count.value === "number"
            ? modifier.count.value
            : typeof modifier.count.max_inclusive === "number"
              ? modifier.count.max_inclusive
              : null;

        if (value !== null) {
          count *= value;
        }
      }
    }

    if (type === "minecraft:rarity_filter") {
      if (typeof modifier.chance === "number") {
        rarityChance = modifier.chance;
      }
    }

    if (type === "minecraft:height_range") {
      const height = modifier.height;

      if (height !== null && typeof height === "object") {
        const min =
          parseHeightValue(height.min_inclusive) ??
          parseHeightValue(height.min) ??
          null;

        const max =
          parseHeightValue(height.max_inclusive) ??
          parseHeightValue(height.max) ??
          null;

        if (min !== null) minY = min;
        if (max !== null) maxY = max;
      }
    }
  }

  const attemptsPerChunk =
    rarityChance !== null ? count / Math.max(1, rarityChance) : count;

  return {
    feature: normalizeFeatureRef(placedFeatureJson?.feature),
    count,
    rarityChance,
    attemptsPerChunk,
    minY,
    maxY,
    modifiers,
  };
}

function extractBiomeModifierInfo(record: Record<string, any>) {
  const json = record.json;
  const type = typeof json.type === "string" ? json.type : "unknown";

  const features: string[] = [];

  function addFeature(value) {
    if (typeof value === "string") {
      features.push(value);
    } else if (Array.isArray(value)) {
      for (const entry of value) addFeature(entry);
    }
  }

  addFeature(json.features);
  addFeature(json.feature);

  return {
    type,
    biomes: json.biomes ?? null,
    features: [...new Set(features)].sort(),
    step: json.step ?? null,
  };
}

function buildWorldgenSummary(records: Record<string, any>[]) {
  const configuredFeatures = {};
  const placedFeatures = {};
  const biomeModifiers = {};
  const biomes = {};
  const blockLootTables = {};

  for (const record of records) {
    if (record.kind === "configured_feature") {
      configuredFeatures[record.id] = {
        id: record.id,
        type: record.json.type ?? null,
        placedBlocks: extractPlacedBlocksFromConfiguredFeature(record),

        // Use one name everywhere.
        veinSize: extractVeinSize(record.json),

        raw: record.json,
      };
    }

    if (record.kind === "placed_feature") {
      placedFeatures[record.id] = {
        id: record.id,
        ...extractPlacementInfo(record.json),
        raw: record.json,
      };
    }

    if (record.kind === "biome_modifier") {
      biomeModifiers[record.id] = {
        id: record.id,
        ...extractBiomeModifierInfo(record),
        raw: record.json,
      };
    }

    if (record.kind === "biome") {
      biomes[record.id] = {
        id: record.id,
        features: extractPlacedFeaturesFromBiome(record.json),
        raw: record.json,
      };
    }

    if (record.kind === "block_loot_table") {
      blockLootTables[record.id] = {
        id: record.id,
        droppedItems: extractDroppedItemsFromLootTable(record.json),
        raw: record.json,
      };
    }
  }

  const placedFeatureToBiomeModifiers =
    buildPlacedFeatureToBiomeModifiers(biomeModifiers);

  const placedFeatureToBiomeCoverage = buildPlacedFeatureToBiomeCoverage({
    placedFeatures,
    biomeModifiers,
    biomes,
  });

  const naturalBlocks = buildNaturalBlocks({
    configuredFeatures,
    placedFeatures,
    placedFeatureToBiomeModifiers,
    placedFeatureToBiomeCoverage,
    blockLootTables,
  });

  const naturalItems = buildNaturalItems({
    naturalBlocks,
    blockLootTables,
  });

  return {
    configuredFeatures,
    placedFeatures,
    biomeModifiers,
    biomes,
    blockLootTables,

    placedFeatureToBiomeModifiers,
    placedFeatureToBiomeCoverage,

    naturalBlocks,
    naturalItems,
  };
}

function extractPlacedFeaturesFromBiome(biomeJson: Record<string, any>) {
  const result = new Set();

  const features = Array.isArray(biomeJson?.features) ? biomeJson.features : [];

  function visit(value: any) {
    if (typeof value === "string") {
      result.add(value);
      return;
    }

    if (Array.isArray(value)) {
      for (const child of value) {
        visit(child);
      }
    }
  }

  visit(features);

  return [...result].sort();
}

function buildPlacedFeatureToBiomeModifiers(
  biomeModifiers: Record<string, any>,
) {
  const result = {};

  for (const modifier of Object.values(biomeModifiers)) {
    for (const featureId of modifier.features) {
      if (result[featureId] === undefined) {
        result[featureId] = [];
      }

      result[featureId].push(modifier.id);
    }
  }

  return result;
}

function buildPlacedFeatureToBiomeCoverage(input: Record<string, any>) {
  const { biomeModifiers, biomes } = input;

  const result = {};

  // 1. Coverage from NeoForge biome modifiers.
  for (const modifier of Object.values(biomeModifiers)) {
    for (const featureId of modifier.features) {
      if (result[featureId] === undefined) {
        result[featureId] = [];
      }

      result[featureId].push(
        estimateBiomeCoverageFromSelector(modifier.biomes),
      );
    }
  }

  // 2. Coverage from direct biome JSON feature lists.
  const biomeList = Object.values(biomes);
  const totalBiomes = Math.max(1, biomeList.length);
  const featureBiomeCounts = {};

  for (const biome of biomeList) {
    for (const featureId of biome.features) {
      featureBiomeCounts[featureId] = (featureBiomeCounts[featureId] ?? 0) + 1;
    }
  }

  for (const [featureId, count] of Object.entries(featureBiomeCounts)) {
    if (result[featureId] === undefined) {
      result[featureId] = [];
    }

    result[featureId].push(
      Math.max(0.001, Math.min(1, Number(count) / totalBiomes)),
    );
  }

  const finalResult = {};

  for (const [featureId, coverages] of Object.entries(result)) {
    finalResult[featureId] = Math.max(...coverages);
  }

  return finalResult;
}

function writeJson(filePath: string, value: Record<string, any>) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function extractVeinSize(configuredFeatureJson: Record<string, any>) {
  const config = configuredFeatureJson?.config;

  if (
    config !== null &&
    typeof config === "object" &&
    typeof config.size === "number"
  ) {
    return config.size;
  }

  return 1;
}

function estimateBiomeCoverageFromSelector(selector: any) {
  if (selector === null || selector === undefined) return 0.5;

  if (typeof selector === "string") {
    if (selector === "#minecraft:is_overworld") return 1.0;
    if (selector === "#minecraft:is_nether") return 1.0;
    if (selector === "#minecraft:is_end") return 1.0;

    if (selector.startsWith("#")) return 0.35;

    return 0.03; // one explicit biome
  }

  if (Array.isArray(selector)) {
    return Math.min(1, Math.max(0.03, selector.length * 0.03));
  }

  if (typeof selector === "object") {
    // Some selectors use objects/conditions. Unknown but probably not global.
    return 0.25;
  }

  return 0.5;
}

function extractDroppedItemsFromLootTable(lootJson: Record<string, any>) {
  const result = new Map();

  function addItem(itemId: string, multiplier: number) {
    const current = result.get(itemId) ?? 0;
    result.set(itemId, current + multiplier);
  }

  function visit(value: any, multiplier = 1) {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      for (const child of value) {
        visit(child, multiplier);
      }

      return;
    }

    if (typeof value !== "object") return;

    if (
      (value.type === "minecraft:item" || value.type === "item") &&
      typeof value.name === "string"
    ) {
      addItem(value.name, multiplier);
    }

    // Basic support for set_count.
    if (Array.isArray(value.functions)) {
      for (const fn of value.functions) {
        if (
          fn !== null &&
          typeof fn === "object" &&
          fn.function === "minecraft:set_count"
        ) {
          if (typeof fn.count === "number") {
            multiplier *= fn.count;
          } else if (
            fn.count !== null &&
            typeof fn.count === "object" &&
            typeof fn.count.max === "number"
          ) {
            multiplier *= fn.count.max;
          }
        }
      }
    }

    for (const child of Object.values(value)) {
      visit(child, multiplier);
    }
  }

  visit(lootJson);

  return [...result.entries()]
    .map(([itemId, multiplier]) => ({
      itemId,
      multiplier: Math.max(1, multiplier),
    }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
}

function writeTypeScriptModule(summary: Record<string, any>) {
  const out = `// Generated by scripts/scan-worldgen.mjs
// Do not edit manually.

export const WORLDGEN_SUMMARY = ${JSON.stringify(summary, null, 2)} as const;
`;

  const filePath = "kubejs_ts/shared/worldgen.ts";
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, out);
}

function getPossibleMinecraftRoots() {
  const home = os.homedir();
  const appData = process.env.APPDATA;
  const localAppData = process.env.LOCALAPPDATA;

  const roots = [];

  // Standard launcher path on Windows
  if (appData) {
    roots.push(path.join(appData, ".minecraft"));
  }

  // Prism / MultiMC style paths are not guaranteed, but these catch some setups
  if (appData) {
    roots.push(path.join(appData, "PrismLauncher"));
    roots.push(path.join(appData, "PolyMC"));
    roots.push(path.join(appData, "MultiMC"));
  }

  if (localAppData) {
    roots.push(path.join(localAppData, "Packages"));
  }

  // Linux/macOS-ish
  roots.push(path.join(home, ".minecraft"));
  roots.push(path.join(home, "Library", "Application Support", "minecraft"));

  // Current CurseForge instance parent candidates
  roots.push(process.cwd());
  roots.push(path.resolve(process.cwd(), ".."));
  roots.push(path.resolve(process.cwd(), "..", ".."));

  return [...new Set(roots)];
}

function findVanillaJar(version: string) {
  const candidates = [];

  for (const root of getPossibleMinecraftRoots()) {
    candidates.push(path.join(root, "versions", version, `${version}.jar`));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function findMinecraftJarBySearch(version: string) {
  const roots = getPossibleMinecraftRoots();
  const expectedName = `${version}.jar`;

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;

    const stack = [root];
    let visited = 0;

    while (stack.length > 0 && visited < 20000) {
      visited++;

      const current = stack.pop();

      let entries;
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);

        if (entry.isDirectory()) {
          // Avoid huge unrelated folders
          if (
            entry.name === "node_modules" ||
            entry.name === ".git" ||
            entry.name === "logs" ||
            entry.name === "crash-reports" ||
            entry.name === "saves"
          ) {
            continue;
          }

          stack.push(fullPath);
        } else if (entry.isFile() && entry.name === expectedName) {
          return fullPath;
        }
      }
    }
  }

  return null;
}

function resolveExtraArchives() {
  const archives = [...CONFIG.extraArchives];

  const directVanillaJar = findVanillaJar(CONFIG.minecraftVersion);
  const searchedVanillaJar =
    directVanillaJar === null
      ? findMinecraftJarBySearch(CONFIG.minecraftVersion)
      : null;

  const vanillaJar = directVanillaJar ?? searchedVanillaJar;

  if (vanillaJar !== null) {
    console.log(`[WorldgenScanner] Found vanilla jar: ${vanillaJar}`);
    archives.push(vanillaJar);
  } else {
    console.warn(
      `[WorldgenScanner] Could not find vanilla Minecraft ${CONFIG.minecraftVersion} jar automatically.`,
    );
    console.warn("[WorldgenScanner] Add it manually to CONFIG.extraArchives.");
  }

  return [...new Set(archives.map(normalizePath))];
}

function buildNaturalBlocks(input: Record<string, any>) {
  const {
    configuredFeatures,
    placedFeatures,
    placedFeatureToBiomeModifiers,
    placedFeatureToBiomeCoverage,
  } = input;

  const naturalBlocks = {};

  for (const placedFeature of Object.values(placedFeatures)) {
    const configuredFeatureId = placedFeature.feature;

    if (configuredFeatureId === null) {
      continue;
    }

    const configured = configuredFeatures[configuredFeatureId];

    if (configured === undefined) {
      continue;
    }

    const biomeCoverage = placedFeatureToBiomeCoverage[placedFeature.id] ?? 0.5;

    for (const blockId of configured.placedBlocks) {
      if (naturalBlocks[blockId] === undefined) {
        naturalBlocks[blockId] = [];
      }

      const source = {
        blockId,
        configuredFeatureId,
        placedFeatureId: placedFeature.id,

        biomeModifierIds: placedFeatureToBiomeModifiers[placedFeature.id] ?? [],

        configuredFeatureType: configured.type,

        veinSize: configured.veinSize ?? 1,
        attemptsPerChunk: placedFeature.attemptsPerChunk ?? 1,
        count: placedFeature.count ?? 1,
        rarityChance: placedFeature.rarityChance ?? null,

        minY: placedFeature.minY ?? null,
        maxY: placedFeature.maxY ?? null,

        biomeCoverage,
        dropMultiplier: 1,
      };

      naturalBlocks[blockId].push({
        ...source,
        abundance: calculateAbundance(source),
      });
    }
  }

  return naturalBlocks;
}

function buildNaturalItems(input: Record<string, any>) {
  const { naturalBlocks, blockLootTables } = input;

  const naturalItems = {};

  for (const [blockId, sources] of Object.entries(naturalBlocks)) {
    const lootTable = blockLootTables[blockId];

    const drops =
      lootTable !== undefined && lootTable.droppedItems.length > 0
        ? lootTable.droppedItems
        : [{ itemId: blockId, multiplier: 1 }];

    for (const drop of drops) {
      if (naturalItems[drop.itemId] === undefined) {
        naturalItems[drop.itemId] = [];
      }

      for (const source of sources) {
        const itemSource = {
          ...source,
          itemId: drop.itemId,
          droppedFromBlockId: blockId,
          dropMultiplier: drop.multiplier ?? 1,
        };

        naturalItems[drop.itemId].push({
          ...itemSource,
          abundance: calculateAbundance(itemSource),
        });
      }
    }
  }

  return naturalItems;
}

function calculateAbundance(source: Record<string, any>) {
  const worldHeight = 384;

  const heightCoverage =
    source.minY !== null && source.maxY !== null
      ? Math.max(1, source.maxY - source.minY + 1) / worldHeight
      : 1;

  return (
    Math.max(0.001, source.attemptsPerChunk) *
    Math.max(1, source.veinSize) *
    Math.max(0.001, heightCoverage) *
    Math.max(0.001, source.biomeCoverage) *
    Math.max(0.001, source.dropMultiplier)
  );
}

function main() {
  ensureDir(CONFIG.outputDir);

  console.log("[WorldgenScanner] Scanning archives and datapack folders...");

  const records = scanAllResources();
  const grouped = groupByKind(records);
  const summary = buildWorldgenSummary(records);

  writeJson(
    path.join(CONFIG.outputDir, "worldgen_resources.raw.json"),
    records,
  );
  writeJson(
    path.join(CONFIG.outputDir, "worldgen_resources.by_kind.json"),
    grouped,
  );
  writeJson(path.join(CONFIG.outputDir, "worldgen_summary.json"), summary);

  const counts = {};

  for (const [kind, list] of Object.entries(grouped)) {
    counts[kind] = list.length;
  }

  writeJson(path.join(CONFIG.outputDir, "worldgen_counts.json"), counts);

  writeTypeScriptModule(summary);

  console.log("[WorldgenScanner] Done.");
  console.log(`[WorldgenScanner] Total resources: ${records.length}`);
  console.log(`[WorldgenScanner] Output: ${CONFIG.outputDir}`);
  console.log("[WorldgenScanner] Counts:");
  console.log(counts);
}

main();
