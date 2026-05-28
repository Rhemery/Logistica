// build-kubejs.mjs
import { build } from "esbuild";
import fg from "fast-glob";
import { rmSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import * as babel from "@babel/core";
import path from "node:path";

const uniqueVarNamesPlugin = function ({ types: t }) {
  return {
    visitor: {
      Program(path) {
        path.scope.crawl();

        for (const [name, binding] of Object.entries(path.scope.bindings)) {
          if (binding.path.isVariableDeclarator()) {
            const parent = binding.path.parentPath;

            if (parent?.node?.kind === "var") {
              const unique = path.scope.generateUidIdentifier(name).name;
              binding.scope.rename(name, unique);
            }
          }
        }
      },

      Function(path) {
        path.scope.crawl();

        for (const [name, binding] of Object.entries(path.scope.bindings)) {
          if (binding.path.isVariableDeclarator()) {
            const parent = binding.path.parentPath;

            if (parent?.node?.kind === "var") {
              const unique = path.scope.generateUidIdentifier(name).name;
              binding.scope.rename(name, unique);
            }
          }
        }
      },
    },
  };
};

const scriptGroups = [
  {
    name: "startup",
    pattern: "kubejs_ts/startup/**/*.ts",
    outdir: "kubejs/startup_scripts/generated",
  },
  {
    name: "server",
    pattern: "kubejs_ts/server/**/*.ts",
    outdir: "kubejs/server_scripts/generated",
  },
  {
    name: "client",
    pattern: "kubejs_ts/client/**/*.ts",
    outdir: "kubejs/client_scripts/generated",
  },
];

const jsonGroups = [
  {
    name: "startup",
    pattern: "kubejs_ts/startup/exported/*.*",
    outdir: "kubejs/exported/startup",
  },
  {
    name: "server",
    pattern: "kubejs_ts/server/exported/*.*",
    outdir: "kubejs/exported/server",
  },
  {
    name: "client",
    pattern: "kubejs_ts/client/exported/*.*",
    outdir: "kubejs/exported/client",
  },
];

for (const group of scriptGroups) {
  const entryPoints = await fg(group.pattern, {
    absolute: false,
    onlyFiles: true,
    ignore: ["**/*.d.ts", "**/*.test.ts", "**/*.spec.ts"],
  });

  rmSync(group.outdir, { recursive: true, force: true });
  mkdirSync(group.outdir, { recursive: true });

  if (entryPoints.length === 0) {
    console.warn(`[${group.name}] No entry points found for ${group.pattern}`);
    continue;
  }

  const result = await build({
    entryPoints,
    outdir: group.outdir,
    alias: {
      "kubejs_ts/shared": "./kubejs_ts/shared",
      "kubejs_ts/types": "./kubejs_ts/types",
      "@package/net/minecraft/core/registries":
        "./.probe/@package/net/minecraft/core/registries/index.d.ts",
    },

    // Critical for KubeJS: removes TS import/export from final files.
    bundle: true,

    // Critical for KubeJS: avoids CommonJS require/module.exports.
    format: "iife",

    platform: "neutral",
    target: "ES2022",

    sourcemap: false,
    minify: false,
    minifySyntax: false,
    treeShaking: false,
    legalComments: "none",
    logLevel: "info",
    metafile: true,

    // Keeps folder structure under startup/server/client.
    outbase: `kubejs_ts/${group.name}`,

    banner: {
      js: `// Generated from ${group.pattern}. Do not edit manually.`,
    },
  });

  for (const outputPath of Object.keys(result.metafile.outputs)) {
    if (!outputPath.endsWith(".js")) continue;

    const code = readFileSync(outputPath, "utf8");

    const result = babel.transform(code, {
      filename: outputPath,
      babelrc: false,
      configFile: false,
      compact: false,
      comments: false,
      plugins: [
        uniqueVarNamesPlugin,
        "@babel/plugin-transform-shorthand-properties",
        "@babel/plugin-transform-object-rest-spread",
        "@babel/plugin-transform-parameters",
        "@babel/plugin-transform-block-scoping",
        "@babel/plugin-transform-spread",
        /*
        "@babel/plugin-transform-spread",
        ,
        ,
        "@babel/plugin-transform-for-of",
        ,*/

        //,

        //,
      ],
    });

    if (!result?.code) {
      throw new Error("Babel did not return transformed code.");
    }

    const forbidden = [
      /\bimport\s+.*from\b/,
      /\bexport\s+/,
      /\brequire\s*\(/,
      /\bmodule\.exports\b/,
      /\bexports\./,
    ];

    writeFileSync(outputPath, result?.code ?? code);
  }

  console.log(`[${group.name}] Built ${entryPoints.length} file(s)`);
}

for (const group of jsonGroups) {
  const entryPoints = await fg(group.pattern, {
    absolute: false,
    onlyFiles: true,
    ignore: ["**/*.d.ts", "**/*.test.ts", "**/*.spec.ts"],
  });

  rmSync(group.outdir, { recursive: true, force: true });
  mkdirSync(group.outdir, { recursive: true });

  if (entryPoints.length === 0) {
    console.warn(`[${group.name}] No entry points found for ${group.pattern}`);
    continue;
  }

  console.log(`[${group.name}] Copying ${entryPoints} file(s)...`);
  for (const entryPoint of entryPoints) {
    const targetDir = path.basename(entryPoint);
    if (existsSync(`${group.outdir}/${targetDir}`)) continue;

    copyFileSync(entryPoint, `${group.outdir}/${targetDir}`);
  }

  console.log(`[${group.name}] Built ${entryPoints.length} file(s)`);
}
