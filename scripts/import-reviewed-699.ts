import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fetchText } from './sync-korabli.ts';
import { digest } from './official-parser.ts';
import { parseReviewedBlog699, blog699Url } from './reviewed-699.ts';
import { mergeReviewed2610 } from './reviewed-2610.ts';
import { readSiteConfig, writeSiteConfig, writeCategoryRows } from './data-lib.ts';
import type { OfficialBalanceDatabase, ChangeCategory } from '../src/types.ts';

const file = 'data/database/korabli-official.json';
const db = JSON.parse(await readFile(file, 'utf8')) as OfficialBalanceDatabase;
const snapshot = 'outputs/official-review/snapshots/699.html';
const html = process.argv.includes('--replay') ? await readFile(snapshot, 'utf8') : await fetchText(blog699Url);
const incoming = parseReviewedBlog699(html), result = mergeReviewed2610(db.records, incoming);
const announcement = { id: '699', url: blog699Url, title: 'Закрытое тестирование 26.11 — изменения тестовых кораблей', sourceKind: 'blog' as const,
  publishedAt: incoming[0].publishedAt, contentHash: digest(html), recordIds: result.records.filter(r => r.announcementId === '699').map(r => r.id) };
const index = db.announcements.findIndex(a => a.id === '699');
if (index < 0) db.announcements.push(announcement); else db.announcements[index] = announcement;
db.records = result.records;
db.syncedAt = new Date().toISOString();
db.rangeEnd = db.syncedAt;
await mkdir('outputs/official-review/snapshots', { recursive: true });
await writeFile(snapshot, html);
await writeFile('outputs/official-review/update-699.json', JSON.stringify({ checkedAt: db.syncedAt, added: result.added, verified: incoming.length,
  shipCount: new Set(incoming.map(r => r.targetName)).size, pending: incoming.filter(r => r.analysisConfidence !== 'high'), records: incoming }, null, 2) + '\n');
await writeFile(file, JSON.stringify(db, null, 2) + '\n');
for (const category of ['ship', 'mechanic', 'misc'] as ChangeCategory[]) await writeCategoryRows(category, db.records.filter(r => r.category === category));
const site = await readSiteConfig();
await writeSiteConfig({ ...site, lastUpdated: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()) });
console.log(`Blog 699: ${result.added.length} added, ${incoming.length} verified; ${db.records.length} total; current version ${site.currentVersion}.`);
