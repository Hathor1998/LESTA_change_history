import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeCategoryRows } from './data-lib.ts';
import type {
  ChangeCategory,
  ChangeTrend,
  OfficialAnalysisConfidence,
  OfficialAnnouncement,
  OfficialBalanceDatabase,
  OfficialBalanceRecord,
  RawBalanceRow,
  ShipStatus,
} from '../src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const databasePath = path.join(repoRoot, 'data', 'database', 'korabli-official.json');
const blogRoot = 'https://blog.korabli.su';
const syncDays = Number.parseInt(process.env.KORABLI_DAYS ?? '730', 10);
const maxPages = Number.parseInt(process.env.KORABLI_MAX_PAGES ?? '80', 10);
const concurrency = Math.max(1, Number.parseInt(process.env.KORABLI_CONCURRENCY ?? '4', 10));

type ListedArticle = { id: string; url: string; title: string; publishedAt: string };
type ShipContext = { name: string; nation: string; tier: string; type: string; status: ShipStatus };

const nationLabels: Record<string, string> = {
  usa: '美国', uk: '英国', germany: '德国', japan: '日本', ussr: '苏联', russia: '苏联',
  france: '法国', italy: '意大利', pan_asia: '泛亚', pan_america: '泛美', europe: '欧洲',
  netherlands: '荷兰', spain: '西班牙', commonwealth: '英联邦', poland: '波兰',
};

const typeLabels: Record<string, string> = {
  destroyer: '驱逐舰', cruiser: '巡洋舰', battleship: '战列舰', carrier: '航空母舰', submarine: '潜艇',
};

const lowerIsBetter = [
  'перезаряд', 'заметност', 'разброс', 'время подготовки', 'время поворота', 'время перекладки',
  'время восстановления', 'время действия пожара', 'время действия затопления', 'радиус циркуляции',
];

const higherIsBetter = [
  'урон', 'бронепробит', 'скорост', 'дальност', 'боеспособност', 'количеств', 'шанс', 'пво',
  'живучест', 'мощност', 'точност', 'эффективност', 'время работы', 'время действия',
];

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»',
    ndash: '–', mdash: '—', hellip: '…', shy: '', copy: '©',
  };

  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return named[lower] ?? `&${entity};`;
  });
}

function textFromHtml(value: string): string {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function attributeValue(tag: string, attribute: string): string {
  return tag.match(new RegExp(`${attribute}="([^"]*)"`, 'i'))?.[1] ?? '';
}

async function fetchText(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'WoWS-change-history-data-sync/1.0 (+https://github.com/Hathor1998/LESTA_change_history)' },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }
  throw new Error(`Unable to fetch ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function dateFromUnixSeconds(value: string): string {
  return new Date(Number.parseInt(value, 10) * 1000).toISOString();
}

function listArticles(html: string): ListedArticle[] {
  const articles: ListedArticle[] = [];
  for (const match of html.matchAll(/<article\b[\s\S]*?<\/article>/gi)) {
    const block = match[0];
    const timestamp = block.match(/<time\s+data-timestamp="(\d+)"/i)?.[1];
    const link = block.match(/href="(https?:\/\/blog\.korabli\.su\/blog\/(\d+))"/i);
    const title = block.match(/<h2[^>]*class="article__title"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    if (!timestamp || !link || !title) continue;
    articles.push({ id: link[2], url: link[1], title: textFromHtml(title), publishedAt: dateFromUnixSeconds(timestamp) });
  }
  return articles;
}

function isBalanceAnnouncement(title: string): boolean {
  return /изменени|баланс|ребаланс|правк|донастройк/i.test(title);
}

function versionFromTitle(title: string, publishedAt: string): string {
  const version = title.match(/(?:обновление|версия|тестирование|общий тест|закрытое тестирование)\s+(\d{2}\.\d{1,2})/i)?.[1];
  return version ?? publishedAt.slice(0, 7).replace('-', '.');
}

function parseNumber(value: string): number | null {
  const match = value.replace(/\s/g, '').match(/-?\d+(?:[,.]\d+)?/);
  return match ? Number.parseFloat(match[0].replace(',', '.')) : null;
}

function inferTrend(attribute: string, oldValue: string, newValue: string, originalText: string): {
  trend: ChangeTrend; rule: string; confidence: OfficialAnalysisConfidence;
} {
  const normalizedAttribute = attribute.toLowerCase();
  const oldNumber = parseNumber(oldValue);
  const newNumber = parseNumber(newValue);
  if (oldNumber !== null && newNumber !== null && oldNumber === newNumber) {
    return { trend: 'neutral', rule: 'numeric-equality', confidence: 'high' };
  }

  const direction = oldNumber !== null && newNumber !== null ? Math.sign(newNumber - oldNumber) : 0;
  if (direction !== 0) {
    if (lowerIsBetter.some((term) => normalizedAttribute.includes(term))) {
      return { trend: direction < 0 ? 'buff' : 'nerf', rule: 'numeric-lower-is-better', confidence: 'high' };
    }
    if (higherIsBetter.some((term) => normalizedAttribute.includes(term))) {
      return { trend: direction > 0 ? 'buff' : 'nerf', rule: 'numeric-higher-is-better', confidence: 'high' };
    }
  }

  if (/исправлен|заменен|заменён|добавлен|удален|удалён|переработан/i.test(originalText)) {
    return { trend: 'adjustment', rule: 'non-numeric-adjustment', confidence: 'medium' };
  }
  return { trend: 'adjustment', rule: 'insufficient-metric-context', confidence: 'low' };
}

function parseChangeLine(value: string): { attribute: string; oldValue: string; newValue: string } {
  const normalized = value.replace(/\s+/g, ' ').trim().replace(/[.]$/, '');
  const ranged = normalized.match(/^(.+?)\s+(?:уменьшен[аоы]?|увеличен[аоы]?|снижен[аоы]?|повышен[аоы]?|изменен[аоы]?|изменён[аоы]?)\s+с\s+(.+?)\s+до\s+(.+?)(?:\.|$)/i);
  if (ranged) return { attribute: ranged[1].trim(), oldValue: ranged[2].trim(), newValue: ranged[3].trim() };

  const changed = normalized.match(/^(.+?)\s+(?:изменен[аоы]?|изменён[аоы]?)\s+с\s+(.+?)\s+на\s+(.+?)(?:\.|$)/i);
  if (changed) return { attribute: changed[1].trim(), oldValue: changed[2].trim(), newValue: changed[3].trim() };
  return { attribute: normalized, oldValue: '—', newValue: '—' };
}

function categoryFor(context: ShipContext | null, title: string, line: string): ChangeCategory {
  if (context) return 'ship';
  if (/навык|снаряжени|подлод|пло|командир/i.test(`${title} ${line}`)) return 'mechanic';
  return 'misc';
}

function shouldKeepLine(value: string): boolean {
  return /уменьшен|увеличен|снижен|повышен|изменен|изменён|исправлен|заменен|заменён|добавлен|удален|удалён|переработан/i.test(value);
}

function parseShipContext(html: string, status: ShipStatus): ShipContext | null {
  const ship = html.match(/<span\b[^>]*class="ship"[^>]*>[\s\S]*?<\/span>/i)?.[0];
  if (!ship) return null;
  const name = textFromHtml(ship).replace(/^(?:I|V|X|L|C|D|M)+\s+/i, '').trim();
  if (!name) return null;
  return {
    name,
    nation: nationLabels[attributeValue(ship, 'data-nation')] ?? '',
    tier: attributeValue(ship, 'data-level'),
    type: typeLabels[attributeValue(ship, 'data-type')] ?? '',
    status,
  };
}

function parseAnnouncement(article: ListedArticle, html: string): { announcement: OfficialAnnouncement; records: OfficialBalanceRecord[] } {
  const content = html.match(/<div class="article__content">([\s\S]*?)<\/div>\s*<\/article>/i)?.[1] ?? '';
  const version = versionFromTitle(article.title, article.publishedAt);
  const records: OfficialBalanceRecord[] = [];
  let shipStatus: ShipStatus = /тестов/i.test(article.title) ? 'test' : 'released';
  let context: ShipContext | null = null;

  for (const match of content.matchAll(/<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const tag = match[1].toLowerCase();
    const blockHtml = match[2];
    const line = textFromHtml(blockHtml);
    if (!line) continue;

    if (tag.startsWith('h')) {
      if (/тестов/i.test(line)) shipStatus = 'test';
      if (/основн|релиз|вступят в силу/i.test(line)) shipStatus = 'released';
      continue;
    }

    if (tag === 'p') {
      const parsedContext = parseShipContext(blockHtml, shipStatus);
      if (parsedContext) context = parsedContext;
      continue;
    }

    if (!shouldKeepLine(line)) continue;
    const change = parseChangeLine(line);
    const targetName = context?.name ?? article.title;
    const category = categoryFor(context, article.title, line);
    const analysis = inferTrend(change.attribute, change.oldValue, change.newValue, line);
    const raw: RawBalanceRow = {
      targetName,
      canonicalName: targetName,
      previousNames: '',
      nation: context?.nation ?? '',
      tier: context?.tier ?? '',
      type: context?.type ?? '',
      attribute: change.attribute,
      oldValue: change.oldValue,
      newValue: change.newValue,
      version,
      notes: `官方公告：${article.url}`,
      trend: analysis.trend,
      shipStatus: category === 'ship' ? (context?.status ?? shipStatus) : 'unknown',
      tags: '',
      sourceSheet: `Korabli #${article.id}`,
    };
    const id = hash([article.id, targetName, change.attribute, change.oldValue, change.newValue, line].join('|')).slice(0, 16);
    records.push({
      ...raw,
      id,
      category,
      announcementId: article.id,
      sourceUrl: article.url,
      publishedAt: article.publishedAt,
      originalText: line,
      analysisRule: analysis.rule,
      analysisConfidence: analysis.confidence,
    });
  }

  return {
    announcement: {
      id: article.id,
      url: article.url,
      title: article.title,
      publishedAt: article.publishedAt,
      contentHash: hash(content),
      recordIds: records.map((record) => record.id),
    },
    records,
  };
}

async function parallelMap<T, R>(items: T[], mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function discoverArticles(rangeStart: Date): Promise<ListedArticle[]> {
  const found = new Map<string, ListedArticle>();
  for (let page = 1; page <= maxPages; page += 1) {
    const html = await fetchText(`${blogRoot}/?page=${page}`);
    const articles = listArticles(html);
    if (articles.length === 0) break;
    articles.forEach((article) => found.set(article.id, article));
    const oldest = Math.min(...articles.map((article) => Date.parse(article.publishedAt)));
    if (oldest < rangeStart.getTime()) break;
  }
  return [...found.values()]
    .filter((article) => Date.parse(article.publishedAt) >= rangeStart.getTime())
    .filter((article) => isBalanceAnnouncement(article.title))
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
}

async function main(): Promise<void> {
  if (!Number.isFinite(syncDays) || syncDays <= 0) throw new Error('KORABLI_DAYS must be a positive number.');
  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd.getTime() - syncDays * 24 * 60 * 60 * 1000);
  const articles = await discoverArticles(rangeStart);
  console.log(`Found ${articles.length} official balance announcements since ${rangeStart.toISOString().slice(0, 10)}.`);

  const parsed = await parallelMap(articles, async (article) => {
    const html = await fetchText(article.url);
    return parseAnnouncement(article, html);
  });
  const announcements = parsed.map((entry) => entry.announcement);
  const records = parsed.flatMap((entry) => entry.records);
  const uniqueRecords = [...new Map(records.map((record) => [record.id, record])).values()];

  const database: OfficialBalanceDatabase = {
    schemaVersion: 1,
    source: 'blog.korabli.su',
    syncedAt: rangeEnd.toISOString(),
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    announcements,
    records: uniqueRecords,
  };
  await mkdir(path.dirname(databasePath), { recursive: true });
  await writeFile(databasePath, `${JSON.stringify(database, null, 2)}\n`, 'utf8');

  const categories: Record<ChangeCategory, RawBalanceRow[]> = { ship: [], mechanic: [], misc: [] };
  uniqueRecords.forEach((record) => {
    const { id: _id, category, announcementId: _announcementId, sourceUrl: _sourceUrl, publishedAt: _publishedAt, originalText: _originalText, analysisRule: _analysisRule, analysisConfidence: _analysisConfidence, ...raw } = record;
    categories[category].push(raw);
  });
  await Promise.all((Object.keys(categories) as ChangeCategory[]).map((category) => writeCategoryRows(category, categories[category])));

  const trends = uniqueRecords.reduce<Record<ChangeTrend, number>>((counts, record) => {
    counts[record.trend] += 1;
    return counts;
  }, { buff: 0, nerf: 0, neutral: 0, adjustment: 0 });
  console.log(`Wrote ${uniqueRecords.length} records to data/database and raw TSV mirrors. ${JSON.stringify(trends)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
