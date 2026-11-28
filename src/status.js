import { installedGlobalInstructionPaths } from './global-instructions.js';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { readManifest } from './manifest.js';
import { IDE_CONFIG } from './config.js';
import { resolveProjectScopeTarget } from './scope.js';
import { verifyInstall, summarizeVerification } from './status-verify.js';
import { observeRuntimeRegistry } from './runtime-observe.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

const SIBLING_PREFIXES = {
  'claude-code': '.claude/',
  cursor: '.cursor/',
  codex: '.agents/',
  antigravity: '.agent/',
  opencode: '.opencode/',
  'github-copilot': '.github/',
  grok: '.grok/',
};

function getPackageVersion() {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

function stripIdeSuffix(name) {
  return name.replace(/ \(Skills\)$/, '').replace(/ \(Commands\)$/, '');
}

function resolveStatusManifest(projectDir, options, homeDir) {
  if (options.forceProject) {
    const target = projectDir ? resolveProjectScopeTarget(projectDir) : null;
    const projectBase = target?.ok ? target.path : projectDir;
    return {
      manifest: projectBase ? readManifest(projectBase) : null,
      scope: 'project',
      base: projectBase,
    };
  }

  // Default: check user-scope first, fall back to project.
  const userManifest = readManifest(homeDir);
  if (userManifest) return { manifest: userManifest, scope: 'user', base: homeDir };

  const projectManifest = projectDir ? readManifest(projectDir) : null;
  if (projectManifest) return { manifest: projectManifest, scope: 'project', base: projectDir };
  return { manifest: null, scope: 'user', base: homeDir };
}

function renderStatusIntro(scope, homeDir) {
  p.intro(pc.bold(pc.cyan('⚛ Atomic Skills — Status')));

  if (scope === 'user') {
    const paths = installedGlobalInstructionPaths(homeDir);
    p.log.message(`Global instructions: ${paths.length ? paths.join(', ') : 'not installed'}`);
  }
}

function reportNotInstalled(scope, base) {
  p.log.error(pc.red('Not installed') + ' — no manifest found.');
  p.log.message('Run ' + pc.bold('npx atomic-skills') + ' to install.');
  p.outro('');
  return { manifest: null, scope, base };
}

function describeVersion(manifest, pkgVersion, verification) {
  // Never claim up-to-date from semver alone when hash verification fails.
  const isUpToDate = verification
    ? verification.upToDate
    : manifest.version === pkgVersion;
  if (isUpToDate) return pc.green(`v${manifest.version}`) + ' (up to date)';

  const drift = manifest.version === pkgVersion
    ? ' (hash drift — not up to date)'
    : ` (package: v${pkgVersion})`;
  return pc.yellow(`v${manifest.version}`) + drift;
}

function renderManifestBlock(manifest, scope, pkgVersion, verification) {
  const versionStr = describeVersion(manifest, pkgVersion, verification);
  p.log.message([
    `${pc.bold('Version:')}  ${versionStr}`,
    `${pc.bold('Scope:')}    ${scope}`,
    `${pc.bold('Language:')} ${manifest.language}`,
    `${pc.bold('Updated:')}  ${manifest.updated_at ? new Date(manifest.updated_at).toLocaleString() : 'unknown'}`,
  ].join('\n'));
}

function driftedCounts(counts) {
  const driftBits = [];
  for (const key of ['missing', 'modified', 'stale', 'preserved', 'conflict']) {
    if (counts[key] > 0) driftBits.push(`${counts[key]} ${key}`);
  }
  return driftBits;
}

function renderVerification(verification) {
  if (!verification) return;

  const counts = verification.counts || summarizeVerification(verification);
  const driftBits = driftedCounts(counts);
  if (driftBits.length === 0) {
    p.log.message(pc.green('Verify:') + ` ${counts.unchanged} unchanged`);
    return;
  }

  p.log.warn(pc.yellow('Verify:') + ' ' + driftBits.join(', '));
  for (const f of verification.files) {
    if (f.state === 'unchanged' || f.state === 'updated') continue;
    p.log.warn(`  ${pc.red(f.state + ':')} ${f.path}`);
  }
}

function ideFilesFor(allFiles, ideId, ideCfg) {
  const ideDir = ideCfg.dir + '/';
  const siblingPrefix = SIBLING_PREFIXES[ideId];
  return allFiles.filter((f) => {
    if (f.startsWith(ideDir)) return true;
    return siblingPrefix !== undefined && f.startsWith(siblingPrefix);
  });
}

function renderIdeSection(ideId, ideCfg, ctx) {
  const { allFiles, verifyByPath, base } = ctx;
  const displayName = stripIdeSuffix(ideCfg.name);
  const ideFiles = ideFilesFor(allFiles, ideId, ideCfg);
  const total = ideFiles.length;
  const missing = ideFiles.filter((f) => !existsSync(join(base, f)));
  const bad = ideFiles.filter((f) => {
    const v = verifyByPath.get(f);
    return v && v.state !== 'unchanged' && v.state !== 'updated';
  });

  if (missing.length === 0 && bad.length === 0) {
    p.log.message(pc.green('✓') + ' ' + pc.bold(displayName) + ` — ${total} file${total !== 1 ? 's' : ''}`);
    return;
  }

  p.log.warn(
    pc.yellow('⚠') + ' ' + pc.bold(displayName)
    + ` — ${total - missing.length - (bad.length - missing.filter((m) => bad.includes(m)).length)}/${total} clean`,
  );
  for (const f of missing) {
    p.log.warn('  ' + pc.red('missing:') + ' ' + f);
  }
  for (const f of bad) {
    if (missing.includes(f)) continue;
    const v = verifyByPath.get(f);
    p.log.warn('  ' + pc.red((v?.state || 'modified') + ':') + ' ' + f);
  }
}

function renderIdeSections(manifest, base, verification) {
  const allFiles = Object.keys(manifest.files || {});
  const verifyByPath = new Map((verification?.files || []).map((f) => [f.path, f]));

  for (const ideId of (manifest.ides || [])) {
    const ideCfg = IDE_CONFIG[ideId];
    if (!ideCfg) continue;
    renderIdeSection(ideId, ideCfg, { allFiles, verifyByPath, base });
  }
}

function observeStatusRuntime(homeDir) {
  try {
    return observeRuntimeRegistry({ homeDir, packageRoot: PACKAGE_ROOT });
  } catch {
    /* observation is best-effort; never fail status */
    return null;
  }
}

function renderRuntime(runtime) {
  if (!runtime) return;

  if (runtime.corruption) {
    p.log.error(pc.red('Runtime registry:') + ' corrupted — ' + runtime.corruption);
  } else if (runtime.selectedOwner) {
    p.log.message(
      pc.bold('Runtime owner:') + ' '
      + runtime.selectedOwner.basePath
      + (runtime.selectedOwner.fingerprint ? ` (fp ${runtime.selectedOwner.fingerprint.slice(0, 8)}…)` : ''),
    );
  } else if (runtime.owners.length === 0) {
    p.log.warn(pc.yellow('Runtime owners:') + ' none registered');
  }
  if (runtime.ghosts?.length) {
    p.log.warn(pc.yellow('Ghost owners:') + ` ${runtime.ghosts.length}`);
  }
  if (runtime.runtimeMismatch) {
    p.log.warn(pc.yellow('Runtime mismatch:') + ' ' + runtime.runtimeMismatch);
  }
}

/**
 * @param {string} projectDir - cwd from caller
 * @param {object} [options]
 * @param {boolean} [options.forceProject] - when true, read project manifest
 *   (./.atomic-skills/manifest.json) instead of falling back to user scope.
 *   Mirrors the `--project` flag on install/detect/uninstall.
 * @param {boolean} [options.verify=true] - hash-verify all manifest paths
 * @returns {{
 *   manifest: object|null,
 *   scope: 'user'|'project',
 *   base: string|null,
 *   verification?: object,
 *   runtime?: object,
 * }}
 */
export function status(projectDir, options = {}) {
  const homeDir = homedir();
  const { manifest, scope, base } = resolveStatusManifest(projectDir, options, homeDir);

  renderStatusIntro(scope, homeDir);

  if (!manifest) return reportNotInstalled(scope, base);

  const pkgVersion = getPackageVersion();
  const verification = options.verify !== false && base
    ? verifyInstall(base, manifest, { packageVersion: pkgVersion })
    : null;

  renderManifestBlock(manifest, scope, pkgVersion, verification);
  renderVerification(verification);
  renderIdeSections(manifest, base, verification);

  // Runtime registry observation (read-only; F2/T-004)
  const runtime = observeStatusRuntime(homeDir);
  renderRuntime(runtime);

  p.outro(pc.bold('Done.'));
  return {
    manifest,
    scope,
    base,
    verification: verification || undefined,
    runtime: runtime || undefined,
  };
}
