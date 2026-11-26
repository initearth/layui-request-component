import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const configFiles = [
  'package.json',
  'rollup.config.mjs',
  'tsconfig.json',
  'tsconfig.build.json'
];

let devServer;
let building = false;
let pendingBuild = false;
let buildTimer;

function runNpm(args) {
  const npmExecPath = process.env.npm_execpath;

  if (npmExecPath && /\.m?js$/.test(npmExecPath)) {
    return spawn(process.execPath, [npmExecPath, ...args], {
      cwd: root,
      stdio: 'inherit'
    });
  }

  return spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
}

function reloadBrowser() {
  if (devServer) devServer.reload();
}

function build() {
  if (building) {
    pendingBuild = true;
    return;
  }

  building = true;
  console.log('[watch] rebuilding...');

  const child = runNpm(['run', 'build']);

  child.on('exit', function (code) {
    building = false;

    if (code === 0) {
      console.log('[watch] rebuild done, reloading browser');
      reloadBrowser();
    } else {
      console.error('[watch] rebuild failed');
    }

    if (pendingBuild) {
      pendingBuild = false;
      scheduleBuild();
    }
  });
}

function scheduleBuild() {
  clearTimeout(buildTimer);
  buildTimer = setTimeout(build, 300);
}

function handleChange(file) {
  if (!file) return;

  const normalized = file.replace(/\\/g, '/');
  const shouldRebuild = /\.ts$/.test(normalized) || configFiles.indexOf(normalized) > -1;

  if (shouldRebuild) {
    console.log('[watch] source changed:', normalized);
    scheduleBuild();
    return;
  }

  console.log('[watch] file changed:', normalized);
  reloadBrowser();
}

function startWatching() {
  devServer = startServer();

  ['src', 'example'].forEach(function (dir) {
    watch(resolve(root, dir), { recursive: true }, function (_event, filename) {
      handleChange(join(dir, filename || ''));
    });
  });

  configFiles.forEach(function (file) {
    watch(resolve(root, file), function () {
      handleChange(file);
    });
  });

  console.log('[watch] watching src/, example/ and config files');
}

async function shutdown() {
  console.log('\n[watch] stopping');
  if (devServer) await devServer.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('[watch] initial build...');
const initialBuild = runNpm(['run', 'build']);
initialBuild.on('exit', function (code) {
  console.log(code === 0 ? '[watch] initial build done' : '[watch] initial build failed');
  startWatching();
});
