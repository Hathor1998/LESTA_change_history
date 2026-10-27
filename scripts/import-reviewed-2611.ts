import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fetchText } from './sync-korabli.ts';
import { digest } from './official-parser.ts';
import { parseReviewedBlog699, blog699Url } from './reviewed-699.ts';
import { parseReviewedRelease2611, release2611Start, release2611Url } from './reviewed-release-2611.ts';
import { mergeReviewed2610 } from './reviewed-2610.ts';
import { readSiteConfig, writeSiteConfig, writeCategoryRows } from './data-lib.ts';
import type { OfficialBalanceDatabase, ChangeCategory } from '../src/types.ts';

const file = 'data/database/korabli-official.json';
const db = JSON.parse(await readFile(file, 'utf8')) as OfficialBalanceDatabase;
const sources = [
  { id: '699', url: blog699Url, title: 'Закрытое тестирование 26.11 — изменения тестовых кораблей', kind: 'blog' as const, parse: parseReviewedBlog699 },
  { id: 'portal-16888', url: release2611Url, title: 'Обновление 26.11. Странности в Спейд-Сити…', kind: 'portal' as const, parse: parseReviewedRelease2611 },
];
const captured = [];
for (const source of sources) {
  const html = process.argv.includes('--replay') ? await readFile(`outputs/official-review/snapshots/${source.id}.html`, 'utf8')
    : await fetchText(source.kind === 'portal' ? `${source.url}?pjax=1&consumer=pc-browser` : source.url);
  captured.push({ ...source, html, records: source.parse(html) });
}
const incoming = captured.flatMap(s => s.records), result = mergeReviewed2610(db.records, incoming);
for (const source of captured) {
  const announcement = { id: source.id, url: source.url, title: source.title, sourceKind: source.kind,
    publishedAt: source.records[0].publishedAt, contentHash: digest(source.html), recordIds: result.records.filter(r => r.announcementId === source.id).map(r => r.id) };
  const index = db.announcements.findIndex(a => a.id === source.id);
  if (index < 0) db.announcements.push(announcement); else db.announcements[index] = announcement;
}
db.records = result.records;
db.syncedAt = new Date().toISOString();
db.rangeEnd = db.syncedAt;
const site = await readSiteConfig();
const currentVersion = new Date() >= new Date(release2611Start) && site.currentVersion.localeCompare('26.11', undefined, { numeric: true }) < 0 ? '26.11' : site.currentVersion;
await mkdir('outputs/official-review/snapshots', { recursive: true });
for (const source of captured) await writeFile(`outputs/official-review/snapshots/${source.id}.html`, source.html);
await writeFile('outputs/official-review/update-2611.json', JSON.stringify({ checkedAt: db.syncedAt, added: result.added,
  verified: incoming.length, previousVersion: site.currentVersion, currentVersion, pending: incoming.filter(r => r.analysisConfidence !== 'high'), records: incoming }, null, 2) + '\n');
await writeFile(file, JSON.stringify(db, null, 2) + '\n');
for (const category of ['ship', 'mechanic', 'misc'] as ChangeCategory[]) await writeCategoryRows(category, db.records.filter(r => r.category === category));
await writeSiteConfig({ ...site, currentVersion, lastUpdated: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()) });
console.log(`26.11 reviewed update: ${result.added.length} added; ${incoming.length} verified; ${db.records.length} total; current version ${currentVersion}.`);
