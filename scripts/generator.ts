/*
  Core Awakening corruption asset generator for KubeJS / NeoForge 1.21.1

  What it does:
  - scans vanilla + mod assets from jars or directories
  - finds simple item models and simple blockstates/models
  - generates dead + corrupted PNG variants
  - generates block model JSON files for generated block variants
  - generates TypeScript startup scripts for KubeJS block/item registration
  - writes a report.json with processed / skipped assets

  Install:
    pnpm add -D adm-zip pngjs

  Run:
    pnpm tsx scripts/generate-corruption-assets.ts

  Notes:
  - this intentionally targets SIMPLE items/blocks first
  - items: generated / handheld parents
  - blocks: simple parents like cube_all / cube_bottom_top / cube_column / orientable
  - it creates NEW corrupted variants, it does not overwrite original assets
*/

import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { PNG } from "pngjs";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

type ParentModel =
  | "minecraft:item/generated"
  | "minecraft:item/handheld"
  | "minecraft:item/handheld_rod"
  | "minecraft:block/cube_all"
  | "minecraft:block/cube_bottom_top"
  | "minecraft:block/cube_column"
  | "minecraft:block/cube_column_horizontal"
  | "minecraft:block/orientable";

type SourceKind = "dir" | "zip";

type CandidateKind = "item" | "block";
type BlockVariantStage = "dead" | "corrupted";

type SupportedBlockParent = string;
type BlockRenderType = "cutout" | "cutout_mipped";
type ConversionDirection = "up" | "down" | "both";
type DeadVariantConversionMode = "none" | "insert";

type BlockTextureKeyResolver = (textures: Record<string, string>) => string[];

type BlockTextureKeyConfig = readonly string[] | BlockTextureKeyResolver;

interface BlockParentDefinition {
  enabled: boolean;
  requiredTextureKeys: BlockTextureKeyConfig;
  renderType?: BlockRenderType;
  usePlantSettings?: boolean;
  useSourceModelAsParent?: boolean;
}

interface BlockConversionOverride {
  from: string;
  to: string | null;
  direction?: ConversionDirection;
}

interface BlockDeadVariantOverride {
  source: string;
  // "insert": source -> dead -> corrupted chain.
  // "none": source -> corrupted chain (dead block can still be generated).
  conversionMode?: DeadVariantConversionMode;
}

type BlockDeadVariantOverrideEntry = string | BlockDeadVariantOverride;

interface DeadVariantConfig {
  enabled: boolean;
  displayPrefix: string;
  registryPrefix: string;
  defaultConversionMode: DeadVariantConversionMode;
  // Sample textures used to derive a dead-tone color profile automatically.
  referenceTexturePaths: string[];
  // Used if no reference textures could be read.
  fallbackTintColor: number;
  desaturate: number;
  contrast: number;
  brightness: number;
}

interface BlockRegistrationTintConfig {
  color: number;
  tintIndices: number[];
}

interface BlockRegistrationKeywordSoundRule {
  keyword: string;
  soundType: string;
}

interface BlockRegistrationKeywordTintRule {
  keyword: string;
  color: number;
  tintIndices: number[];
}

interface BlockRegistrationOverride {
  soundType?: string;
  tintColor?: number;
  tintIndices?: number[];
  renderType?: BlockRenderType | null;
  usePlantSettings?: boolean;
  copyPropertiesFrom?: boolean;
}

interface BlockRegistrationConfig {
  emitTintCallbacks: boolean;
  bakeTintedTextures: boolean;
  copyPropertiesFromSource: boolean;
  copyPropertiesFromSafeOnly: boolean;
  applyPrototypeSnapshot: boolean;
  prototypeSnapshotPath?: string;
  defaultSoundType: string;
  soundTypeByParent: Record<string, string>;
  soundTypeKeywordRules: BlockRegistrationKeywordSoundRule[];
  tintByParent: Record<string, BlockRegistrationTintConfig>;
  tintKeywordRules: BlockRegistrationKeywordTintRule[];
  overrides: Record<string, BlockRegistrationOverride>;
}

interface CorruptionOverlayConfig {
  path: string;
  opacity: number;
}

interface CorruptionLevelConfig {
  id: string;
  displayPrefix: string;
  registryPrefix: string;
  tintStrength: number;
  overlay?: CorruptionOverlayConfig;
}

interface LoadedCorruptionOverlay {
  opacity: number;
  png: PNG;
}

interface LoadedCorruptionLevel extends CorruptionLevelConfig {
  overlayImage?: LoadedCorruptionOverlay;
}

interface GeneratorConfig {
  inputs: string[];
  outRoot: string;
  generatedNamespace: string;
  registryNamespace: string;
  tsOutDir: string;
  includeNamespaces?: string[];
  excludeNamespaces?: string[];
  copyMcmeta: boolean;
  item: {
    enabled: boolean;
    supportedParents: ParentModel[];
    supportedIds: string[];
  };
  block: {
    enabled: boolean;
    supportedParents: SupportedBlockParent[];
    supportedIds: string[];
    registration: BlockRegistrationConfig;
    deadVariant: DeadVariantConfig;
    deadVariantOverrides: Record<string, BlockDeadVariantOverrideEntry>;
    conversionOverrides: BlockConversionOverride[];
  };
  corruptionLevels: CorruptionLevelConfig[];
  transform: {
    desaturate: number;
    targetR: number;
    targetG: number;
    targetB: number;
  };
}

interface ResourceLocation {
  namespace: string;
  path: string;
}

interface AssetEntry {
  assetPath: string;
  sourceKind: SourceKind;
  sourceRoot: string;
  filePath?: string;
  zipPath?: string;
}

interface ResolvedModel {
  parentChain: string[];
  textures: Record<string, string>;
  tintedTextureRefs: string[];
}

interface ItemCandidate {
  kind: "item";
  originalId: string;
  registryId: string;
  displayName: string;
  sourceNamespace: string;
  sourcePath: string;
  parentModel: string;
  layers: Record<string, string>;
}

interface BlockCandidate {
  kind: "block";
  stage: BlockVariantStage;
  originalId: string;
  registryId: string;
  displayName: string;
  sourceNamespace: string;
  sourcePath: string;
  sourceBlockId: string;
  deadVariantConversionMode: DeadVariantConversionMode;
  applyDeadVariantPrepass: boolean;
  selectedParent: SupportedBlockParent;
  parentModel: SupportedBlockParent;
  textures: Record<string, string>;
  tintedTextureKeys: string[];
  modelResourceLocation: string;
  corruptionLevel?: LoadedCorruptionLevel;
}

interface DeadVariantColorProfile {
  tint: { r: number; g: number; b: number };
  desaturate: number;
  contrast: number;
  brightness: number;
}

interface Report {
  generatedItems: number;
  generatedBlocks: number;
  skippedItems: Array<{ id: string; reason: string }>;
  skippedBlocks: Array<{ id: string; reason: string }>;
}

interface BlockPrototypeSnapshotEntry {
  id: string;
  tags?: string[];
  properties?: Array<{ name?: string }>;
  flags?: {
    requiresTool?: boolean;
  };
  stats?: {
    destroySpeed?: number;
    explosionResistance?: number;
    friction?: number;
    speedFactor?: number;
    jumpFactor?: number;
    lightEmission?: number;
  };
}

interface BlockPrototypeSnapshotFile {
  blocks?: BlockPrototypeSnapshotEntry[];
}

interface ResolvedBlockGenerationSource {
  sourceBlockId: string;
  sourceNamespace: string;
  sourcePath: string;
  selectedParent: SupportedBlockParent;
  parentModel: SupportedBlockParent;
  textures: Record<string, string>;
  tintedTextureKeys: string[];
}

interface ResolvedBlockGenerationSourceResult {
  source?: ResolvedBlockGenerationSource;
  reason?: string;
}

// Add or edit block parent support in this single table.
const BLOCK_PARENT_DEFINITIONS: Record<string, BlockParentDefinition> = {
  "minecraft:block/cube_all": {
    enabled: true,
    requiredTextureKeys: ["all"],
  },
  "minecraft:block/cube_bottom_top": {
    enabled: true,
    requiredTextureKeys: ["side", "top", "bottom"],
  },
  "minecraft:block/cube_column": {
    enabled: true,
    requiredTextureKeys: ["side", "end"],
  },
  "minecraft:block/cube_column_horizontal": {
    enabled: true,
    requiredTextureKeys: ["side", "end"],
  },
  "minecraft:block/orientable": {
    enabled: true,
    requiredTextureKeys: ["front", "side", "top"],
  },
  "minecraft:block/cross": {
    enabled: true,
    requiredTextureKeys: ["cross"],
    renderType: "cutout",
    usePlantSettings: true,
  },
  "minecraft:block/tinted_cross": {
    enabled: true,
    requiredTextureKeys: ["cross"],
    renderType: "cutout",
    usePlantSettings: true,
  },
  "minecraft:block/template_seagrass": {
    enabled: true,
    requiredTextureKeys: ["texture"],
    renderType: "cutout",
    usePlantSettings: true,
  },
  "minecraft:block/leaves": {
    enabled: true,
    requiredTextureKeys: ["all"],
    renderType: "cutout_mipped",
  },
  "minecraft:block/block": {
    enabled: true,
    requiredTextureKeys: getResolvableTextureKeys,
    useSourceModelAsParent: true,
  },
};

function getDefaultSupportedBlockParents(): SupportedBlockParent[] {
  return Object.entries(BLOCK_PARENT_DEFINITIONS)
    .filter(([, definition]) => definition.enabled)
    .map(([parent]) => parent);
}

const DEFAULT_BLOCK_SOUND_BY_PARENT: Record<string, string> = {
  "minecraft:block/leaves": "grass",
  "minecraft:block/tinted_cross": "grass",
  "minecraft:block/cross": "grass",
  "minecraft:block/template_seagrass": "wet_grass",
};

const DEFAULT_BLOCK_SOUND_KEYWORD_GROUPS: Record<string, string[]> = {
  grass: ["leaves", "grass", "sapling", "fern", "flower", "mushroom"],
  crop: ["crop"],
  roots: ["roots"],
  vine: ["vine"],
  wool: ["wool", "carpet"],
  glass: ["glass", "ice"],
  sand: ["sand"],
  gravel: ["gravel"],
  wood: ["wood", "log", "planks"],
  bamboo: ["bamboo"],
  stem: ["stem"],
  nether_wood: ["hyphae"],
  metal: ["metal", "iron", "gold"],
  copper: ["copper"],
  chain: ["chain"],
  anvil: ["anvil"],
  amethyst: ["amethyst"],
};

const DEFAULT_BLOCK_TINT_BY_PARENT: Record<string, BlockRegistrationTintConfig> = {
  "minecraft:block/leaves": { color: 0x48b518, tintIndices: [0] },
  "minecraft:block/tinted_cross": { color: 0x79c05a, tintIndices: [0] },
  "minecraft:block/template_seagrass": { color: 0x79c05a, tintIndices: [0] },
};

const DEFAULT_BLOCK_TINT_KEYWORD_GROUPS: Array<{
  keywords: string[];
  color: number;
  tintIndices: number[];
}> = [
  { keywords: ["leaves"], color: 0x48b518, tintIndices: [0] },
  {
    keywords: ["grass_block", "grass", "sapling", "fern", "vine", "seagrass"],
    color: 0x79c05a,
    tintIndices: [0],
  },
];

function buildKeywordSoundRules(
  groups: Record<string, string[]>,
): BlockRegistrationKeywordSoundRule[] {
  const out: BlockRegistrationKeywordSoundRule[] = [];
  for (const [soundType, keywords] of Object.entries(groups)) {
    for (const keyword of keywords) {
      out.push({ keyword, soundType });
    }
  }
  return out;
}

function buildKeywordTintRules(
  groups: Array<{ keywords: string[]; color: number; tintIndices: number[] }>,
): BlockRegistrationKeywordTintRule[] {
  const out: BlockRegistrationKeywordTintRule[] = [];
  for (const group of groups) {
    for (const keyword of group.keywords) {
      out.push({
        keyword,
        color: group.color,
        tintIndices: group.tintIndices,
      });
    }
  }
  return out;
}

const version = "1.21.1";
const outRoot = process.env.CORRUPTION_OUT_ROOT ?? "kubejs/assets";
const tsOutDir =
  process.env.CORRUPTION_TS_OUT_DIR ??
  "kubejs_ts/startup/02_core_awakening";
const CONFIG: GeneratorConfig = {
  // Order matters: later inputs override earlier inputs.
  // Put vanilla/client jar first, then mod jars or resource folders.
  inputs: [
    path.join(
      process.cwd(),
      "..",
      "..",
      "Install",
      "versions",
      version,
      `${version}.jar`,
    ),
  ],
  outRoot: path.resolve(outRoot),
  tsOutDir: path.resolve(tsOutDir),
  generatedNamespace: "coreawakening_generated",
  registryNamespace: "kubejs",
  includeNamespaces: undefined,
  excludeNamespaces: ["forge", "neoforge", "fml"],
  copyMcmeta: true,
  item: {
    enabled: false,
    supportedParents: [
      "minecraft:item/generated",
      "minecraft:item/handheld",
      "minecraft:item/handheld_rod",
    ],
    supportedIds: [],
  },
  block: {
    enabled: true,
    supportedParents: getDefaultSupportedBlockParents(),
    supportedIds: [],
    registration: {
      // KubeJS 1.21.1 can produce missing-model rendering on some custom-model blocks
      // when .color(...) is applied. Keep this off unless you verify it works.
      emitTintCallbacks: false,
      // Bake tint-index model colors (grass/leaves/etc.) directly into generated
      // textures so blocks don't render gray without client color handlers.
      bakeTintedTextures: true,
      // Copy core behavior-related properties from the source block id.
      // This is the closest KubeJS-side approximation to "same block, retextured".
      copyPropertiesFromSource: true,
      // Some vanilla blocks (e.g. logs with axis-dependent map color) crash when
      // copied into a state-less KubeJS custom block.
      // Keep this true to skip copyPropertiesFrom on stateful source blocks.
      copyPropertiesFromSafeOnly: true,
      // Optional runtime-generated snapshot to transfer per-block values/tags
      // (hardness/resistance/light/tool-requirement/mineable tags).
      applyPrototypeSnapshot: true,
      prototypeSnapshotPath: path.resolve(
        "kubejs/exported/server/core_awakening_block_snapshot.json",
      ),
      // Fallback used when no parent/id rule matches.
      defaultSoundType: "stone",
      // Parent-based defaults. Add/override keys here as needed.
      soundTypeByParent: DEFAULT_BLOCK_SOUND_BY_PARENT,
      // First matching keyword wins. Match is done against full source id.
      soundTypeKeywordRules: buildKeywordSoundRules(
        DEFAULT_BLOCK_SOUND_KEYWORD_GROUPS,
      ),
      // Suggested tint colors for grayscale tint-index models (leaves/grass/etc.).
      // Used for optional .color(...) callbacks and baked texture tinting.
      tintByParent: DEFAULT_BLOCK_TINT_BY_PARENT,
      tintKeywordRules: buildKeywordTintRules(
        DEFAULT_BLOCK_TINT_KEYWORD_GROUPS,
      ),
      // Exact source-id overrides.
      overrides: {
        // "minecraft:grass_block": { soundType: "grass", tintColor: 0x79c05a, tintIndices: [0] },
      },
    },
    deadVariant: {
      enabled: true,
      displayPrefix: "Dead",
      registryPrefix: "dead",
      defaultConversionMode: "insert",
      referenceTexturePaths: [
        path.resolve(
          "kubejs/assets/kubejs/textures/block/dead_grass_block/dead_grass_block_top_texture.png",
        ),
        path.resolve(
          "kubejs/assets/kubejs/textures/block/dead_grass_block/dead_grass_block_side_texture.png",
        ),
      ],
      fallbackTintColor: 0x7f6650,
      desaturate: 1,
      contrast: 1.05,
      brightness: -8,
    },
    // Optional per-block source/conversion overrides for dead/corruption generation.
    // NOTE: `source` must resolve from configured `inputs` (jar/asset folder), so custom
    // KubeJS runtime-only blocks need matching assets (blockstate + model + textures) present.
    deadVariantOverrides: {
      // "minecraft:grass_block": { source: "kubejs:dead_grass_block", conversionMode: "insert" },
      // "minecraft:oak_leaves": "kubejs:dead_oak_leaves",
      // "minecraft:fern": "kubejs:dead_fern",
    },
    // Manual conversion overrides applied after auto-generation.
    // Use `to: null` to remove a generated mapping.
    conversionOverrides: [
      // { from: "minecraft:grass_block", to: "kubejs:dead_grass_block", direction: "up" },
      // { from: "kubejs:light_corrupted_block_minecraft_grass_block", to: "minecraft:grass_block", direction: "down" },
    ],
  },
  corruptionLevels: [
    {
      id: "light",
      displayPrefix: "Lightly Corrupted",
      registryPrefix: "light_corrupted",
      tintStrength: 0,
      overlay: {
        path: path.resolve(
          "kubejs/assets/coreawakening/textures/corruption/light_corruption.png",
        ),
        opacity: 1,
      },
    },
    {
      id: "heavy",
      displayPrefix: "Heavily Corrupted",
      registryPrefix: "heavy_corrupted",
      tintStrength: 0,
      overlay: {
        path: path.resolve(
          "kubejs/assets/coreawakening/textures/corruption/heavy_corruption.png",
        ),
        opacity: 1,
      },
    },
  ],
  transform: {
    desaturate: 0,
    targetR: 255,
    targetG: 0,
    targetB: 128,
  },
};

const conversionsUp: Record<string, string> = {
  "minecraft:dirt_path": "minecraft:dirt",
};
const conversionsDown: Record<string, string> = {};

class AssetIndex {
  private readonly entries = new Map<string, AssetEntry>();
  private readonly zipCache = new Map<string, AdmZip>();

  async addInput(inputPath: string): Promise<void> {
    const stat = await fsp.stat(inputPath);

    if (stat.isDirectory()) {
      await this.addDirectory(inputPath);
      return;
    }

    if (stat.isFile() && /\.(jar|zip)$/i.test(inputPath)) {
      await this.addZip(inputPath);
      return;
    }

    throw new Error(`Unsupported input: ${inputPath}`);
  }

  private async addDirectory(root: string): Promise<void> {
    const files = await walk(root);

    for (const absolutePath of files) {
      const relative = normalizeSlashes(path.relative(root, absolutePath));
      if (!relative.startsWith("assets/")) continue;

      this.entries.set(relative, {
        assetPath: relative,
        sourceKind: "dir",
        sourceRoot: root,
        filePath: absolutePath,
      });
    }
  }

  private async addZip(zipPath: string): Promise<void> {
    const zip = new AdmZip(zipPath);
    this.zipCache.set(zipPath, zip);

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const relative = normalizeSlashes(entry.entryName);
      if (!relative.startsWith("assets/")) continue;

      this.entries.set(relative, {
        assetPath: relative,
        sourceKind: "zip",
        sourceRoot: zipPath,
        zipPath: relative,
      });
    }
  }

  list(prefix: string): string[] {
    const p = normalizeSlashes(prefix);
    return [...this.entries.keys()].filter((k) => k.startsWith(p)).sort();
  }

  has(assetPath: string): boolean {
    return this.entries.has(normalizeSlashes(assetPath));
  }

  async readBuffer(assetPath: string): Promise<Buffer | null> {
    const entry = this.entries.get(normalizeSlashes(assetPath));
    if (!entry) return null;

    if (entry.sourceKind === "dir") {
      return fsp.readFile(entry.filePath!);
    }

    const zip = this.zipCache.get(entry.sourceRoot);
    if (!zip) return null;
    const zipEntry = zip.getEntry(entry.zipPath!);
    if (!zipEntry) return null;
    return zipEntry.getData();
  }

  async readText(assetPath: string): Promise<string | null> {
    const buf = await this.readBuffer(assetPath);
    return buf ? buf.toString("utf8") : null;
  }

  async readJson<T extends Json = Json>(assetPath: string): Promise<T | null> {
    const text = await this.readText(assetPath);
    if (!text) return null;

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${assetPath}\n${String(error)}`);
    }
  }
}

async function writeConversionMap(): Promise<void> {
  applyConversionOverrides(CONFIG.block.conversionOverrides);

  const result = [
    `export const GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_UP: Record<string, string> = ${JSON.stringify(conversionsUp, null, 2)};`,
    `export const GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_DOWN: Record<string, string> = ${JSON.stringify(conversionsDown, null, 2)};`,
  ];
  const conversionOutPath = path.resolve(
    process.env.CORRUPTION_CONVERSION_OUT ??
      "kubejs_ts/shared/core_awakening/generated/corruption_block_conversion.ts",
  );
  await fsp.mkdir(path.dirname(conversionOutPath), { recursive: true });
  await fsp.writeFile(conversionOutPath, result.join("\n"));
}

function applyConversionOverrides(overrides: BlockConversionOverride[]): void {
  for (const override of overrides) {
    const direction = override.direction ?? "both";
    const shouldApplyUp = direction === "up" || direction === "both";
    const shouldApplyDown = direction === "down" || direction === "both";

    if (shouldApplyUp) {
      if (override.to === null) {
        delete conversionsUp[override.from];
      } else {
        conversionsUp[override.from] = override.to;
      }
    }

    if (shouldApplyDown) {
      if (override.to === null) {
        delete conversionsDown[override.from];
      } else {
        conversionsDown[override.from] = override.to;
      }
    }
  }
}

async function main(): Promise<void> {
  if (CONFIG.inputs.length === 0) {
    throw new Error(
      "CONFIG.inputs is empty. Add your Minecraft jar and mod/resource inputs first.",
    );
  }

  const index = new AssetIndex();
  for (const input of CONFIG.inputs) {
    await index.addInput(path.resolve(input));
  }
  const corruptionLevels = await loadCorruptionLevels();
  if (corruptionLevels.length === 0) {
    throw new Error("CONFIG.corruptionLevels is empty.");
  }

  const report: Report = {
    generatedItems: 0,
    generatedBlocks: 0,
    skippedItems: [],
    skippedBlocks: [],
  };

  const generatedItems: ItemCandidate[] = [];
  const generatedBlocks: BlockCandidate[] = [];

  await fsp.mkdir(CONFIG.outRoot, { recursive: true });
  await fsp.mkdir(CONFIG.tsOutDir, { recursive: true });

  if (CONFIG.item.enabled) {
    const items = await collectItemCandidates(index, report);
    generatedItems.push(...items);
    report.generatedItems = items.length;
    await materializeItems(index, items);
  }

  if (CONFIG.block.enabled) {
    const blocks = await collectBlockCandidates(
      index,
      report,
      corruptionLevels,
    );
    generatedBlocks.push(...blocks);
    report.generatedBlocks = blocks.length;
    await materializeBlocks(index, blocks);
  }

  await writeConversionMap();
  await writeGeneratedKubeJSTs(generatedItems, generatedBlocks);
  await writeReport(report, generatedItems, generatedBlocks);

  console.log(
    `Generated ${generatedItems.length} corrupted items and ${generatedBlocks.length} generated block variants.`,
  );
}

async function collectItemCandidates(
  index: AssetIndex,
  report: Report,
): Promise<ItemCandidate[]> {
  const modelPaths = index
    .list("assets/")
    .filter((p) => /\/models\/item\/.+\.json$/i.test(p));
  const modelCache = new Map<string, ResolvedModel | null>();
  const out: ItemCandidate[] = [];

  for (const assetPath of modelPaths) {
    const parsed = parseAssetModelPath(assetPath, "item");
    if (!parsed) continue;
    if (!shouldIncludeNamespace(parsed.namespace)) continue;

    const originalId = `${parsed.namespace}:${parsed.path}`;
    const registryId = buildGeneratedRegistryId(
      "item",
      parsed.namespace,
      parsed.path,
    );

    const resolved = await resolveModel(
      index,
      { namespace: parsed.namespace, path: `item/${parsed.path}` },
      modelCache,
    );
    if (!resolved) {
      report.skippedItems.push({
        id: originalId,
        reason: "Could not resolve item model parent",
      });
      continue;
    }

    const selectedParent = pickSupportedParent(
      originalId,
      resolved.parentChain,
      CONFIG.item.supportedParents,
      CONFIG.item.supportedIds,
    );

    if (!selectedParent) {
      const directParent = resolved.parentChain[0];
      report.skippedItems.push({
        id: originalId,
        reason: directParent
          ? `Unsupported item parent: ${directParent}`
          : "Could not resolve item model parent",
      });
      continue;
    }

    const layers: Record<string, string> = {};
    for (let i = 0; i < 8; i++) {
      const key = `layer${i}`;
      const textureRef = resolveTextureReference(resolved.textures, key);
      if (!textureRef) continue;
      layers[key] = textureRef;
    }

    if (!layers.layer0) {
      report.skippedItems.push({
        id: originalId,
        reason: "Missing layer0 texture",
      });
      continue;
    }

    out.push({
      kind: "item",
      originalId,
      registryId,
      displayName: `Corrupted ${toTitleCase(parsed.path)}`,
      sourceNamespace: parsed.namespace,
      sourcePath: parsed.path,
      parentModel: selectedParent as ItemCandidate["parentModel"],
      layers,
    });
  }

  return dedupeBy(out, (c) => c.registryId);
}

async function collectBlockCandidates(
  index: AssetIndex,
  report: Report,
  corruptionLevels: LoadedCorruptionLevel[],
): Promise<BlockCandidate[]> {
  const blockstatePaths = index
    .list("assets/")
    .filter((p) => /\/blockstates\/.+\.json$/i.test(p));
  const modelCache = new Map<string, ResolvedModel | null>();
  const out: BlockCandidate[] = [];

  for (const assetPath of blockstatePaths) {
    const parsed = parseAssetBlockstatePath(assetPath);
    if (!parsed) continue;
    if (!shouldIncludeNamespace(parsed.namespace)) continue;

    const originalId = `${parsed.namespace}:${parsed.path}`;
    const deadVariantOverride = getDeadVariantOverride(originalId);
    const sourceBlockId = deadVariantOverride?.source ?? originalId;
    const deadVariantConversionMode =
      deadVariantOverride?.conversionMode ??
      CONFIG.block.deadVariant.defaultConversionMode;
    const shouldCreateDeadVariant = CONFIG.block.deadVariant.enabled;

    const resolvedSourceResult = await resolveBlockGenerationSource(
      index,
      modelCache,
      sourceBlockId,
      originalId,
    );
    if (!resolvedSourceResult.source) {
      report.skippedBlocks.push({
        id: originalId,
        reason:
          resolvedSourceResult.reason ??
          `Could not resolve source block '${sourceBlockId}'`,
      });
      continue;
    }
    const resolvedSource = resolvedSourceResult.source;

    const conversion: string[] = [originalId];
    if (shouldCreateDeadVariant) {
      const deadVariantCandidate = createDeadVariantCandidate(
        parsed,
        originalId,
        resolvedSource,
        deadVariantConversionMode,
      );
      const deadFullId = `kubejs:${deadVariantCandidate.registryId}`;
      out.push(deadVariantCandidate);

      if (deadVariantConversionMode === "insert") {
        conversion.push(deadFullId);
      }
    }

    for (const corruptionLevel of corruptionLevels) {
      const registryId = buildCorruptionRegistryId(
        "block",
        corruptionLevel.registryPrefix,
        parsed.namespace,
        parsed.path,
      );

      conversion.push(`kubejs:${registryId}`);

      out.push({
        kind: "block",
        stage: "corrupted",
        originalId,
        registryId,
        displayName: `${corruptionLevel.displayPrefix} ${toTitleCase(parsed.path)}`,
        sourceNamespace: resolvedSource.sourceNamespace,
        sourcePath: resolvedSource.sourcePath,
        sourceBlockId: resolvedSource.sourceBlockId,
        deadVariantConversionMode,
        applyDeadVariantPrepass: shouldCreateDeadVariant,
        selectedParent: resolvedSource.selectedParent,
        parentModel: resolvedSource.parentModel,
        textures: resolvedSource.textures,
        tintedTextureKeys: resolvedSource.tintedTextureKeys,
        modelResourceLocation: `${CONFIG.generatedNamespace}:block/generated/${registryId}`,
        corruptionLevel,
      });
    }

    if (conversion.length < 2) {
      continue;
    }

    for (let i = 1; i < conversion.length; i++) {
      conversionsUp[conversion[i - 1]] = conversion[i];
      conversionsDown[conversion[i]] = conversion[i - 1];
    }
  }

  return dedupeBy(out, (c) => c.registryId);
}

function createDeadVariantCandidate(
  parsed: { namespace: string; path: string },
  originalId: string,
  resolvedSource: ResolvedBlockGenerationSource,
  deadVariantConversionMode: DeadVariantConversionMode,
): BlockCandidate {
  const deadRegistryId = buildDeadVariantRegistryId(
    "block",
    CONFIG.block.deadVariant.registryPrefix,
    parsed.namespace,
    parsed.path,
  );

  return {
    kind: "block",
    stage: "dead",
    originalId,
    registryId: deadRegistryId,
    displayName: `${CONFIG.block.deadVariant.displayPrefix} ${toTitleCase(parsed.path)}`,
    sourceNamespace: resolvedSource.sourceNamespace,
    sourcePath: resolvedSource.sourcePath,
    sourceBlockId: resolvedSource.sourceBlockId,
    deadVariantConversionMode,
    applyDeadVariantPrepass: true,
    selectedParent: resolvedSource.selectedParent,
    parentModel: resolvedSource.parentModel,
    textures: resolvedSource.textures,
    tintedTextureKeys: resolvedSource.tintedTextureKeys,
    modelResourceLocation: `${CONFIG.generatedNamespace}:block/generated/${deadRegistryId}`,
  };
}

function getDeadVariantOverride(
  blockId: string,
): BlockDeadVariantOverride | undefined {
  const entry = CONFIG.block.deadVariantOverrides[blockId];
  if (!entry) {
    return undefined;
  }
  if (typeof entry === "string") {
    return { source: entry };
  }
  return entry;
}

async function resolveBlockGenerationSource(
  index: AssetIndex,
  modelCache: Map<string, ResolvedModel | null>,
  sourceBlockId: string,
  originalIdForSupport: string,
): Promise<ResolvedBlockGenerationSourceResult> {
  const sourceRl = parseResourceLocation(sourceBlockId, "minecraft");
  const sourceBlockstatePath = `assets/${sourceRl.namespace}/blockstates/${sourceRl.path}.json`;
  const sourceBlockstate = await index.readJson<any>(sourceBlockstatePath);
  if (!sourceBlockstate) {
    return {
      reason: `Unreadable blockstate JSON for source '${sourceBlockId}'`,
    };
  }

  const chosenModelRef = pickModelFromBlockstate(sourceBlockstate);
  if (!chosenModelRef) {
    return {
      reason: `Unsupported blockstate structure for source '${sourceBlockId}'`,
    };
  }

  const modelRl = parseResourceLocation(chosenModelRef, sourceRl.namespace);
  const resolved = await resolveModel(index, modelRl, modelCache);
  if (!resolved) {
    return {
      reason: `Could not resolve block model parent for source '${sourceBlockId}'`,
    };
  }

  const selectedParent = pickSupportedParent(
    originalIdForSupport,
    resolved.parentChain,
    CONFIG.block.supportedParents,
    CONFIG.block.supportedIds,
  );
  if (!selectedParent) {
    const directParent = resolved.parentChain[0];
    return {
      reason: directParent
        ? `Unsupported block parent: ${directParent}`
        : `Could not resolve block model parent for source '${sourceBlockId}'`,
    };
  }

  const requiredKeys = getRequiredTextureKeysForBlockParent(
    selectedParent,
    resolved.textures,
  );
  if (requiredKeys.length === 0) {
    return {
      reason: `Unsupported block parent: ${selectedParent}`,
    };
  }

  const textures: Record<string, string> = {};
  for (const key of requiredKeys) {
    const textureRef = resolveTextureReference(resolved.textures, key);
    if (!textureRef) {
      return {
        reason: "Missing one or more required block textures",
      };
    }
    textures[key] = textureRef;
  }

  const tintedTextureKeys = getTintedTextureKeysForBlock(
    resolved,
    sourceRl.namespace,
    Object.keys(textures),
  );

  const parentModel = shouldUseSourceModelAsParent(selectedParent)
    ? `${modelRl.namespace}:${modelRl.path}`
    : selectedParent;

  return {
    source: {
      sourceBlockId,
      sourceNamespace: sourceRl.namespace,
      sourcePath: sourceRl.path,
      selectedParent,
      parentModel,
      textures,
      tintedTextureKeys,
    },
  };
}

async function materializeItems(
  index: AssetIndex,
  candidates: ItemCandidate[],
): Promise<void> {
  for (const candidate of candidates) {
    for (const [layer, sourceTextureRef] of Object.entries(candidate.layers)) {
      const sourceTextureRl = parseResourceLocation(
        sourceTextureRef,
        candidate.sourceNamespace,
      );
      const sourceTextureAssetPath =
        resourceLocationToTextureAssetPath(sourceTextureRl);
      const png = await index.readBuffer(sourceTextureAssetPath);
      if (!png) continue;

      const outRl = `${CONFIG.generatedNamespace}:item/generated/${candidate.registryId}/${layer}`;
      const outPngPath = textureRlToOutputPath(outRl);
      await writeTransformedTexture(png, outPngPath);

      if (CONFIG.copyMcmeta) {
        await copyTextureMcmetaIfPresent(
          index,
          sourceTextureAssetPath,
          `${outPngPath}.mcmeta`,
        );
      }
    }
  }
}

async function materializeBlocks(
  index: AssetIndex,
  candidates: BlockCandidate[],
): Promise<void> {
  const deadVariantProfile = await loadDeadVariantColorProfile();
  for (const candidate of candidates) {
    const generatedTextures: Record<string, string> = {};
    const tintConfig =
      candidate.stage === "corrupted" &&
      !candidate.applyDeadVariantPrepass &&
      CONFIG.block.registration.bakeTintedTextures
      ? getSuggestedBlockTint(candidate)
      : null;
    const tintedTextureKeys = new Set(candidate.tintedTextureKeys);

    for (const [textureKey, sourceTextureRef] of Object.entries(
      candidate.textures,
    )) {
      const sourceTextureRl = parseResourceLocation(
        sourceTextureRef,
        candidate.sourceNamespace,
      );
      const sourceTextureAssetPath =
        resourceLocationToTextureAssetPath(sourceTextureRl);
      const png = await index.readBuffer(sourceTextureAssetPath);
      if (!png) continue;

      const generatedTextureRl = `${CONFIG.generatedNamespace}:block/generated/${candidate.registryId}/${textureKey}`;
      generatedTextures[textureKey] = generatedTextureRl;
      const outPngPath = textureRlToOutputPath(generatedTextureRl);
      const bakedTintColor =
        tintConfig && tintedTextureKeys.has(textureKey) ? tintConfig.color : null;
      await writeTransformedTexture(
        png,
        outPngPath,
        candidate.corruptionLevel,
        bakedTintColor,
        candidate.applyDeadVariantPrepass ? deadVariantProfile : null,
      );

      if (CONFIG.copyMcmeta) {
        await copyTextureMcmetaIfPresent(
          index,
          sourceTextureAssetPath,
          `${outPngPath}.mcmeta`,
        );
      }
    }

    const modelJson = {
      parent: candidate.parentModel,
      textures: generatedTextures,
    };

    const modelPath = modelRlToOutputPath(candidate.modelResourceLocation);
    await writeJson(modelPath, modelJson);
  }
}

async function writeGeneratedKubeJSTs(
  items: ItemCandidate[],
  blocks: BlockCandidate[],
): Promise<void> {
  const prototypeSnapshotById = await loadBlockPrototypeSnapshotMap();
  const itemsTs = buildItemRegistrationTs(items);
  const blocksTs = buildBlockRegistrationTs(blocks, prototypeSnapshotById);

  await fsp.mkdir(CONFIG.tsOutDir, { recursive: true });
  await fsp.writeFile(
    path.join(CONFIG.tsOutDir, "02_generated_corrupted_items.ts"),
    itemsTs,
    "utf8",
  );
  await fsp.writeFile(
    path.join(CONFIG.tsOutDir, "03_generated_corrupted_blocks.ts"),
    blocksTs,
    "utf8",
  );
}

function buildItemRegistrationTs(items: ItemCandidate[]): string {
  const rows = items
    .map((item) => {
      const layerLines = Object.keys(item.layers)
        .sort()
        .map((layer) => {
          const rl = `${CONFIG.generatedNamespace}:item/generated/${item.registryId}/${layer}`;
          return `      ${JSON.stringify(layer)}: ${JSON.stringify(rl)},`;
        })
        .join("\n");

      const eventId = buildEventCreateId(item.registryId);

      return `  event.create(${JSON.stringify(eventId)})
    .displayName(${JSON.stringify(item.displayName)})
    .parentModel(${JSON.stringify(item.parentModel)})
    .textures({
${layerLines}
    })`;
    })
    .join("\n\n");
  if (rows.length === 0) {
    return "";
  }
  return `// Generated by generate-corruption-assets.ts
// DO NOT EDIT MANUALLY

StartupEvents.registry('item', event => {
${rows}
})
`;
}

function buildBlockRegistrationTs(
  blocks: BlockCandidate[],
  prototypeSnapshotById: Map<string, BlockPrototypeSnapshotEntry>,
): string {
  const rows = blocks
    .map((block) => {
      const eventId = buildEventCreateId(block.registryId);
      const registrationOverride = getBlockRegistrationOverride(block);
      const hasExplicitSoundOverride = Boolean(registrationOverride?.soundType);
      const soundType = getSuggestedBlockSoundType(block);
      const renderType = getSuggestedBlockRenderType(block);
      const needsPlantSettings = shouldUsePlantBlockSettings(block);
      const tint = getSuggestedBlockTint(block);
      const sourceBlockId = block.sourceBlockId || block.originalId;
      const sourcePrototype =
        prototypeSnapshotById.get(sourceBlockId) ??
        prototypeSnapshotById.get(block.originalId);
      const shouldCopyProperties = shouldCopyPropertiesFromSourceBlock(
        block,
        sourcePrototype,
      );
      const lines = [
        `  event.create(${JSON.stringify(eventId)})`,
        `    .displayName(${JSON.stringify(block.displayName)})`,
        `    .parentModel(${JSON.stringify(block.modelResourceLocation)})`,
      ];

      if (shouldCopyProperties) {
        lines.push(`    .copyPropertiesFrom(${JSON.stringify(sourceBlockId)})`);
      }

      if (sourcePrototype && CONFIG.block.registration.applyPrototypeSnapshot) {
        appendPrototypeSnapshotBuilderLines(lines, sourcePrototype);
      }

      if (
        soundType &&
        (!shouldCopyProperties || hasExplicitSoundOverride)
      ) {
        lines.push(`    .soundType(${JSON.stringify(soundType)})`);
      }
      if (renderType) {
        lines.push(`    .renderType(${JSON.stringify(renderType)})`);
      }
      if (needsPlantSettings) {
        lines.push("    .fullBlock(false)");
        lines.push("    .notSolid()");
        lines.push("    .noCollision()");
      }
      if (CONFIG.block.registration.emitTintCallbacks && tint) {
        for (const tintIndex of tint.tintIndices) {
          lines.push(`    .color(${tintIndex}, ${formatHexColor(tint.color)})`);
        }
      }

      lines.push(
        `    .item(item => item.parentModel(${JSON.stringify(block.modelResourceLocation)}))`,
      );

      return lines.join("\n");
    })
    .join("\n\n");

  if (rows.length === 0) {
    return "";
  }

  return `// Generated by generate-corruption-assets.ts
// DO NOT EDIT MANUALLY

StartupEvents.registry('block', event => {
${rows}
})
`;
}

function shouldCopyPropertiesFromSourceBlock(
  block: BlockCandidate,
  sourcePrototype?: BlockPrototypeSnapshotEntry,
): boolean {
  const override = getBlockRegistrationOverride(block);
  if (typeof override?.copyPropertiesFrom === "boolean") {
    return override.copyPropertiesFrom;
  }

  if (!CONFIG.block.registration.copyPropertiesFromSource) {
    return false;
  }

  if (!CONFIG.block.registration.copyPropertiesFromSafeOnly) {
    return true;
  }

  if (!sourcePrototype) {
    return false;
  }

  // Stateful source blocks can crash KubeJS custom block registration when
  // copied directly because copied behavior may query missing properties.
  return (sourcePrototype.properties?.length ?? 0) === 0;
}

function appendPrototypeSnapshotBuilderLines(
  lines: string[],
  prototype: BlockPrototypeSnapshotEntry,
): void {
  const requiresTool = prototype.flags?.requiresTool ?? false;
  if (requiresTool) {
    lines.push("    .requiresTool()");
  }

  const destroySpeed = toFiniteNumber(prototype.stats?.destroySpeed);
  if (destroySpeed != null) {
    if (destroySpeed < 0) {
      lines.push("    .unbreakable()");
    } else {
      lines.push(`    .hardness(${formatNumberLiteral(destroySpeed)})`);
    }
  }

  const explosionResistance = toFiniteNumber(prototype.stats?.explosionResistance);
  if (explosionResistance != null && explosionResistance >= 0) {
    lines.push(`    .resistance(${formatNumberLiteral(explosionResistance)})`);
  }

  const friction = toFiniteNumber(prototype.stats?.friction);
  if (friction != null && friction >= 0) {
    lines.push(`    .slipperiness(${formatNumberLiteral(friction)})`);
  }

  const speedFactor = toFiniteNumber(prototype.stats?.speedFactor);
  if (speedFactor != null && speedFactor > 0) {
    lines.push(`    .speedFactor(${formatNumberLiteral(speedFactor)})`);
  }

  const jumpFactor = toFiniteNumber(prototype.stats?.jumpFactor);
  if (jumpFactor != null && jumpFactor > 0) {
    lines.push(`    .jumpFactor(${formatNumberLiteral(jumpFactor)})`);
  }

  const lightEmission = toFiniteNumber(prototype.stats?.lightEmission);
  if (lightEmission != null && lightEmission > 0) {
    lines.push(`    .lightLevel(${formatNumberLiteral(lightEmission)})`);
  }

  for (const tag of getPrototypeSnapshotRelevantBlockTags(prototype.tags)) {
    lines.push(`    .tagBlock(${JSON.stringify(tag)})`);
  }
}

async function loadBlockPrototypeSnapshotMap(): Promise<
  Map<string, BlockPrototypeSnapshotEntry>
> {
  const out = new Map<string, BlockPrototypeSnapshotEntry>();
  if (!CONFIG.block.registration.applyPrototypeSnapshot) {
    return out;
  }

  const configuredPath = CONFIG.block.registration.prototypeSnapshotPath;
  if (!configuredPath) {
    return out;
  }

  const snapshotPath = path.resolve(configuredPath);
  if (!fs.existsSync(snapshotPath)) {
    console.warn(
      `[corruption-generator] Prototype snapshot not found: ${snapshotPath}`,
    );
    return out;
  }

  try {
    const raw = await fsp.readFile(snapshotPath, "utf8");
    const parsed = JSON.parse(raw) as BlockPrototypeSnapshotFile;
    if (!parsed || !Array.isArray(parsed.blocks)) {
      console.warn(
        `[corruption-generator] Invalid prototype snapshot format: ${snapshotPath}`,
      );
      return out;
    }

    for (const block of parsed.blocks) {
      if (!block || typeof block.id !== "string" || block.id.length === 0) {
        continue;
      }
      out.set(block.id, block);
    }

    console.log(
      `[corruption-generator] Loaded ${out.size} block prototypes from snapshot.`,
    );
  } catch (error) {
    console.warn(
      `[corruption-generator] Failed to load prototype snapshot '${snapshotPath}': ${String(error)}`,
    );
  }

  return out;
}

function getPrototypeSnapshotRelevantBlockTags(tags?: string[]): string[] {
  if (!Array.isArray(tags) || tags.length === 0) {
    return [];
  }

  const allowedTags = new Set([
    "minecraft:mineable/axe",
    "minecraft:mineable/pickaxe",
    "minecraft:mineable/shovel",
    "minecraft:mineable/hoe",
    "minecraft:needs_stone_tool",
    "minecraft:needs_iron_tool",
    "minecraft:needs_diamond_tool",
  ]);

  return tags.filter((tag) => allowedTags.has(tag));
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number") {
    return null;
  }
  return Number.isFinite(value) ? value : null;
}

function formatNumberLiteral(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}`;
  }
  return `${Number(value.toFixed(6))}`;
}

async function writeReport(
  report: Report,
  items: ItemCandidate[],
  blocks: BlockCandidate[],
): Promise<void> {
  const outPath = path.join(CONFIG.tsOutDir, "report.json");
  const fullReport = {
    ...report,
    items: items.map((i) => ({
      generated: `${CONFIG.registryNamespace}:${i.registryId}`,
      source: i.originalId,
    })),
    blocks: blocks.map((b) => ({
      generated: `${CONFIG.registryNamespace}:${b.registryId}`,
      source: b.originalId,
    })),
  };
  await writeJson(outPath, fullReport);
}

async function loadCorruptionLevels(): Promise<LoadedCorruptionLevel[]> {
  const out: LoadedCorruptionLevel[] = [];

  for (const level of CONFIG.corruptionLevels) {
    let overlayImage: LoadedCorruptionOverlay | undefined;

    if (level.overlay) {
      const overlayPath = path.resolve(level.overlay.path);
      if (fs.existsSync(overlayPath)) {
        const overlayBuffer = await fsp.readFile(overlayPath);
        overlayImage = {
          png: PNG.sync.read(overlayBuffer),
          opacity: clamp01(level.overlay.opacity),
        };
      } else {
        console.warn(
          `[corruption-generator] Overlay not found for '${level.id}': ${overlayPath}. Continuing with tint only.`,
        );
      }
    }

    out.push({
      ...level,
      overlayImage,
    });
  }

  return out;
}

async function loadDeadVariantColorProfile(): Promise<DeadVariantColorProfile | null> {
  if (!CONFIG.block.deadVariant.enabled) {
    return null;
  }

  const samples: Array<{ r: number; g: number; b: number; count: number }> = [];
  for (const texturePath of CONFIG.block.deadVariant.referenceTexturePaths) {
    const absolutePath = path.resolve(texturePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    try {
      const buffer = await fsp.readFile(absolutePath);
      const png = PNG.sync.read(buffer);
      const sample = sampleAveragePngColor(png);
      if (sample.count > 0) {
        samples.push(sample);
      }
    } catch (error) {
      console.warn(
        `[corruption-generator] Failed to read dead-variant reference texture '${absolutePath}': ${String(error)}`,
      );
    }
  }

  let tint = getRgbColor(CONFIG.block.deadVariant.fallbackTintColor);
  if (!tint) {
    tint = { r: 127, g: 102, b: 80 };
  }

  if (samples.length > 0) {
    let totalCount = 0;
    let weightedR = 0;
    let weightedG = 0;
    let weightedB = 0;
    for (const sample of samples) {
      totalCount += sample.count;
      weightedR += sample.r * sample.count;
      weightedG += sample.g * sample.count;
      weightedB += sample.b * sample.count;
    }
    if (totalCount > 0) {
      tint = {
        r: clampByte(weightedR / totalCount),
        g: clampByte(weightedG / totalCount),
        b: clampByte(weightedB / totalCount),
      };
    }
  }

  return {
    tint,
    desaturate: clamp01(CONFIG.block.deadVariant.desaturate),
    contrast: CONFIG.block.deadVariant.contrast,
    brightness: CONFIG.block.deadVariant.brightness,
  };
}

function sampleAveragePngColor(
  png: PNG,
): { r: number; g: number; b: number; count: number } {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const alpha = png.data[i + 3]!;
    if (alpha === 0) continue;
    totalR += png.data[i + 0]!;
    totalG += png.data[i + 1]!;
    totalB += png.data[i + 2]!;
    count++;
  }
  if (count === 0) {
    return { r: 0, g: 0, b: 0, count: 0 };
  }
  return {
    r: totalR / count,
    g: totalG / count,
    b: totalB / count,
    count,
  };
}

function applyDeadVariantColor(
  r: number,
  g: number,
  b: number,
  profile: DeadVariantColorProfile,
): { r: number; g: number; b: number } {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const gray = lum;
  const dr = mix(r, gray, profile.desaturate);
  const dg = mix(g, gray, profile.desaturate);
  const db = mix(b, gray, profile.desaturate);

  let rr = (dr * profile.tint.r) / 255;
  let gg = (dg * profile.tint.g) / 255;
  let bb = (db * profile.tint.b) / 255;

  if (profile.contrast !== 1) {
    rr = (rr - 128) * profile.contrast + 128;
    gg = (gg - 128) * profile.contrast + 128;
    bb = (bb - 128) * profile.contrast + 128;
  }

  if (profile.brightness !== 0) {
    rr += profile.brightness;
    gg += profile.brightness;
    bb += profile.brightness;
  }

  return {
    r: clampByte(rr),
    g: clampByte(gg),
    b: clampByte(bb),
  };
}

async function writeTransformedTexture(
  sourcePng: Buffer,
  outPath: string,
  corruptionLevel?: LoadedCorruptionLevel,
  bakedTintColor?: number | null,
  deadVariantProfile?: DeadVariantColorProfile | null,
): Promise<void> {
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  const inPng = PNG.sync.read(sourcePng);
  const outPng = new PNG({ width: inPng.width, height: inPng.height });
  const tintStrength = clamp01(
    corruptionLevel?.tintStrength ??
      CONFIG.corruptionLevels[0]?.tintStrength ??
      0,
  );
  const overlay = corruptionLevel?.overlayImage;
  const bakedTint = getRgbColor(bakedTintColor ?? null);
  const useOverlay =
    overlay &&
    overlay.png.width > 0 &&
    overlay.png.height > 0 &&
    overlay.opacity > 0;

  for (let y = 0; y < inPng.height; y++) {
    for (let x = 0; x < inPng.width; x++) {
      const idx = (inPng.width * y + x) << 2;
      const r = inPng.data[idx + 0]!;
      const g = inPng.data[idx + 1]!;
      const b = inPng.data[idx + 2]!;
      const a = inPng.data[idx + 3]!;

      if (a === 0) {
        outPng.data[idx + 0] = 0;
        outPng.data[idx + 1] = 0;
        outPng.data[idx + 2] = 0;
        outPng.data[idx + 3] = 0;
        continue;
      }

      let baseR = r;
      let baseG = g;
      let baseB = b;

      if (deadVariantProfile) {
        const dead = applyDeadVariantColor(
          baseR,
          baseG,
          baseB,
          deadVariantProfile,
        );
        baseR = dead.r;
        baseG = dead.g;
        baseB = dead.b;
      }

      if (bakedTint) {
        baseR = (baseR * bakedTint.r) / 255;
        baseG = (baseG * bakedTint.g) / 255;
        baseB = (baseB * bakedTint.b) / 255;
      }

      const lum = 0.2126 * baseR + 0.7152 * baseG + 0.0722 * baseB;
      const gray = lum;

      let rr = mix(baseR, gray, CONFIG.transform.desaturate);
      let gg = mix(baseG, gray, CONFIG.transform.desaturate);
      let bb = mix(baseB, gray, CONFIG.transform.desaturate);

      rr = mix(rr, CONFIG.transform.targetR, tintStrength);
      gg = mix(gg, CONFIG.transform.targetG, tintStrength);
      bb = mix(bb, CONFIG.transform.targetB, tintStrength);

      if (useOverlay) {
        const ox = x % overlay.png.width;
        const oy = y % overlay.png.height;
        const oidx = (overlay.png.width * oy + ox) << 2;
        const or = overlay.png.data[oidx + 0]!;
        const og = overlay.png.data[oidx + 1]!;
        const ob = overlay.png.data[oidx + 2]!;
        const oa = (overlay.png.data[oidx + 3]! / 255) * overlay.opacity;

        if (oa > 0) {
          rr = mix(rr, or, oa);
          gg = mix(gg, og, oa);
          bb = mix(bb, ob, oa);
        }
      }

      outPng.data[idx + 0] = clampByte(rr);
      outPng.data[idx + 1] = clampByte(gg);
      outPng.data[idx + 2] = clampByte(bb);
      outPng.data[idx + 3] = a;
    }
  }

  await fsp.writeFile(outPath, PNG.sync.write(outPng));
}

async function copyTextureMcmetaIfPresent(
  index: AssetIndex,
  sourceTextureAssetPath: string,
  outMcmetaPath: string,
): Promise<void> {
  const mcmeta = await index.readBuffer(`${sourceTextureAssetPath}.mcmeta`);
  if (!mcmeta) return;
  await fsp.mkdir(path.dirname(outMcmetaPath), { recursive: true });
  await fsp.writeFile(outMcmetaPath, mcmeta);
}

async function resolveModel(
  index: AssetIndex,
  rl: ResourceLocation,
  cache: Map<string, ResolvedModel | null>,
): Promise<ResolvedModel | null> {
  const cacheKey = `${rl.namespace}:${rl.path}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  const assetPath = `assets/${rl.namespace}/models/${rl.path}.json`;
  const model = await index.readJson<any>(assetPath);
  if (!model) {
    cache.set(cacheKey, null);
    return null;
  }

  const parentRef = typeof model.parent === "string" ? model.parent : undefined;
  const localTextures = isObject(model.textures)
    ? asStringRecord(model.textures)
    : {};
  const hasLocalElements = Array.isArray((model as any).elements);
  const localTintedTextureRefs = collectTintedTextureRefs(model);

  if (!parentRef) {
    const resolved: ResolvedModel = {
      parentChain: [],
      textures: localTextures,
      tintedTextureRefs: localTintedTextureRefs,
    };
    cache.set(cacheKey, resolved);
    return resolved;
  }

  const normalizedParentRef = normalizeModelReference(parentRef, rl.namespace);
  let parentResolved: ResolvedModel | null = null;
  if (!isBuiltinModelReference(normalizedParentRef)) {
    const parentRl = parseResourceLocation(parentRef, rl.namespace);
    parentResolved = await resolveModel(index, parentRl, cache);
  }

  const resolved: ResolvedModel = {
    parentChain: [normalizedParentRef, ...(parentResolved?.parentChain ?? [])],
    textures: {
      ...(parentResolved?.textures ?? {}),
      ...localTextures,
    },
    tintedTextureRefs: dedupeBy(
      hasLocalElements
        ? localTintedTextureRefs
        : [
            ...(parentResolved?.tintedTextureRefs ?? []),
            ...localTintedTextureRefs,
          ],
      (value) => value,
    ),
  };

  cache.set(cacheKey, resolved);
  return resolved;
}

function resolveTextureReference(
  textures: Record<string, string>,
  key: string,
  depth = 0,
): string | null {
  if (depth > 32) return null;
  const raw = textures[key];
  if (!raw) return null;
  if (!raw.startsWith("#")) return raw;
  return resolveTextureReference(textures, raw.slice(1), depth + 1);
}

function collectTintedTextureRefs(model: unknown): string[] {
  if (!isObject(model) || !Array.isArray((model as any).elements)) {
    return [];
  }

  const out: string[] = [];
  for (const element of (model as any).elements as unknown[]) {
    if (!isObject(element) || !isObject((element as any).faces)) continue;
    const faces = (element as any).faces as Record<string, unknown>;
    for (const face of Object.values(faces)) {
      if (!isObject(face)) continue;
      const tintindex = (face as any).tintindex;
      if (typeof tintindex !== "number" || tintindex < 0) continue;
      const texture = (face as any).texture;
      if (typeof texture !== "string") continue;
      out.push(texture);
    }
  }

  return dedupeBy(out, (value) => value);
}

function getTintedTextureKeysForBlock(
  resolved: ResolvedModel,
  sourceNamespace: string,
  candidateTextureKeys: string[],
): string[] {
  if (resolved.tintedTextureRefs.length === 0) {
    return [];
  }

  const tintedTextureRefs = new Set<string>();
  for (const textureRef of resolved.tintedTextureRefs) {
    const resolvedRef = resolveTextureFaceReference(
      resolved.textures,
      textureRef,
    );
    if (!resolvedRef) continue;
    tintedTextureRefs.add(
      normalizeTextureResourceLocation(resolvedRef, sourceNamespace),
    );
  }
  if (tintedTextureRefs.size === 0) {
    return [];
  }

  const out: string[] = [];
  for (const key of candidateTextureKeys) {
    const textureRef = resolveTextureReference(resolved.textures, key);
    if (!textureRef) continue;
    const normalizedTextureRef = normalizeTextureResourceLocation(
      textureRef,
      sourceNamespace,
    );
    if (tintedTextureRefs.has(normalizedTextureRef)) {
      out.push(key);
    }
  }

  return dedupeBy(out, (value) => value);
}

function resolveTextureFaceReference(
  textures: Record<string, string>,
  textureRef: string,
): string | null {
  return textureRef.startsWith("#")
    ? resolveTextureReference(textures, textureRef.slice(1))
    : textureRef;
}

function normalizeTextureResourceLocation(
  textureRef: string,
  sourceNamespace: string,
): string {
  const rl = parseResourceLocation(textureRef, sourceNamespace);
  return `${rl.namespace}:${rl.path}`;
}

function pickSupportedParent<T extends string>(
  id: string,
  parentChain: string[],
  supportedParents: readonly T[],
  supportedIds: string[],
): T | null {
  const supportedP = new Set<string>(supportedParents);

  for (const parent of parentChain) {
    if (supportedP.has(parent)) return parent as T;
  }

  if (supportedIds.some((s) => id.includes(s))) {
    return parentChain[0] as T;
  }

  return null;
}

function getRequiredTextureKeysForBlockParent(
  parent: SupportedBlockParent,
  textures: Record<string, string>,
): string[] {
  const definition = getBlockParentDefinition(parent);
  if (!definition) {
    return getResolvableTextureKeys(textures);
  }
  const { requiredTextureKeys } = definition;
  if (typeof requiredTextureKeys === "function") {
    return requiredTextureKeys(textures);
  }
  return [...requiredTextureKeys];
}

function getBlockParentDefinition(
  parent: SupportedBlockParent,
): BlockParentDefinition | undefined {
  return BLOCK_PARENT_DEFINITIONS[parent];
}

function getResolvableTextureKeys(textures: Record<string, string>): string[] {
  return Object.keys(textures).filter(
    (key) =>
      key !== "particle" && resolveTextureReference(textures, key) !== null,
  );
}

function shouldUseSourceModelAsParent(parent: SupportedBlockParent): boolean {
  return getBlockParentDefinition(parent)?.useSourceModelAsParent ?? false;
}

function pickModelFromBlockstate(blockstate: any): string | null {
  if (isObject(blockstate.variants)) {
    const variants = blockstate.variants as Record<string, unknown>;

    if (variants[""]) {
      return extractModelRef(variants[""]);
    }

    const firstKey = Object.keys(variants)[0];
    if (firstKey) {
      return extractModelRef(variants[firstKey]);
    }
  }

  if (Array.isArray(blockstate.multipart) && blockstate.multipart.length > 0) {
    const first = blockstate.multipart[0];
    if (isObject(first) && "apply" in first) {
      return extractModelRef((first as any).apply);
    }
  }

  return null;
}

function extractModelRef(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const model = extractModelRef(entry);
      if (model) return model;
    }
    return null;
  }

  if (isObject(value) && typeof value.model === "string") {
    return value.model;
  }

  return null;
}

function parseAssetModelPath(
  assetPath: string,
  kind: "item" | "block",
): { namespace: string; path: string } | null {
  const match = normalizeSlashes(assetPath).match(
    /^assets\/([^/]+)\/models\/(item|block)\/(.+)\.json$/,
  );
  if (!match) return null;
  if (match[2] !== kind) return null;
  return { namespace: match[1]!, path: match[3]! };
}

function parseAssetBlockstatePath(
  assetPath: string,
): { namespace: string; path: string } | null {
  const match = normalizeSlashes(assetPath).match(
    /^assets\/([^/]+)\/blockstates\/(.+)\.json$/,
  );
  if (!match) return null;
  return { namespace: match[1]!, path: match[2]! };
}

function parseResourceLocation(
  value: string,
  currentNamespace: string,
): ResourceLocation {
  if (value.startsWith("#")) {
    throw new Error(`Unexpected unresolved texture reference: ${value}`);
  }

  const cleaned = value.replace(/^\//, "");
  const colon = cleaned.indexOf(":");
  if (colon >= 0) {
    return {
      namespace: cleaned.slice(0, colon),
      path: cleaned.slice(colon + 1),
    };
  }

  return {
    namespace: currentNamespace,
    path: cleaned,
  };
}

function getSuggestedBlockRenderType(
  block: BlockCandidate,
): BlockRenderType | null {
  const override = getBlockRegistrationOverride(block);
  if (
    override &&
    Object.prototype.hasOwnProperty.call(override, "renderType")
  ) {
    return override.renderType ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(block.textures, "overlay")) {
    return "cutout_mipped";
  }

  return getBlockParentDefinition(block.selectedParent)?.renderType ?? null;
}

function shouldUsePlantBlockSettings(block: BlockCandidate): boolean {
  const override = getBlockRegistrationOverride(block);
  if (
    override &&
    Object.prototype.hasOwnProperty.call(override, "usePlantSettings")
  ) {
    return override.usePlantSettings ?? false;
  }

  return getBlockParentDefinition(block.selectedParent)?.usePlantSettings ?? false;
}

function getSuggestedBlockSoundType(block: BlockCandidate): string {
  const override = getBlockRegistrationOverride(block);
  if (override?.soundType) {
    return override.soundType;
  }

  const byParent = CONFIG.block.registration.soundTypeByParent[block.selectedParent];
  if (byParent) {
    return byParent;
  }

  const loweredId = block.originalId.toLowerCase();
  for (const rule of CONFIG.block.registration.soundTypeKeywordRules) {
    if (loweredId.includes(rule.keyword.toLowerCase())) {
      return rule.soundType;
    }
  }

  return CONFIG.block.registration.defaultSoundType;
}

function getSuggestedBlockTint(
  block: BlockCandidate,
): BlockRegistrationTintConfig | null {
  const override = getBlockRegistrationOverride(block);
  if (override?.tintColor != null) {
    return {
      color: override.tintColor,
      tintIndices: override.tintIndices ?? [0],
    };
  }

  const tintByParent = CONFIG.block.registration.tintByParent[block.selectedParent];
  if (tintByParent) {
    return tintByParent;
  }

  const loweredId = block.originalId.toLowerCase();
  for (const rule of CONFIG.block.registration.tintKeywordRules) {
    if (loweredId.includes(rule.keyword.toLowerCase())) {
      return {
        color: rule.color,
        tintIndices: rule.tintIndices,
      };
    }
  }

  return null;
}

function getBlockRegistrationOverride(
  block: BlockCandidate,
): BlockRegistrationOverride | undefined {
  return CONFIG.block.registration.overrides[block.originalId];
}

function formatHexColor(value: number): string {
  const normalized = value >>> 0;
  // KubeJS block tint colors are safest as ARGB. If user gives RGB, force opaque alpha.
  const argb =
    normalized <= 0xffffff ? ((0xff000000 | normalized) >>> 0) : normalized;
  return `0x${argb.toString(16).padStart(8, "0").toUpperCase()}`;
}

function getRgbColor(
  value: number | null,
): { r: number; g: number; b: number } | null {
  if (value == null) {
    return null;
  }
  const normalized = value >>> 0;
  return {
    r: (normalized >> 16) & 0xff,
    g: (normalized >> 8) & 0xff,
    b: normalized & 0xff,
  };
}

function normalizeModelReference(
  value: string,
  currentNamespace: string,
): string {
  const cleaned = value.replace(/^\//, "");
  if (cleaned.includes(":")) return cleaned;
  if (isBuiltinModelReference(cleaned)) return cleaned;
  return `${currentNamespace}:${cleaned}`;
}

function isBuiltinModelReference(value: string): boolean {
  return value.startsWith("builtin/");
}

function resourceLocationToTextureAssetPath(rl: ResourceLocation): string {
  return `assets/${rl.namespace}/textures/${rl.path}.png`;
}

function textureRlToOutputPath(textureRl: string): string {
  const rl = parseResourceLocation(textureRl, CONFIG.generatedNamespace);
  return path.join(CONFIG.outRoot, rl.namespace, "textures", `${rl.path}.png`);
}

function modelRlToOutputPath(modelRl: string): string {
  const rl = parseResourceLocation(modelRl, CONFIG.generatedNamespace);
  return path.join(CONFIG.outRoot, rl.namespace, "models", `${rl.path}.json`);
}

function buildGeneratedRegistryId(
  kind: CandidateKind,
  namespace: string,
  resourcePath: string,
): string {
  const raw = `${kind}__${namespace}__${resourcePath}`;
  return `corrupted_${sanitizeForRegistryPath(raw)}`;
}

function buildCorruptionRegistryId(
  kind: CandidateKind,
  corruptionPrefix: string,
  namespace: string,
  resourcePath: string,
): string {
  const raw = `${corruptionPrefix}_${kind}__${namespace}__${resourcePath}`;
  return sanitizeForRegistryPath(raw);
}

function buildDeadVariantRegistryId(
  kind: CandidateKind,
  deadPrefix: string,
  namespace: string,
  resourcePath: string,
): string {
  const raw = `${deadPrefix}_${kind}__${namespace}__${resourcePath}`;
  return sanitizeForRegistryPath(raw);
}

function buildEventCreateId(registryPath: string): string {
  return CONFIG.registryNamespace === "kubejs"
    ? registryPath
    : `${CONFIG.registryNamespace}:${registryPath}`;
}

function shouldIncludeNamespace(namespace: string): boolean {
  if (CONFIG.includeNamespaces && CONFIG.includeNamespaces.length > 0) {
    if (!CONFIG.includeNamespaces.includes(namespace)) return false;
  }
  if (CONFIG.excludeNamespaces?.includes(namespace)) return false;
  return true;
}

function sanitizeForRegistryPath(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_/.-]+/g, "_")
    .replace(/\//g, "__")
    .replace(/\.+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function dedupeBy<T>(arr: T[], keyFn: (value: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const value of arr) {
    const key = keyFn(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

async function walk(root: string): Promise<string[]> {
  const out: string[] = [];
  async function visit(current: string): Promise<void> {
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile()) {
        out.push(fullPath);
      }
    }
  }
  await visit(root);
  return out;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringRecord(
  value: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

function toTitleCase(value: string): string {
  return value
    .split(/[\/_.-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function writeJson(outPath: string, value: unknown): Promise<void> {
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
main();
