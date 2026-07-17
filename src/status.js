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

function getPackageVersion() {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

function stripIdeSuffix(name) {
  return name.replace(/ \(Skills\)$/, '').replace(/ \(Commands\)$/, '');
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
  const doVerify = options.verify !== false;
  let manifest;
  let manifestScope;
  let manifestBase;

  if (options.forceProject) {
    const target = projectDir ? resolveProjectScopeTarget(projectDir) : null;
    const projectBase = target?.ok ? target.path : projectDir;
    manifest = projectBase ? readManifest(projectBase) : null;
    manifestScope = 'project';
    manifestBase = projectBase;
  } else {
    // Default: check user-scope first, fall back to project.
    manifest = readManifest(homeDir);
    manifestScope = 'user';
    manifestBase = homeDir;

    if (!manifest && projectDir) {
      manifest = readManifest(projectDir);
      manifestScope = 'project';
      manifestBase = projectDir;
    }
  }

  p.intro(pc.bold(pc.cyan('⚛ Atomic Skills — Status')));

  if (!manifest) {
    p.log.error(pc.red('Not installed') + ' — no manifest found.');
    p.log.message('Run ' + pc.bold('npx atomic-skills') + ' to install.');
    p.outro('');
    return { manifest: null, scope: manifestScope, base: manifestBase };
  }

  const pkgVersion = getPackageVersion();
  const verification = doVerify && manifestBase
    ? verifyInstall(manifestBase, manifest, { packageVersion: pkgVersion })
    : null;

  // Never claim up-to-date from semver alone when hash verification fails.
  const isUpToDate = verification
    ? verification.upToDate
    : manifest.version === pkgVersion;
  const versionStr = isUpToDate
    ? pc.green(`v${manifest.version}`) + ' (up to date)'
    : pc.yellow(`v${manifest.version}`)
      + (manifest.version === pkgVersion
        ? ' (hash drift — not up to date)'
        : ` (package: v${pkgVersion})`);

  p.log.message([
    `${pc.bold('Version:')}  ${versionStr}`,
    `${pc.bold('Scope:')}    ${manifestScope}`,
    `${pc.bold('Language:')} ${manifest.language}`,
    `${pc.bold('Updated:')}  ${manifest.updated_at ? new Date(manifest.updated_at).toLocaleString() : 'unknown'}`,
  ].join('\n'));

  if (verification) {
    const counts = verification.counts || summarizeVerification(verification);
    const driftBits = [];
    for (const key of ['missing', 'modified', 'stale', 'preserved', 'conflict']) {
      if (counts[key] > 0) driftBits.push(`${counts[key]} ${key}`);
    }
    if (driftBits.length > 0) {
      p.log.warn(pc.yellow('Verify:') + ' ' + driftBits.join(', '));
      for (const f of verification.files) {
        if (f.state === 'unchanged' || f.state === 'updated') continue;
        p.log.warn(`  ${pc.red(f.state + ':')} ${f.path}`);
      }
    } else {
      p.log.message(pc.green('Verify:') + ` ${counts.unchanged} unchanged`);
    }
  }

  // Per-IDE status (presence + hash when verified)
  const allFiles = Object.keys(manifest.files || {});
  const verifyByPath = new Map((verification?.files || []).map((f) => [f.path, f]));

  for (const ideId of (manifest.ides || [])) {
    const ideCfg = IDE_CONFIG[ideId];
    if (!ideCfg) continue;

    const displayName = stripIdeSuffix(ideCfg.name);
    const ideDir = ideCfg.dir + '/';
    // Include sibling assets (outside ide.dir) when path is under the IDE parent tree
    // for this host — e.g. .claude/atomic-skills/_assets/… for claude-code.
    const ideFiles = allFiles.filter((f) => {
      if (f.startsWith(ideDir) || f.startsWith(ideCfg.dir + '/')) return true;
      // Assets live as siblings of the scanned skill tree (see getAssetsDir).
      if (ideId === 'claude-code' && f.startsWith('.claude/')) return true;
      if (ideId === 'cursor' && f.startsWith('.cursor/')) return true;
      if (ideId === 'codex' && f.startsWith('.agents/')) return true;
      if ((ideId === 'gemini' || ideId === 'gemini-commands') && f.startsWith('.gemini/')) return true;
      if (ideId === 'opencode' && f.startsWith('.opencode/')) return true;
      if (ideId === 'github-copilot' && f.startsWith('.github/')) return true;
      if (ideId === 'grok' && f.startsWith('.grok/')) return true;
      return false;
    });
    const total = ideFiles.length;
    const missing = ideFiles.filter((f) => !existsSync(join(manifestBase, f)));
    const bad = ideFiles.filter((f) => {
      const v = verifyByPath.get(f);
      return v && v.state !== 'unchanged' && v.state !== 'updated';
    });

    if (missing.length === 0 && bad.length === 0) {
      p.log.message(pc.green('✓') + ' ' + pc.bold(displayName) + ` — ${total} file${total !== 1 ? 's' : ''}`);
    } else {
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
  }

  // Runtime registry observation (read-only; F2/T-004)
  let runtime = null;
  try {
    runtime = observeRuntimeRegistry({ homeDir, packageRoot: PACKAGE_ROOT });
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
  } catch {
    /* observation is best-effort; never fail status */
  }

  p.outro(pc.bold('Done.'));
  return {
    manifest,
    scope: manifestScope,
    base: manifestBase,
    verification: verification || undefined,
    runtime: runtime || undefined,
  };
}
