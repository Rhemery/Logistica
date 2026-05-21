import type { Item } from "kubejs_ts/types/minecraft/item";
import {
  INFER_MATERIAL_BLACKLIST_KEYWORDS,
  INFER_MATERIAL_CLEANUP_KEYWORDS,
  INFER_MATERIAL_KEYWORDS,
  INFER_MATERIAL_OVERRIDE,
} from "./config/materials";
import { ItemId } from "kubejs_ts/types/minecraft";
import { clearObject } from ".";
import { logProgress } from "./logs";

export function LoadMaterials() {
  const items = Object.values(global.items);
  if (items.length == 0) {
    console.errorf(
      "[Economy] LoadMaterials() depends on loadItems(), but no items found.",
    );
  }
  console.infof("[Economy] Infering materials...");
  function addMaterial(material: string, item: Item) {
    if (!global.materials[material]) {
      global.materials[material] = {
        name: material,
        items: [item.id],
        value: 0,
      };
    } else {
      if (!global.materials[material].items)
        global.materials[material].items = [];
      if (!global.materials[material].items.includes(item.id))
        global.materials[material].items.push(item.id);
    }
  }
  clearObject(global.materials);

  const maybeMaterials: {
    material: string;
    item: Item;
  }[] = [];
  items.forEach((item, index) => {
    logProgress("Materials", index, items.length);
    const result = inferMaterial(item.id);
    if (result == null) return;

    INFER_MATERIAL_OVERRIDE.forEach(([target, keyword]) => {
      if (result.name.includes(keyword)) {
        result.name = target;
      }
    });

    if (result.isMaterial) {
      addMaterial(result.name, item);
    } else if (result.maybeMaterial) {
      maybeMaterials.push({
        material: result.name,
        item: item,
      });
    }
  });

  maybeMaterials.forEach(({ material, item }) => {
    addMaterial(material, item);
  });

  Object.values(global.materials).forEach((material) => {
    material.items.forEach((item_id) => {
      if (global.items[item_id]) {
        const item = global.items[item_id];
        item.materials[material.name] = material;
      }
    });
  });

  JsonIO.write(
    "kubejs/exported/server/materials.json",
    JSON.parse(JSON.stringify(global.materials, null, 2)),
  );
}

export function inferMaterial(id: ItemId): {
  name: string;
  isMaterial: boolean;
  maybeMaterial: boolean;
} | null {
  const path = id.split(":")[1];
  if (!path) return null;

  for (const keyword of INFER_MATERIAL_BLACKLIST_KEYWORDS) {
    if (path.includes(keyword)) return null;
  }

  function findKeywords(input: readonly string[], path: string) {
    const keywords = input.join("|");

    return [
      new RegExp(`_(${keywords})$`, "i").exec(path),
      new RegExp(`^(${keywords})_`, "i").exec(path),
    ];
  }

  function hasValue(regs: (RegExpExecArray | null)[]) {
    let hasValue = false;
    for (const reg of regs) {
      if (reg) {
        hasValue = true;
        break;
      }
    }
    return hasValue;
  }

  let result = path;
  let regs = findKeywords(INFER_MATERIAL_KEYWORDS, result);
  if (!hasValue(regs))
    return {
      name: result,
      isMaterial: false,
      maybeMaterial: true,
    };

  while (hasValue(regs)) {
    for (const reg of regs) {
      if (!reg) continue;

      for (const regx of reg) {
        result = result.replace(regx, "");
      }
    }

    regs = findKeywords(INFER_MATERIAL_KEYWORDS, result);
  }

  regs = findKeywords(INFER_MATERIAL_CLEANUP_KEYWORDS, result);
  while (hasValue(regs)) {
    for (const reg of regs) {
      if (!reg) continue;

      for (const regx of reg) {
        result = result.replace(regx, "");
      }
    }

    regs = findKeywords(INFER_MATERIAL_CLEANUP_KEYWORDS, result);
  }

  return {
    name: result,
    isMaterial: true,
    maybeMaterial: false,
  };
}

export function cleanupMaterialName(material: string): string {
  return material.replace(/^deepslate_/, "").replace(/^nether_/, "");
}

export function isKnownMaterialName(material: string): boolean {
  return global.materials[material] != null;
}
