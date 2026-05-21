import { priceItems } from "kubejs_ts/shared/logistica/economy";
import { buildMarketEntries } from "kubejs_ts/shared/logistica/market";
import { loadItems } from "kubejs_ts/shared/minecraft/item";
import { LoadMaterials } from "kubejs_ts/shared/minecraft/material";
import { loadRecipes } from "kubejs_ts/shared/minecraft/recipe";

ServerEvents.recipes(() => {
  loadItems();
});

ServerEvents.recipes(() => {
  LoadMaterials();
});

ServerEvents.recipes((event) => {
  loadRecipes(event);
});

ServerEvents.recipes(() => {
  priceItems();
});

ServerEvents.recipes(() => {
  buildMarketEntries();
});
