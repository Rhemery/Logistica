import { DeepSearchObject } from "kubejs_ts/types/minecraft";

export function validateObject(schema: Record<string, unknown>, obj: Record<string, unknown>) {
  for (const key in schema) {
    const schemaValue = schema[key];
    const objValue = obj[key];
    if (objValue === undefined) {
      return false;
    }

    if (Array.isArray(schemaValue)) {
      if (!Array.isArray(objValue)) {
        return false;
      } else {
        for (let i = 0; i < schemaValue.length; i++) {
          if (!validateObject(schemaValue[i], objValue[i])) {
            return false;
          }
        }
      }
    } else if (typeof schemaValue === "object") {
      if (typeof objValue !== "object") {
        return false;
      } else {
        if (
          !validateObject(
            schemaValue as Record<string, unknown>,
            objValue as Record<string, unknown>,
          )
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

export function assignObject(source: Record<string, unknown>, target: Record<string, unknown>) {
  if (!source) return;
  if (!target) return;

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];
    if (!targetValue) {
      target[key] = sourceValue;
    } else if (Array.isArray(sourceValue)) {
      if (!Array.isArray(targetValue)) {
        target[key] = sourceValue;
      } else {
        for (let i = 0; i < sourceValue.length; i++) {
          assignObject(sourceValue[i], targetValue[i]);
        }
      }
    } else if (typeof sourceValue === "object") {
      if (typeof targetValue !== "object") {
        target[key] = sourceValue;
      } else {
        assignObject(
          sourceValue as Record<string, unknown>,
          targetValue as Record<string, unknown>,
        );
      }
    } else {
      target[key] = sourceValue;
    }
  }
}

export function clearObject(obj: object) {
  for (const key in obj) {
    delete obj[key as keyof typeof obj];
  }
}

export function deepSearch(
  path: string,
  object: DeepSearchObject,
  output: any[],
  expected: (
    | "bigint"
    | "boolean"
    | "function"
    | "number"
    | "object"
    | "string"
    | "symbol"
    | "undefined"
  )[],
) {
  const parts = path.split(".").filter((s) => s.length > 0);
  const part = parts[0];
  if (!part) return false;

  const key = part.replace("[]", "") as keyof typeof object;
  const isArray = part.includes("[]") && Array.isArray(object[key]);
  const nestedArray = part == "[]" && Array.isArray(object);
  const expectencyCheck = (value: any) => {
    return expected.includes(typeof value);
  };

  if (parts.length == 1) {
    if (nestedArray && expectencyCheck(object)) {
      output.push(object);
      return true;
    } else if (isArray && expectencyCheck(object[key])) {
      const arr = object[key] as any[];
      arr.forEach((_, i) => {
        if (!expectencyCheck(arr[i])) return;

        output.push(arr[i]);
      });

      return true;
    } else if (expectencyCheck(object[part as keyof typeof object])) {
      output.push(object[part as keyof typeof object]);
      return true;
    } else {
      output.push(undefined);
      return false;
    }
  }

  if (nestedArray) {
    object.forEach((o, i) => {
      deepSearch(parts.slice(1).join("."), object[i] as DeepSearchObject, output, expected);
    });
  } else if (isArray) {
    (object[key] as any[]).forEach((o, i) => {
      deepSearch(
        parts.slice(1).join("."),
        (object[key] as any[])[i] as DeepSearchObject,
        output,
        expected,
      );
    });
  } else if (typeof object[key] === "object") {
    deepSearch(parts.slice(1).join("."), object[key] as DeepSearchObject, output, expected);
  }

  return false;
}

export function isStringifiedObject(value: object | string): boolean {
  function includesObjectChars(value: string) {
    return value.startsWith("{") && value.endsWith("}");
  }

  if (typeof value === "object") {
    value = String(value);
  }

  if (typeof value === "string" && includesObjectChars(value)) {
    return true;
  }

  return false;
}

export function tryParse(value: unknown): object | null {
  const forcedString = String(value);

  if (forcedString.startsWith("{") && forcedString.endsWith("}")) {
    if (forcedString.length == 2) return {};
    if (!forcedString.includes('"')) {
      console.warnf(
        `[isParsableObject] Failed to parse: ${forcedString} - has values but no quotes`,
      );
    }

    return JSON.parse(forcedString) as object;
  }

  if (forcedString.startsWith("[") && forcedString.endsWith("]")) {
    if (forcedString.includes("object Object")) {
      return value as object;
    } else if (forcedString.includes("not_supported")) {
      return null;
    } else if (forcedString.includes("[]")) {
      return [];
    } else if (forcedString.includes('"')) {
      return JSON.parse(forcedString) as object;
    } else {
      try {
        const stringified = (value as object).toString();
        console.infof(`[isParsableObject] Java object: ${stringified} - ${forcedString}`);
        return tryParse(stringified);
      } catch (e) {
        console.errorf(
          `[isParsableObject] Failed to parse: ${String(e)} - checked if its java object`,
        );
        return null;
      }
    }
  }
  return null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
