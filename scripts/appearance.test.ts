import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parseAppearance, resolveAppearance } from '../src/utils/appearance.ts';

test('appearance preferences validate without touching data drafts', () => {
  for (const value of [null, undefined, 'broken', '{}']) assert.equal(parseAppearance(value), 'system');
  assert.equal(parseAppearance('light'), 'light');
  assert.equal(parseAppearance('dark'), 'dark');
  assert.equal(resolveAppearance('system', true), 'dark');
  assert.equal(resolveAppearance('system', false), 'light');
  assert.equal(resolveAppearance('light', true), 'light');
  assert.equal(resolveAppearance('dark', false), 'dark');
});

test('pre-paint bootstrap supports saved preferences, system colors and denied storage', async () => {
  const script = await readFile('public/appearance-init.js', 'utf8');
  for (const scenario of [
    { saved: 'dark', systemDark: false, denied: false, expected: 'dark' },
    { saved: 'light', systemDark: true, denied: false, expected: 'light' },
    { saved: 'system', systemDark: true, denied: false, expected: 'dark' },
    { saved: 'invalid', systemDark: false, denied: false, expected: 'light' },
    { saved: 'light', systemDark: true, denied: true, expected: 'dark' },
  ]) {
    const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    let chromeColor = '';
    runInNewContext(script, {
      localStorage: { getItem(key: string) { assert.equal(key, 'wows-appearance'); if (scenario.denied) throw new Error('denied'); return scenario.saved; } },
      window: { matchMedia: () => ({ matches: scenario.systemDark }) },
      document: { documentElement: root, querySelector: () => ({ setAttribute: (_key: string, value: string) => { chromeColor = value; } }) },
    });
    assert.equal(root.dataset.theme, scenario.expected);
    assert.equal(root.style.colorScheme, scenario.expected);
    assert.equal(chromeColor, scenario.expected === 'dark' ? '#0b1524' : '#edf3f9');
  }
});
