import type { BalanceChange } from '../types.ts';

export function groupChangeBatches(records: BalanceChange[]) {
  const batches = new Map<string, BalanceChange[]>();
  for (const record of records) {
    // Unknown sources stay separate: a shared version alone is not an announcement.
    const source = record.announcementId || record.sourceUrl || record.sourceSheet || record.id;
    const key = JSON.stringify([source, record.version, record.changeStage ?? record.shipStatus]);
    const batch = batches.get(key) ?? [];
    batch.push(record);
    batches.set(key, batch);
  }
  return [...batches.entries()].sort(([, a], [, b]) => {
    const left = a[0], right = b[0];
    if (left.publishedAt && right.publishedAt && left.publishedAt !== right.publishedAt) {
      return right.publishedAt.localeCompare(left.publishedAt);
    }
    return right.version.localeCompare(left.version, undefined, { numeric: true });
  });
}

export function hasChangeValue(value: string) {
  return !['', '-', '—', '未知', '未提供'].includes(value.trim());
}

export function groupChangeSections(records: BalanceChange[]) {
  const sections: { key: string; title?: string; items: { record: BalanceChange; label: string }[] }[] = [];
  const headings = new Map<string, typeof sections[number]>();
  for (const record of records) {
    // Only explicit context separators are restored; hyphens inside names/numbers are not headings.
    const match = record.attribute.match(/^(.+?)[：:](.+)$/)
      ?? record.attribute.match(/^((?:监视雷达|水听|水底搜索|水下搜索|维修小组|引擎增压|侦察机|发烟器|主炮装填助推器|鱼雷装填助推器|战斗指令[^-]*))-(.+)$/);
    if (!match) {
      sections.push({ key: record.id, items: [{ record, label: record.attribute }] });
      continue;
    }
    const context = match[1].trim();
    const title = /参数|更改|调整|新增|替换|强化|改善|减少|增加|效果|条件/.test(context)
      ? context : `“${context.replace(/^[“「]|[”」]$/g, '')}”参数调整`;
    let section = headings.get(context);
    if (!section) {
      section = { key: `heading:${context}`, title, items: [] };
      headings.set(context, section);
      sections.push(section);
    }
    section.items.push({ record, label: match[2].trim() });
  }
  return sections;
}
