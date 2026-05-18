// Print all files from /mods to mods.txt

const fs = require("fs");
const path = require("path");

const mods = fs.readdirSync(path.join(__dirname, "../mods"));
fs.writeFileSync(
  path.join(__dirname, "mods.txt"),
  mods.filter((f) => f.endsWith(".jar")).join("\n"),
);

console.log(`Wrote ${mods.length} mods to mods.txt`);
