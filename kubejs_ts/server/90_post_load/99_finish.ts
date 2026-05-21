ServerEvents.loaded(() => {
  JsonIO.write(
    "kubejs/exported/server/items.json",
    JSON.parse(JSON.stringify(global.items, null, 2)),
  );
  JsonIO.write(
    "kubejs/exported/server/recipes.json",
    JSON.parse(JSON.stringify(global.recipes, null, 2)),
  );
});
