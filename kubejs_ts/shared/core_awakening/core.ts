import { $LivingEntity } from "@package/net/minecraft/world/entity";
import { saveNbt } from "../minecraft/nbt";
import { CA } from "kubejs_ts/types/core_awakening";

export const CA_ENTITY_NBT_KEY = "ca_entity";

export function createCore(entity: $LivingEntity): void {
  const data: CA.EntityData = {
    core: {
      health: 0,
      energy: 0,
      corruption: 0,
      purity: 0,
    },
    nodesDisintigrated: 0,
  };

  saveNbt(entity.persistentData, CA_ENTITY_NBT_KEY, data);
}
