# WoWS Balance Change Archive

## Purpose

The production build is a read-only GitHub Pages archive. Local development additionally provides import and data-management tools; no writing controls are rendered in the production site.

## Official Announcement Database

`data/database/korabli-official.json` is a Git-versioned package combining developer blog announcements from the last two years with official portal release notes from version 26.9 onward. Existing history is retained outside the rolling discovery window. Each record keeps:

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
npm run data:translate:zh
npm run data:validate
npm run test:data
npm run lint
npm run build
npm run data:review
npm run preview -- --host 127.0.0.1 --port 4173
```

`npm run data:sync:official` fetches the last 730 days by default. Override the range when necessary, for example: `KORABLI_DAYS=365 npm run data:sync:official`.

That window applies only to blog discovery; portal releases start at 26.9. Preview at `http://127.0.0.1:4173/LESTA_change_history/`, then review `outputs/official-review/README.md` and `review.json` before publishing. Building locally does not push anything. Run `npm run data:bundle` separately if an upload bundle is needed.

Portal content uses the public PJAX endpoint, not the calendar anchor or promotional sections. Network/body failures do not overwrite the database or TSV mirrors. Windows requests use the system proxy; other platforms use Node fetch. Requests have timeouts and bounded retries.

Equivalent changes merge provenance only when ship identity, version, stage, metric and values match. Conflicts retain the existing display values and appear in the review report; test history is not merged into released changes. Unknown identities and unparsed lines remain review candidates. Resolve approved conflicts in the database while retaining source evidence, then sync again to verify. The site version is explicitly maintained in `site.json`, never inferred from the latest blog title.

Use `npm run data:sync:official -- --replay` to recheck captured `articles.json` and `snapshots/` offline. Review artifacts are ignored by Git. Legacy blog records are preserved rather than re-parsed wholesale; articles imported by the new parser are rechecked. Historical omissions need a separate audit.

`npm run data:translate:zh` first reads ship names from the local `global.mo`, then translates remaining display fields through the DeepSeek-compatible gateway configured by local Claude settings. Credentials are only read locally and are never committed; GitHub Actions uses the committed translation package.

Set `WOWS_GLOBAL_MO_PATH` if the dictionary moves. Existing reviewed Chinese text is preserved. Unverified historical versions are labeled pending confirmation instead of dates; tiers use Roman numerals and super-ships use a star. Existing remote scheduled workflows are not disabled by this local review process.

`npm run data:import:excel` remains available for the curated Excel ship log. An official sync regenerates all three TSV mirrors, so choose one primary source for a single release.

## GitHub Pages and Automated Updates

1. In GitHub `Settings > Pages`, publish from `main` branch `/docs`.
2. Pushing a data package triggers `.github/workflows/refresh-data.yml`, which rebuilds and commits `docs/`.
3. The workflow also performs a daily official sync and can be started from `Actions > Refresh balance data > Run workflow`.
4. If needed, allow GitHub Actions to read and write repository contents in `Settings > Actions > General`.

Push only after the local preview and report are approved; an unpushed local build does not update Pages:

```bash
git add data/database data/raw data/config src docs scripts README.md README.zh-CN.md README.en.md package.json package-lock.json
git commit -m "Update balance data"
git push origin main
```

## Safety

The production build does not render import, review, draft, or data-management controls. All edits happen locally and are published as reviewable Git data packages and build output.
# Local Audit and Navigation

The bottom glass dock contains categories and search/filter controls. Escape closes the filter dialog. Version, phase, notes and sources are collapsed by default. Release status requires official evidence, rather than a test announcement title.

Run `npm run data:import:localization -- "E:/Download/8863954.0.mo"` to refresh the portable ship dictionary. Explicit code/metadata overrides live in `data/database/ship-name-overrides.json`; former translations are search aliases, not in-game renames.

Use `npm run data:sync:official -- --audit-only` to capture all articles, then `npm run data:sync:official -- --replay --review-only` for a non-writing audit. See `outputs/official-review/coverage.json`. Unreviewed candidates are quarantined, not auto-published. This iteration does not commit, push or deploy.
