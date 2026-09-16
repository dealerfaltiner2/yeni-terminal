import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.resolve(rootDir, process.env.BUILD_OUTPUT_DIR || 'dist');
const indexPath = path.join(rootDir, 'index.html');
const vercelConfigPath = path.join(rootDir, 'vercel.json');
const envConfigPath = path.join(outputDir, 'env-config.js');

const appConfig = {
  workerUrl:
    process.env.TRADING_TERMINAL_WORKER_URL ||
    'https://bist.c8jmvhdm8c.workers.dev/',
  twelveDataApiKey: process.env.TRADING_TERMINAL_TWELVEDATA_API_KEY || '',
  defaultDataSource: process.env.TRADING_TERMINAL_DEFAULT_DATA_SOURCE || 'yahoo'
};

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await cp(indexPath, path.join(outputDir, 'index.html'));
await cp(vercelConfigPath, path.join(outputDir, 'vercel.json'));

const sourceHtml = await readFile(indexPath, 'utf8');
const outputHtml = sourceHtml.includes('./env-config.js')
  ? sourceHtml
  : sourceHtml.replace('<script>', '<script src="./env-config.js"></script>\n<script>');

await writeFile(path.join(outputDir, 'index.html'), outputHtml, 'utf8');
await writeFile(
  envConfigPath,
  `window.TRADING_TERMINAL_CONFIG = Object.freeze(${JSON.stringify(appConfig, null, 2)});\n`,
  'utf8'
);

