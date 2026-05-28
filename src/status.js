import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { readManifest } from './manifest.js';
import { IDE_CONFIG } from './config.js';
import { resolveProjectScopeTarget } from './scope.js';

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
 * @returns {{manifest: object|null, scope: 'user'|'project', base: string|null}}
 *   The manifest read (or null if not found), the scope it came from, and
 *   the base path it was resolved against. Returned so tests and callers
 *   can verify routing without scraping console output.
 */
export function status(projectDir, options = {}) {
  const homeDir = homedir();
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
  const isUpToDate = manifest.version === pkgVersion;
  const versionStr = isUpToDate
    ? pc.green(`v${manifest.version}`) + ' (up to date)'
    : pc.yellow(`v${manifest.version}`) + ` (package: v${pkgVersion})`;

  p.log.message([
    `${pc.bold('Version:')}  ${versionStr}`,
    `${pc.bold('Scope:')}    ${manifestScope}`,
    `${pc.bold('Language:')} ${manifest.language}`,
    `${pc.bold('Updated:')}  ${manifest.updated_at ? new Date(manifest.updated_at).toLocaleString() : 'unknown'}`,
  ].join('\n'));

  // Per-IDE status
  const allFiles = Object.keys(manifest.files);

  for (const ideId of (manifest.ides || [])) {
    const ideCfg = IDE_CONFIG[ideId];
    if (!ideCfg) continue;

    const displayName = stripIdeSuffix(ideCfg.name);
    const ideDir = ideCfg.dir + '/';
    const ideFiles = allFiles.filter(f => f.startsWith(ideDir) || f.startsWith(ideCfg.dir + '/'));
    const total = ideFiles.length;
    const missing = ideFiles.filter(f => !existsSync(join(manifestBase, f)));

    if (missing.length === 0) {
      p.log.message(pc.green('✓') + ' ' + pc.bold(displayName) + ` — ${total} file${total !== 1 ? 's' : ''}`);
    } else {
      p.log.warn(
        pc.yellow('⚠') + ' ' + pc.bold(displayName) +
        ` — ${total - missing.length}/${total} files present`
      );
      for (const f of missing) {
        p.log.warn('  ' + pc.red('missing:') + ' ' + f);
      }
    }
  }

  // Module status
  const modules = manifest.modules || {};
  const installedMods = Object.entries(modules).filter(([, v]) => v.installed).map(([k]) => k);
  if (installedMods.length > 0) {
    p.log.message(pc.bold('Modules:') + ' ' + installedMods.map(m => pc.cyan(m)).join(', '));
  } else {
    p.log.message(pc.bold('Modules:') + ' none');
  }

  p.outro(pc.bold('Done.'));
  return { manifest, scope: manifestScope, base: manifestBase };
}
