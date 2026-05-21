/*
  Core Awakening corruption asset generator for KubeJS / NeoForge 1.21.1

  What it does:
  - scans vanilla + mod assets from jars or directories
  - finds simple item models and simple blockstates/models
  - generates corrupted PNG variants
  - generates block model JSON files for corrupted blocks
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

type SupportedBlockParent = string;

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
  originalId: string;
  registryId: string;
  displayName: string;
  sourceNamespace: string;
  sourcePath: string;
  parentModel: SupportedBlockParent;
  textures: Record<string, string>;
  modelResourceLocation: string;
  corruptionLevel: LoadedCorruptionLevel;
}

interface Report {
  generatedItems: number;
  generatedBlocks: number;
  skippedItems: Array<{ id: string; reason: string }>;
  skippedBlocks: Array<{ id: string; reason: string }>;
}

const version = "1.21.1";
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
  outRoot: path.resolve("kubejs/assets"),
  tsOutDir: path.resolve("kubejs_ts/startup/core_awakening/generated"),
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
    supportedParents: [
      "minecraft:block/cube_all",
      "minecraft:block/cube_bottom_top",
      "minecraft:block/cube_column",
      "minecraft:block/cube_column_horizontal",
      "minecraft:block/orientable",
    ],
    supportedIds: [],
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
  "minecraft:grass_block": "kubejs:dead_grass_block",
  "kubejs:dead_grass_block": "minecraft:dirt",
  "minecraft:dirt": "kubejs:light_corrupted_block_minecraft_dirt",
  "kubejs:light_corrupted_block_minecraft_dirt":
    "kubejs:heavy_corrupted_block_minecraft_dirt",
};
const conversionsDown: Record<string, string> = {
  "kubejs:heavy_corrupted_block_minecraft_dirt":
    "kubejs:light_corrupted_block_minecraft_dirt",
  "kubejs:light_corrupted_block_minecraft_dirt": "minecraft:dirt",
};

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

async function writeConversionMap(blocks: BlockCandidate[]): Promise<void> {
  const result = [
    `export const GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_UP: Record<string, string> = ${JSON.stringify(conversionsUp, null, 2)};`,
    `export const GENERATED_CORRUPTION_BLOCK_CONVERSION_MAP_DOWN: Record<string, string> = ${JSON.stringify(conversionsDown, null, 2)};`,
  ];
  await fsp.writeFile(
    path.join(
      path.resolve("kubejs_ts/shared/core_awakening/generated"),
      "corruption_block_conversion.ts",
    ),
    result.join("\n"),
  );
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

  await writeConversionMap(generatedBlocks);
  await writeGeneratedKubeJSTs(generatedItems, generatedBlocks);
  await writeReport(report, generatedItems, generatedBlocks);

  console.log(
    `Generated ${generatedItems.length} corrupted items and ${generatedBlocks.length} corrupted blocks.`,
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
    const blockstate = await index.readJson<any>(assetPath);
    if (!blockstate) {
      report.skippedBlocks.push({
        id: originalId,
        reason: "Unreadable blockstate JSON",
      });
      continue;
    }

    const chosenModelRef = pickModelFromBlockstate(blockstate);
    if (!chosenModelRef) {
      report.skippedBlocks.push({
        id: originalId,
        reason: "Unsupported blockstate structure",
      });
      continue;
    }

    const modelRl = parseResourceLocation(chosenModelRef, parsed.namespace);
    const resolved = await resolveModel(index, modelRl, modelCache);
    if (!resolved) {
      report.skippedBlocks.push({
        id: originalId,
        reason: "Could not resolve block model parent",
      });
      continue;
    }

    const selectedParent = pickSupportedParent(
      originalId,
      resolved.parentChain,
      CONFIG.block.supportedParents,
      CONFIG.block.supportedIds,
    );
    if (!selectedParent) {
      const directParent = resolved.parentChain[0];
      report.skippedBlocks.push({
        id: originalId,
        reason: directParent
          ? `Unsupported block parent: ${directParent}`
          : "Could not resolve block model parent",
      });
      continue;
    }

    const requiredKeys = getRequiredTextureKeysForBlockParent(
      selectedParent,
      resolved.textures,
    );
    if (requiredKeys.length === 0) {
      report.skippedBlocks.push({
        id: originalId,
        reason: `Unsupported block parent: ${selectedParent}`,
      });
      continue;
    }

    const textures: Record<string, string> = {};

    let missing = false;
    for (const key of requiredKeys) {
      const textureRef = resolveTextureReference(resolved.textures, key);
      if (!textureRef) {
        missing = true;
        break;
      }
      textures[key] = textureRef;
    }

    if (missing) {
      report.skippedBlocks.push({
        id: originalId,
        reason: "Missing one or more required block textures",
      });
      continue;
    }

    const outputParentModel =
      selectedParent === "minecraft:block/block"
        ? `${modelRl.namespace}:${modelRl.path}`
        : selectedParent;

    const conversion = [originalId];
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
        originalId,
        registryId,
        displayName: `${corruptionLevel.displayPrefix} ${toTitleCase(parsed.path)}`,
        sourceNamespace: parsed.namespace,
        sourcePath: parsed.path,
        parentModel: outputParentModel,
        textures,
        modelResourceLocation: `${CONFIG.generatedNamespace}:block/generated/${registryId}`,
        corruptionLevel,
      });
    }

    for (let i = 1; i < conversion.length; i++) {
      conversionsUp[conversion[i - 1]] = conversion[i];
      conversionsDown[conversion[i]] = conversion[i - 1];
    }
  }

  return dedupeBy(out, (c) => c.registryId);
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
  for (const candidate of candidates) {
    const generatedTextures: Record<string, string> = {};

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
      await writeTransformedTexture(png, outPngPath, candidate.corruptionLevel);

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
  const itemsTs = buildItemRegistrationTs(items);
  const blocksTs = buildBlockRegistrationTs(blocks);
  const manifestTs = buildManifestTs(items, blocks);

  await fsp.mkdir(CONFIG.tsOutDir, { recursive: true });
  await fsp.writeFile(
    path.join(CONFIG.tsOutDir, "register_corrupted_items.ts"),
    itemsTs,
    "utf8",
  );
  await fsp.writeFile(
    path.join(CONFIG.tsOutDir, "register_corrupted_blocks.ts"),
    blocksTs,
    "utf8",
  );
  await fsp.writeFile(
    path.join(CONFIG.tsOutDir, "corruption_generated_manifest.ts"),
    manifestTs,
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

  return `// Generated by generate-corruption-assets.ts
// DO NOT EDIT MANUALLY

StartupEvents.registry('item', event => {
${rows}
})
`;
}

function buildBlockRegistrationTs(blocks: BlockCandidate[]): string {
  const rows = blocks
    .map((block) => {
      const eventId = buildEventCreateId(block.registryId);
      const renderType = getSuggestedBlockRenderType(block);
      const needsPlantSettings = shouldUsePlantBlockSettings(block);
      const lines = [
        `  event.create(${JSON.stringify(eventId)})`,
        `    .displayName(${JSON.stringify(block.displayName)})`,
        `    .parentModel(${JSON.stringify(block.modelResourceLocation)})`,
      ];

      if (renderType) {
        lines.push(`    .renderType(${JSON.stringify(renderType)})`);
      }
      if (needsPlantSettings) {
        lines.push("    .fullBlock(false)");
        lines.push("    .notSolid()");
        lines.push("    .noCollision()");
      }

      lines.push(
        `    .item(item => item.parentModel(${JSON.stringify(block.modelResourceLocation)}))`,
      );

      return lines.join("\n");
    })
    .join("\n\n");

  return `// Generated by generate-corruption-assets.ts
// DO NOT EDIT MANUALLY

StartupEvents.registry('block', event => {
${rows}
})
`;
}

function buildManifestTs(
  items: ItemCandidate[],
  blocks: BlockCandidate[],
): string {
  const itemRows = items
    .map(
      (item) =>
        `  ${JSON.stringify(item.registryId)}: ${JSON.stringify(item.originalId)},`,
    )
    .join("\n");
  const blockRows = blocks
    .map(
      (block) =>
        `  ${JSON.stringify(block.registryId)}: ${JSON.stringify(block.originalId)},`,
    )
    .join("\n");

  return `// Generated by generate-corruption-assets.ts
// DO NOT EDIT MANUALLY

export const CORRUPTED_ITEM_SOURCE_MAP = {
${itemRows}
} as const

export const CORRUPTED_BLOCK_SOURCE_MAP = {
${blockRows}
} as const
`;
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

async function writeTransformedTexture(
  sourcePng: Buffer,
  outPath: string,
  corruptionLevel?: LoadedCorruptionLevel,
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

      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const gray = lum;

      let rr = mix(r, gray, CONFIG.transform.desaturate);
      let gg = mix(g, gray, CONFIG.transform.desaturate);
      let bb = mix(b, gray, CONFIG.transform.desaturate);

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

  if (!parentRef) {
    const resolved: ResolvedModel = {
      parentChain: [],
      textures: localTextures,
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
  switch (parent) {
    case "minecraft:block/cube_all":
      return ["all"];
    case "minecraft:block/cube_bottom_top":
      return ["side", "top", "bottom"];
    case "minecraft:block/cube_column":
    case "minecraft:block/cube_column_horizontal":
      return ["side", "end"];
    case "minecraft:block/orientable":
      return ["front", "side", "top"];
    case "minecraft:block/tinted_cross":
    case "minecraft:block/cross":
      return ["cross"];
    case "minecraft:block/template_seagrass":
      return ["texture"];
    default:
      return Object.keys(textures).filter(
        (key) =>
          key !== "particle" && resolveTextureReference(textures, key) !== null,
      );
  }
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
): "cutout" | "cutout_mipped" | null {
  if (Object.prototype.hasOwnProperty.call(block.textures, "overlay")) {
    return "cutout_mipped";
  }

  switch (block.parentModel) {
    case "minecraft:block/tinted_cross":
    case "minecraft:block/cross":
    case "minecraft:block/template_seagrass":
      return "cutout";
    default:
      return null;
  }
}

function shouldUsePlantBlockSettings(block: BlockCandidate): boolean {
  switch (block.parentModel) {
    case "minecraft:block/tinted_cross":
    case "minecraft:block/cross":
    case "minecraft:block/template_seagrass":
      return true;
    default:
      return false;
  }
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
