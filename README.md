# Logistica

KubeJS + TypeScript workflow for a Minecraft NeoForge `1.21.1` instance.

## Overview

This repository contains the authored scripts and tooling for the Logistica instance, with a build pipeline that compiles TypeScript sources into KubeJS-ready JavaScript.

## Project Structure

- `kubejs_ts/` TypeScript source scripts and shared logic
- `kubejs/` KubeJS runtime scripts, config, and exported data
- `scripts/` utility scripts for schema generation and worldgen scanning
- `build-kubejs.mjs` build pipeline for generating KubeJS script outputs

## Requirements

- Node.js 20+
- npm 10+

## Setup

```bash
npm install
```

## Contributor Setup (CurseForge)

`git clone` alone does not install gameplay binaries (`mods`, `resourcepacks`, `shaderpacks`).

Use this workflow:

1. Install/import the pack with CurseForge (project page, profile code, or exported profile `.zip`) so CurseForge resolves and downloads mod files from `manifest.json`.
2. Open the created instance folder in your filesystem.
3. Sync this repository into that instance folder (or copy tracked repo files into it).
4. Run `npm install`.
5. Run `npm run build`.

This keeps third-party binaries out of Git while still giving contributors a reproducible environment.

## Commands

- `npm run typecheck` TypeScript project checks
- `npm run lint` ESLint checks for `kubejs_ts`
- `npm run check` run typecheck + lint
- `npm run build` build generated KubeJS scripts
- `npm run recipes:schema` generate recipe schema/type artifacts
- `npm run scan:worldgen` scan resources and generate worldgen exports

## Notes

- This repository is prepared for public GitHub publishing.
- Machine-local files, runtime data, generated artifacts, and secrets are excluded via `.gitignore`.

## License

MIT. See [LICENSE.md](./LICENSE.md).
