import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBalanceChanges, readSiteConfig } from './data-lib.ts';
import type { OfficialBalanceDatabase } from '../src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const databasePath = path.join(path.dirname(__filename), '..', 'data', 'database', 'korabli-official.json');

async function validateOfficialDatabase(): Promise<OfficialBalanceDatabase> {
  const database = JSON.parse(await readFile(databasePath, 'utf8')) as OfficialBalanceDatabase;
  if (![1, 2].includes(database.schemaVersion) || !['blog.korabli.su', 'korabli-multi-source'].includes(database.source)) {
    throw new Error('Official database has an unsupported schema or source. Run npm run data:sync:official.');
  }
  if (!Array.isArray(database.announcements) || !Array.isArray(database.records)) {
    throw new Error('Official database is missing announcements or records arrays.');
  }
  const ids = new Set<string>();
  const announcements = new Map(database.announcements.map(a => [a.id, a]));
  if (announcements.size !== database.announcements.length) throw new Error('Duplicate announcement ids.');
  database.records.forEach((record) => {
    if (!record.id || (!record.sourceUrl.startsWith('https://blog.korabli.su/blog/') && !record.sourceUrl.startsWith('https://korabli.su/ru/news/game-updates/') && !record.sourceUrl.startsWith('https://korabli.su/ru/news/public-test/') && !record.sourceUrl.startsWith('manual://user-provided/'))) {
      throw new Error(`Official database contains an invalid record source: ${record.id || '(missing id)'}.`);
    }
    if (ids.has(record.id)) throw new Error(`Official database contains duplicate record id ${record.id}.`);
    if(record.sourceUrl.includes('/news/public-test/') && record.changeStage!=='public-test') throw new Error(`Public-test phase missing: ${record.id}`);
    if (!announcements.has(record.announcementId)) throw new Error(`Missing announcement for ${record.id}.`);
    if (database.schemaVersion === 2 && record.version !== '待确认' && !/^\d{2}\.\d{1,2}$/.test(record.version)) {
      throw new Error(`Invalid explicit game version for ${record.id}: ${record.version}`);
    }
    for (const source of record.sources ?? []) {
      const announcement = announcements.get(source.announcementId);
      if (!announcement || announcement.url !== source.url || !source.originalText.trim()) {
        throw new Error(`Invalid associated source for ${record.id}.`);
      }
    }
    ids.add(record.id);
  });
  for (const announcement of database.announcements) {
    if (announcement.recordIds.some(id => !ids.has(id))) throw new Error(`Dangling record reference in ${announcement.id}.`);
  }
  return database;
}

try {
  const [records, _siteConfig, database] = await Promise.all([
    loadBalanceChanges(),
    readSiteConfig(),
    validateOfficialDatabase(),
  ]);
  console.log(`Validated ${records.length} balance records and ${database.announcements.length} official announcements.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
