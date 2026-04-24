# WoWS Balance Change Workbench

中文说明见 [README.zh-CN.md](./README.zh-CN.md)  
English guide: [README.en.md](./README.en.md)

## Overview

This repository is a local-first World of Warships / Lesta balance change archive.

- Production build: read-only viewer published from `docs/`
- Local development build: adds `数据导入` and `数据管理` tools for reviewing updates, maintaining raw source files, and exporting update bundles
- Source of truth: `data/raw/*.tsv` and `data/config/site.json`
- Generated frontend payload: `src/data/generated/balanceChanges.json`

## Quick Commands

```bash
npm install
npm run data:import:excel
npm run data:validate
npm run data:build
npm run dev
```

## Local Verification

```bash
npm run lint
npm run data:import:excel
npm run data:validate
npm run data:build
npm run build
npm run data:bundle
```

## Core Files

- `data/raw/ship.tsv`
- `data/raw/mechanic.tsv`
- `data/raw/misc.tsv`
- `data/config/site.json`
- `src/data/generated/balanceChanges.json`
- `scripts/import-excel.ts`
- `scripts/bundle-update.ts`

## Deployment Note

GitHub Pages should publish from `docs/`.  
Before deployment, confirm the `base` value in `vite.config.ts` matches your repository path.
