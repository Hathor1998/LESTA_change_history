import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChineseTranslationDatabase, OfficialBalanceDatabase } from '../src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.join(path.dirname(__filename), '..');
const databaseDir = path.join(repoRoot, 'data', 'database');
const officialDatabasePath = path.join(databaseDir, 'korabli-official.json');
const translationPath = path.join(databaseDir, 'korabli-zh.json');
const claudeSettingsPath = process.env.CLAUDE_SETTINGS_PATH ?? 'C:/Users/Horus/.claude/settings.json';
const defaultMoPath = 'E:/wows/WoWS-GameParams-master/WoWS-GameParams-master/trans_ch/26.7/global.mo';
const batchSize = Math.max(1, Number.parseInt(process.env.DEEPSEEK_TRANSLATE_BATCH_SIZE ?? '25', 10));

// Reviewed corrections take precedence over cached machine translations.
const approvedOverrides: Record<string, string> = {
  'Повышена точность орудий ГК. Разброс снарядов станет таким же, как у V Микоян ': '主炮精度提高，炮弹散布将与V级“米高扬”相同。',
};

interface ClaudeGatewaySettings {
  env: {
    ANTHROPIC_AUTH_TOKEN: string;
    ANTHROPIC_BASE_URL: string;
    ANTHROPIC_MODEL: string;
  };
}

interface TranslationItem {
  source: string;
  translation: string;
}

function normalizeShipCode(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function readUint32(buffer: Buffer, offset: number, littleEndian: boolean): number {
  return littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
}

function parseMoShipTranslations(buffer: Buffer): Record<string, string> {
  const littleEndian = buffer.readUInt32LE(0) === 0x950412de;
  const count = readUint32(buffer, 8, littleEndian);
  const originalOffset = readUint32(buffer, 12, littleEndian);
  const translationOffset = readUint32(buffer, 16, littleEndian);
  const translations: Record<string, string> = {};

  for (let index = 0; index < count; index += 1) {
    const originalLength = readUint32(buffer, originalOffset + index * 8, littleEndian);
    const originalStart = readUint32(buffer, originalOffset + index * 8 + 4, littleEndian);
    const translatedLength = readUint32(buffer, translationOffset + index * 8, littleEndian);
    const translatedStart = readUint32(buffer, translationOffset + index * 8 + 4, littleEndian);
    const key = buffer.subarray(originalStart, originalStart + originalLength).toString('utf8');
    const shipCode = key.match(/^IDS_[A-Z0-9]+_HULL_([A-Z0-9_]+)$/)?.[1];
    if (!shipCode) continue;
    const value = buffer.subarray(translatedStart, translatedStart + translatedLength).toString('utf8').trim();
    if (value && value.length < 80 && /[\u3400-\u9fff]/.test(value)) {
      translations[normalizeShipCode(shipCode)] = value;
    }
  }
  return translations;
}

async function resolveMoPath(): Promise<string> {
  const candidates = [process.env.WOWS_GLOBAL_MO_PATH, defaultMoPath].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next configured location.
    }
  }
  throw new Error('Cannot find global.mo. Set WOWS_GLOBAL_MO_PATH to the Chinese localization file.');
}

function chunk<T>(values: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));
}

function extractJsonObject(value: string): unknown {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model response did not include a JSON object.');
  return JSON.parse(value.slice(start, end + 1));
}

async function translateBatch(settings: ClaudeGatewaySettings, values: string[]): Promise<TranslationItem[]> {
  const prompt = [
    'Translate each World of Warships source string into accurate Simplified Chinese.',
    'Use game terminology: ГК=主炮, ПМК=副炮, ПВО=防空, ТА=鱼雷发射管.',
    'For ship names, use an established Chinese game name when known; otherwise provide a natural Chinese transliteration.',
    'Preserve numbers, units, percentages, version numbers, and quoted equipment names.',
    'Return JSON only in this exact form: {"translations":[{"source":"original","translation":"中文"}]}.',
    JSON.stringify(values),
  ].join('\n');
  const baseUrl = settings.env.ANTHROPIC_BASE_URL.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.env.ANTHROPIC_AUTH_TOKEN,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: settings.env.ANTHROPIC_MODEL,
      max_tokens: 2_500,
      temperature: 0,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`DeepSeek translation request failed: ${response.status} ${await response.text()}`);
  const payload = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const text = payload.content?.filter((item) => item.type === 'text').map((item) => item.text ?? '').join('\n') ?? '';
  const parsed = extractJsonObject(text) as { translations?: TranslationItem[] };
  if (!Array.isArray(parsed.translations)) throw new Error('DeepSeek translation response has no translations array.');
  return parsed.translations.filter((item) => values.includes(item.source) && Boolean(item.translation?.trim()));
}

async function writeDatabase(translations: Record<string, string>, untranslated: string[]): Promise<void> {
  const output: ChineseTranslationDatabase = {
    schemaVersion: 1,
    provider: 'deepseek-claude-gateway',
    generatedAt: new Date().toISOString(),
    translations: Object.fromEntries(Object.entries(translations).sort(([left], [right]) => left.localeCompare(right, 'ru'))),
    untranslated: [...new Set(untranslated)].sort(),
  };
  await mkdir(databaseDir, { recursive: true });
  await writeFile(translationPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
}

async function readExistingTranslations(): Promise<Record<string, string>> {
  try {
    const database = JSON.parse(await readFile(translationPath, 'utf8')) as ChineseTranslationDatabase;
    return database.translations ?? {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

async function main(): Promise<void> {
  const [officialDatabase, settings, moPath, cachedTranslations] = await Promise.all([
    readFile(officialDatabasePath, 'utf8').then((source) => JSON.parse(source) as OfficialBalanceDatabase),
    readFile(claudeSettingsPath, 'utf8').then((source) => JSON.parse(source) as ClaudeGatewaySettings),
    resolveMoPath(),
    readExistingTranslations(),
  ]);
  const moShipTranslations = parseMoShipTranslations(await readFile(moPath));
  const values = new Set<string>();
  const translations: Record<string, string> = { ...cachedTranslations, ...approvedOverrides };

  officialDatabase.records.forEach((record) => {
    [record.targetName, record.canonicalName, ...record.previousNames.split('|')].filter(Boolean).forEach((name) => {
      const gameTranslation = moShipTranslations[normalizeShipCode(name)];
      if (gameTranslation) translations[name] = gameTranslation;
      else values.add(name);
    });
    [record.attribute, record.oldValue, record.newValue, record.notes]
      .filter((value) => /[\u0400-\u04ff]/.test(value))
      .forEach((value) => values.add(value));
  });

  const pending = [...values].filter((value) => !translations[value]);
  const untranslated: string[] = [];
  let failedBatches = 0;
  console.log(`Using ${Object.keys(translations).length} cached or game-localization names. Translating ${pending.length} remaining strings with DeepSeek.`);
  for (const [index, group] of chunk(pending, batchSize).entries()) {
    try {
      const translated = await translateBatch(settings, group);
      const translatedSources = new Set(translated.map((item) => item.source));
      translated.forEach((item) => { translations[item.source] = item.translation.trim(); });
      group.filter((value) => !translatedSources.has(value)).forEach((value) => untranslated.push(value));
    } catch (error) {
      console.error(`Batch ${index + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
      untranslated.push(...group);
      failedBatches += 1;
    }
    await writeDatabase(translations, untranslated);
    console.log(`Translated batch ${index + 1}/${Math.ceil(pending.length / batchSize)}.`);
  }
  console.log(`Saved ${Object.keys(translations).length} translations; ${untranslated.length} items need review.`);
  if (failedBatches > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
