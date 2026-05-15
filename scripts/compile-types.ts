import fs from "node:fs";

type PrimitiveKind = "string" | "number" | "boolean" | "null" | "undefined";

type SchemaNode =
  | PrimitiveSchema
  | ArraySchema
  | ObjectSchema
  | UnionSchema
  | UnknownSchema;

interface PrimitiveSchema {
  kind: "primitive";
  types: Set<PrimitiveKind>;
  literals: Set<string>;
}

interface ArraySchema {
  kind: "array";
  item: SchemaNode;
}

interface ObjectSchema {
  kind: "object";
  samples: number;
  props: Map<string, PropSchema>;

  /**
   * If this is set, the object is emitted as:
   * {
   *   [key: string]: ...
   * }
   *
   * or:
   *
   * {
   *   [key: number]: ...
   * }
   */
  indexSignature?: {
    keyType: "string" | "number";
    value: SchemaNode;
  };
}

interface PropSchema {
  node: SchemaNode;
  count: number;
}

interface UnionSchema {
  kind: "union";
  members: SchemaNode[];
}

interface UnknownSchema {
  kind: "unknown";
}

interface GenerateOptions {
  useLiteralValues?: boolean;
  collapseSingleCharKeyObjects?: boolean;
  numericStringKeysBecomeNumberIndex?: boolean;
  rootTypeName?: string;

  /**
   * If a string literal union has more values than this,
   * emit a named alias instead of all literals.
   *
   * Example:
   *   item: ItemId
   *   type ItemId = string;
   */
  maxStringLiteralUnionSize?: number;

  /**
   * Used to infer names like ItemId, TagId, RecipeType, etc.
   */
  namedStringAliases?: Record<string, string>;

  /**
   * If true:
   *   type ItemId = string;
   *
   * If false:
   *   item: string
   */
  emitBroadStringAliases?: boolean;
}

interface RenderContext {
  aliases: Map<string, string>;
  path: string[];

  /**
   * Used for CombinedRecipe.
   */
  rootRecipeTypes?: string[];

  /**
   * Used for precise recipe variants.
   */
  discriminatorValue?: string;
}

const DEFAULT_OPTIONS: Required<GenerateOptions> = {
  useLiteralValues: true,
  collapseSingleCharKeyObjects: true,
  numericStringKeysBecomeNumberIndex: true,
  rootTypeName: "Recipe",

  maxStringLiteralUnionSize: 30,

  namedStringAliases: {
    item: "ItemId",
    id: "ItemId",
    tag: "TagId",
    type: "RecipeType",
    result: "ItemId",
    fluid: "FluidId",
    block: "BlockId",
    entity: "EntityId",
    ingredient: "IngredientId",
    resource: "ResourceLocation",
  },

  emitBroadStringAliases: true,
};

export function generateRecipeTypes(
  input: Record<string, unknown>,
  options: GenerateOptions = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const ctx: RenderContext = {
    aliases: new Map(),
    path: [],
  };

  const groups = new Map<string, unknown[]>();
  const allRecipeTypes = new Set<string>();

  let combinedSchema: SchemaNode = { kind: "unknown" };
  let count = 0;

  for (const key in input) {
    const recipe = input[key];

    combinedSchema = mergeSchemas(
      combinedSchema,
      schemaFromValue(recipe, opts),
      opts,
    );

    count++;

    if (
      recipe &&
      typeof recipe === "object" &&
      !Array.isArray(recipe) &&
      typeof (recipe as Record<string, unknown>).type === "string"
    ) {
      const recipeType = (recipe as Record<string, unknown>).type as string;

      allRecipeTypes.add(recipeType);

      if (!groups.has(recipeType)) {
        groups.set(recipeType, []);
      }

      groups.get(recipeType)!.push(recipe);
    }
  }

  if (count === 0) {
    return `export type ${opts.rootTypeName} = unknown;\n`;
  }

  combinedSchema = normalizeSchema(combinedSchema, opts);

  const recipeTypeValues = [...allRecipeTypes].sort();

  const variantTypeNames: string[] = [];
  const variantOutputs: string[] = [];

  for (const [recipeType, recipes] of [...groups.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    let variantSchema: SchemaNode = { kind: "unknown" };

    for (const recipe of recipes) {
      variantSchema = mergeSchemas(
        variantSchema,
        schemaFromValue(recipe, opts),
        opts,
      );
    }

    variantSchema = normalizeSchema(variantSchema, opts);

    const typeName = recipeTypeToTypeName(recipeType);
    variantTypeNames.push(typeName);

    const body = renderType(variantSchema, 0, opts, {
      ...ctx,
      path: [],
      discriminatorValue: recipeType,
    });

    variantOutputs.push(`export type ${typeName} = ${body};`);
  }

  const combinedBody = renderType(combinedSchema, 0, opts, {
    ...ctx,
    path: [],
    rootRecipeTypes: recipeTypeValues,
  });

  const baseAliases = [
    "export type ResourceLocation = `${string}:${string}`;",
    "export type ItemId = ResourceLocation;",
    "export type TagId = ResourceLocation | `#${ResourceLocation}`;",
    "export type BlockId = ResourceLocation;",
    "export type FluidId = ResourceLocation;",
    "export type EntityId = ResourceLocation;",
    "export type RecipeTypeId = ResourceLocation;",
    "export type ModId = string;",
    "export type UnknownRecipeType = string & {};",
  ];

  const generatedAliases = [...ctx.aliases.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `export type ${name} = ${value};`);

  const aliasOutput = [...baseAliases, ...generatedAliases].join("\n");

  const recipeTypeUnion = renderStringLiteralUnion(recipeTypeValues);

  const knownRecipeUnion =
    variantTypeNames.length === 0
      ? "never"
      : variantTypeNames.map((name) => `  | ${name}`).join("\n");

  return [
    aliasOutput,
    "",
    `export type RecipeType = ${recipeTypeUnion};`,
    "",
    `export type CombinedRecipe = ${combinedBody};`,
    "",
    `export type UnknownRecipe = Omit<CombinedRecipe, "type"> & {`,
    `  type: UnknownRecipeType;`,
    `};`,
    "",
    `export type KnownRecipe =`,
    `${knownRecipeUnion};`,
    "",
    `export type ${opts.rootTypeName} = KnownRecipe | UnknownRecipe;`,
    "",
    variantOutputs.join("\n\n"),
    "",
  ].join("\n");
}

function collapseSamples(
  values: unknown[],
  opts: Required<GenerateOptions>,
): SchemaNode {
  let schema: SchemaNode = { kind: "unknown" };

  values.forEach((value, index) => {
    if (index % 1000 === 0) console.log(`${index + 1}/${values.length}`);
    schema = mergeSchemas(schema, schemaFromValue(value, opts), opts);
  });

  return normalizeSchema(schema, opts);
}

function schemaFromValue(
  value: unknown,
  opts: Required<GenerateOptions>,
): SchemaNode {
  if (value === null) {
    return primitive("null", value, opts);
  }

  if (value === undefined) {
    return primitive("undefined", value, opts);
  }

  if (Array.isArray(value)) {
    let itemSchema: SchemaNode = { kind: "unknown" };

    for (const item of value) {
      itemSchema = mergeSchemas(itemSchema, schemaFromValue(item, opts), opts);
    }

    return {
      kind: "array",
      item: normalizeSchema(itemSchema, opts),
    };
  }

  const valueType = typeof value;

  if (
    valueType === "string" ||
    valueType === "number" ||
    valueType === "boolean"
  ) {
    return primitive(valueType, value, opts);
  }

  if (valueType === "object") {
    return objectSchemaFromValue(value as Record<string, unknown>, opts);
  }

  return { kind: "unknown" };
}

function primitive(
  type: PrimitiveKind,
  value: unknown,
  opts: Required<GenerateOptions>,
): PrimitiveSchema {
  const node: PrimitiveSchema = {
    kind: "primitive",
    types: new Set(),
    literals: new Set(),
  };

  if (type === "number") {
    node.types.add("number");
    return node;
  }

  if (type === "boolean") {
    node.types.add("boolean");
    return node;
  }

  if (type === "null") {
    node.types.add("null");
    return node;
  }

  if (type === "undefined") {
    node.types.add("undefined");
    return node;
  }

  if (type === "string") {
    if (opts.useLiteralValues && typeof value === "string") {
      node.literals.add(JSON.stringify(value));
    } else {
      node.types.add("string");
    }

    return node;
  }

  node.types.add(type);
  return node;
}

function objectSchemaFromValue(
  obj: Record<string, unknown>,
  opts: Required<GenerateOptions>,
): ObjectSchema {
  const entries = Object.entries(obj);

  const schema: ObjectSchema = {
    kind: "object",
    samples: 1,
    props: new Map(),
  };

  if (
    opts.collapseSingleCharKeyObjects &&
    entries.length > 0 &&
    entries.every(([key]) => key.length === 1)
  ) {
    const allNumericKeys = entries.every(([key]) => /^\d$/.test(key));

    let valueSchema: SchemaNode = { kind: "unknown" };

    for (const [, value] of entries) {
      valueSchema = mergeSchemas(
        valueSchema,
        schemaFromValue(value, opts),
        opts,
      );
    }

    schema.indexSignature = {
      keyType:
        allNumericKeys && opts.numericStringKeysBecomeNumberIndex
          ? "number"
          : "string",
      value: normalizeSchema(valueSchema, opts),
    };

    return schema;
  }

  for (const [key, value] of entries) {
    schema.props.set(key, {
      node: schemaFromValue(value, opts),
      count: 1,
    });
  }

  return schema;
}

function mergeSchemas(
  a: SchemaNode,
  b: SchemaNode,
  opts: Required<GenerateOptions>,
): SchemaNode {
  if (a.kind === "unknown") return b;
  if (b.kind === "unknown") return a;

  if (a.kind === "primitive" && b.kind === "primitive") {
    return mergePrimitiveSchemas(a, b);
  }

  if (a.kind === "array" && b.kind === "array") {
    return {
      kind: "array",
      item: mergeSchemas(a.item, b.item, opts),
    };
  }

  if (a.kind === "object" && b.kind === "object") {
    return mergeObjectSchemas(a, b, opts);
  }

  if (a.kind === "union") {
    return normalizeSchema(
      {
        kind: "union",
        members: [...a.members, b],
      },
      opts,
    );
  }

  if (b.kind === "union") {
    return normalizeSchema(
      {
        kind: "union",
        members: [a, ...b.members],
      },
      opts,
    );
  }

  return normalizeSchema(
    {
      kind: "union",
      members: [a, b],
    },
    opts,
  );
}

function inferStringAliasNameFromLiterals(
  path: string[],
  literals: string[],
  opts: Required<GenerateOptions>,
): string | undefined {
  const byPath = inferStringAliasName(path, opts);
  if (byPath) return byPath;

  const values = literals
    .map((literal) => {
      try {
        return JSON.parse(literal);
      } catch {
        return undefined;
      }
    })
    .filter((value): value is string => typeof value === "string");

  if (values.length === 0) return undefined;

  const allTags = values.every((value) => value.startsWith("#"));
  if (allTags) return "TagId";

  const allNamespacedIds = values.every((value) =>
    /^#?[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(value),
  );

  if (allNamespacedIds) {
    const lastKey = path[path.length - 1];

    if (lastKey === "tag") return "TagId";
    if (lastKey === "item") return "ItemId";
    if (lastKey === "fluid") return "FluidId";
    if (lastKey === "block") return "BlockId";
    if (lastKey === "entity") return "EntityId";

    return "ResourceLocation";
  }

  return undefined;
}

function mergePrimitiveSchemas(
  a: PrimitiveSchema,
  b: PrimitiveSchema,
): PrimitiveSchema {
  const types = new Set<PrimitiveKind>([...a.types, ...b.types]);
  const literals = new Set<string>([...a.literals, ...b.literals]);

  if (types.has("number")) {
    for (const literal of [...literals]) {
      if (isJsonNumberLiteral(literal)) {
        literals.delete(literal);
      }
    }
  }

  if (types.has("string")) {
    for (const literal of [...literals]) {
      if (isJsonStringLiteral(literal)) {
        literals.delete(literal);
      }
    }
  }

  if (types.has("boolean")) {
    literals.delete("true");
    literals.delete("false");
  }

  return {
    kind: "primitive",
    types,
    literals,
  };
}

function isJsonNumberLiteral(value: string): boolean {
  try {
    return typeof JSON.parse(value) === "number";
  } catch {
    return false;
  }
}

function isJsonStringLiteral(value: string): boolean {
  try {
    return typeof JSON.parse(value) === "string";
  } catch {
    return false;
  }
}

function mergeObjectSchemas(
  a: ObjectSchema,
  b: ObjectSchema,
  opts: Required<GenerateOptions>,
): ObjectSchema {
  const merged: ObjectSchema = {
    kind: "object",
    samples: a.samples + b.samples,
    props: new Map(),
  };

  if (a.indexSignature || b.indexSignature) {
    const aValue = a.indexSignature?.value ?? objectWithoutIndexSignature(a);
    const bValue = b.indexSignature?.value ?? objectWithoutIndexSignature(b);

    merged.indexSignature = {
      keyType:
        a.indexSignature?.keyType === "number" &&
        b.indexSignature?.keyType === "number"
          ? "number"
          : "string",
      value: mergeSchemas(aValue, bValue, opts),
    };

    return merged;
  }

  const keys = new Set([...a.props.keys(), ...b.props.keys()]);

  for (const key of keys) {
    const propA = a.props.get(key);
    const propB = b.props.get(key);

    if (propA && propB) {
      merged.props.set(key, {
        node: mergeSchemas(propA.node, propB.node, opts),
        count: propA.count + propB.count,
      });
    } else if (propA) {
      merged.props.set(key, {
        node: propA.node,
        count: propA.count,
      });
    } else if (propB) {
      merged.props.set(key, {
        node: propB.node,
        count: propB.count,
      });
    }
  }

  return merged;
}

function objectWithoutIndexSignature(obj: ObjectSchema): ObjectSchema {
  return {
    kind: "object",
    samples: obj.samples,
    props: obj.props,
  };
}

function normalizeSchema(
  schema: SchemaNode,
  opts: Required<GenerateOptions>,
): SchemaNode {
  if (schema.kind !== "union") return schema;

  const flatMembers: SchemaNode[] = [];

  for (const member of schema.members) {
    const normalized = normalizeSchema(member, opts);

    if (normalized.kind === "union") {
      flatMembers.push(...normalized.members);
    } else {
      flatMembers.push(normalized);
    }
  }

  let primitiveNode: PrimitiveSchema | undefined;
  const arrays: ArraySchema[] = [];
  const objects: ObjectSchema[] = [];
  const unknowns: UnknownSchema[] = [];

  for (const member of flatMembers) {
    if (member.kind === "primitive") {
      primitiveNode = primitiveNode
        ? mergePrimitiveSchemas(primitiveNode, member)
        : member;
    } else if (member.kind === "array") {
      arrays.push(member);
    } else if (member.kind === "object") {
      objects.push(member);
    } else if (member.kind === "unknown") {
      unknowns.push(member);
    }
  }

  let arrayNode: ArraySchema | undefined;
  for (const array of arrays) {
    arrayNode = arrayNode
      ? {
          kind: "array",
          item: mergeSchemas(arrayNode.item, array.item, opts),
        }
      : array;
  }

  let objectNode: ObjectSchema | undefined;
  for (const object of objects) {
    objectNode = objectNode
      ? mergeObjectSchemas(objectNode, object, opts)
      : object;
  }

  const finalMembers: SchemaNode[] = [];

  if (primitiveNode) finalMembers.push(primitiveNode);
  if (arrayNode) finalMembers.push(arrayNode);
  if (objectNode) finalMembers.push(objectNode);
  if (unknowns.length > 0) finalMembers.push({ kind: "unknown" });

  if (finalMembers.length === 1) return finalMembers[0];

  return {
    kind: "union",
    members: finalMembers,
  };
}

function containsTopLevelUnion(typeText: string): boolean {
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString: string | undefined;

  for (let i = 0; i < typeText.length; i++) {
    const char = typeText[i];
    const prev = typeText[i - 1];

    if (inString) {
      if (char === inString && prev !== "\\") {
        inString = undefined;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      continue;
    }

    if (char === "(") parenDepth++;
    else if (char === ")") parenDepth--;
    else if (char === "{") braceDepth++;
    else if (char === "}") braceDepth--;
    else if (char === "[") bracketDepth++;
    else if (char === "]") bracketDepth--;
    else if (
      char === "|" &&
      parenDepth === 0 &&
      braceDepth === 0 &&
      bracketDepth === 0
    ) {
      return true;
    }
  }

  return false;
}

function aliasForStringLiterals(
  path: string[],
  stringLiterals: string[],
): string | undefined {
  const values = stringLiterals
    .map((literal) => {
      try {
        return JSON.parse(literal);
      } catch {
        return undefined;
      }
    })
    .filter((value): value is string => typeof value === "string");

  if (values.length === 0) return undefined;

  if (values.every((value) => value.startsWith("#"))) {
    return "TagId";
  }

  const allResourceLocations = values.every((value) =>
    /^#?[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(value),
  );

  if (!allResourceLocations) return undefined;

  const joinedPath = path.join(".").toLowerCase();

  if (joinedPath.includes("tag")) return "TagId";
  if (joinedPath.includes("fluid")) return "FluidId";
  if (joinedPath.includes("block")) return "BlockId";
  if (joinedPath.includes("entity")) return "EntityId";
  if (joinedPath.includes("item") || joinedPath.includes("result"))
    return "ItemId";

  return "ResourceLocation";
}

function renderType(
  schema: SchemaNode,
  depth: number,
  opts: Required<GenerateOptions>,
  ctx: RenderContext,
): string {
  switch (schema.kind) {
    case "unknown":
      return "unknown";

    case "primitive":
      return renderPrimitive(schema, opts, ctx);

    case "array": {
      const item = renderType(schema.item, depth, opts, ctx);
      const needsParens =
        schema.item.kind === "union" || containsTopLevelUnion(item);

      return `${needsParens ? `(${item})` : item}[]`;
    }

    case "object":
      return renderObject(schema, depth, opts, ctx);

    case "union":
      return schema.members
        .map((member) => renderType(member, depth, opts, ctx))
        .filter(unique)
        .join(" | ");
  }
}

function unique<T>(value: T, index: number, array: T[]): boolean {
  return array.indexOf(value) === index;
}

function renderPrimitive(
  schema: PrimitiveSchema,
  opts: Required<GenerateOptions>,
  ctx: RenderContext,
): string {
  const primitiveTypes = [...schema.types];
  const literals = [...schema.literals];
  const stringLiterals = [...new Set(literals.filter(isJsonStringLiteral))];

  const parts: string[] = [];

  /**
   * Numbers should always be broad.
   * No: 1 | 2 | 3
   * Yes: number
   */
  if (primitiveTypes.includes("number")) {
    parts.push("number");
  }

  /**
   * Booleans should usually be broad.
   * No: true | false
   * Yes: boolean
   */
  if (primitiveTypes.includes("boolean")) {
    parts.push("boolean");
  }

  /**
   * Strings:
   * 1. Prefer semantic aliases: ItemId, TagId, FluidId, etc.
   * 2. Keep small literal unions for category/mode-like fields.
   * 3. Collapse large literal unions to string.
   */
  if (stringLiterals.length > 0 || primitiveTypes.includes("string")) {
    if (shouldForceString(ctx.path)) {
      parts.push("string");
    } else {
      const semanticAlias =
        aliasForStringField(ctx.path) ??
        aliasForStringLiterals(ctx.path, stringLiterals);

      if (semanticAlias) {
        parts.push(semanticAlias);
      } else if (
        opts.useLiteralValues &&
        stringLiterals.length > 0 &&
        stringLiterals.length <= opts.maxStringLiteralUnionSize
      ) {
        parts.push(...stringLiterals);
      } else {
        parts.push("string");
      }
    }
  }

  if (primitiveTypes.includes("null")) {
    parts.push("null");
  }

  if (primitiveTypes.includes("undefined")) {
    parts.push("undefined");
  }

  const deduped = [...new Set(parts)];

  if (deduped.length === 0) {
    return "unknown";
  }

  return deduped.join(" | ");
}

function inferStringAliasName(
  path: string[],
  opts: Required<GenerateOptions>,
): string | undefined {
  for (let i = path.length - 1; i >= 0; i--) {
    const key = path[i];

    if (opts.namedStringAliases[key]) {
      return opts.namedStringAliases[key];
    }
  }

  return undefined;
}

function shouldForceString(path: string[]): boolean {
  const key = path[path.length - 1];
  const parent = path[path.length - 2];

  if (!key) return false;

  /**
   * Minecraft shaped recipe patterns:
   * pattern: ["ABA", "CDC"]
   */
  if (key === "pattern") return true;

  /**
   * Block state / NBT-like property values:
   * properties: {
   *   level: "0"
   * }
   *
   * These should be string, not "0".
   */
  if (parent === "properties") return true;

  return false;
}

function renderStringLiteralUnion(values: string[]): string {
  const uniqueValues = [...new Set(values)].sort();

  if (uniqueValues.length === 0) {
    return "string";
  }

  return uniqueValues.map((value) => JSON.stringify(value)).join(" | ");
}

function recipeTypeToTypeName(recipeType: string): string {
  const name =
    recipeType
      .replace(/^#/, "tag_")
      .split(/[:/._-]+/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("") + "Recipe";

  return ensureValidTypeName(name);
}

function ensureValidTypeName(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9_$]/g, "");

  if (/^[A-Za-z_$]/.test(safe)) {
    return safe;
  }

  return `Recipe${safe}`;
}

function renderObject(
  schema: ObjectSchema,
  depth: number,
  opts: Required<GenerateOptions>,
  ctx: RenderContext,
): string {
  const pad = indent(depth);
  const childPad = indent(depth + 1);

  if (schema.indexSignature) {
    const childCtx: RenderContext = {
      ...ctx,
      path: [...ctx.path, "[key]"],
    };

    const valueType = renderType(
      schema.indexSignature.value,
      depth + 1,
      opts,
      childCtx,
    );

    return [
      "{",
      `${childPad}[key: ${schema.indexSignature.keyType}]: ${valueType};`,
      `${pad}}`,
    ].join("\n");
  }

  if (schema.props.size === 0) {
    return "Record<string, never>";
  }

  const lines: string[] = [""];

  const sortedProps = [...schema.props.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [key, prop] of sortedProps) {
    const optional = prop.count < schema.samples;
    const safeKey = isValidIdentifier(key) ? key : JSON.stringify(key);

    let renderedValue: string;

    if (depth === 0 && key === "type" && ctx.discriminatorValue) {
      renderedValue = JSON.stringify(ctx.discriminatorValue);
    } else if (depth === 0 && key === "type" && ctx.rootRecipeTypes?.length) {
      renderedValue = "RecipeType";
    } else {
      const childCtx: RenderContext = {
        ...ctx,
        path: [...ctx.path, key],
      };

      renderedValue = renderType(prop.node, depth + 1, opts, childCtx);
    }

    lines.push(
      `${childPad}${safeKey}${optional ? "?" : ""}: ${renderedValue};`,
    );
  }

  lines.push(`${pad}}`);

  return `{${lines.join("\n")}`;
}

function aliasForStringField(path: string[]): string | undefined {
  const key = path[path.length - 1];

  if (!key) return undefined;

  switch (key) {
    case "item":
    case "item_id":
    case "itemId":
      return "ItemId";

    case "tag":
    case "tags":
    case "item_tag":
    case "itemTag":
      return "TagId";

    case "biome":
    case "biomes":
      return "TagId";

    case "block":
    case "block_id":
    case "blockId":
      return "BlockId";

    case "fluid":
    case "fluid_id":
    case "fluidId":
      return "FluidId";

    case "fluid_tag":
    case "fluidTag":
      return "TagId";

    case "entity":
    case "entity_id":
    case "entityId":
      return "EntityId";

    case "id":
      return inferIdAliasFromPath(path);

    case "type":
      return "RecipeTypeId";

    case "modid":
    case "mod_id":
      return "ModId";

    default:
      return undefined;
  }
}

function inferIdAliasFromPath(path: string[]): string {
  const joined = path.join(".").toLowerCase();

  if (joined.includes("result")) return "ItemId";
  if (joined.includes("item")) return "ItemId";
  if (joined.includes("block")) return "BlockId";
  if (joined.includes("fluid")) return "FluidId";
  if (joined.includes("entity")) return "EntityId";

  return "ResourceLocation";
}

function indent(depth: number): string {
  return "  ".repeat(depth);
}

function isValidIdentifier(key: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

const aliases = {
  item: "ItemId",
  tag: "TagId",
  fluid: "FluidId",
  block: "BlockId",
  entity: "EntityId",
};

const database = JSON.parse(
  fs.readFileSync("../kubejs/exported/server/database.json", "utf8"),
);

let result = [
  generateRecipeTypes(database.recipes, {
    rootTypeName: "JavaRecipe",
    useLiteralValues: true,
    maxStringLiteralUnionSize: 30,
    namedStringAliases: aliases,
  }),
  generateRecipeTypes(database.items, {
    rootTypeName: "JavaItem",
    useLiteralValues: true,
    maxStringLiteralUnionSize: 30,
    namedStringAliases: aliases,
  }),
].join("\n\n");

fs.writeFileSync("../kubejs_ts/types/database.d.ts", result);
