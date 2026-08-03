import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TREND_VALUES } from '../src/data/schema.ts';
import { parseWorkbookBuffer } from '../src/utils/xlsx.ts';
import type { ChangeTrend, RawBalanceRow } from '../src/types.ts';
import { writeCategoryRows } from './data-lib.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const PRIMARY_WORKBOOK_PATTERN = /1\.xlsx$/i;
const FALLBACK_WORKBOOK_PATTERN = /lesta/i;
const DEFAULT_SHEET_NAME = 'Sheet1';
const EXPECTED_HEADERS = [
  '船名',
  '国籍',
  '等级',
  '舰种',
  '属性',
  '原始值',
  '改后数值',
  '改动版本',
  '备注',
  'FLAG',
];

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

function normalizeHeader(value: string): string {
  return value.trim().replace(/[\s()/_-]+/g, '').toLowerCase();
}

function findWorkbookPath(fileNames: string[]): string {
  const xlsxFiles = fileNames.filter((fileName) => fileName.toLowerCase().endsWith('.xlsx'));
  if (xlsxFiles.length === 0) {
    throw new Error('项目根目录中没有找到可用的 .xlsx 数据源文件。');
  }

  const preferred = xlsxFiles.find((fileName) => PRIMARY_WORKBOOK_PATTERN.test(fileName))
    ?? xlsxFiles.find((fileName) => FALLBACK_WORKBOOK_PATTERN.test(fileName))
    ?? xlsxFiles[0];

  return path.join(repoRoot, preferred);
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
    return 'nerf';
  }

  if (normalized === '0') {
    return 'buff';
  }

  if (normalized === '2') {
    return 'neutral';
  }

  if (TREND_VALUES.includes(normalized as ChangeTrend)) {
    return normalized as ChangeTrend;
  }

  if (/(削弱|nerf)/i.test(rawValue)) {
    return 'nerf';
  }

  if (/(加强|buff)/i.test(rawValue)) {
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

  if (attribute || oldValue || newValue || version || notes) {
    return {
      attribute,
      oldValue: oldValue || '-',
      newValue: newValue || '-',
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
        notes: '原始 Excel 行存在稀疏列，已按兼容规则导入，建议人工复核。',
        trend,
      };
    }

    return {
      attribute: sparseValue || sparseText,
      oldValue: '-',
      newValue: sparseText || '-',
      version: sparseVersion,
      notes: '原始 Excel 行存在稀疏列，已按兼容规则导入，建议人工复核。',
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

function findHeaderIndex(rows: string[][]): number {
  const normalizedExpected = EXPECTED_HEADERS.map(normalizeHeader);
  return rows.findIndex((row) => {
    const normalizedRow = row.slice(0, EXPECTED_HEADERS.length).map(normalizeHeader);
    return normalizedExpected.every((header, index) => normalizedRow[index] === header);
  });
}

function mapSheetRowsToShipRows(rows: string[][], workbookName: string, sheetName: string): RawBalanceRow[] {
  const normalizedRows = normalizeRows(rows);
  const headerIndex = findHeaderIndex(normalizedRows);
  if (headerIndex < 0) {
    throw new Error(`文件 ${workbookName} 的 ${sheetName} 未找到可识别的表头。`);
  }

  return normalizedRows
    .slice(headerIndex + 1)
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
        sourceSheet: sheetName,
      };
    });
}

async function main(): Promise<void> {
  const workbookPath = findWorkbookPath(await readdir(repoRoot));
  const workbookName = path.basename(workbookPath);
  const buffer = await readFile(workbookPath);
  const workbook = await parseWorkbookBuffer(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );

  const targetSheet = workbook.sheets.find((sheet) => sheet.name === DEFAULT_SHEET_NAME) ?? workbook.sheets[0];
  if (!targetSheet) {
    throw new Error(`文件 ${workbookName} 中没有可用的工作表。`);
  }

  const shipRows = mapSheetRowsToShipRows(targetSheet.rows, workbookName, targetSheet.name);
  await writeCategoryRows('ship', shipRows);

  console.log(`已使用 ${workbookName} 的 ${targetSheet.name} 导入 ${shipRows.length} 条正式舰船记录。`);
  console.log('当前版本号继续使用 data/config/site.json，不再从该 Excel 自动提取。');
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
