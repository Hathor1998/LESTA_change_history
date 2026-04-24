import type { ChangeCategory, ChangeTag, ChangeTrend, RawBalanceRow, ShipStatus } from '../types.ts';

export const RAW_BALANCE_COLUMNS = [
  'targetName',
  'canonicalName',
  'previousNames',
  'nation',
  'tier',
  'type',
  'attribute',
  'oldValue',
  'newValue',
  'version',
  'notes',
  'trend',
  'shipStatus',
  'tags',
  'sourceSheet',
] as const satisfies readonly (keyof RawBalanceRow)[];

export const TREND_VALUES = [
  'buff',
  'nerf',
  'neutral',
  'adjustment',
] as const satisfies readonly ChangeTrend[];

export const SHIP_STATUS_VALUES = [
  'test',
  'released',
  'unknown',
] as const satisfies readonly ShipStatus[];

export const CHANGE_TAG_VALUES = [
  'test-ship',
  'released-ship',
  'converted-from-test',
  'name-change',
] as const satisfies readonly ChangeTag[];

export const CATEGORY_ORDER: ChangeCategory[] = ['ship', 'mechanic', 'misc'];

export const CATEGORY_LABELS: Record<ChangeCategory, string> = {
  ship: '舰船平衡改动',
  mechanic: '机制平衡改动',
  misc: '其他平衡改动',
};

export const SHIP_STATUS_LABELS: Record<ShipStatus, string> = {
  test: '测试船',
  released: '正式船',
  unknown: '未知状态',
};

export const CHANGE_TAG_LABELS: Record<ChangeTag, string> = {
  'test-ship': '测试船',
  'released-ship': '正式船',
  'converted-from-test': '测试转正',
  'name-change': '名称变更',
};
