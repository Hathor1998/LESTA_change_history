const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function normalizeTier(value: string): string {
  const tier = value.trim().toUpperCase().replace(/Х/g, 'X');
  if (/^[★⭐]$/.test(tier)) return '11';
  const index = roman.indexOf(tier);
  if (index > 0) return String(index);
  return /^(?:[1-9]|10|11)$/.test(tier) ? tier : '';
}

export function explicitVersion(value: string): string | null {
  return value.match(/(?:обновлени[ея]|верси[яи]|тестировани[ея]|общий тест|закрытый тест)\s+(\d{2}\.\d{1,2})(?!\d)/i)?.[1] ?? null;
}
