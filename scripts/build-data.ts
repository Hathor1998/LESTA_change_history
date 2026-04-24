import { buildGeneratedData, loadBalanceChanges, readSiteConfig, writeGeneratedData } from './data-lib.ts';

try {
  const [records, siteConfig] = await Promise.all([
    loadBalanceChanges(),
    readSiteConfig(),
  ]);
  const data = buildGeneratedData(records, siteConfig);
  await writeGeneratedData(data);
  console.log(`Generated ${data.records.length} balance records at src/data/generated/balanceChanges.json.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
