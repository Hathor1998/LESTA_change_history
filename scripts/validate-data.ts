import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBalanceChanges, readSiteConfig } from './data-lib.ts';
import type { OfficialBalanceDatabase } from '../src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const databasePath = path.join(path.dirname(__filename), '..', 'data', 'database', 'korabli-official.json');

async function validateOfficialDatabase(): Promise<OfficialBalanceDatabase> {
  const database = JSON.parse(await readFile(databasePath, 'utf8')) as OfficialBalanceDatabase;
  if (database.schemaVersion !== 1 || database.source !== 'blog.korabli.su') {
    throw new Error('Official database has an unsupported schema or source. Run npm run data:sync:official.');
  }
  if (!Array.isArray(database.announcements) || !Array.isArray(database.records)) {
    throw new Error('Official database is missing announcements or records arrays.');
  }
  const ids = new Set<string>();
  database.records.forEach((record) => {
    if (!record.id || !record.sourceUrl.startsWith('https://blog.korabli.su/blog/')) {
      throw new Error(`Official database contains an invalid record source: ${record.id || '(missing id)'}.`);
    }
    if (ids.has(record.id)) throw new Error(`Official database contains duplicate record id ${record.id}.`);
    ids.add(record.id);
  });
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
