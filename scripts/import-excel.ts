import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TREND_VALUES } from '../src/data/schema.ts';
import { parseWorkbookBuffer } from '../src/utils/xlsx.ts';
import type { ChangeTrend, RawBalanceRow, SiteConfig } from '../src/types.ts';
import { readSiteConfig, writeCategoryRows, writeSiteConfig } from './data-lib.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const QUERY_SHEET_NAME = '查询';
const RELEASED_SHIP_SHEET_NAME = '非测试舰船';
const TEST_SHIP_SHEET_NAME = '测试舰船';
const EXPECTED_HEADERS = ['船名', '国籍', '等级', '舰种', '属性', '原始值', '改后数值', '改动版本', '备注', 'FLAG'];
const QUERY_DATA_START_COLUMN = 15;
const QUERY_DATA_END_COLUMN = 25;

function normalizeCell(value: string | undefined): string {
  return (value ?? '').trim();
}

function normalizeRows(rows: string[][]): string[][] {
  return rows
    .map((row) => {
      const compacted = row.map((cell) => normalizeCell(cell));
      while (compacted.length > 0 && !compacted[compacted.length - 1]) {
        compacted.pop();
      }
      return compacted;
    })
    .filter((row) => row.some(Boolean));
}

function findWorkbookPath(fileNames: string[]): string {
  const xlsxFiles = fileNames.filter((fileName) => fileName.toLowerCase().endsWith('.xlsx'));
  if (xlsxFiles.length === 0) {
    throw new Error('项目根目录下未找到任何 .xlsx 工作簿。');
  }

  const preferred = xlsxFiles.find((fileName) => /lesta/i.test(fileName)) ?? xlsxFiles[0];
  return path.join(repoRoot, preferred);
}

function findHeaderIndex(rows: string[][]): number {
  return rows.findIndex((row) => {
    const firstCell = normalizeCell(row[0]);
    if (firstCell !== EXPECTED_HEADERS[0]) {
      return false;
    }

    if (row.length === 1) {
      return true;
    }

    return EXPECTED_HEADERS.every((header, index) => !row[index] || normalizeCell(row[index]) === header);
  });
}

function findHeaderIndexInSlice(rows: string[][], start: number, end: number): number {
  return rows.findIndex((row) => {
    const columns = row.slice(start, end).map((cell) => normalizeCell(cell));
    return EXPECTED_HEADERS.every((header, index) => columns[index] === header);
  });
}

function splitAliases(targetName: string): { canonicalName: string; previousNames: string[] } {
  const names = targetName
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean);

  if (names.length === 0) {
    return { canonicalName: '', previousNames: [] };
  }

  return {
    canonicalName: names[0],
    previousNames: names.slice(1),
  };
}

function normalizeTrend(rawValue: string): ChangeTrend {
  const normalized = rawValue.trim().toLowerCase();

  if (normalized === '1') {
    return 'buff';
  }

  if (normalized === '0') {
    return 'nerf';
  }

  if (normalized === '2') {
    return 'neutral';
  }

  if (TREND_VALUES.includes(normalized as ChangeTrend)) {
    return normalized as ChangeTrend;
  }

  if (/(削弱|降低|nerf)/i.test(rawValue)) {
    return 'nerf';
  }

  if (/(加强|增强|提升|buff)/i.test(rawValue)) {
    return 'buff';
  }

  if (/(中性|neutral)/i.test(rawValue)) {
    return 'neutral';
  }

  return 'adjustment';
}

function isNumericLike(value: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(value.trim());
}

function mapExcelRecord(row: string[]): Pick<RawBalanceRow, 'attribute' | 'oldValue' | 'newValue' | 'version' | 'notes' | 'trend'> {
  const attribute = normalizeCell(row[4]);
  const oldValue = normalizeCell(row[5]);
  const newValue = normalizeCell(row[6]);
  const version = normalizeCell(row[7]);
  const notes = normalizeCell(row[8]);
  const trend = normalizeTrend(normalizeCell(row[9]));

  if (attribute || oldValue) {
    return {
      attribute,
      oldValue,
      newValue,
      version,
      notes,
      trend,
    };
  }

  const sparseValue = normalizeCell(row[6]);
  const sparseVersion = normalizeCell(row[7]);
  const sparseText = normalizeCell(row[8]);

  if (sparseValue || sparseVersion || sparseText) {
    if (isNumericLike(sparseValue) && sparseText) {
      return {
        attribute: sparseText,
        oldValue: sparseValue,
        newValue: '-',
        version: sparseVersion,
        notes: '来自稀疏 Excel 行，建议人工复核',
        trend,
      };
    }

    return {
      attribute: sparseValue,
      oldValue: '-',
      newValue: sparseText || '-',
      version: sparseVersion,
      notes: '来自稀疏 Excel 行，建议人工复核',
      trend,
    };
  }

  return {
    attribute: '',
    oldValue: '',
    newValue: '',
    version: '',
    notes: '',
    trend,
  };
}

function extractCurrentVersion(rows: string[][], fallback: SiteConfig): SiteConfig {
  const versionPattern = /^\d+(?:\.\d+)+$/;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < rows[rowIndex].length; columnIndex += 1) {
      const cell = normalizeCell(rows[rowIndex][columnIndex]);
      if (!cell.includes('当前版本')) {
        continue;
      }

      const candidates = [
        rows[rowIndex][columnIndex + 1],
        rows[rowIndex + 1]?.[columnIndex],
        rows[rowIndex + 1]?.[columnIndex + 1],
      ]
        .map((candidate) => normalizeCell(candidate))
        .filter(Boolean);

      const matched = candidates.find((candidate) => versionPattern.test(candidate));
      if (matched) {
        return {
          currentVersion: matched,
          lastUpdated: fallback.lastUpdated,
        };
      }
    }
  }

  return fallback;
}

async function main(): Promise<void> {
  const workbookPath = findWorkbookPath(await readdir(repoRoot));
  const buffer = await readFile(workbookPath);
  const workbook = await parseWorkbookBuffer(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );

  const querySheet = workbook.sheets.find((sheet) => sheet.name === QUERY_SHEET_NAME);
  const releasedSheet = workbook.sheets.find((sheet) => sheet.name === RELEASED_SHIP_SHEET_NAME);
  const testSheet = workbook.sheets.find((sheet) => sheet.name === TEST_SHIP_SHEET_NAME);

  if (!releasedSheet) {
    throw new Error(`Excel 工作簿缺少 "${RELEASED_SHIP_SHEET_NAME}" sheet。`);
  }

  if (testSheet && normalizeRows(testSheet.rows).length > 0) {
    console.log(`检测到 "${TEST_SHIP_SHEET_NAME}" sheet 有内容，本次仍只覆盖正式舰船真源。`);
  }

  const normalizedQueryRows = normalizeRows(querySheet?.rows ?? []);
  const queryHeaderIndex = findHeaderIndexInSlice(normalizedQueryRows, QUERY_DATA_START_COLUMN, QUERY_DATA_END_COLUMN);
  if (queryHeaderIndex < 0) {
    throw new Error(`在 "${QUERY_SHEET_NAME}" 中未找到平铺数据表头。`);
  }

  const flattenedRows = normalizedQueryRows
    .slice(queryHeaderIndex + 1)
    .map((row) => row.slice(QUERY_DATA_START_COLUMN, QUERY_DATA_END_COLUMN).map((cell) => normalizeCell(cell)));

  const shipRows: RawBalanceRow[] = flattenedRows
    .filter((row) => normalizeCell(row[0]).length > 0)
    .filter((row) => [row[4], row[5], row[6], row[7], row[8]].some((value) => normalizeCell(value).length > 0))
    .map((row) => {
      const targetName = normalizeCell(row[0]);
      const aliases = splitAliases(targetName);
      const mapped = mapExcelRecord(row);

      return {
        targetName,
        canonicalName: aliases.canonicalName || targetName,
        previousNames: aliases.previousNames.join('|'),
        nation: normalizeCell(row[1]),
        tier: normalizeCell(row[2]),
        type: normalizeCell(row[3]),
        attribute: mapped.attribute,
        oldValue: mapped.oldValue,
        newValue: mapped.newValue,
        version: mapped.version,
        notes: mapped.notes,
        trend: mapped.trend,
        shipStatus: 'released',
        tags: 'released-ship',
        sourceSheet: RELEASED_SHIP_SHEET_NAME,
      };
    });

  await writeCategoryRows('ship', shipRows);

  const existingConfig = await readSiteConfig();
  const nextConfig = extractCurrentVersion(normalizeRows(querySheet?.rows ?? []), existingConfig);
  await writeSiteConfig(nextConfig);

  console.log(`已从 ${path.basename(workbookPath)} 导入 ${shipRows.length} 条正式舰船记录。`);
  console.log(`当前版本号已设置为 ${nextConfig.currentVersion}。`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
