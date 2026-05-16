import { ItemId } from ".";

export type Material = {
  name: string;
  items: ItemId[];
  value: number;
};

export type MaterialForm =
  | "ore"
  | "raw"
  | "crushed"
  | "dust"
  | "scrap"
  | "nugget"
  | "ingot"
  | "gem"
  | "shard"
  | "plate"
  | "sheet"
  | "storage_block";
