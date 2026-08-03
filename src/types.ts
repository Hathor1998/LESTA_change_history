export type ChangeCategory = 'ship' | 'mechanic' | 'misc';
export type ChangeTrend = 'buff' | 'nerf' | 'neutral' | 'adjustment';
export type ShipStatus = 'test' | 'released' | 'unknown';
export type ChangeTag = 'test-ship' | 'released-ship' | 'converted-from-test' | 'name-change';
export type ImportParseMode = 'structured-table' | 'announcement-block';

export interface BalanceChange {
  id: string;
  category: ChangeCategory;
  targetName: string;
  canonicalName: string;
  previousNames: string[];
  nation: string;
  tier: string;
  type: string;
  attribute: string;
  oldValue: string;
  newValue: string;
  version: string;
  notes: string;
  trend: ChangeTrend;
  shipStatus: ShipStatus;
  tags: ChangeTag[];
  sourceSheet: string;
}

export interface RawBalanceRow {
  targetName: string;
  canonicalName: string;
  previousNames: string;
  nation: string;
  tier: string;
  type: string;
  attribute: string;
  oldValue: string;
  newValue: string;
  version: string;
  notes: string;
  trend: ChangeTrend;
  shipStatus: ShipStatus;
  tags: string;
  sourceSheet: string;
}

export interface SiteConfig {
  currentVersion: string;
  lastUpdated?: string;
}

export interface BuildMeta {
  generatedAt: string;
  currentVersion: string;
  lastUpdated?: string;
  recordCount: number;
  categoryCounts: Record<ChangeCategory, number>;
  shipStatusCounts: Record<ShipStatus, number>;
  tagCounts: Partial<Record<ChangeTag, number>>;
  trendCounts: Record<ChangeTrend, number>;
  officialData?: {
    announcementCount: number;
    rangeStart: string;
    rangeEnd: string;
    syncedAt: string;
  };
}

export interface GeneratedBalanceData {
  records: BalanceChange[];
  meta: BuildMeta;
}

export interface ImportReviewRow {
  id: string;
  category: ChangeCategory;
  targetName: string;
  canonicalName: string;
  previousNames: string[];
  nation: string;
  tier: string;
  type: string;
  attribute: string;
  oldValue: string;
  newValue: string;
  version: string;
  notes: string;
  trend: ChangeTrend;
  shipStatus: ShipStatus;
  tags: ChangeTag[];
  sourceSheet: string;
  issues: string[];
}

export interface ImportWorkbookSheet {
  name: string;
  rowCount: number;
}

export interface ImportParseResult {
  mode: ImportParseMode;
  rows: ImportReviewRow[];
  sheetSummaries: ImportWorkbookSheet[];
  ignoredSheets: string[];
}

export interface UpdateBundleManifest {
  bundleCreatedAt: string;
  currentVersion: string;
  includedFiles: string[];
}

export type OfficialAnalysisConfidence = 'high' | 'medium' | 'low';

export interface OfficialAnnouncement {
  id: string;
  url: string;
  title: string;
  publishedAt: string;
  contentHash: string;
  recordIds: string[];
}

export interface OfficialBalanceRecord extends RawBalanceRow {
  id: string;
  category: ChangeCategory;
  announcementId: string;
  sourceUrl: string;
  publishedAt: string;
  originalText: string;
  analysisRule: string;
  analysisConfidence: OfficialAnalysisConfidence;
}

export interface OfficialBalanceDatabase {
  schemaVersion: 1;
  source: 'blog.korabli.su';
  syncedAt: string;
  rangeStart: string;
  rangeEnd: string;
  announcements: OfficialAnnouncement[];
  records: OfficialBalanceRecord[];
}

export interface ChineseTranslationDatabase {
  schemaVersion: 1;
  provider: 'deepseek-claude-gateway';
  generatedAt: string;
  translations: Record<string, string>;
  untranslated: string[];
}

export interface LocalToolDraft {
  version: number;
  savedAt: string;
  managedRows: ImportReviewRow[];
  siteConfig: SiteConfig;
}
