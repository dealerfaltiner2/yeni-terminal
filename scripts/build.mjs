import { cp, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const runtimeConfigPath = path.join(rootDir, 'env-config.js');
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

await run('npx', ['vite', 'build']);
await mkdir(distDir, { recursive: true });

try {
  await access(runtimeConfigPath, constants.R_OK);
  await cp(runtimeConfigPath, distRuntimeConfigPath);
} catch (error) {
  throw new Error(`Runtime config file is missing or unreadable at ${runtimeConfigPath}: ${error.message}`);
}

console.log(`✅ Production bundle is ready in ${distDir}`);
