import { loadBalanceChanges, readSiteConfig } from './data-lib.ts';

try {
  const [records] = await Promise.all([
    loadBalanceChanges(),
    readSiteConfig(),
  ]);
  console.log(`Validated ${records.length} balance records from raw TSV files.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
