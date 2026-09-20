export type Appearance = 'system' | 'light' | 'dark';
export const APPEARANCE_KEY = 'wows-appearance';
export function parseAppearance(value: unknown): Appearance {
  return value === 'light' || value === 'dark' ? value : 'system';
}
export function resolveAppearance(value: Appearance, darkSystem: boolean): 'light' | 'dark' {
  return value === 'system' ? (darkSystem ? 'dark' : 'light') : value;
}
