import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.resolve(rootDir, process.env.BUILD_OUTPUT_DIR || 'dist');
const indexPath = path.join(rootDir, 'index.html');
const vercelConfigPath = path.join(rootDir, 'vercel.json');
const envConfigPath = path.join(outputDir, 'env-config.js');
const staticAssetPaths = ['src', 'styles', 'backup-restore-v2.js'];

const appConfig = {
  workerUrl:
    process.env.TRADING_TERMINAL_WORKER_URL ||
    'https://bist.c8jmvhdm8c.workers.dev/',
  defaultDataSource: process.env.TRADING_TERMINAL_DEFAULT_DATA_SOURCE || 'yahoo'
};

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await cp(vercelConfigPath, path.join(outputDir, 'vercel.json'));

const sourceHtml = await readFile(indexPath, 'utf8');
if (!sourceHtml.includes('<base href="./">')) {
  throw new Error('index.html must define a relative <base href="./"> for subpath hosting');
}
if (!sourceHtml.includes('<script src="./env-config.js"></script>')) {
  throw new Error('index.html must load ./env-config.js before the application script');
}

await writeFile(path.join(outputDir, 'index.html'), sourceHtml, 'utf8');
await writeFile(path.join(outputDir, '.nojekyll'), '', 'utf8');
await writeFile(
  envConfigPath,
  `window.TRADING_TERMINAL_CONFIG = Object.freeze(${JSON.stringify(appConfig, null, 2)});\n`,
  'utf8'
);

for (const assetPath of staticAssetPaths) {
  const sourcePath = path.join(rootDir, assetPath);
  const destinationPath = path.join(outputDir, assetPath);
  await cp(sourcePath, destinationPath, { recursive: true });
}
