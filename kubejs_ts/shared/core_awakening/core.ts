import { $LivingEntity } from "@package/net/minecraft/world/entity";
import { CoreAwakening } from "./runtime";

/**
 * Legacy key from early prototypes. New runtime data is written to
 * `CoreAwakening.Runtime.ENTITY_NBT_KEY`.
 */
export const CA_ENTITY_NBT_KEY = "ca_entity";

export function createCore(entity: $LivingEntity): void {
  // Idempotent initialization: hydrate from persistent data or create defaults.
  CoreAwakening.Runtime.loadEntityState(entity);
  CoreAwakening.Runtime.saveEntityState(entity);
}
