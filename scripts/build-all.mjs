import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const javaProjectDir = path.join(rootDir, "JavaProjects", "LogisticaMod");
const modsDir = path.join(rootDir, "mods");
const libsDir = path.join(javaProjectDir, "build", "libs");

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function isLogisticaJar(fileName) {
  return /^logistica.*\.jar$/i.test(fileName);
}

function isRuntimeJar(fileName) {
  return (
    isLogisticaJar(fileName) &&
    !/-sources\.jar$/i.test(fileName) &&
    !/-javadoc\.jar$/i.test(fileName)
  );
}

function getNewestRuntimeJar(directory) {
  if (!existsSync(directory)) {
    throw new Error(`Build output directory not found: ${directory}`);
  }

  const candidates = readdirSync(directory)
    .filter(isRuntimeJar)
    .map((name) => ({
      name,
      fullPath: path.join(directory, name),
      mtimeMs: statSync(path.join(directory, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (candidates.length === 0) {
    throw new Error(`No Logistica runtime jar found in: ${directory}`);
  }

  return candidates[0];
}
/*
console.log("[build] Generating package info...");
runCommand(process.execPath, [path.join(rootDir, "scripts", "generate-package-info.mjs")], rootDir);
*/
console.log("[build] Building KubeJS scripts...");
runCommand(process.execPath, [path.join(rootDir, "build-kubejs.mjs")], rootDir);

console.log("[build] Building LogisticaMod...");
if (process.platform === "win32") {
  runCommand("cmd.exe", ["/c", "gradlew.bat", "build"], javaProjectDir);
} else {
  runCommand("./gradlew", ["build"], javaProjectDir);
}

const builtJar = getNewestRuntimeJar(libsDir);

console.log("[build] Replacing Logistica mod jar in mods folder...");
for (const fileName of readdirSync(modsDir)) {
  if (isLogisticaJar(fileName)) {
    rmSync(path.join(modsDir, fileName), { force: true });
  }
}

const destinationJar = path.join(modsDir, builtJar.name);
copyFileSync(builtJar.fullPath, destinationJar);

console.log(`[build] Copied ${builtJar.name} to mods.`);
