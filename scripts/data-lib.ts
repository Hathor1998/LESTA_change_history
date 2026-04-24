import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CATEGORY_ORDER,
  CHANGE_TAG_VALUES,
  RAW_BALANCE_COLUMNS,
  SHIP_STATUS_VALUES,
  TREND_VALUES,
} from '../src/data/schema.ts';
import { generateRawTSV } from '../src/utils/tsv.ts';
import type {
  BalanceChange,
  ChangeCategory,
  ChangeTag,
  GeneratedBalanceData,
  RawBalanceRow,
  SiteConfig,
  ShipStatus,
} from '../src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

export const RAW_DATA_DIR = path.join(repoRoot, 'data', 'raw');
export const CONFIG_DIR = path.join(repoRoot, 'data', 'config');
export const SITE_CONFIG_PATH = path.join(CONFIG_DIR, 'site.json');
export const GENERATED_DATA_PATH = path.join(repoRoot, 'src', 'data', 'generated', 'balanceChanges.json');

const CATEGORY_FILES: Record<ChangeCategory, string> = {
  ship: 'ship.tsv',
  mechanic: 'mechanic.tsv',
  misc: 'misc.tsv',
};

const REQUIRED_FIELDS: Array<keyof RawBalanceRow> = [
  'targetName',
  'attribute',
  'oldValue',
  'newValue',
  'version',
  'trend',
];

function fail(message: string): never {
  throw new Error(message);
}

export function parseVersion(version: string): number[] {
  return version.split('.').map((part) => Number.parseInt(part, 10) || 0);
}

export function compareVersionDesc(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const delta = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

export function splitPipeList(value: string): string[] {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeShipStatus(category: ChangeCategory, status: string): ShipStatus {
  if (category !== 'ship') {
    return 'unknown';
  }

  if (!status.trim()) {
    return 'released';
  }

  if (SHIP_STATUS_VALUES.includes(status as ShipStatus)) {
    return status as ShipStatus;
  }

  fail(`Invalid shipStatus "${status}". Expected one of: ${SHIP_STATUS_VALUES.join(', ')}.`);
}

export function normalizeTags(category: ChangeCategory, row: RawBalanceRow): ChangeTag[] {
  const inputTags = splitPipeList(row.tags);
  inputTags.forEach((tag) => {
    if (!CHANGE_TAG_VALUES.includes(tag as ChangeTag)) {
      fail(`Invalid tag "${tag}". Expected one of: ${CHANGE_TAG_VALUES.join(', ')}.`);
    }
  });

  const tags = new Set<ChangeTag>(inputTags as ChangeTag[]);
  const shipStatus = normalizeShipStatus(category, row.shipStatus);

  if (category === 'ship') {
    if (shipStatus === 'test') {
      tags.add('test-ship');
      tags.delete('released-ship');
    }

    if (shipStatus === 'released') {
      tags.add('released-ship');
      tags.delete('test-ship');
    }

    if (splitPipeList(row.previousNames).length > 0) {
      tags.add('name-change');
    }
  }

  return [...tags];
}

function getStableId(category: ChangeCategory, row: RawBalanceRow): string {
  const rawValue = [
    category,
    row.targetName,
    row.canonicalName,
    row.previousNames,
    row.nation,
    row.tier,
    row.type,
    row.attribute,
    row.oldValue,
    row.newValue,
    row.version,
    row.notes,
    row.trend,
    row.shipStatus,
    row.tags,
    row.sourceSheet,
  ].join('|');

  return createHash('sha256').update(rawValue).digest('hex').slice(0, 12);
}

function validateHeader(headerLine: string, sourceFile: string): void {
  const actualColumns = headerLine.split('\t').map((column) => column.trim());
  const expectedColumns = [...RAW_BALANCE_COLUMNS];

  if (actualColumns.length !== expectedColumns.length) {
    fail(`${sourceFile}: header column count mismatch, expected ${expectedColumns.length} columns.`);
  }

  expectedColumns.forEach((column, index) => {
    if (actualColumns[index] !== column) {
      fail(`${sourceFile}: invalid header at column ${index + 1}, expected "${column}" but got "${actualColumns[index] ?? ''}".`);
    }
  });
}

function validateRow(row: RawBalanceRow, category: ChangeCategory, sourceFile: string, lineNumber: number): void {
  REQUIRED_FIELDS.forEach((field) => {
    if (!row[field].trim()) {
      fail(`${sourceFile}:${lineNumber} missing required field "${field}" for category "${category}".`);
    }
  });

  if (!TREND_VALUES.includes(row.trend)) {
    fail(`${sourceFile}:${lineNumber} invalid trend "${row.trend}". Expected one of: ${TREND_VALUES.join(', ')}.`);
  }

  normalizeShipStatus(category, row.shipStatus);
  normalizeTags(category, row);
}

function normalizeRow(columns: string[]): RawBalanceRow {
  return {
    targetName: columns[0] ?? '',
    canonicalName: columns[1] ?? '',
    previousNames: columns[2] ?? '',
    nation: columns[3] ?? '',
    tier: columns[4] ?? '',
    type: columns[5] ?? '',
    attribute: columns[6] ?? '',
    oldValue: columns[7] ?? '',
    newValue: columns[8] ?? '',
    version: columns[9] ?? '',
    notes: columns[10] ?? '',
    trend: (columns[11] ?? '') as RawBalanceRow['trend'],
    shipStatus: (columns[12] ?? '') as RawBalanceRow['shipStatus'],
    tags: columns[13] ?? '',
    sourceSheet: columns[14] ?? '',
  };
}

function getAliasSet(record: Pick<BalanceChange, 'targetName' | 'canonicalName' | 'previousNames'>): Set<string> {
  return new Set([
    record.targetName.trim(),
    record.canonicalName.trim(),
    ...record.previousNames.map((name) => name.trim()),
  ].filter(Boolean));
}

export async function readCategoryRows(category: ChangeCategory): Promise<RawBalanceRow[]> {
  if (!CATEGORY_ORDER.includes(category)) {
    fail(`Unknown category "${category}".`);
  }

  const sourceFile = path.join(RAW_DATA_DIR, CATEGORY_FILES[category]);
  const fileContents = await readFile(sourceFile, 'utf8');
  const lines = fileContents.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    fail(`${sourceFile}: file is empty.`);
  }

  validateHeader(lines[0], sourceFile);

  const rows: RawBalanceRow[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const columns = lines[index].split('\t').map((column) => column.trim());
    if (columns.length !== RAW_BALANCE_COLUMNS.length) {
      fail(`${sourceFile}:${index + 1} expected ${RAW_BALANCE_COLUMNS.length} columns, got ${columns.length}.`);
    }

    const row = normalizeRow(columns);
    validateRow(row, category, sourceFile, index + 1);
    rows.push(row);
  }

  return rows;
}

export function toBalanceChange(category: ChangeCategory, row: RawBalanceRow): BalanceChange {
  return {
    id: getStableId(category, row),
    category,
    targetName: row.targetName,
    canonicalName: row.canonicalName.trim() || row.targetName,
    previousNames: splitPipeList(row.previousNames),
    nation: row.nation,
    tier: row.tier,
    type: row.type,
    attribute: row.attribute,
    oldValue: row.oldValue,
    newValue: row.newValue,
    version: row.version,
    notes: row.notes,
    trend: row.trend,
    shipStatus: normalizeShipStatus(category, row.shipStatus),
    tags: normalizeTags(category, row),
    sourceSheet: row.sourceSheet,
  };
}

function applyDerivedShipTags(records: BalanceChange[]): BalanceChange[] {
  const testAliasSets = records
    .filter((record) => record.category === 'ship' && record.shipStatus === 'test')
    .map((record) => getAliasSet(record));

  return records.map((record) => {
    if (record.category !== 'ship') {
      return { ...record, shipStatus: 'unknown', tags: [] };
    }

    const tags = new Set<ChangeTag>(record.tags);
    if (record.previousNames.length > 0) {
      tags.add('name-change');
    }

    if (record.shipStatus === 'released') {
      const aliasSet = getAliasSet(record);
      const converted = testAliasSets.some((testAliases) => [...aliasSet].some((name) => testAliases.has(name)));
      if (converted) {
        tags.add('converted-from-test');
      }
    }

    return {
      ...record,
      tags: [...tags],
    };
  });
}

export async function loadBalanceChanges(): Promise<BalanceChange[]> {
  const duplicateSignatures = new Set<string>();
  const records: BalanceChange[] = [];

  for (const category of CATEGORY_ORDER) {
    const rows = await readCategoryRows(category);
    for (const row of rows) {
      const record = toBalanceChange(category, row);
      const signature = [
        record.category,
        record.targetName,
        record.canonicalName,
        record.previousNames.join('|'),
        record.nation,
        record.tier,
        record.type,
        record.attribute,
        record.oldValue,
        record.newValue,
        record.version,
        record.notes,
        record.trend,
        record.shipStatus,
        record.tags.join('|'),
        record.sourceSheet,
      ].join('|');

      if (duplicateSignatures.has(signature)) {
        fail(`Duplicate record detected for "${record.targetName}" (${record.category}, ${record.version}, ${record.attribute}).`);
      }

      duplicateSignatures.add(signature);
      records.push(record);
    }
  }

  return applyDerivedShipTags(records).sort((left, right) => {
    const categoryDelta = CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
    if (categoryDelta !== 0) {
      return categoryDelta;
    }

    const versionDelta = compareVersionDesc(left.version, right.version);
    if (versionDelta !== 0) {
      return versionDelta;
    }

    const canonicalDelta = left.canonicalName.localeCompare(right.canonicalName, 'zh-CN');
    if (canonicalDelta !== 0) {
      return canonicalDelta;
    }

    return left.attribute.localeCompare(right.attribute, 'zh-CN');
  });
}

export async function readSiteConfig(): Promise<SiteConfig> {
  const source = await readFile(SITE_CONFIG_PATH, 'utf8');
  const config = JSON.parse(source) as SiteConfig;
  validateSiteConfig(config);
  return config;
}

export function validateSiteConfig(config: SiteConfig): void {
  if (!config.currentVersion?.trim()) {
    fail('Site config must include a non-empty currentVersion.');
  }
}

export async function writeSiteConfig(config: SiteConfig): Promise<void> {
  validateSiteConfig(config);
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(SITE_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export async function writeCategoryRows(category: ChangeCategory, rows: RawBalanceRow[]): Promise<void> {
  await mkdir(RAW_DATA_DIR, { recursive: true });
  await writeFile(path.join(RAW_DATA_DIR, CATEGORY_FILES[category]), `${generateRawTSV(rows)}\n`, 'utf8');
}

export function buildGeneratedData(records: BalanceChange[], siteConfig: SiteConfig): GeneratedBalanceData {
  const categoryCounts: GeneratedBalanceData['meta']['categoryCounts'] = {
    ship: 0,
    mechanic: 0,
    misc: 0,
  };
  const shipStatusCounts: GeneratedBalanceData['meta']['shipStatusCounts'] = {
    test: 0,
    released: 0,
    unknown: 0,
  };
  const tagCounts: GeneratedBalanceData['meta']['tagCounts'] = {};

  records.forEach((record) => {
    categoryCounts[record.category] += 1;
    shipStatusCounts[record.shipStatus] += 1;
    record.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    });
  });

  return {
    records,
    meta: {
      generatedAt: new Date().toISOString(),
      currentVersion: siteConfig.currentVersion,
      lastUpdated: siteConfig.lastUpdated,
      recordCount: records.length,
      categoryCounts,
      shipStatusCounts,
      tagCounts,
    },
  };
}

export async function writeGeneratedData(data: GeneratedBalanceData): Promise<void> {
  await mkdir(path.dirname(GENERATED_DATA_PATH), { recursive: true });
  await writeFile(GENERATED_DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
