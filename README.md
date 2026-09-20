# WoWS Balance Change Archive

<img src="public/brand/logo.png" alt="World of Ships Balance Changes" width="160" />

## Local Audit / 本地复查

26.10 公测潜艇更新已核对录入：20 条单舰、5 条通用机制。独立标记 `changeStage: public-test`，不代表正式服已生效，当前站点版本仍为26.9。复核导入：`npm run data:import:public-test -- <保存的官方公告HTML路径>`；缺少正文、原文数值变化或冲突时停止，不自动覆盖。最新专用报告：`outputs/official-review/public-test-2610-review.json`。

本轮只生成本地预览，不发布。129 篇公告已建立逐块覆盖清单；未确认的拆分、重复及版本问题留在审核报告，不自动追加。

```bash
npm run data:sync:official -- --audit-only
npm run data:sync:official -- --replay --review-only
npm run data:import:localization -- "E:/Download/8863954.0.mo"
npm run test:data
npm run build
npm run data:review
npm run preview -- --host 127.0.0.1 --port 4173
```

`outputs/official-review/coverage.json` records every inspected block; `audit-candidates.json` is review-only. Unapproved new candidates remain quarantined during synchronization; they are **not** automatically published. `ship-localization.json` is the portable MO snapshot; `ship-name-overrides.json` records explicit identities. Lifecycle without release evidence remains unknown. Blog 695 concerns the test ship Schwaben, not a verified released ship.

[简体中文说明](./README.zh-CN.md) | [English guide](./README.en.md)

## Data Sources

- Official two-year announcement database: `data/database/korabli-official.json`
- Build-compatible TSV mirrors: `data/raw/*.tsv`
- Site configuration: `data/config/site.json`
- Generated frontend payload: `src/data/generated/balanceChanges.json`

`npm run data:sync:official` combines recent development-blog announcements with official portal release notes from 26.9 onward. Equivalent changes merge sources; conflicts retain existing values for review. Original text, URLs and analysis confidence stay in the database. The independently maintained site version is never inferred from blog titles.

## Core Commands

```bash
npm install
npm run data:sync:official
npm run data:translate:zh
npm run data:validate
npm run test:data
npm run lint
npm run build
npm run data:review
npm run preview -- --host 127.0.0.1 --port 4173
```

The production site is a read-only GitHub Pages viewer published from `main` branch `/docs`. Local development also exposes the import and data-management tools.

## Automatic Website Updates

`.github/workflows/refresh-data.yml` rebuilds `docs/` whenever a data package is pushed. It also runs daily and can be started manually from GitHub Actions to fetch the official blog, rebuild the data package, and commit the result. Enable repository Actions write permission if GitHub asks for it.

先在 `http://127.0.0.1:4173/LESTA_change_history/` 检查本地构建，审核 `outputs/official-review/README.md`，确认后才上传。本地命令不自动推送；既有线上定时任务保持不变。

Only after local review and explicit approval, publish with:

```bash
git add data/database data/raw data/config src docs scripts README.md README.zh-CN.md README.en.md package.json package-lock.json
git commit -m "Update balance data"
git push origin main
```
