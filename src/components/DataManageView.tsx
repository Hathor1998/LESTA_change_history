import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  CHANGE_TAG_LABELS,
  SHIP_STATUS_LABELS,
} from '../data/schema.ts';
import type {
  BalanceChange,
  BuildMeta,
  ChangeCategory,
  ImportParseMode,
  ImportParseResult,
  ImportReviewRow,
  LocalToolDraft,
  ShipStatus,
  SiteConfig,
} from '../types.ts';
import { parsePastedText, parseWorkbookFile, reconcileImportRows, updateImportRow } from '../utils/import.ts';
import { generateTSV } from '../utils/tsv.ts';

interface DataManageViewProps {
  data: BalanceChange[];
  meta: BuildMeta;
}

type LocalToolTab = 'import' | 'source';
type StatusState = { type: 'idle' | 'success' | 'error'; message: string };
type DraftSource = 'generated' | 'draft';

const CATEGORY_OPTIONS: ChangeCategory[] = ['ship', 'mechanic', 'misc'];
const SHIP_STATUS_OPTIONS: ShipStatus[] = ['released', 'test', 'unknown'];
const DRAFT_STORAGE_KEY = 'wows-local-tools-draft';
const DRAFT_VERSION = 1;

function downloadTextFile(fileName: string, text: string, mimeType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toReviewRow(record: BalanceChange): ImportReviewRow {
  return {
    id: record.id,
    category: record.category,
    targetName: record.targetName,
    canonicalName: record.canonicalName,
    previousNames: [...record.previousNames],
    nation: record.nation,
    tier: record.tier,
    type: record.type,
    attribute: record.attribute,
    oldValue: record.oldValue,
    newValue: record.newValue,
    version: record.version,
    notes: record.notes,
    trend: record.trend,
    shipStatus: record.shipStatus,
    tags: [...record.tags],
    sourceSheet: record.sourceSheet,
    issues: [],
  };
}

function reviewRowToBalanceChange(row: ImportReviewRow): BalanceChange {
  return {
    id: row.id,
    category: row.category,
    targetName: row.targetName.trim(),
    canonicalName: row.canonicalName.trim() || row.targetName.trim(),
    previousNames: row.previousNames.map((name) => name.trim()).filter(Boolean),
    nation: row.nation.trim(),
    tier: row.tier.trim(),
    type: row.type.trim(),
    attribute: row.attribute.trim(),
    oldValue: row.oldValue.trim(),
    newValue: row.newValue.trim(),
    version: row.version.trim(),
    notes: row.notes.trim(),
    trend: row.trend,
    shipStatus: row.category === 'ship' ? row.shipStatus : 'unknown',
    tags: row.tags,
    sourceSheet: row.sourceSheet.trim(),
  };
}

function cloneReviewRows(rows: ImportReviewRow[]): ImportReviewRow[] {
  return rows.map((row, index) => ({
    ...row,
    id: `${row.category}-local-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
  }));
}

function createEmptySourceRow(category: ChangeCategory): ImportReviewRow {
  return {
    id: `${category}-empty-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category,
    targetName: '',
    canonicalName: '',
    previousNames: [],
    nation: '',
    tier: '',
    type: '',
    attribute: '',
    oldValue: '',
    newValue: '',
    version: '',
    notes: '',
    trend: 'adjustment',
    shipStatus: category === 'ship' ? 'released' : 'unknown',
    tags: category === 'ship' ? ['released-ship'] : [],
    sourceSheet: 'Local Manager',
    issues: [],
  };
}

function statusTone(type: StatusState['type']): string {
  if (type === 'success') return 'text-emerald-600';
  if (type === 'error') return 'text-red-600';
  return 'text-slate-500';
}

function parseModeLabel(mode: ImportParseMode): string {
  return mode === 'announcement-block' ? '公告正文模式' : '结构化表格模式';
}

function readStoredDraft(): LocalToolDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const draft = JSON.parse(raw) as Partial<LocalToolDraft>;
    if (
      draft.version !== DRAFT_VERSION ||
      !Array.isArray(draft.managedRows) ||
      typeof draft.savedAt !== 'string' ||
      !draft.siteConfig ||
      typeof draft.siteConfig.currentVersion !== 'string'
    ) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }

    return {
      version: DRAFT_VERSION,
      savedAt: draft.savedAt,
      managedRows: draft.managedRows as ImportReviewRow[],
      siteConfig: {
        currentVersion: draft.siteConfig.currentVersion,
        lastUpdated: draft.siteConfig.lastUpdated ?? '',
      },
    };
  } catch {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    return null;
  }
}

interface EditableRowsTableProps {
  rows: ImportReviewRow[];
  onFieldChange: (rowId: string, field: keyof Omit<ImportReviewRow, 'id' | 'issues'>, value: string) => void;
  onPreviousNamesChange: (rowId: string, value: string) => void;
  onRemoveRow: (rowId: string) => void;
}

function EditableRowsTable({ rows, onFieldChange, onPreviousNamesChange, onRemoveRow }: EditableRowsTableProps) {
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl">
      <table className="min-w-[1700px] w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-3 text-left">来源 / 问题</th>
            <th className="px-3 py-3 text-left">分类</th>
            <th className="px-3 py-3 text-left">状态</th>
            <th className="px-3 py-3 text-left">标签</th>
            <th className="px-3 py-3 text-left">船名 / 目标名</th>
            <th className="px-3 py-3 text-left">规范名</th>
            <th className="px-3 py-3 text-left">曾用名</th>
            <th className="px-3 py-3 text-left">国籍</th>
            <th className="px-3 py-3 text-left">等级</th>
            <th className="px-3 py-3 text-left">舰种</th>
            <th className="px-3 py-3 text-left">属性</th>
            <th className="px-3 py-3 text-left">原始值</th>
            <th className="px-3 py-3 text-left">改后数值</th>
            <th className="px-3 py-3 text-left">版本</th>
            <th className="px-3 py-3 text-left">趋势</th>
            <th className="px-3 py-3 text-left">备注</th>
            <th className="px-3 py-3 text-left">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={17} className="px-4 py-10 text-center text-slate-500">
                当前没有可显示的记录。
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 align-top">
              <td className="px-3 py-3">
                <div className="space-y-2">
                  <div className="font-medium text-slate-700">{row.sourceSheet || 'Local Manager'}</div>
                  {row.issues.length > 0 ? (
                    <div className="space-y-1">
                      {row.issues.map((issue) => (
                        <div key={issue} className="text-xs text-red-600">{issue}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-600">校验通过</div>
                  )}
                </div>
              </td>
              <td className="px-3 py-3">
                <select
                  value={row.category}
                  onChange={(event) => onFieldChange(row.id, 'category', event.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1 bg-white"
                >
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-3">
                <select
                  value={row.shipStatus}
                  onChange={(event) => onFieldChange(row.id, 'shipStatus', event.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1 bg-white"
                  disabled={row.category !== 'ship'}
                >
                  {SHIP_STATUS_OPTIONS.map((shipStatus) => (
                    <option key={shipStatus} value={shipStatus}>{SHIP_STATUS_LABELS[shipStatus]}</option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-1 max-w-56">
                  {row.tags.length === 0 && <span className="text-xs text-slate-400">无标签</span>}
                  {row.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">
                      {CHANGE_TAG_LABELS[tag]}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-3">
                <input value={row.targetName} onChange={(event) => onFieldChange(row.id, 'targetName', event.target.value)} className="w-40 border border-slate-300 rounded-md px-2 py-1" />
              </td>
              <td className="px-3 py-3">
                <input value={row.canonicalName} onChange={(event) => onFieldChange(row.id, 'canonicalName', event.target.value)} className="w-40 border border-slate-300 rounded-md px-2 py-1" />
              </td>
              <td className="px-3 py-3">
                <input value={row.previousNames.join(' | ')} onChange={(event) => onPreviousNamesChange(row.id, event.target.value)} className="w-48 border border-slate-300 rounded-md px-2 py-1" placeholder="多个别名用 | 分隔" />
              </td>
              <td className="px-3 py-3">
                <input value={row.nation} onChange={(event) => onFieldChange(row.id, 'nation', event.target.value)} className="w-28 border border-slate-300 rounded-md px-2 py-1" />
              </td>
              <td className="px-3 py-3">
                <input value={row.tier} onChange={(event) => onFieldChange(row.id, 'tier', event.target.value)} className="w-20 border border-slate-300 rounded-md px-2 py-1" />
              </td>
              <td className="px-3 py-3">
                <input value={row.type} onChange={(event) => onFieldChange(row.id, 'type', event.target.value)} className="w-32 border border-slate-300 rounded-md px-2 py-1" />
              </td>
              <td className="px-3 py-3">
                <input value={row.attribute} onChange={(event) => onFieldChange(row.id, 'attribute', event.target.value)} className="w-48 border border-slate-300 rounded-md px-2 py-1" />
              </td>
              <td className="px-3 py-3">
                <input value={row.oldValue} onChange={(event) => onFieldChange(row.id, 'oldValue', event.target.value)} className="w-28 border border-slate-300 rounded-md px-2 py-1" />
              </td>
              <td className="px-3 py-3">
                <input value={row.newValue} onChange={(event) => onFieldChange(row.id, 'newValue', event.target.value)} className="w-28 border border-slate-300 rounded-md px-2 py-1" />
              </td>
              <td className="px-3 py-3">
                <input value={row.version} onChange={(event) => onFieldChange(row.id, 'version', event.target.value)} className="w-24 border border-slate-300 rounded-md px-2 py-1" />
              </td>
              <td className="px-3 py-3">
                <select value={row.trend} onChange={(event) => onFieldChange(row.id, 'trend', event.target.value)} className="border border-slate-300 rounded-md px-2 py-1 bg-white">
                  <option value="buff">buff</option>
                  <option value="nerf">nerf</option>
                  <option value="adjustment">adjustment</option>
                  <option value="neutral">neutral</option>
                </select>
              </td>
              <td className="px-3 py-3">
                <input value={row.notes} onChange={(event) => onFieldChange(row.id, 'notes', event.target.value)} className="w-48 border border-slate-300 rounded-md px-2 py-1" />
              </td>
              <td className="px-3 py-3">
                <button onClick={() => onRemoveRow(row.id)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DataManageView({ data, meta }: DataManageViewProps) {
  const baseManagedRows = useMemo(() => reconcileImportRows(data.map(toReviewRow), data), [data]);
  const baseSiteConfig = useMemo(() => ({
    currentVersion: meta.currentVersion,
    lastUpdated: meta.lastUpdated ?? '',
  }), [meta.currentVersion, meta.lastUpdated]);
  const initialDraftRef = useRef<LocalToolDraft | null>(readStoredDraft());

  const [toolTab, setToolTab] = useState<LocalToolTab>('import');
  const [inputMode, setInputMode] = useState<'paste' | 'file'>('paste');
  const [fallbackCategory, setFallbackCategory] = useState<ChangeCategory>('ship');
  const [pasteInput, setPasteInput] = useState('');
  const [importResult, setImportResult] = useState<ImportParseResult | null>(null);
  const [importedRows, setImportedRows] = useState<ImportReviewRow[]>([]);
  const [reviewSearch, setReviewSearch] = useState('');
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [managedRows, setManagedRows] = useState<ImportReviewRow[]>(
    initialDraftRef.current ? reconcileImportRows(initialDraftRef.current.managedRows, initialDraftRef.current.managedRows) : baseManagedRows,
  );
  const [managedCategory, setManagedCategory] = useState<ChangeCategory>('ship');
  const [managedSearch, setManagedSearch] = useState('');
  const [managedIssuesOnly, setManagedIssuesOnly] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(
    initialDraftRef.current ? initialDraftRef.current.siteConfig : baseSiteConfig,
  );
  const [draftSource, setDraftSource] = useState<DraftSource>(initialDraftRef.current ? 'draft' : 'generated');
  const [draftSavedAt, setDraftSavedAt] = useState<string>(initialDraftRef.current?.savedAt ?? '');
  const [status, setStatus] = useState<StatusState>({
    type: 'idle',
    message: initialDraftRef.current ? '已恢复上次保存的本地草稿。' : '',
  });
  const [hasUnsavedDraftChanges, setHasUnsavedDraftChanges] = useState(false);

  useEffect(() => {
    if (!initialDraftRef.current) {
      setManagedRows(baseManagedRows);
      setSiteConfig(baseSiteConfig);
      setDraftSource('generated');
      setDraftSavedAt('');
    }
  }, [baseManagedRows, baseSiteConfig]);

  const validImportedRows = useMemo(() => importedRows.filter((row) => row.issues.length === 0), [importedRows]);

  const importSummary = useMemo(() => {
    const shipRows = importedRows.filter((row) => row.category === 'ship');
    return {
      total: importedRows.length,
      invalid: importedRows.filter((row) => row.issues.length > 0).length,
      testShips: shipRows.filter((row) => row.shipStatus === 'test').length,
      releasedShips: shipRows.filter((row) => row.shipStatus === 'released').length,
      converted: shipRows.filter((row) => row.tags.includes('converted-from-test')).length,
    };
  }, [importedRows]);

  const importedCountsByCategory = useMemo(() => {
    return CATEGORY_OPTIONS.reduce<Record<ChangeCategory, number>>((accumulator, category) => {
      accumulator[category] = validImportedRows.filter((row) => row.category === category).length;
      return accumulator;
    }, { ship: 0, mechanic: 0, misc: 0 });
  }, [validImportedRows]);

  const reviewRows = useMemo(() => {
    const keyword = reviewSearch.trim().toLowerCase();
    return importedRows.filter((row) => {
      if (issuesOnly && row.issues.length === 0) return false;
      if (!keyword) return true;

      return [
        row.targetName,
        row.canonicalName,
        row.previousNames.join(' '),
        row.attribute,
        row.version,
        row.sourceSheet,
      ].join(' ').toLowerCase().includes(keyword);
    });
  }, [importedRows, issuesOnly, reviewSearch]);

  const managedSummary = useMemo(() => {
    const filtered = managedRows.filter((row) => row.category === managedCategory);
    return {
      total: filtered.length,
      invalid: filtered.filter((row) => row.issues.length > 0).length,
      testShips: filtered.filter((row) => row.shipStatus === 'test').length,
      releasedShips: filtered.filter((row) => row.shipStatus === 'released').length,
    };
  }, [managedCategory, managedRows]);

  const managedViewRows = useMemo(() => {
    const keyword = managedSearch.trim().toLowerCase();
    return managedRows.filter((row) => {
      if (row.category !== managedCategory) return false;
      if (managedIssuesOnly && row.issues.length === 0) return false;
      if (!keyword) return true;

      return [
        row.targetName,
        row.canonicalName,
        row.previousNames.join(' '),
        row.attribute,
        row.version,
        row.sourceSheet,
      ].join(' ').toLowerCase().includes(keyword);
    });
  }, [managedCategory, managedIssuesOnly, managedRows, managedSearch]);

  const markManagedDirty = () => {
    setHasUnsavedDraftChanges(true);
  };

  const applyImportResult = (result: ImportParseResult, successMessage: string) => {
    const reconciledRows = reconcileImportRows(result.rows, data);
    setImportResult(result);
    setImportedRows(reconciledRows);
    setStatus({
      type: 'success',
      message: `${successMessage} 已识别 ${reconciledRows.length} 条记录，当前解析模式为${parseModeLabel(result.mode)}。`,
    });
  };

  const handlePasteImport = () => {
    if (!pasteInput.trim()) {
      setStatus({ type: 'error', message: '请先粘贴官网公告、Excel 表格内容或 TSV / CSV 文本。' });
      return;
    }

    const result = parsePastedText(pasteInput, fallbackCategory, 'Pasted Data');
    applyImportResult(result, '粘贴内容解析完成。');
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        const result = await parseWorkbookFile(file, fallbackCategory);
        applyImportResult(result, `文件 ${file.name} 解析完成。`);
      } else if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.tsv')) {
        const text = await file.text();
        const result = parsePastedText(text, fallbackCategory, file.name);
        applyImportResult(result, `文件 ${file.name} 解析完成。`);
      } else {
        setStatus({ type: 'error', message: '仅支持 .xlsx、.csv 和 .tsv 文件。' });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : '文件解析失败，请检查文件格式后重试。',
      });
    } finally {
      event.target.value = '';
    }
  };

  const handleImportFieldChange = (rowId: string, field: keyof Omit<ImportReviewRow, 'id' | 'issues'>, value: string) => {
    setImportedRows((currentRows) => updateImportRow(currentRows, rowId, field, value, data));
  };

  const handleImportPreviousNamesChange = (rowId: string, value: string) => {
    setImportedRows((currentRows) => updateImportRow(currentRows, rowId, 'previousNames', value, data));
  };

  const handleImportRemoveRow = (rowId: string) => {
    setImportedRows((currentRows) => reconcileImportRows(currentRows.filter((row) => row.id !== rowId), data));
  };

  const handleManagedFieldChange = (rowId: string, field: keyof Omit<ImportReviewRow, 'id' | 'issues'>, value: string) => {
    markManagedDirty();
    setManagedRows((currentRows) => updateImportRow(currentRows, rowId, field, value, currentRows));
  };

  const handleManagedPreviousNamesChange = (rowId: string, value: string) => {
    markManagedDirty();
    setManagedRows((currentRows) => updateImportRow(currentRows, rowId, 'previousNames', value, currentRows));
  };

  const handleManagedRemoveRow = (rowId: string) => {
    markManagedDirty();
    setManagedRows((currentRows) => reconcileImportRows(currentRows.filter((row) => row.id !== rowId), currentRows));
  };

  const handleRecomputeImported = () => {
    setImportedRows((currentRows) => reconcileImportRows(currentRows, data));
    setStatus({ type: 'success', message: '已重新推断导入记录的标签、状态和校验问题。' });
  };

  const handleAddManagedRow = () => {
    markManagedDirty();
    setManagedRows((currentRows) => reconcileImportRows([...currentRows, createEmptySourceRow(managedCategory)], currentRows));
  };

  const handleAppendImportedToSource = (category: ChangeCategory) => {
    const rowsToAppend = cloneReviewRows(validImportedRows.filter((row) => row.category === category));
    if (rowsToAppend.length === 0) {
      setStatus({ type: 'error', message: `${CATEGORY_LABELS[category]} 没有可追加的有效导入记录。` });
      return;
    }

    markManagedDirty();
    setManagedRows((currentRows) => reconcileImportRows([...currentRows, ...rowsToAppend], currentRows));
    setToolTab('source');
    setManagedCategory(category);
    setStatus({ type: 'success', message: `已将 ${rowsToAppend.length} 条${CATEGORY_LABELS[category]}记录追加到本地数据管理区。` });
  };

  const handleReplaceManagedCategory = (category: ChangeCategory) => {
    const replacementRows = cloneReviewRows(validImportedRows.filter((row) => row.category === category));
    if (replacementRows.length === 0) {
      setStatus({ type: 'error', message: `${CATEGORY_LABELS[category]} 没有可用于替换的有效导入记录。` });
      return;
    }

    markManagedDirty();
    setManagedRows((currentRows) => {
      const nextRows = [
        ...currentRows.filter((row) => row.category !== category),
        ...replacementRows,
      ];
      return reconcileImportRows(nextRows, nextRows);
    });
    setToolTab('source');
    setManagedCategory(category);
    setStatus({ type: 'success', message: `已用 ${replacementRows.length} 条记录替换当前${CATEGORY_LABELS[category]}数据。` });
  };

  const exportCategoryRows = (rows: ImportReviewRow[], category: ChangeCategory) => {
    const categoryRows = rows.filter((row) => row.category === category);
    if (categoryRows.length === 0) {
      setStatus({ type: 'error', message: `${CATEGORY_LABELS[category]} 当前没有可导出的记录。` });
      return null;
    }

    const invalidRows = categoryRows.filter((row) => row.issues.length > 0);
    if (invalidRows.length > 0) {
      setStatus({ type: 'error', message: `${CATEGORY_LABELS[category]} 仍有 ${invalidRows.length} 条记录存在问题，请先修正后再导出。` });
      return null;
    }

    return categoryRows.map(reviewRowToBalanceChange);
  };

  const handleExportImportedCategory = async (category: ChangeCategory, mode: 'copy' | 'download') => {
    const categoryRows = exportCategoryRows(validImportedRows, category);
    if (!categoryRows) return;

    const tsv = generateTSV(categoryRows);
    if (mode === 'copy') {
      try {
        await navigator.clipboard.writeText(tsv);
        setStatus({ type: 'success', message: `${CATEGORY_LABELS[category]} TSV 已复制到剪贴板。` });
      } catch {
        setStatus({ type: 'error', message: '复制失败，请改用下载导出。' });
      }
      return;
    }

    downloadTextFile(`${category}.tsv`, tsv, 'text/tab-separated-values;charset=utf-8');
    setStatus({ type: 'success', message: `${category}.tsv 已下载。` });
  };

  const handleExportManagedCategory = (category: ChangeCategory) => {
    const categoryRows = exportCategoryRows(managedRows, category);
    if (!categoryRows) return;

    downloadTextFile(`${category}.tsv`, generateTSV(categoryRows), 'text/tab-separated-values;charset=utf-8');
    setStatus({ type: 'success', message: `${CATEGORY_LABELS[category]} TSV 已下载。` });
  };

  const handleExportImportedJson = () => {
    if (validImportedRows.length === 0) {
      setStatus({ type: 'error', message: '当前没有可导出的审核结果。' });
      return;
    }

    downloadTextFile(
      'reviewed-import.json',
      `${JSON.stringify(validImportedRows.map(reviewRowToBalanceChange), null, 2)}\n`,
      'application/json;charset=utf-8',
    );
    setStatus({ type: 'success', message: '审核结果 JSON 已下载。' });
  };

  const handleExportSiteConfig = () => {
    if (!siteConfig.currentVersion.trim()) {
      setStatus({ type: 'error', message: '当前版本号不能为空。' });
      return;
    }

    downloadTextFile(
      'site.json',
      `${JSON.stringify({
        currentVersion: siteConfig.currentVersion.trim(),
        lastUpdated: siteConfig.lastUpdated?.trim() || undefined,
      }, null, 2)}\n`,
      'application/json;charset=utf-8',
    );
    setStatus({ type: 'success', message: 'site.json 已下载。' });
  };

  const handleSaveDraft = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const draft: LocalToolDraft = {
      version: DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      managedRows,
      siteConfig,
    };

    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    setDraftSource('draft');
    setDraftSavedAt(draft.savedAt);
    setHasUnsavedDraftChanges(false);
    setStatus({ type: 'success', message: '本地草稿已保存到浏览器，可在刷新后继续编辑。' });
  };

  const handleRefreshFromGenerated = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }

    setManagedRows(baseManagedRows);
    setSiteConfig(baseSiteConfig);
    setDraftSource('generated');
    setDraftSavedAt('');
    setHasUnsavedDraftChanges(false);
    setStatus({ type: 'success', message: '已清除本地草稿，并从当前生成数据重新加载。' });
  };

  const draftStatusText = draftSource === 'draft'
    ? `当前来源：本地草稿${draftSavedAt ? `（${new Date(draftSavedAt).toLocaleString('zh-CN', { hour12: false })}）` : ''}`
    : '当前来源：生成数据';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              本地数据维护工具
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              这里用于本地导入、审核和维护真源数据。浏览器端不会直接写回仓库文件，导出后的 TSV 和 site.json 需要你手动保存到
              <code className="mx-1">data/raw/*.tsv</code>
              与
              <code className="mx-1">data/config/site.json</code>
              。
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-slate-500">当前版本号</div>
              <div className="text-lg font-semibold text-slate-900 mt-1">{siteConfig.currentVersion}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-slate-500">数据生成时间</div>
              <div className="font-medium text-slate-900 mt-1">{new Date(meta.generatedAt).toLocaleString('zh-CN', { hour12: false })}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-slate-500">最近维护日期</div>
              <div className="font-medium text-slate-900 mt-1">{siteConfig.lastUpdated || '未设置'}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1 text-sm">
            <div className="font-medium text-slate-800">{draftStatusText}</div>
            <div className={hasUnsavedDraftChanges ? 'text-amber-600' : 'text-slate-500'}>
              {hasUnsavedDraftChanges ? '存在未保存到草稿的本地修改。' : '当前没有未保存的草稿修改。'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleSaveDraft} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm">
              <Save className="w-4 h-4" />
              保存草稿
            </button>
            <button onClick={handleRefreshFromGenerated} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-sm">
              <RefreshCcw className="w-4 h-4" />
              从生成数据刷新
            </button>
            <button onClick={handleExportSiteConfig} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-sm">
              <Download className="w-4 h-4" />
              导出站点配置
            </button>
          </div>
        </div>

        <div className="flex rounded-lg bg-slate-100 p-1 w-fit">
          <button
            onClick={() => setToolTab('import')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${toolTab === 'import' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            数据导入
          </button>
          <button
            onClick={() => setToolTab('source')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${toolTab === 'source' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            数据管理
          </button>
        </div>

        {status.message && (
          <div className={`flex items-center gap-2 text-sm font-medium ${statusTone(status.type)}`}>
            {status.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {status.message}
          </div>
        )}
      </div>

      {toolTab === 'import' && (
        <>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg bg-slate-100 p-1">
                <button onClick={() => setInputMode('paste')} className={`px-3 py-1.5 text-sm rounded-md ${inputMode === 'paste' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                  粘贴导入
                </button>
                <button onClick={() => setInputMode('file')} className={`px-3 py-1.5 text-sm rounded-md ${inputMode === 'file' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                  文件导入
                </button>
              </div>

              <label className="text-sm text-slate-600">
                默认分类
                <select className="ml-2 border border-slate-300 rounded-md px-2 py-1 bg-white" value={fallbackCategory} onChange={(event) => setFallbackCategory(event.target.value as ChangeCategory)}>
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
                  ))}
                </select>
              </label>
            </div>

            {inputMode === 'paste' ? (
              <div className="space-y-4">
                <textarea
                  className="w-full min-h-56 p-4 border border-slate-300 rounded-lg text-sm leading-7 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={'可直接粘贴官网公告正文、Excel 表格内容、TSV 或 CSV。\n\n示例：\n美国超级驱逐舰—石墙(Stonewall)\n主炮装填时间从 7 秒减少到 5.8 秒\n对海隐蔽从 9.3km 减少到 8.1km'}
                  value={pasteInput}
                  onChange={(event) => setPasteInput(event.target.value)}
                />
                <button onClick={handlePasteImport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                  <Upload className="w-4 h-4" />
                  解析粘贴内容
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50">
                <Upload className="w-8 h-8 text-slate-400 mb-3" />
                <span className="text-sm font-medium text-slate-700">上传 .xlsx / .csv / .tsv 文件</span>
                <span className="text-xs text-slate-500 mt-1">Excel 将按工作表逐个尝试解析，空表和无法识别的表会自动忽略。</span>
                <input type="file" accept=".xlsx,.csv,.tsv" className="mt-4 text-sm" onChange={handleFileImport} />
              </label>
            )}

            {importResult && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                  <p className="text-sm font-medium text-slate-800">解析结果</p>
                  <div className="mt-3 text-sm text-slate-600 space-y-1">
                    <div>解析模式：{parseModeLabel(importResult.mode)}</div>
                    <div>识别记录：{importSummary.total}</div>
                    <div>待修正：{importSummary.invalid}</div>
                    <div>测试船：{importSummary.testShips}</div>
                    <div>正式船：{importSummary.releasedShips}</div>
                    <div>测试转正：{importSummary.converted}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                  <p className="text-sm font-medium text-slate-800">Sheet 识别情况</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    {importResult.sheetSummaries.map((sheet) => (
                      <span key={sheet.name} className="px-2.5 py-1 rounded-md border border-slate-200 bg-white">
                        {sheet.name}: {sheet.rowCount} 条
                      </span>
                    ))}
                    {importResult.ignoredSheets.map((sheet) => (
                      <span key={sheet} className="px-2.5 py-1 rounded-md border border-amber-200 bg-amber-50 text-amber-700">
                        已忽略：{sheet}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-base font-semibold text-slate-900">审核结果</h3>
                <p className="text-sm text-slate-600 mt-1">
                  可逐行修正分类、规范名、别名、状态和趋势，修正后再导出或追加到本地数据管理区。
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={handleRecomputeImported} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">
                  <RefreshCcw className="w-4 h-4" />
                  重新推断标签
                </button>
                <label className="text-sm text-slate-600 flex items-center gap-2">
                  <input type="checkbox" checked={issuesOnly} onChange={(event) => setIssuesOnly(event.target.checked)} />
                  只看有问题的记录
                </label>
                <input type="text" value={reviewSearch} onChange={(event) => setReviewSearch(event.target.value)} placeholder="搜索船名、别名、属性或版本" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <EditableRowsTable
              rows={reviewRows}
              onFieldChange={handleImportFieldChange}
              onPreviousNamesChange={handleImportPreviousNamesChange}
              onRemoveRow={handleImportRemoveRow}
            />

            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-4">
              <p className="text-sm font-medium text-slate-800">导出或送入本地数据管理</p>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {CATEGORY_OPTIONS.map((category) => (
                  <div key={category} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                    <div className="text-sm font-medium text-slate-800">{CATEGORY_LABELS[category]}</div>
                    <div className="text-xs text-slate-500">有效记录：{importedCountsByCategory[category]} 条</div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleExportImportedCategory(category, 'copy')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">
                        <FileSpreadsheet className="w-4 h-4" />
                        复制 TSV
                      </button>
                      <button onClick={() => handleExportImportedCategory(category, 'download')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">
                        <Download className="w-4 h-4" />
                        下载 TSV
                      </button>
                      <button onClick={() => handleAppendImportedToSource(category)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">
                        <Save className="w-4 h-4" />
                        追加到数据管理
                      </button>
                      <button onClick={() => handleReplaceManagedCategory(category)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">
                        替换该分类
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleExportImportedJson} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-sm">
                <Download className="w-4 h-4" />
                导出审核结果 JSON
              </button>
            </div>
          </div>
        </>
      )}

      {toolTab === 'source' && (
        <>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-base font-semibold text-slate-900">本地数据管理</h3>
                <p className="text-sm text-slate-600 mt-1">
                  这里维护准备写回真源的数据，可新增、删除、编辑，并最终按分类导出 TSV。
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={managedCategory} onChange={(event) => setManagedCategory(event.target.value as ChangeCategory)}>
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
                  ))}
                </select>
                <label className="text-sm text-slate-600 flex items-center gap-2">
                  <input type="checkbox" checked={managedIssuesOnly} onChange={(event) => setManagedIssuesOnly(event.target.checked)} />
                  只看有问题的记录
                </label>
                <input type="text" value={managedSearch} onChange={(event) => setManagedSearch(event.target.value)} placeholder="搜索规范名、别名、属性或版本" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <button onClick={handleAddManagedRow} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm">
                  新增记录
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">当前分类记录数</div>
                <div className="text-2xl font-semibold text-slate-900 mt-1">{managedSummary.total}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">存在问题</div>
                <div className="text-2xl font-semibold text-slate-900 mt-1">{managedSummary.invalid}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">测试船</div>
                <div className="text-2xl font-semibold text-slate-900 mt-1">{managedSummary.testShips}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">正式船</div>
                <div className="text-2xl font-semibold text-slate-900 mt-1">{managedSummary.releasedShips}</div>
              </div>
            </div>

            <EditableRowsTable
              rows={managedViewRows}
              onFieldChange={handleManagedFieldChange}
              onPreviousNamesChange={handleManagedPreviousNamesChange}
              onRemoveRow={handleManagedRemoveRow}
            />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-3">
                <p className="text-sm font-medium text-slate-800">站点配置</p>
                <label className="block text-sm text-slate-600">
                  当前版本号
                  <input
                    value={siteConfig.currentVersion}
                    onChange={(event) => {
                      markManagedDirty();
                      setSiteConfig((current) => ({ ...current, currentVersion: event.target.value }));
                    }}
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  />
                </label>
                <label className="block text-sm text-slate-600">
                  最近维护日期
                  <input
                    value={siteConfig.lastUpdated ?? ''}
                    onChange={(event) => {
                      markManagedDirty();
                      setSiteConfig((current) => ({ ...current, lastUpdated: event.target.value }));
                    }}
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    placeholder="例如 2026-04-24"
                  />
                </label>
                <button onClick={handleExportSiteConfig} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-sm">
                  <Download className="w-4 h-4" />
                  导出 site.json
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-3">
                <p className="text-sm font-medium text-slate-800">导出与后续步骤</p>
                <p className="text-sm text-slate-600">
                  导出 TSV 和 site.json 后，请用它们覆盖仓库真源，再执行
                  <code className="mx-1">npm run data:validate</code>
                  <code className="mx-1">npm run data:build</code>
                  <code className="mx-1">npm run build</code>
                  <code className="mx-1">npm run data:bundle</code>
                  生成最新部署产物和更新包。
                </p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((category) => (
                    <button key={category} onClick={() => handleExportManagedCategory(category)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-sm">
                      <Download className="w-4 h-4" />
                      导出 {CATEGORY_LABELS[category]} TSV
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
