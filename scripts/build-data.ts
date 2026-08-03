import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGeneratedData, loadBalanceChanges, readSiteConfig, writeGeneratedData } from './data-lib.ts';
import type { OfficialBalanceDatabase } from '../src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const databasePath = path.join(path.dirname(__filename), '..', 'data', 'database', 'korabli-official.json');

try {
  const [records, siteConfig, officialDatabase] = await Promise.all([
    loadBalanceChanges(),
    readSiteConfig(),
    readFile(databasePath, 'utf8').then((source) => JSON.parse(source) as OfficialBalanceDatabase),
  ]);
  const data = buildGeneratedData(records, siteConfig);
  data.meta.officialData = {
    announcementCount: officialDatabase.announcements.length,
    rangeStart: officialDatabase.rangeStart,
    rangeEnd: officialDatabase.rangeEnd,
    syncedAt: officialDatabase.syncedAt,
  };
  await writeGeneratedData(data);
  console.log(`Generated ${data.records.length} balance records at src/data/generated/balanceChanges.json.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
