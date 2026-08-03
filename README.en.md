# WoWS Balance Change Archive

## Purpose

The production build is a read-only GitHub Pages archive. Local development additionally provides import and data-management tools; no writing controls are rendered in the production site.

## Official Announcement Database

`data/database/korabli-official.json` is a Git-versioned data package built from the last two years of balance-change announcements on `blog.korabli.su`. Each record keeps:

- the official URL, title, and publication date
- the original Russian change sentence
- parsed values, attribute, ship context, and category
- an automatic `buff`, `nerf`, `neutral`, or `adjustment` result
- the applied rule and confidence level

The classifier first compares numerical values and then applies attribute direction rules. Lower reload, detectability, and dispersion values are treated as buffs; higher damage, range, and speed values are treated as buffs. Ambiguous or non-numeric changes are intentionally classified as `adjustment` instead of pretending to be a buff or nerf.

The sync script also writes the three TSV mirrors under `data/raw/`, keeping the existing build and local tools compatible.

## Local Update Flow

```bash
npm install
npm run data:sync:official
npm run data:validate
npm run lint
npm run build
npm run data:bundle
```

`npm run data:sync:official` fetches the last 730 days by default. Override the range when necessary, for example: `KORABLI_DAYS=365 npm run data:sync:official`.

`npm run data:import:excel` remains available for the curated Excel ship log. An official sync regenerates all three TSV mirrors, so choose one primary source for a single release.

## GitHub Pages and Automated Updates

1. In GitHub `Settings > Pages`, publish from `main` branch `/docs`.
2. Pushing a data package triggers `.github/workflows/refresh-data.yml`, which rebuilds and commits `docs/`.
3. The workflow also performs a daily official sync and can be started from `Actions > Refresh balance data > Run workflow`.
4. If needed, allow GitHub Actions to read and write repository contents in `Settings > Actions > General`.

Push after each local update, otherwise Pages cannot change:

```bash
git add data/database data/raw data/config src/data/generated docs scripts .github README.md README.zh-CN.md README.en.md package.json
git commit -m "Update balance data"
git push origin main
```

## Safety

The production build does not render import, review, draft, or data-management controls. All edits happen locally and are published as reviewable Git data packages and build output.
