import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('build generates deployable Vercel bundle with env config', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'yeni-terminal-build-'));

  await execFileAsync('node', ['./scripts/build.mjs'], {
    cwd: repoDir,
    env: {
      ...process.env,
      BUILD_OUTPUT_DIR: tempDir,
      TRADING_TERMINAL_WORKER_URL: 'https://example-worker.vercel.app/',
      TRADING_TERMINAL_TWELVEDATA_API_KEY: 'demo-key',
      TRADING_TERMINAL_DEFAULT_DATA_SOURCE: 'twelvedata'
    }
  });

  const [html, envConfig, vercelConfig] = await Promise.all([
    readFile(path.join(tempDir, 'index.html'), 'utf8'),
    readFile(path.join(tempDir, 'env-config.js'), 'utf8'),
    readFile(path.join(tempDir, 'vercel.json'), 'utf8')
  ]);

  assert.match(html, /<script src="\.\/env-config\.js"><\/script>/);
  assert.match(envConfig, /https:\/\/example-worker\.vercel\.app\//);
  assert.match(envConfig, /demo-key/);
  assert.match(envConfig, /twelvedata/);
  assert.match(vercelConfig, /Strict-Transport-Security/);
});
