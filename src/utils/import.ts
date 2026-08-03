import {
  CHANGE_TAG_VALUES,
  SHIP_STATUS_VALUES,
  TREND_VALUES,
} from '../data/schema.ts';
import type {
  BalanceChange,
  ChangeCategory,
  ChangeTag,
  ChangeTrend,
  ImportParseResult,
  ImportReviewRow,
  ImportWorkbookSheet,
  ShipStatus,
} from '../types.ts';
import { parseWorkbookBuffer } from './xlsx.ts';

type ReviewContextRow = BalanceChange | ImportReviewRow;
type ImportEditableField = Exclude<keyof ImportReviewRow, 'id' | 'issues'>;

const STRUCTURED_FIELDS: Array<ImportEditableField> = [
  'targetName',
  'nation',
  'tier',
  'type',
  'attribute',
  'oldValue',
  'newValue',
  'version',
  'notes',
];

const HEADER_ALIASES: Record<string, ImportEditableField | 'ignore'> = {
  targetname: 'targetName',
  目标名: 'targetName',
  船名: 'targetName',
  目标名称: 'targetName',
  canonicalname: 'canonicalName',
  规范名: 'canonicalName',
  归档名: 'canonicalName',
  previousnames: 'previousNames',
  previousname: 'previousNames',
  曾用名: 'previousNames',
  别名: 'previousNames',
  nation: 'nation',
  国籍: 'nation',
  tier: 'tier',
  等级: 'tier',
  type: 'type',
  舰种: 'type',
  分类: 'type',
  attribute: 'attribute',
  属性: 'attribute',
  oldvalue: 'oldValue',
  原始值: 'oldValue',
  旧值: 'oldValue',
  newvalue: 'newValue',
  改后数值: 'newValue',
  新值: 'newValue',
  version: 'version',
  版本: 'version',
  改动版本: 'version',
  notes: 'notes',
  备注: 'notes',
  说明: 'notes',
  trend: 'trend',
  趋势: 'trend',
  shipstatus: 'shipStatus',
  舰船状态: 'shipStatus',
  状态: 'shipStatus',
  tags: 'tags',
  标签: 'tags',
  sourcesheet: 'sourceSheet',
  来源: 'sourceSheet',
  sheet: 'sourceSheet',
  flag: 'trend',
};

function makeRowId(seed: string, index: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${seed}-${index}-${crypto.randomUUID()}`;
  }

  return `${seed}-${index}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .replace(/[\s()/_-]+/g, '')
    .toLowerCase();
}

function normalizeListText(value: string): string[] {
  return value
    .split(/[|,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

function inferShipStatus(rawValue: string, sourceSheet: string, category: ChangeCategory): ShipStatus {
  if (category !== 'ship') {
    return 'unknown';
  }

  const normalized = rawValue.trim().toLowerCase();
  if (SHIP_STATUS_VALUES.includes(normalized as ShipStatus)) {
    return normalized as ShipStatus;
  }

  if (/(测试船|测试舰船|test)/i.test(`${sourceSheet} ${rawValue}`)) {
    return 'test';
  }

  if (/(正式船|非测试舰船|released)/i.test(`${sourceSheet} ${rawValue}`)) {
    return 'released';
  }

  return 'released';
}

function inferCategory(sourceSheet: string, fallback: ChangeCategory): ChangeCategory {
  if (/(机制|mechanic)/i.test(sourceSheet)) {
    return 'mechanic';
  }

  if (/(其他|杂项|misc)/i.test(sourceSheet)) {
    return 'misc';
  }

  if (/(舰船|ship|测试舰船|非测试舰船)/i.test(sourceSheet)) {
    return 'ship';
  }

  return fallback;
}

function normalizeTags(tags: string[], shipStatus: ShipStatus, previousNames: string[]): ChangeTag[] {
  const result = new Set<ChangeTag>();
  tags.forEach((tag) => {
    if (CHANGE_TAG_VALUES.includes(tag as ChangeTag)) {
      result.add(tag as ChangeTag);
    }
  });

  if (shipStatus === 'test') {
    result.add('test-ship');
    result.delete('released-ship');
  }

  if (shipStatus === 'released') {
    result.add('released-ship');
    result.delete('test-ship');
  }

  if (previousNames.length > 0) {
    result.add('name-change');
  }

  return [...result];
}

function getAliasSet(row: Pick<ReviewContextRow, 'targetName' | 'canonicalName' | 'previousNames'>): Set<string> {
  return new Set([
    row.targetName.trim(),
    row.canonicalName.trim(),
    ...row.previousNames.map((name) => name.trim()),
  ].filter(Boolean));
}

function deriveIssues(row: ImportReviewRow): string[] {
  const issues: string[] = [];

  if (!row.targetName.trim()) issues.push('缺少船名/目标名');
  if (!row.attribute.trim()) issues.push('缺少属性');
  if (!row.oldValue.trim()) issues.push('缺少原始值');
  if (!row.newValue.trim()) issues.push('缺少改后数值');
  if (!row.version.trim()) issues.push('缺少版本号');

  if (row.category === 'ship') {
    if (!row.canonicalName.trim()) issues.push('缺少规范名');
    if (row.shipStatus === 'unknown') issues.push('舰船状态未确认');
  }

  return issues;
}

function applyLifecycleInference(row: ImportReviewRow, contextRows: ReviewContextRow[]): ImportReviewRow {
  const previousNames = row.previousNames.map((name) => name.trim()).filter(Boolean);
  const shipStatus = row.category === 'ship' ? row.shipStatus : 'unknown';
  const tags = new Set<ChangeTag>(normalizeTags(row.tags, shipStatus, previousNames));

  if (row.category === 'ship' && shipStatus === 'released') {
    const aliasSet = getAliasSet({ ...row, previousNames });
    const matchedTestRecord = contextRows.some((candidate) => {
      const candidateShipStatus = candidate.category === 'ship' ? candidate.shipStatus : 'unknown';
      if (candidateShipStatus !== 'test') {
        return false;
      }

      const candidateAliases = getAliasSet(candidate);
      return [...aliasSet].some((alias) => candidateAliases.has(alias));
    });

    if (matchedTestRecord) {
      tags.add('converted-from-test');
    }
  }

  const nextRow: ImportReviewRow = {
    ...row,
    canonicalName: row.canonicalName.trim() || row.targetName.trim(),
    previousNames,
    shipStatus,
    tags: [...tags],
    issues: [],
  };

  nextRow.issues = deriveIssues(nextRow);
  return nextRow;
}

export function reconcileImportRows(rows: ImportReviewRow[], existingData: ReviewContextRow[]): ImportReviewRow[] {
  const seedContext = [...existingData, ...rows];
  return rows.map((row) => applyLifecycleInference(row, seedContext));
}

function inferHeaderMap(rows: string[][]): { headerRowIndex: number; map: Map<number, ImportEditableField | 'ignore'> } | null {
  let bestScore = 0;
  let bestIndex = -1;
  let bestMap = new Map<number, ImportEditableField | 'ignore'>();

  rows.slice(0, 12).forEach((row, rowIndex) => {
    const map = new Map<number, ImportEditableField | 'ignore'>();
    let score = 0;

    row.forEach((cell, index) => {
      const mapped = HEADER_ALIASES[normalizeHeader(cell)];
      if (mapped) {
        map.set(index, mapped);
        if (mapped !== 'ignore') {
          score += 1;
        }
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestIndex = rowIndex;
      bestMap = map;
    }
  });

  if (bestScore < 4) {
    return null;
  }

  return {
    headerRowIndex: bestIndex,
    map: bestMap,
  };
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes(',')) return ',';
  if (firstLine.includes(';')) return ';';
  return '\t';
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  if (delimiter !== ',') {
    return line.split(delimiter).map((cell) => cell.trim());
  }

  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function compactRows(rows: string[][]): string[][] {
  return rows
    .map((row) => {
      const compacted = [...row];
      while (compacted.length > 0 && !(compacted[compacted.length - 1] ?? '').trim()) {
        compacted.pop();
      }
      return compacted;
    })
    .filter((row) => row.some((cell) => cell.trim().length > 0));
}

function buildRowFromValues(
  values: string[],
  options: {
    category: ChangeCategory;
    sourceSheet: string;
    idSeed: string;
    index: number;
    headerMap?: Map<number, ImportEditableField | 'ignore'>;
  },
): ImportReviewRow {
  const mapped: Partial<Record<ImportEditableField, string | string[]>> = {};
  const {
    category,
    sourceSheet,
    idSeed,
    index,
    headerMap,
  } = options;

  if (headerMap) {
    headerMap.forEach((field, fieldIndex) => {
      if (field === 'ignore') {
        return;
      }

      const value = values[fieldIndex] ?? '';
      if (field === 'previousNames' || field === 'tags') {
        mapped[field] = normalizeListText(value);
        return;
      }
      mapped[field] = value;
    });
  } else {
    STRUCTURED_FIELDS.forEach((field, fieldIndex) => {
      mapped[field] = values[fieldIndex] ?? '';
    });
  }

  const targetName = String(mapped.targetName ?? '').trim();
  const inferredCategory = inferCategory(sourceSheet, category);
  const previousNames = Array.isArray(mapped.previousNames)
    ? mapped.previousNames
    : normalizeListText(String(mapped.previousNames ?? ''));
  const tagsInput = Array.isArray(mapped.tags)
    ? mapped.tags
    : normalizeListText(String(mapped.tags ?? ''));
  const shipStatus = inferShipStatus(String(mapped.shipStatus ?? ''), sourceSheet, inferredCategory);

  return {
    id: makeRowId(idSeed, index),
    category: inferredCategory,
    targetName,
    canonicalName: String(mapped.canonicalName ?? targetName).trim() || targetName,
    previousNames,
    nation: String(mapped.nation ?? '').trim(),
    tier: String(mapped.tier ?? '').trim(),
    type: String(mapped.type ?? '').trim(),
    attribute: String(mapped.attribute ?? '').trim(),
    oldValue: String(mapped.oldValue ?? '').trim(),
    newValue: String(mapped.newValue ?? '').trim(),
    version: String(mapped.version ?? '').trim(),
    notes: String(mapped.notes ?? '').trim(),
    trend: normalizeTrend(String(mapped.trend ?? '')),
    shipStatus,
    tags: normalizeTags(tagsInput, shipStatus, previousNames),
    sourceSheet,
    issues: [],
  };
}

function parseRowsToReviewRows(rows: string[][], category: ChangeCategory, sourceSheet: string, idSeed: string): ImportReviewRow[] {
  const compactedRows = compactRows(rows);
  if (compactedRows.length === 0) {
    return [];
  }

  const headerInfo = inferHeaderMap(compactedRows);
  const dataRows = headerInfo ? compactedRows.slice(headerInfo.headerRowIndex + 1) : compactedRows;

  return dataRows
    .map((values, index) => buildRowFromValues(values, {
      category,
      sourceSheet,
      idSeed,
      index,
      headerMap: headerInfo?.map,
    }))
    .filter((row) => row.targetName || row.attribute || row.oldValue || row.newValue);
}

function appendNote(notes: string, line: string): string {
  if (!line.trim()) {
    return notes.trim();
  }

  if (!notes.trim()) {
    return line.trim();
  }

  return `${notes.trim()} ${line.trim()}`;
}

function normalizeLine(rawLine: string): string {
  return rawLine.replace(/^[\s>*•\-·●○]+/, '').trim();
}

function isPotentialTitleLine(line: string): boolean {
  if (!line || line.length > 60) {
    return false;
  }

  if (/^(冷却时间|作用时间|主炮|副炮|对海|对空|转舵|航速|射程|隐蔽)/.test(line)) {
    return false;
  }

  return !/(从.+到|减少到|增加到|调整了|提高到|提升到|由.+改为|改为|变为|替换|移除|增加|减少)/.test(line);
}

function isContinuationNoteLine(line: string): boolean {
  return /(其他类型|相应调整|同样调整|此外|另外|同时|并且|仍将)/.test(line);
}

function parseConsumableContext(line: string): string | null {
  const quoted = line.match(/调整了[“"'']?(.+?)[”"'']?消耗品的参数/);
  if (quoted) {
    return quoted[1].trim();
  }

  const generic = line.match(/调整了(.+?)的参数/);
  if (generic) {
    return generic[1].trim();
  }

  return null;
}

function withAttributePrefix(attribute: string, attributePrefix: string): string {
  if (!attributePrefix) {
    return attribute.trim();
  }

  if (attribute.startsWith(attributePrefix)) {
    return attribute.trim();
  }

  return `${attributePrefix}-${attribute.trim()}`;
}

function inferTrendFromSentence(attribute: string, sentence: string): ChangeTrend {
  if (/(提升|提高|增强|改善|标准)/.test(sentence)) {
    return 'buff';
  }

  if (/(削弱|降低)/.test(sentence)) {
    return 'nerf';
  }

  if (/(减少到|缩短到)/.test(sentence)) {
    if (/(装填|冷却|隐蔽|被侦测|散布|转舵|点火时间|恢复时间)/.test(attribute)) {
      return 'buff';
    }
    return 'nerf';
  }

  if (/(增加到|延长到)/.test(sentence)) {
    if (/(装填|冷却|隐蔽|被侦测|散布|转舵)/.test(attribute)) {
      return 'nerf';
    }
    return 'buff';
  }

  return 'adjustment';
}

function parseAnnouncementSentence(
  line: string,
  attributePrefix: string,
): { attribute: string; oldValue: string; newValue: string; trend: ChangeTrend; notes?: string } | null {
  const fromToMatch = line.match(
    /^(?<attribute>.+?)从\s*(?<old>.+?)\s*(?<verb>减少到|降低到|缩短到|增加到|提高到|提升到|延长到|改为|变为|调整到|调整为)\s*(?<new>.+)$/,
  );

  if (fromToMatch?.groups) {
    const attribute = withAttributePrefix(fromToMatch.groups.attribute.trim(), attributePrefix);
    return {
      attribute,
      oldValue: fromToMatch.groups.old.trim(),
      newValue: fromToMatch.groups.new.trim(),
      trend: inferTrendFromSentence(attribute, line),
    };
  }

  const targetOnlyMatch = line.match(
    /^(?<attribute>.+?)\s*(?<verb>提升到|提高到|调整到|改为|变为|替换为)\s*(?<new>.+)$/,
  );
  if (targetOnlyMatch?.groups) {
    const attribute = withAttributePrefix(targetOnlyMatch.groups.attribute.trim(), attributePrefix);
    return {
      attribute,
      oldValue: '-',
      newValue: targetOnlyMatch.groups.new.trim(),
      trend: inferTrendFromSentence(attribute, line),
    };
  }

  const genericVerbMatch = line.match(/^(增加|移除|替换).+$/);
  if (genericVerbMatch) {
    return {
      attribute: withAttributePrefix(line, attributePrefix),
      oldValue: '-',
      newValue: '-',
      trend: 'adjustment',
      notes: '需要手动补充数值与版本号',
    };
  }

  return null;
}

function parseAnnouncementBlock(input: string, fallbackCategory: ChangeCategory, sourceSheet: string): ImportParseResult {
  const lines = input.split(/\r?\n/).map(normalizeLine);
  const rows: ImportReviewRow[] = [];
  let currentTargetName = '';
  let currentCanonicalName = '';
  let currentAttributePrefix = '';
  let lastRowIndex = -1;

  lines.forEach((line, index) => {
    if (!line) {
      currentAttributePrefix = '';
      return;
    }

    if (isPotentialTitleLine(line)) {
      currentTargetName = line;
      currentCanonicalName = line;
      currentAttributePrefix = '';
      lastRowIndex = -1;
      return;
    }

    if (!currentTargetName) {
      return;
    }

    const context = parseConsumableContext(line);
    if (context) {
      currentAttributePrefix = context;
      return;
    }

    const parsed = parseAnnouncementSentence(line, currentAttributePrefix);
    if (parsed) {
      rows.push({
        id: makeRowId('announcement', rows.length),
        category: fallbackCategory,
        targetName: currentTargetName,
        canonicalName: currentCanonicalName,
        previousNames: [],
        nation: '',
        tier: '',
        type: '',
        attribute: parsed.attribute,
        oldValue: parsed.oldValue,
        newValue: parsed.newValue,
        version: '',
        notes: parsed.notes ?? '',
        trend: parsed.trend,
        shipStatus: fallbackCategory === 'ship' ? 'released' : 'unknown',
        tags: fallbackCategory === 'ship' ? ['released-ship'] : [],
        sourceSheet,
        issues: [],
      });
      lastRowIndex = rows.length - 1;
      return;
    }

    if (isContinuationNoteLine(line) && lastRowIndex >= 0) {
      rows[lastRowIndex] = {
        ...rows[lastRowIndex],
        notes: appendNote(rows[lastRowIndex].notes, line),
      };
      return;
    }

    rows.push({
      id: makeRowId('announcement-fallback', index),
      category: fallbackCategory,
      targetName: currentTargetName,
      canonicalName: currentCanonicalName,
      previousNames: [],
      nation: '',
      tier: '',
      type: '',
      attribute: withAttributePrefix(line, currentAttributePrefix),
      oldValue: '',
      newValue: '',
      version: '',
      notes: '未能自动拆分该描述，请手动补充字段',
      trend: 'adjustment',
      shipStatus: fallbackCategory === 'ship' ? 'released' : 'unknown',
      tags: fallbackCategory === 'ship' ? ['released-ship'] : [],
      sourceSheet,
      issues: [],
    });
    lastRowIndex = rows.length - 1;
  });

  return {
    mode: 'announcement-block',
    rows,
    sheetSummaries: rows.length > 0 ? [{ name: sourceSheet, rowCount: rows.length }] : [],
    ignoredSheets: [],
  };
}

function looksLikeAnnouncementBlock(input: string): boolean {
  const lines = input.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  if (lines.length < 3) {
    return false;
  }

  const hasTableDelimiter = lines.some((line) => /[\t,;]/.test(line));
  if (hasTableDelimiter) {
    return false;
  }

  const titleCount = lines.filter(isPotentialTitleLine).length;
  const changeCount = lines.filter((line) =>
    /(从.+到|减少到|增加到|调整了|提高到|提升到|由.+改为|改为|变为|替换|移除)/.test(line),
  ).length;

  return titleCount >= 1 && changeCount >= 2;
}

function createSheetSummary(name: string, rows: ImportReviewRow[]): ImportWorkbookSheet {
  return {
    name,
    rowCount: rows.length,
  };
}

export async function parseWorkbookFile(file: File, fallbackCategory: ChangeCategory): Promise<ImportParseResult> {
  const workbook = await parseWorkbookBuffer(await file.arrayBuffer());
  const rows: ImportReviewRow[] = [];
  const sheetSummaries: ImportWorkbookSheet[] = [];
  const ignoredSheets: string[] = [];

  workbook.sheets.forEach((sheet) => {
    if (sheet.name.includes('查询')) {
      ignoredSheets.push(sheet.name);
      return;
    }

    const parsedRows = parseRowsToReviewRows(sheet.rows, fallbackCategory, sheet.name, file.name);
    if (parsedRows.length === 0) {
      ignoredSheets.push(sheet.name);
      return;
    }

    sheetSummaries.push(createSheetSummary(sheet.name, parsedRows));
    rows.push(...parsedRows);
  });

  return {
    mode: 'structured-table',
    rows,
    sheetSummaries,
    ignoredSheets,
  };
}

export function parsePastedText(input: string, fallbackCategory: ChangeCategory, sourceSheet = 'Pasted Data'): ImportParseResult {
  if (looksLikeAnnouncementBlock(input)) {
    return parseAnnouncementBlock(input, fallbackCategory, sourceSheet);
  }

  const delimiter = detectDelimiter(input);
  const rows = input
    .split(/\r?\n/)
    .map((line) => splitDelimitedLine(line, delimiter))
    .filter((line) => line.some((cell) => cell.trim().length > 0));
  const parsedRows = parseRowsToReviewRows(rows, fallbackCategory, sourceSheet, 'paste');

  return {
    mode: 'structured-table',
    rows: parsedRows,
    sheetSummaries: parsedRows.length > 0 ? [createSheetSummary(sourceSheet, parsedRows)] : [],
    ignoredSheets: [],
  };
}

export function updateImportRow(
  rows: ImportReviewRow[],
  id: string,
  field: ImportEditableField,
  value: string | string[],
  existingData: ReviewContextRow[],
): ImportReviewRow[] {
  const nextRows = rows.map((row) => {
    if (row.id !== id) {
      return row;
    }

    if (field === 'previousNames') {
      return { ...row, previousNames: Array.isArray(value) ? value : normalizeListText(value) };
    }

    if (field === 'tags') {
      const nextTags = Array.isArray(value) ? value : normalizeListText(value);
      return { ...row, tags: nextTags.filter((tag): tag is ChangeTag => CHANGE_TAG_VALUES.includes(tag as ChangeTag)) };
    }

    return { ...row, [field]: value } as ImportReviewRow;
  });

  return reconcileImportRows(nextRows, existingData);
}
