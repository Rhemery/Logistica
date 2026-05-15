import { priceItems } from "kubejs_ts/shared/economy";
import { loadItems } from "kubejs_ts/shared/item";
import { LoadMaterials } from "kubejs_ts/shared/material";
import { buildMarketEntries } from "kubejs_ts/shared/market";
import { loadRecipes } from "kubejs_ts/shared/recipe";

ServerEvents.recipes((event) => {
  loadItems();
  LoadMaterials();
  loadRecipes(event);
  priceItems();
  buildMarketEntries();
});
