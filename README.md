# WoWS Balance Change Archive

[简体中文说明](./README.zh-CN.md) | [English guide](./README.en.md)

## Data Sources

- Official two-year announcement database: `data/database/korabli-official.json`
- Build-compatible TSV mirrors: `data/raw/*.tsv`
- Site configuration: `data/config/site.json`
- Generated frontend payload: `src/data/generated/balanceChanges.json`

`npm run data:sync:official` fetches and parses recent official Korabli development-blog balance announcements. Every record retains its original announcement URL, text, analysis rule, and confidence in the versioned JSON database. The script then refreshes the TSV mirrors used by the site.

## Core Commands

```bash
npm install
npm run data:sync:official
npm run data:validate
npm run build
```

The production site is a read-only GitHub Pages viewer published from `main` branch `/docs`. Local development also exposes the import and data-management tools.

## Automatic Website Updates

`.github/workflows/refresh-data.yml` rebuilds `docs/` whenever a data package is pushed. It also runs daily and can be started manually from GitHub Actions to fetch the official blog, rebuild the data package, and commit the result. Enable repository Actions write permission if GitHub asks for it.

After a local update, publish it with:

```bash
git add data/database data/raw data/config src/data/generated docs scripts .github README.md README.zh-CN.md README.en.md package.json
git commit -m "Update balance data"
git push origin main
```
