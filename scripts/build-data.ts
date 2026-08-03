import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGeneratedData, loadBalanceChanges, readSiteConfig, writeGeneratedData } from './data-lib.ts';
import type { ChineseTranslationDatabase, OfficialBalanceDatabase } from '../src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const databasePath = path.join(path.dirname(__filename), '..', 'data', 'database', 'korabli-official.json');
const translationPath = path.join(path.dirname(__filename), '..', 'data', 'database', 'korabli-zh.json');

function localizeUnits(value: string): string {
  return value
    // Restrict replacements to numeric values so a Cyrillic letter inside prose is never altered.
    .replace(/(\d(?:[.,]\d+)?)\s*с(?=\s|$|[.,;:])/gi, '$1 秒')
    .replace(/(\d(?:[.,]\d+)?)\s*км(?=\s|$|[.,;:])/gi, '$1 千米')
    .replace(/(\d(?:[.,]\d+)?)\s*мм(?=\s|$|[.,;:])/gi, '$1 毫米')
    .replace(/(\d(?:[.,]\d+)?)\s*м(?=\s|$|[.,;:])/gi, '$1 米')
    .replace(/(\d(?:[.,]\d+)?)\s*уз(?:лов)?(?=\s|$|[.,;:])/gi, '$1 节')
    .replace(/(\d(?:[.,]\d+)?)\s*единиц(?:а|ы)?(?=\s|$|[.,;:])/gi, '$1 点')
    .replace(/(\d(?:[.,]\d+)?)\s*ед\.?(?=\s|$|[.,;:])/gi, '$1 点');
}

function applyChineseTranslations(records: Awaited<ReturnType<typeof loadBalanceChanges>>, translations: Record<string, string>) {
  const normalizedTranslations = new Map(Object.entries(translations).map(([source, translation]) => [source.trim(), translation]));
  const translate = (value: string) => translations[value] ?? normalizedTranslations.get(value.trim()) ?? value;
  return records.map((record) => ({
    ...record,
    targetName: translate(record.targetName),
    canonicalName: translate(record.canonicalName),
    previousNames: record.previousNames.map(translate),
    attribute: translate(record.attribute),
    oldValue: localizeUnits(translate(record.oldValue)),
    newValue: localizeUnits(translate(record.newValue)),
    notes: translate(record.notes),
  }));
}

try {
  const [records, siteConfig, officialDatabase, translationDatabase] = await Promise.all([
    loadBalanceChanges(),
    readSiteConfig(),
    readFile(databasePath, 'utf8').then((source) => JSON.parse(source) as OfficialBalanceDatabase),
    readFile(translationPath, 'utf8').then((source) => JSON.parse(source) as ChineseTranslationDatabase),
  ]);
  const data = buildGeneratedData(applyChineseTranslations(records, translationDatabase.translations), siteConfig);
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
