#!/usr/bin/env node
/**
 * dev-aideck.mjs — orquestrador para development do aiDeck local.
 *
 * Usage:
 *   node scripts/dev-aideck.mjs link     — build + symlink aideck local
 *   node scripts/dev-aideck.mjs unlink   — volta ao pacote npm
 *   node scripts/dev-aideck.mjs status   — mostra qual build está ativo
 *
 * Options:
 *   --aideck-root <path>  — caminho para o repo do aideck
 *   --no-build            — linka um aideck JÁ buildado (pula `npm run build`)
 *
 * Motivação: Precisamos testar mudanças no aiDeck antes de publicar.
 * O aideck local pode estar em ../aideck ou em path configurado via --aideck-root.
 *
 * O staging do runtime REUSA o buildShim canônico (src/runtime-layers/aideck.js)
 * — mesmo shim launcher que o instalador escreve. Uma cópia bruta de dist/cli.js
 * NÃO funciona: seus imports relativos (./cli/args.js, ./server/index.js, …)
 * só resolvem dentro da árvore dist/ do pacote; o shim importa cli.js por
 * caminho ABSOLUTO para que o node resolva esses imports no lugar certo.
 */

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { buildShim } from '../src/runtime-layers/aideck.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const NODE_MODULES = join(REPO_ROOT, 'node_modules');
const AIDECK_PACKAGE = join(NODE_MODULES, '@henryavila', 'aideck');
const RUNTIME_BIN = join(homedir(), '.atomic-skills', 'bin', 'aideck.mjs');
const RUNTIME_DASHBOARD = join(homedir(), '.atomic-skills', 'dashboard');

const c = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  bad: (s) => `\x1b[31m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// ── args ────────────────────────────────────────────────────────────────
let aideckRoot = null;
let noBuild = false;
const args = process.argv.slice(2);
const command = args[0];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--aideck-root' && args[i + 1]) {
    aideckRoot = args[i + 1];
  } else if (args[i] === '--no-build') {
    noBuild = true;
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

function resolveAideckSibling() {
  // Procura ../aideck ou ../aiDeck (case variations)
  const candidates = [
    resolve(REPO_ROOT, '..', 'aideck'),
    resolve(REPO_ROOT, '..', 'aiDeck'),
    aideckRoot,
  ].filter(Boolean);

  for (const dir of candidates) {
    if (existsSync(join(dir, 'package.json'))) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        if (pkg.name === '@henryavila/aideck') {
          return dir;
        }
      } catch {
        // continue
      }
    }
  }
  return null;
}

function buildAideck(aideckPath) {
  console.log(`Building aiDeck at ${aideckPath}...`);
  try {
    execSync('npm run build', { cwd: aideckPath, stdio: 'inherit' });
    return true;
  } catch (cause) {
    console.error(c.bad('Build failed:'), cause.message);
    return false;
  }
}

function isSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function getSymlinkTarget(path) {
  // readlinkSync lê o alvo do symlink; readFileSync seguiria o link e falharia
  // (EISDIR em symlink de diretório) — devolvendo sempre null no `status`.
  try {
    return readlinkSync(path);
  } catch {
    return null;
  }
}

/**
 * Restage the runtime artifacts (bin shim + dashboard client) from an aideck
 * build dir into <homeDir>/.atomic-skills/. REUSES the canonical buildShim so
 * the staged bin is byte-identical to the installer's — a raw dist/cli.js copy
 * does NOT work (its relative imports only resolve inside the package's dist/).
 *
 * `homeDir` is a test seam (defaults to the real $HOME); exported so the
 * regression test can stage into a sandbox HOME and EXECUTE the result.
 */
export function restageRuntime(aideckPath, homeDir = homedir()) {
  const runtimeBin = join(homeDir, '.atomic-skills', 'bin', 'aideck.mjs');
  const runtimeDashboard = join(homeDir, '.atomic-skills', 'dashboard');

  // Bin: argv-rewrite launcher shim (mirrors src/install.js + buildShim).
  const binSrc = join(aideckPath, 'dist', 'cli.js');
  if (existsSync(binSrc)) {
    mkdirSync(dirname(runtimeBin), { recursive: true });
    writeFileSync(runtimeBin, buildShim(binSrc));
    console.log(`  ${c.ok('✓')} Staged ${runtimeBin} (shim → ${binSrc})`);
  }

  // Dashboard client: clean first so stale files from a prior build don't
  // linger (mirrors src/install.js: rmSync then cpSync).
  const clientSrc = join(aideckPath, 'dist', 'client');
  if (existsSync(join(clientSrc, 'index.html'))) {
    if (existsSync(runtimeDashboard)) rmSync(runtimeDashboard, { recursive: true, force: true });
    mkdirSync(runtimeDashboard, { recursive: true });
    for (const entry of readdirSync(clientSrc)) {
      cpSync(join(clientSrc, entry), join(runtimeDashboard, entry), { recursive: true });
    }
    console.log(`  ${c.ok('✓')} Staged ${runtimeDashboard}`);
  }
}

function getVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(AIDECK_PACKAGE, 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

function getGitInfo(aideckPath) {
  try {
    const branch = execSync('git branch --show-current', { cwd: aideckPath, encoding: 'utf8' }).trim();
    const commit = execSync('git rev-parse --short HEAD', { cwd: aideckPath, encoding: 'utf8' }).trim();
    return { branch, commit };
  } catch {
    return {};
  }
}

// ── commands ─────────────────────────────────────────────────────────────

async function cmdLink() {
  const sibling = resolveAideckSibling();
  if (!sibling) {
    console.error(c.bad('✗ Cannot find aiDeck sibling'));
    console.error(c.dim('  → Expected ../aideck or use --aideck-root <path>'));
    process.exit(1);
  }

  console.log(`Found aiDeck at: ${sibling}`);

  // Build (skip with --no-build — link an already-built aideck for fast iteration)
  if (!noBuild && !buildAideck(sibling)) {
    process.exit(1);
  }

  // Remove existing (if any)
  if (existsSync(AIDECK_PACKAGE)) {
    if (isSymlink(AIDECK_PACKAGE)) {
      unlinkSync(AIDECK_PACKAGE);
    } else {
      rmSync(AIDECK_PACKAGE, { recursive: true, force: true });
    }
  }

  // Create symlink
  mkdirSync(dirname(AIDECK_PACKAGE), { recursive: true });
  symlinkSync(sibling, AIDECK_PACKAGE);
  console.log(`  ${c.ok('✓')} Symlinked ${AIDECK_PACKAGE} → ${sibling}`);

  // Restage runtime
  restageRuntime(sibling);

  // Report
  const git = getGitInfo(sibling);
  console.log(c.bold('\n✅ aiDeck local linked'));
  console.log(`  Version: ${getVersion()}`);
  console.log(`  Branch: ${git.branch || 'unknown'}`);
  console.log(`  Commit: ${git.commit || 'unknown'}`);
  console.log(c.dim('\nRun: npm run serve'));
}

async function cmdUnlink() {
  if (!existsSync(AIDECK_PACKAGE)) {
    console.warn(c.warn('No @henryavila/aideck installed — nothing to unlink'));
    return;
  }

  // Remove
  if (isSymlink(AIDECK_PACKAGE)) {
    unlinkSync(AIDECK_PACKAGE);
    console.log(`  ${c.ok('✓')} Removed symlink`);
  } else {
    rmSync(AIDECK_PACKAGE, { recursive: true, force: true });
    console.log(`  ${c.ok('✓')} Removed package`);
  }

  // Reinstall from npm
  console.log('Installing @henryavila/aideck from npm...');
  try {
    execSync('npm install @henryavila/aideck', { cwd: REPO_ROOT, stdio: 'inherit' });
  } catch {
    console.error(c.bad('✗ npm install failed'));
    process.exit(1);
  }

  // Restage runtime from published
  restageRuntime(AIDECK_PACKAGE);

  // Report
  console.log(c.bold('\n✅ aiDeck published restored'));
  console.log(`  Version: ${getVersion()}`);
  console.log(c.dim('\nRun: npm run serve'));
}

async function cmdStatus() {
  console.log(c.bold('aiDeck status'));

  if (!existsSync(AIDECK_PACKAGE)) {
    console.log(c.bad('  ✗ Not installed'));
    console.log(c.dim('  → Run: npm install'));
    return;
  }

  const isLink = isSymlink(AIDECK_PACKAGE);
  const version = getVersion();

  console.log(`  Location: ${AIDECK_PACKAGE}`);
  console.log(`  Version: ${version}`);

  if (isLink) {
    const target = getSymlinkTarget(AIDECK_PACKAGE);
    console.log(`  Type: ${c.warn('symlink')} → ${target || '(unknown)'}`);
    if (target && existsSync(target)) {
      const git = getGitInfo(target);
      if (git.branch) {
        console.log(`  Branch: ${git.branch}`);
        console.log(`  Commit: ${git.commit}`);
      }
    }
  } else {
    console.log(`  Type: ${c.ok('npm package')}`);
  }

  // Runtime status
  console.log(c.bold('\nRuntime artifacts:'));
  console.log(`  Bin: ${existsSync(RUNTIME_BIN) ? c.ok('✓ present') : c.bad('✗ missing')}`);
  console.log(`  Dashboard: ${existsSync(RUNTIME_DASHBOARD) ? c.ok('✓ present') : c.bad('✗ missing')}`);
}

// ── main ─────────────────────────────────────────────────────────────────
// Only run the CLI when invoked directly — importing this module (for the
// restageRuntime unit test) must NOT execute the command dispatch. The
// process.argv[1] truthy-check guards REPL/-e/test-runner imports where it is
// undefined (pathToFileURL(undefined) throws ERR_INVALID_ARG_TYPE).
const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
(async () => {
  switch (command) {
    case 'link':
      await cmdLink();
      break;
    case 'unlink':
      await cmdUnlink();
      break;
    case 'status':
      await cmdStatus();
      break;
    default:
      console.log(c.bold('dev-aideck.mjs — aiDeck local development orquestrator'));
      console.log('\nUsage:');
      console.log('  node scripts/dev-aideck.mjs link     — build + symlink aideck local');
      console.log('  node scripts/dev-aideck.mjs unlink   — volta ao pacote npm');
      console.log('  node scripts/dev-aideck.mjs status   — mostra qual build está ativo');
      console.log('\nOptions:');
      console.log('  --aideck-root <path>  — caminho para o repo do aideck');
      console.log('  --no-build            — linka um aideck JÁ buildado (pula npm run build)');
      process.exit(1);
  }
})();
}
