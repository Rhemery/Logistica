ServerEvents.recipes((event) => {
  JsonIO.write(
    "kubejs/exported/server/items.json",
    JSON.parse(JSON.stringify(global.items, null, 2)) as typeof global.items,
  );
  JsonIO.write(
    "kubejs/exported/server/recipes.json",
    JSON.parse(
      JSON.stringify(global.recipes, null, 2),
    ) as typeof global.recipes,
  );
});
