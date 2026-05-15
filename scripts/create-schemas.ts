import fs from "node:fs";
import path from "node:path";

const INPUT = "kubejs/exported/recipes.json";
const OUT_DIR = "kubejs_ts/generated";
const SCHEMA_OUT = path.join(OUT_DIR, "recipe-schemas.schema.json");
const TYPES_OUT = path.join(OUT_DIR, "recipe-types.ts");

fs.mkdirSync(OUT_DIR, { recursive: true });

const exportedRecipes = JSON.parse(fs.readFileSync(INPUT, "utf8"));

const byType = new Map();

for (const entry of exportedRecipes) {
  const json = entry.json;
  const type = json?.type ?? entry.type ?? "unknown";

  if (!byType.has(type)) byType.set(type, []);
  byType.get(type).push(json);
}

function cleanTypeName(type) {
  return (
    type
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim()
      .split(/\s+/g)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("") + "Recipe"
  );
}

function schemaForValue(value) {
  if (value === null) return { type: "null" };

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { type: "array", items: {} };
    }

    return {
      type: "array",
      items: mergeSchemas(value.map(schemaForValue)),
    };
  }

  const valueType = typeof value;

  if (valueType === "string") return { type: "string" };
  if (valueType === "number")
    return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  if (valueType === "boolean") return { type: "boolean" };

  if (valueType === "object") {
    const properties = {};
    const required = [];

    for (const [key, child] of Object.entries(value)) {
      properties[key] = schemaForValue(child);
      required.push(key);
    }

    return {
      type: "object",
      properties,
      required,
      additionalProperties: true,
    };
  }

  return {};
}

function normalizeSchema(schema) {
  if (schema.oneOf) {
    const flat = schema.oneOf.flatMap((s) => s.oneOf ?? [s]);
    return mergeSchemas(flat);
  }

  return schema;
}

function schemaKey(schema) {
  return JSON.stringify(schema);
}

function mergeSchemas(schemas) {
  const normalized = schemas.map(normalizeSchema);

  if (normalized.length === 0) return {};
  if (normalized.length === 1) return normalized[0];

  const unique = [
    ...new Map(normalized.map((s) => [schemaKey(s), s])).values(),
  ];

  if (unique.length === 1) return unique[0];

  const types = new Set(unique.map((s) => s.type));

  // Merge object schemas.
  if (types.size === 1 && types.has("object")) {
    return mergeObjectSchemas(unique);
  }

  // Merge array schemas.
  if (types.size === 1 && types.has("array")) {
    return {
      type: "array",
      items: mergeSchemas(unique.map((s) => s.items ?? {})),
    };
  }

  // Merge integer + number into number.
  if (types.size === 2 && types.has("integer") && types.has("number")) {
    return { type: "number" };
  }

  return { oneOf: unique };
}

function mergeObjectSchemas(schemas) {
  const allKeys = new Set();
  const presentCount = new Map();
  const propertySchemas = new Map();

  for (const schema of schemas) {
    const props = schema.properties ?? {};

    for (const key of Object.keys(props)) {
      allKeys.add(key);
      presentCount.set(key, (presentCount.get(key) ?? 0) + 1);

      if (!propertySchemas.has(key)) propertySchemas.set(key, []);
      propertySchemas.get(key).push(props[key]);
    }
  }

  const properties = {};
  const required = [];

  for (const key of [...allKeys].sort()) {
    properties[key] = mergeSchemas(propertySchemas.get(key));

    if (presentCount.get(key) === schemas.length) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: true,
  };
}

function schemaForRecipeType(type, recipes) {
  const schemas = recipes.map((recipe) => schemaForValue(recipe));
  const merged = mergeSchemas(schemas);

  if (merged.type === "object") {
    merged.properties = {
      type: { const: type },
      ...(merged.properties ?? {}),
    };

    merged.required = [...new Set(["type", ...(merged.required ?? [])])];
  }

  return merged;
}

const definitions = {};
const typeNameByRecipeType = {};

for (const [type, recipes] of [...byType.entries()].sort()) {
  const typeName = cleanTypeName(type);
  typeNameByRecipeType[type] = typeName;
  definitions[typeName] = schemaForRecipeType(type, recipes);
}

const rootSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://local.kubejs/recipe-schemas.schema.json",
  title: "Inferred Minecraft Recipe JSON Schemas",
  oneOf: Object.keys(definitions).map((name) => ({
    $ref: `#/$defs/${name}`,
  })),
  $defs: definitions,
};

fs.writeFileSync(SCHEMA_OUT, JSON.stringify(rootSchema, null, 2));

function tsStringLiteral(value) {
  return JSON.stringify(value);
}

function propName(key) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function schemaToTs(schema, indent = 0) {
  if (!schema || Object.keys(schema).length === 0) return "unknown";

  if (schema.const !== undefined) return tsStringLiteral(schema.const);

  if (schema.oneOf) {
    return schema.oneOf.map((s) => schemaToTs(s, indent)).join(" | ");
  }

  switch (schema.type) {
    case "null":
      return "null";
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return `Array<${schemaToTs(schema.items ?? {}, indent)}>`;
    case "object": {
      const props = schema.properties ?? {};
      const required = new Set(schema.required ?? []);

      const pad = " ".repeat(indent);
      const childPad = " ".repeat(indent + 2);

      const lines = ["{"];

      for (const [key, propSchema] of Object.entries(props)) {
        const optional = required.has(key) ? "" : "?";
        lines.push(
          `${childPad}${propName(key)}${optional}: ${schemaToTs(propSchema, indent + 2)}`,
        );
      }

      if (schema.additionalProperties) {
        lines.push(`${childPad}[key: string]: unknown`);
      }

      lines.push(`${pad}}`);
      return lines.join("\n");
    }
    default:
      return "unknown";
  }
}

let ts = `// Generated by scripts/generate-recipe-schemas.mjs
// Do not edit manually.

`;

for (const [type, typeName] of Object.entries(typeNameByRecipeType)) {
  ts += `export type ${typeName} = ${schemaToTs(definitions[typeName])}\n\n`;
}

ts += `export type RecipeJson =\n`;
for (const typeName of Object.values(typeNameByRecipeType)) {
  ts += `  | ${typeName}\n`;
}

ts += `\nexport type RecipeType = RecipeJson['type']\n\n`;

ts += `export type RecipeByType<T extends RecipeType> = Extract<RecipeJson, { type: T }>\n\n`;

ts += `export type RecipeTypeMap = {\n`;
for (const [type, typeName] of Object.entries(typeNameByRecipeType)) {
  ts += `  ${tsStringLiteral(type)}: ${typeName}\n`;
}
ts += `}\n`;

fs.writeFileSync(TYPES_OUT, ts);

console.log(`Generated ${SCHEMA_OUT}`);
console.log(`Generated ${TYPES_OUT}`);
console.log(`Recipe types: ${Object.keys(definitions).length}`);
