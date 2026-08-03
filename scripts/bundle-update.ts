import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UpdateBundleManifest } from '../src/types.ts';
import { readSiteConfig } from './data-lib.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function getTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');
}

async function copyRelativePath(outputRoot: string, relativePath: string): Promise<void> {
  const source = path.join(repoRoot, relativePath);
  const destination = path.join(outputRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

try {
  const config = await readSiteConfig();
  const bundleRelativePaths = [
    'data/raw',
    'data/database',
    'data/config/site.json',
    'src/data/generated/balanceChanges.json',
    'docs',
  ];

  const outputRoot = path.join(repoRoot, 'outputs', 'update-bundles', getTimestamp());
  await mkdir(outputRoot, { recursive: true });

  for (const relativePath of bundleRelativePaths) {
    await copyRelativePath(outputRoot, relativePath);
  }

  const manifest: UpdateBundleManifest = {
    bundleCreatedAt: new Date().toISOString(),
    currentVersion: config.currentVersion,
    includedFiles: bundleRelativePaths,
  };

  await writeFile(
    path.join(outputRoot, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  console.log(`Created update bundle at ${outputRoot}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
