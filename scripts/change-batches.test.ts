import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupChangeBatches, groupChangeSections, hasChangeValue } from '../src/utils/change-batches.ts';
import type { BalanceChange } from '../src/types.ts';

test('same announcement merges attributes but preserves stages and later announcements', () => {
  const row = { version: '26.10', shipStatus: 'test', announcementId: '696', publishedAt: '2026-10-01' } as BalanceChange;
  const batches = groupChangeBatches([
    { ...row, id: 'a' }, { ...row, id: 'b' },
    { ...row, id: 'c', announcementId: '698', publishedAt: '2026-10-15' },
    { ...row, id: 'd', shipStatus: 'released' },
  ]);
  assert.equal(batches.length, 3);
  assert.equal(batches[0][1][0].id, 'c');
  assert.deepEqual(batches[1][1].map(r => r.id), ['a', 'b']);
});

test('unknown sources do not merge; missing values are not shown as zero', () => {
  const row = { version: '26.10', shipStatus: 'test' } as BalanceChange;
  assert.equal(groupChangeBatches([{ ...row, id: 'a' }, { ...row, id: 'b' }]).length, 2);
  assert.equal(hasChangeValue('—'), false);
  assert.equal(hasChangeValue('0'), true);
});

test('restores explicit radar context without splitting weapon names or salvo ranges', () => {
  const rows = ['监视雷达-舰船发现距离', '监视雷达-作用时间', '监视雷达-可用次数', '第1-2轮齐射装填时间', '新增“维修小组”消耗品，具体参数如下：消耗品数量：3']
    .map((attribute, i) => ({ id: String(i), attribute }) as BalanceChange);
  const sections = groupChangeSections(rows);
  assert.equal(sections.length, 3);
  assert.equal(sections[0].title, '“监视雷达”参数调整');
  assert.deepEqual(sections[0].items.map(i => i.label), ['舰船发现距离', '作用时间', '可用次数']);
  assert.equal(sections[1].title, undefined);
  assert.equal(sections[2].items[0].label, '消耗品数量：3');
});
