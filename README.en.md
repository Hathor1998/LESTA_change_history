# WoWS Local Balance Change Workbench

## Overview

This repository now has two separate roles:

1. Production site: a read-only balance change archive
2. Local development site: includes `数据导入` and `数据管理` tools for importing, reviewing, and preparing source data updates

The repository source of truth is:

- `data/raw/ship.tsv`
- `data/raw/mechanic.tsv`
- `data/raw/misc.tsv`
- `data/config/site.json`

The frontend reads the generated payload:

- `src/data/generated/balanceChanges.json`

## Workflow

Recommended update flow:

1. Run `npm run data:import:excel` if you want to rebuild released ship source data from the root workbook
2. Run `npm run dev`
3. Import pasted official announcement text or upload `.xlsx/.csv/.tsv`
4. Review fields manually, especially version, aliases, and ship lifecycle
5. Append valid rows into local source data or replace a category
6. Export `data/raw/*.tsv` and `site.json`
7. Run `npm run data:validate`
8. Run `npm run data:build`
9. Run `npm run build`
10. Run `npm run data:bundle`
11. Manually commit or upload the output to GitHub

## Local Tools

### Data Import

The importer supports two parsing modes:

- Structured table mode for TSV / CSV / Excel rows
- Announcement block mode for pasted official website text

Announcement block mode is designed for inputs like:

- `Main battery reload time reduced from 7 s to 5.8 s`
- `Surface detectability reduced from 9.3 km to 8.1 km`
- `Adjusted the parameters of the "Spotter Aircraft" consumable`
- child lines such as cooldown and action time changes

Parent context lines are preserved and applied to child rows, so attributes become complete labels like `Spotter Aircraft-cooldown`.

### Data Manager

The local data manager is for maintaining the source snapshot that will later be written back to the repository. It supports:

- browsing and filtering source rows
- adding, editing, and deleting rows
- maintaining `canonicalName`, `previousNames`, `shipStatus`, and `tags`
- editing `currentVersion` and `lastUpdated`
- exporting per-category TSV
- exporting `site.json`

The browser does not write to the repository directly. Exported files must be copied back into the repo manually.

## Excel Import Rules

`npm run data:import:excel` scans the project root for `.xlsx` files and prefers one whose filename contains `Lesta`.

The script:

- reads the `查询` sheet
- reads the `非测试舰船` sheet
- ignores an empty `测试舰船` sheet
- overwrites only `data/raw/ship.tsv`
- splits `/` in ship names into `canonicalName + previousNames`
- updates `site.json.currentVersion` from the `查询` sheet when `当前版本` is found

## Lifecycle and Tags

Supported lifecycle-related fields:

- `canonicalName`
- `previousNames`
- `shipStatus`
- `tags`
- `sourceSheet`

Derived tag rules:

- `shipStatus=test` adds `test-ship`
- `shipStatus=released` adds `released-ship`
- non-empty `previousNames` adds `name-change`
- released ships matching test ships by display name, canonical name, or aliases add `converted-from-test`

If there is no test-ship source data yet, `converted-from-test` may remain `0`. Once test ship rows are added, rebuilding will infer the conversion tags automatically.

## Raw TSV Schema

All source TSV files use this 15-column layout:

```tsv
targetName	canonicalName	previousNames	nation	tier	type	attribute	oldValue	newValue	version	notes	trend	shipStatus	tags	sourceSheet
```

Rules:

- `previousNames` uses `|`
- `tags` uses `|`
- `trend` must be `buff | nerf | neutral | adjustment`
- `shipStatus` must be `test | released | unknown`

## Commands

Install:

```bash
npm install
```

Local development:

```bash
npm run dev
```

Rebuild released ship source data from Excel:

```bash
npm run data:import:excel
```

Validate source data:

```bash
npm run data:validate
```

Generate frontend data:

```bash
npm run data:build
```

Type-check:

```bash
npm run lint
```

Build production output:

```bash
npm run build
```

Export a local update bundle:

```bash
npm run data:bundle
```

## GitHub Pages Deployment

### 1. Confirm the Vite base

Make sure the `base` value in `vite.config.ts` matches your GitHub Pages repository path.

### 2. Run the full local verification flow

```bash
npm run lint
npm run data:import:excel
npm run data:validate
npm run data:build
npm run build
npm run data:bundle
```

### 3. Commit the required outputs

At minimum, publish:

- `data/raw/*.tsv`
- `data/config/site.json`
- `src/data/generated/balanceChanges.json`
- `docs/`
- related source and documentation changes

### 4. Enable GitHub Pages

In GitHub:

1. Open `Settings`
2. Open `Pages`
3. Set `Build and deployment` to `Deploy from a branch`
4. Choose your deployment branch
5. Choose `/docs`

### 5. Production site behavior

The GitHub Pages site is intentionally read-only. `数据导入` and `数据管理` are hidden in production to avoid accidental online edits and reduce data risk.
