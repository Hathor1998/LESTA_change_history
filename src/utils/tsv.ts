import { BalanceChange, ChangeCategory } from '../types';

export function parseTSV(tsv: string, category: ChangeCategory): BalanceChange[] {
  const lines = tsv.trim().split('\n');
  if (lines.length < 1) return [];

  const data: BalanceChange[] = [];
  
  // Skip header if it contains common header keywords
  let startIndex = 0;
  if (lines[0].includes('船名') || lines[0].includes('名称') || lines[0].includes('机制')) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(c => c.trim());
    if (cols.length >= 8) {
      data.push({
        id: Math.random().toString(36).substr(2, 9),
        category,
        targetName: cols[0] || '',
        nation: cols[1] || '',
        tier: cols[2] || '',
        type: cols[3] || '',
        attribute: cols[4] || '',
        oldValue: cols[5] || '',
        newValue: cols[6] || '',
        version: cols[7] || '',
        notes: cols[8] || '',
        trend: 'adjustment'
      });
    }
  }
  return data;
}

export function generateTSV(data: BalanceChange[]): string {
  const header = ['名称/船名', '系别', '等级', '类型/舰种', '属性', '修改前数值', '修改后数值', '改动版本', '备注'].join('\t');
  const rows = data.map(d => [
    d.targetName, d.nation, d.tier, d.type, d.attribute, d.oldValue, d.newValue, d.version, d.notes
  ].join('\t'));
  return [header, ...rows].join('\n');
}
