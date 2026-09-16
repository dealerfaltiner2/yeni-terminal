import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const distRuntimeConfigPath = path.join(distDir, 'env-config.js');

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
  });

const runtimeConfig = {
  WORKER_URL: process.env.WORKER_URL || 'https://bist.c8jmvhdm8c.workers.dev/',
  TRADINGVIEW_SCANNER_BASE: process.env.TRADINGVIEW_SCANNER_BASE || 'https://scanner.tradingview.com',
  TWELVE_DATA_BASE: process.env.TWELVE_DATA_BASE || 'https://api.twelvedata.com',
  BINANCE_BASE: process.env.BINANCE_BASE || 'https://api.binance.com',
  COINGECKO_BASE: process.env.COINGECKO_BASE || 'https://api.coingecko.com'
};

await run('npx', ['vite', 'build']);
await mkdir(distDir, { recursive: true });
await writeFile(
  distRuntimeConfigPath,
  `window.__APP_CONFIG__ = Object.assign(${JSON.stringify(runtimeConfig, null, 2)}, window.__APP_CONFIG__ || {});\n`
);

console.log(`✅ Production bundle is ready in ${distDir}`);
