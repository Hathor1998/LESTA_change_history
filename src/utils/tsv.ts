import { RAW_BALANCE_COLUMNS } from '../data/schema.ts';
import type { BalanceChange, RawBalanceRow } from '../types.ts';

function escapeCell(value: string): string {
  return value.replaceAll('\t', ' ').replaceAll('\r', ' ').replaceAll('\n', ' ');
}

function rowToColumns(row: RawBalanceRow): string[] {
  return RAW_BALANCE_COLUMNS.map((column) => escapeCell(row[column] ?? ''));
}

export function toRawBalanceRow(item: BalanceChange): RawBalanceRow {
  return {
    targetName: item.targetName,
    canonicalName: item.canonicalName,
    previousNames: item.previousNames.join('|'),
    nation: item.nation,
    tier: item.tier,
    type: item.type,
    attribute: item.attribute,
    oldValue: item.oldValue,
    newValue: item.newValue,
    version: item.version,
    notes: item.notes,
    trend: item.trend,
    shipStatus: item.shipStatus,
    tags: item.tags.join('|'),
    sourceSheet: item.sourceSheet,
  };
}

export function generateRawTSV(rows: RawBalanceRow[]): string {
  const header = RAW_BALANCE_COLUMNS.join('\t');
  const body = rows.map((row) => rowToColumns(row).join('\t'));
  return [header, ...body].join('\n');
}

export function generateTSV(data: BalanceChange[]): string {
  return generateRawTSV(data.map(toRawBalanceRow));
}
