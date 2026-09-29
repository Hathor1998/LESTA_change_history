export type SyncFailure = { source: string; error: string };

// A failed source must never erase its historical records or block other sources.
export async function collectSources<T>(sources: { name: string; read: () => Promise<T[]> }[]) {
  const items: T[] = [];
  const failures: SyncFailure[] = [];
  for (const source of sources) {
    try { items.push(...await source.read()); }
    catch (error) { failures.push({source: source.name, error: String(error)}); }
  }
  return {items, failures};
}
