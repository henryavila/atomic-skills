import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync, rmSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, symlinkSync, chmodSync, lstatSync, unlinkSync,
} from 'node:fs';
import { rename } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { install } from '../src/install.js';
import { installedGlobalInstructionPaths, globalInstructionBody, globalInstructionsDecision } from '../src/global-instructions.js';
import { msg } from '../src/ui.js';
import { uninstall } from '../src/uninstall.js';
import { isolateHomedir, assertIsolatedHomedir } from './helpers/isolate-homedir.js';
import { quietTestStdout } from './helpers/quiet-test-stdout.js';

// install() and uninstall() print strings to stdout in this process; the
// reporter's stdout carries Buffer events, so keep the two apart.
quietTestStdout();

// `new URL(...).pathname` yields `/D:/a/...` on Windows, which Node then tries
// to resolve as `C:\D:\a\...`. fileURLToPath gives the platform path.
const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

// Fault injection at the actual no-follow read boundary, independent of uid and OS ACLs.
function instructionReadFailure(repo, file, code) {
  const preload = join(repo, 'instruction-read-failure.cjs');
  writeFileSync(preload, `const fs = require('node:fs');
const target = fs.statSync(${JSON.stringify(file)});
const read = fs.readSync;
fs.readSync = function(fd, ...args) {
  const st = fs.fstatSync(fd);
  if (st.dev === target.dev && st.ino === target.ino) {
    throw Object.assign(new Error('injected instruction read failure'), { code: ${JSON.stringify(code)} });
  }
  return read.call(this, fd, ...args);
};
require('node:module').syncBuiltinESMExports();
`);
  return preload;
}

function withHome(fakeHome, fn) {
  const restoreHome = isolateHomedir(fakeHome);
  const originalSkip = process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
  // Hermetic: real `grok` under a fake HOME seeds host docs/registry residue
  // that breaks content-aware roundtrip snapshots.
  process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = '1';
  return Promise.resolve().then(() => {
    assertIsolatedHomedir(fakeHome);
    return fn();
  }).finally(() => {
    restoreHome();
    if (originalSkip === undefined) delete process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
    else process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = originalSkip;
  });
}

/**
 * Content-aware snapshot: Map of root-relative path → 'dir' for directories,
 * or a sha256 of file contents for files. Skips `.git`. Empty when root missing.
 */
function snapshotTree(root) {
  const out = new Map();
  (function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === '.git') continue;
      const abs = join(dir, e.name);
      const rel = relative(root, abs);
      if (e.isDirectory()) { out.set(rel, 'dir'); walk(abs); }
      else { out.set(rel, createHash('sha256').update(readFileSync(abs)).digest('hex')); }
    }
  })(root);
  return out;
}

/** Three-way diff: paths added, removed, or whose hash changed. */
function diffTree(before, after) {
  const added = [], removed = [], modified = [];
  for (const [p, h] of after) {
    if (!before.has(p)) added.push(p);
    else if (before.get(p) !== h) modified.push(p);
  }
  for (const p of before.keys()) if (!after.has(p)) removed.push(p);
  return { added: added.sort(), removed: removed.sort(), modified: modified.sort() };
}

function sessionStartCommands(settingsPath) {
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  return (settings.hooks?.SessionStart ?? [])
    .flatMap((entry) => (entry.hooks ?? []).map((hook) => hook.command))
    .filter((command) => typeof command === 'string');
}

/** Match version-check commands whether shell-quoted or raw paths. */
function isVersionCheckCommand(command, absPath = null) {
  if (typeof command !== 'string') return false;
  const unquoted = command.replace(/^'|'$/g, '').replace(/'\\''/g, "'");
  if (absPath && (command === absPath || unquoted === absPath || command === `'${absPath}'`)) {
    return true;
  }
  return /version-check\.sh'?$/.test(command) || unquoted.endsWith('version-check.sh');
}

function countVersionCheckHooks(commands) {
  return commands.filter((command) => isVersionCheckCommand(command)).length;
}

describe('install→uninstall round-trip', () => {
  it('user scope returns $HOME to its pre-install state (no residue)', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        const before = snapshotTree(fakeHome);
        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });
        await uninstall(projectDir, { scope: 'user', yes: true });
        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(added, [], `residue after user uninstall: ${added.join(', ')}`);
        assert.deepEqual(removed, [], `user uninstall deleted pre-existing paths: ${removed.join(', ')}`);
        assert.deepEqual(modified, [], `user uninstall modified pre-existing files: ${modified.join(', ')}`);
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('R08 --global-instructions content-aware snapshot roundtrip across four files', async () => {
    const home = mkdtempSync(join(tmpdir(), 'as-global-snapshot-'));
    const repo = mkdtempSync(join(tmpdir(), 'as-global-repo-'));
    try {
      await withHome(home, async () => {
        const paths = ['.claude/CLAUDE.md', '.codex/AGENTS.md', '.config/opencode/AGENTS.md', '.gemini/GEMINI.md'];
        for (const path of paths) {
          mkdirSync(join(home, path, '..'), { recursive: true });
          writeFileSync(join(home, path), 'user text\r\nwithout final newline');
        }
        const before = snapshotTree(home);
        execFileSync(process.execPath, [CLI,
          'install', '--yes', '--ide', 'claude-code,codex,opencode,antigravity', '--global-instructions'],
        { cwd: repo, env: process.env });
        // Guard the mutation: a clean round-trip of skipped writes proves nothing.
        for (const path of paths) {
          assert.ok(
            readFileSync(join(home, path), 'utf8').includes('<!-- BEGIN atomic-skills:delegate -->'),
            `${path} must carry the managed block after install`,
          );
        }
        await uninstall(repo, { scope: 'user', yes: true });
        assert.deepEqual(diffTree(before, snapshotTree(home)), { added: [], removed: [], modified: [] });
      });
    } finally { rmSync(home, { recursive: true, force: true }); rmSync(repo, { recursive: true, force: true }); }
  });

  it('user scope reverts EVERY item across ALL public IDEs (no residue)', async () => {
    // Each IDE writes to a different path tree (.claude, .cursor, .agent,
    // .codex/.agents, .opencode, .github, .grok). Installing all of them at once is
    // the strongest parity proof: ~300+ files, and every one must be reverted.
    const ALL_IDES = ['claude-code', 'cursor', 'antigravity', 'codex', 'opencode', 'github-copilot', 'grok'];
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        const before = snapshotTree(fakeHome);
        await install(projectDir, { yes: true, ide: ALL_IDES, lang: 'en' });
        await uninstall(projectDir, { scope: 'user', yes: true });
        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(added, [], `items left without a reversal: ${added.join(', ')}`);
        assert.deepEqual(removed, [], `uninstall deleted pre-existing paths: ${removed.join(', ')}`);
        assert.deepEqual(modified, [], `uninstall modified pre-existing files: ${modified.join(', ')}`);
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('user scope preserves a pre-existing settings.json', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        const settingsPath = join(fakeHome, '.claude', 'settings.json');
        mkdirSync(join(settingsPath, '..'), { recursive: true });
        writeFileSync(settingsPath, JSON.stringify({}, null, 2) + '\n'); // canonical {}
        const before = snapshotTree(fakeHome);
        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });
        await uninstall(projectDir, { scope: 'user', yes: true });
        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(removed, [], `must not delete the user's pre-existing files: ${removed.join(', ')}`);
        assert.deepEqual(added, [], `residue after uninstall: ${added.join(', ')}`);
        assert.deepEqual(modified, [], `must restore settings.json byte-for-byte: ${modified.join(', ')}`);
        assert.ok(existsSync(settingsPath), 'pre-existing settings.json survives');
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('user-scope grok install writes plugin package only (no .grok/skills tree)', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        const before = snapshotTree(fakeHome);
        await install(projectDir, { yes: true, ide: ['grok'], lang: 'en' });

        const pluginJson = join(fakeHome, '.grok/plugins/atomic-skills/plugin.json');
        const skillMd = join(fakeHome, '.grok/plugins/atomic-skills/skills/fix/SKILL.md');
        const hooksJson = join(fakeHome, '.grok/plugins/atomic-skills/hooks/hooks.json');
        assert.ok(existsSync(pluginJson), 'plugin.json must exist under plugin root');
        assert.ok(existsSync(skillMd), 'at least one SKILL.md under plugin skills/');
        assert.ok(existsSync(hooksJson), 'hooks/hooks.json stub must exist');

        const plugin = JSON.parse(readFileSync(pluginJson, 'utf8'));
        assert.equal(plugin.name, 'atomic-skills');
        assert.ok(plugin.version, 'plugin.json must carry package version');
        assert.equal(plugin.skills, './skills/');

        // Forbidden dual tree: package must not own skill files under .grok/skills/
        const dualSkillsRoot = join(fakeHome, '.grok/skills/atomic-skills');
        assert.ok(
          !existsSync(dualSkillsRoot),
          'must not create .grok/skills/atomic-skills dual tree',
        );

        // Auto-update SessionStart on Grok surface (D3) — not Claude settings.
        const versionCheck = join(fakeHome, '.atomic-skills/hooks/version-check.sh');
        const grokAutoUpdate = join(fakeHome, '.grok/hooks/atomic-skills-auto-update.json');
        assert.ok(existsSync(versionCheck), 'version-check.sh staged for auto-update');
        assert.ok(existsSync(grokAutoUpdate), 'Grok auto-update hook file must exist');
        assert.ok(
          !existsSync(join(fakeHome, '.claude/settings.json')),
          'grok-only install must not create .claude/settings.json',
        );
        const autoUpdate = JSON.parse(readFileSync(grokAutoUpdate, 'utf8'));
        assert.ok(autoUpdate.hooks?.SessionStart?.length >= 1, 'SessionStart registered');
        assert.equal(
          autoUpdate.hooks.SessionStart[0].matcher,
          undefined,
          'Grok SessionStart must not set matcher',
        );
        assert.equal(autoUpdate.hooks.PreToolUse, undefined, 'auto-update must not ship Soft PreToolUse');
        assert.equal(autoUpdate.hooks.Stop, undefined, 'auto-update must not ship Strict Stop');

        await uninstall(projectDir, { scope: 'user', yes: true });
        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(added, [], `residue after grok uninstall: ${added.join(', ')}`);
        assert.deepEqual(removed, [], `grok uninstall deleted pre-existing paths: ${removed.join(', ')}`);
        assert.deepEqual(modified, [], `grok uninstall modified pre-existing files: ${modified.join(', ')}`);
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('user-scope claude+grok install registers both auto-update surfaces and uninstalls cleanly', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        const before = snapshotTree(fakeHome);
        await install(projectDir, { yes: true, ide: ['claude-code', 'grok'], lang: 'en' });

        const versionCheck = join(fakeHome, '.atomic-skills/hooks/version-check.sh');
        const claudeSettings = join(fakeHome, '.claude/settings.json');
        const grokAutoUpdate = join(fakeHome, '.grok/hooks/atomic-skills-auto-update.json');
        assert.ok(existsSync(versionCheck));
        assert.ok(existsSync(claudeSettings), 'Claude auto-update registration present');
        assert.ok(existsSync(grokAutoUpdate), 'Grok auto-update registration present');

        // Hosts resolve `command` as a path (Grok joins non-absolute to the hook
        // JSON dir). Must be the raw absolute path — never shell-quoted.
        const claude = JSON.parse(readFileSync(claudeSettings, 'utf8'));
        const claudeCmds = (claude.hooks?.SessionStart || []).flatMap((e) => e.hooks || []);
        assert.ok(
          claudeCmds.some((h) => h.command === versionCheck),
          'Claude SessionStart must register raw absolute version-check path (no shell quotes)',
        );
        assert.equal(
          claudeCmds.filter((h) => isVersionCheckCommand(h.command, versionCheck)).length,
          1,
          'exactly one Claude version-check SessionStart entry',
        );

        const grok = JSON.parse(readFileSync(grokAutoUpdate, 'utf8'));
        const grokCmds = (grok.hooks?.SessionStart || []).flatMap((e) => e.hooks || []);
        assert.ok(
          grokCmds.some((h) => h.command === versionCheck),
          'Grok SessionStart must register raw absolute version-check path (no shell quotes)',
        );
        assert.equal(
          grokCmds.filter((h) => isVersionCheckCommand(h.command, versionCheck)).length,
          1,
          'exactly one Grok version-check SessionStart entry',
        );

        await uninstall(projectDir, { scope: 'user', yes: true });
        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(added, [], `residue after dual-ides uninstall: ${added.join(', ')}`);
        assert.deepEqual(removed, [], `dual-ides uninstall deleted pre-existing: ${removed.join(', ')}`);
        assert.deepEqual(modified, [], `dual-ides uninstall modified pre-existing: ${modified.join(', ')}`);
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('project scope returns the repo to baseline with .gitignore left untouched', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const repo = mkdtempSync(join(tmpdir(), 'as-rt-repo-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: repo });
      const gitignorePath = join(repo, '.gitignore');
      const gitignoreBefore = 'node_modules/\ndist/\n';
      writeFileSync(gitignorePath, gitignoreBefore);
      await withHome(fakeHome, async () => {
        const before = snapshotTree(repo);
        await install(repo, { yes: true, project: true, ide: ['claude-code'], lang: 'en' });
        await uninstall(repo, { scope: 'project', yes: true });
        const { added, removed, modified } = diffTree(before, snapshotTree(repo));
        assert.deepEqual(added, [], `unexpected new files in repo: ${added.join(', ')}`);
        assert.deepEqual(removed, [], `uninstall deleted pre-existing repo files: ${removed.join(', ')}`);
        // The installer no longer appends a .atomic-skills/ ignore line, so the
        // repo must return to baseline with NOTHING modified — not even .gitignore.
        assert.deepEqual(modified, [], `nothing may change, incl. .gitignore: ${modified.join(', ')}`);
        assert.equal(
          readFileSync(gitignorePath, 'utf8'),
          gitignoreBefore,
          '.gitignore must be byte-identical to its pre-install content',
        );
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('project-scope install ships surviving skills and not the removed plan or implement skills', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const repo = mkdtempSync(join(tmpdir(), 'as-rt-repo-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: repo });
      await withHome(fakeHome, async () => {
        await install(repo, { yes: true, project: true, ide: ['claude-code'], lang: 'en' });

        const stateRoot = join(repo, '.atomic-skills');
        assert.ok(existsSync(join(stateRoot, 'manifest.json')), 'installer ledger exists');
        assert.ok(existsSync(join(stateRoot, 'hooks', 'version-check.sh')), 'installer hook exists');
        assert.equal(existsSync(join(stateRoot, 'PROJECT-STATUS.md')), false);
        assert.equal(existsSync(join(stateRoot, 'projects')), false);

        const commands = join(repo, '.claude', 'commands', 'atomic-skills');
        assert.ok(existsSync(join(commands, 'fix.md')));
        assert.ok(existsSync(join(commands, 'review-plan.md')));
        assert.ok(existsSync(join(commands, 'verify-claim.md')));
        assert.equal(existsSync(join(commands, 'project.md')), false);
        assert.equal(existsSync(join(commands, 'implement.md')), false);

        await uninstall(repo, { scope: 'project', yes: true });
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('project install→uninstall preserves canonical and legacy lifecycle state byte-for-byte', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const repo = mkdtempSync(join(tmpdir(), 'as-rt-repo-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: repo });
      const stateRoot = join(repo, '.atomic-skills');
      mkdirSync(join(stateRoot, 'plans'), { recursive: true });
      mkdirSync(join(stateRoot, 'initiatives'), { recursive: true });
      writeFileSync(
        join(stateRoot, 'PROJECT-STATUS.md'),
        "---\nschemaVersion: '0.1'\n---\n\n# Project Status Index\n",
      );
      writeFileSync(join(stateRoot, 'plans', 'legacy.md'), 'legacy plan bytes\n');
      writeFileSync(join(stateRoot, 'initiatives', 'legacy.md'), 'legacy initiative bytes\n');
      const before = snapshotTree(repo);

      await withHome(fakeHome, async () => {
        await install(repo, { yes: true, project: true, ide: ['claude-code'], lang: 'en' });
        await uninstall(repo, { scope: 'project', yes: true });
      });

      const { added, removed, modified } = diffTree(before, snapshotTree(repo));
      assert.deepEqual(added, [], `installer residue: ${added.join(', ')}`);
      assert.deepEqual(removed, [], `lifecycle state deleted: ${removed.join(', ')}`);
      assert.deepEqual(modified, [], `lifecycle state modified: ${modified.join(', ')}`);
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });

  // ─── Adversarial data-safety matrix (F1 T-004) ───
  // These three fixtures lock in the data-safety contract the installer MUST
  // satisfy — proving the round-trip is not just "clean install/uninstall" but
  // survives the cases that destroy user data when reversal is naive. They
  // exercise the CURRENT installer (the kernel effects are wired in at F3); each
  // is the parity contract F3's rewire onto json-merge / refcount / legacy-prune
  // must keep green.

  it('preserves a pre-existing THIRD-PARTY SessionStart hook across install→UPDATE→uninstall', async () => {
    // json-merge data-safety: revert subtracts ONLY the entry the installer
    // merged, never a snapshot — a hook the user already had must survive.
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        const settingsPath = join(fakeHome, '.claude', 'settings.json');
        mkdirSync(join(settingsPath, '..'), { recursive: true });
        const thirdPartyCmd = '/opt/other-tool/on-start.sh';
        const preExisting = {
          hooks: {
            SessionStart: [
              { matcher: '*', hooks: [{ type: 'command', command: thirdPartyCmd }] },
            ],
          },
        };
        writeFileSync(settingsPath, JSON.stringify(preExisting, null, 2) + '\n');
        const before = snapshotTree(fakeHome);

        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });

        const mergedCmds = sessionStartCommands(settingsPath);
        assert.ok(mergedCmds.includes(thirdPartyCmd), 'third-party hook present after install');
        assert.equal(
          countVersionCheckHooks(mergedCmds), 1,
          'installer merged exactly one of its own hooks alongside the third party',
        );

        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' }); // UPDATE

        const updatedCmds = sessionStartCommands(settingsPath);
        assert.ok(updatedCmds.includes(thirdPartyCmd), 'third-party hook present after update');
        assert.equal(
          countVersionCheckHooks(updatedCmds), 1,
          'update keeps a single Atomic Skills hook entry',
        );

        await uninstall(projectDir, { scope: 'user', yes: true });

        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(removed, [], `uninstall deleted user files: ${removed.join(', ')}`);
        assert.deepEqual(added, [], `residue after uninstall: ${added.join(', ')}`);
        assert.deepEqual(modified, [], `settings.json must return byte-for-byte: ${modified.join(', ')}`);
        const afterCmds = sessionStartCommands(settingsPath);
        assert.ok(afterCmds.includes(thirdPartyCmd), 'third-party hook survives uninstall');
        assert.equal(
          countVersionCheckHooks(afterCmds), 0,
          'installer hook removed on uninstall (only the delta subtracted)',
        );
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('refcounts a shared install registry across two owners and heals a crash-retry duplicate', async () => {
    // refcount data-safety: the shared runtime registry (~/.atomic-skills/
    // installs.json) is reclaimed ONLY when the LAST owner leaves; one
    // uninstall of two must NOT orphan the other. The crash window the design
    // calls out (a crashed uninstall-retry that double-appended an owner) is
    // healed because unregisterInstall filters ALL matching entries.
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const repo = mkdtempSync(join(tmpdir(), 'as-rt-repo-'));
    const userProj = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: repo });
      await withHome(fakeHome, async () => {
        const before = snapshotTree(fakeHome);
        const installsJson = join(fakeHome, '.atomic-skills', 'installs.json');

        // Owner A (user scope, basePath = $HOME) and owner B (project scope,
        // basePath = repo) both register in the shared $HOME registry.
        await install(userProj, { yes: true, ide: ['claude-code'], lang: 'en' });
        await install(repo, { yes: true, project: true, ide: ['claude-code'], lang: 'en' });
        assert.ok(existsSync(installsJson), 'shared install registry created');
        {
          // P1-B: versioned schema { schemaVersion, owners:[{basePath,...}] }
          const reg = JSON.parse(readFileSync(installsJson, 'utf8'));
          const owners = Array.isArray(reg) ? reg : (reg.owners || []);
          assert.equal(owners.length, 2, 'both owners registered');
        }

        // Uninstall owner B: the shared registry must persist (owner A remains).
        await uninstall(repo, { scope: 'project', yes: true });
        assert.ok(existsSync(installsJson), 'registry persists while one owner remains');
        const remainingReg = JSON.parse(readFileSync(installsJson, 'utf8'));
        const remainingOwners = Array.isArray(remainingReg)
          ? remainingReg.map((b) => (typeof b === 'string' ? { basePath: b } : b))
          : (remainingReg.owners || []);
        assert.equal(remainingOwners.length, 1, 'one owner remains after first uninstall');

        // CRASH SIMULATION: a crashed uninstall-retry left a DUPLICATE owner-A
        // entry in the registry. The filter-based unregister must still reach 0.
        writeFileSync(
          installsJson,
          JSON.stringify({
            schemaVersion: remainingReg.schemaVersion || '1',
            owners: [...remainingOwners, ...remainingOwners],
          }, null, 2) + '\n',
        );

        // Uninstall owner A: count -> 0 -> registry + shared runtime reclaimed.
        await uninstall(userProj, { scope: 'user', yes: true });

        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(added, [], `residue after last owner left: ${added.join(', ')}`);
        assert.deepEqual(removed, [], `deleted pre-existing paths: ${removed.join(', ')}`);
        assert.deepEqual(modified, [], `modified pre-existing files: ${modified.join(', ')}`);
        assert.ok(
          !existsSync(installsJson),
          'registry removed when last owner leaves, crash-retry duplicate healed',
        );
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
      rmSync(userProj, { recursive: true, force: true });
    }
  });

  it('preserves an UNSIGNED user file at a legacy namespace path (P3: no proof, no delete)', async () => {
    // legacy-prune data-safety: a file at a legacy path WITHOUT the consumer's
    // frontmatter signature is presumed user-owned and is never deleted — the
    // safelist is the only accepted ownership proof for legacy paths.
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        // .claude/skills/<ns> is a LEGACY_NAMESPACE_PATH the installer scans for
        // orphan cleanup. This file's `name:` is NOT in the catalog or the
        // historical safelist, so it must be classified user-owned and preserved.
        const legacyFile = join(fakeHome, '.claude', 'skills', 'atomic-skills', 'my-notes.md');
        const legacyContent = '---\nname: my-personal-notes\n---\n\nMy own stuff.\n';
        mkdirSync(join(legacyFile, '..'), { recursive: true });
        writeFileSync(legacyFile, legacyContent);
        const before = snapshotTree(fakeHome);

        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });
        await uninstall(projectDir, { scope: 'user', yes: true });

        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(removed, [], `must not delete the unsigned user file: ${removed.join(', ')}`);
        assert.deepEqual(added, [], `residue after uninstall: ${added.join(', ')}`);
        assert.deepEqual(modified, [], `must not modify user files: ${modified.join(', ')}`);
        assert.ok(existsSync(legacyFile), 'unsigned legacy user file survives the round-trip');
        assert.equal(
          readFileSync(legacyFile, 'utf8'), legacyContent,
          'unsigned legacy file is byte-identical',
        );
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  // ─── Update-path parity (F3 review CRITICAL A) ───
  // The single-install round-trip is necessary but NOT sufficient: the NORMAL
  // upgrade path (a second install before uninstall) is where the runtime-layer
  // effects lose ownership. stageRuntimeArtifacts.apply only records `created`
  // for paths that did not exist before THIS apply, and jsonMerge only records
  // the entries it inserts THIS apply — so on the second install both record an
  // empty before-state, and uninstall (replaying only the latest journal) leaves
  // the hook script + the SessionStart settings entry behind. The fix threads the
  // prior before-state (`previous`) so an update re-records what it owns.
  it('user scope returns to baseline after install→UPDATE→uninstall (no residue)', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        const before = snapshotTree(fakeHome);
        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });
        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' }); // UPDATE
        await uninstall(projectDir, { scope: 'user', yes: true });
        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(added, [], `residue after update→uninstall: ${added.join(', ')}`);
        assert.deepEqual(removed, [], `update→uninstall deleted pre-existing: ${removed.join(', ')}`);
        assert.deepEqual(modified, [], `update→uninstall modified pre-existing: ${modified.join(', ')}`);
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('user scope update adopts a byte-identical hook left by an older empty runtime journal', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    const sha = (s) => createHash('sha256').update(s).digest('hex');
    const writeAbs = (rel, content) => {
      const abs = join(fakeHome, rel);
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, content);
    };
    try {
      await withHome(fakeHome, async () => {
        const hookRel = '.atomic-skills/hooks/version-check.sh';
        const hookContent = readFileSync(new URL('../skills/shared/auto-update-hook/version-check.sh', import.meta.url));
        writeAbs(hookRel, hookContent);
        writeAbs(join('.atomic-skills', 'manifest.json'), JSON.stringify({
          version: '2.0.0',
          language: 'en',
          ides: ['claude-code'],
          effects: [
            { type: 'reconcileFileSet', beforeState: [] },
            { type: 'stageRuntimeArtifacts', beforeState: { created: [] } },
            {
              type: 'jsonMerge',
              beforeState: {
                path: '.claude/settings.json',
                fileCreated: false,
                inserts: [],
                createdContainers: [],
              },
            },
          ],
          files: {},
        }, null, 2) + '\n');

        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });

        const manifest = JSON.parse(readFileSync(join(fakeHome, '.atomic-skills', 'manifest.json'), 'utf8'));
        const staged = manifest.effects.find((e) => e.type === 'stageRuntimeArtifacts');
        assert.deepEqual(staged.beforeState.created, [hookRel]);
        assert.equal(
          manifest.files[hookRel].installed_hash,
          sha(hookContent),
          'adopted hook is restored to the legacy files map for status readers',
        );
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  // ─── Legacy-manifest uninstall parity (F3 review CRITICAL B) ───
  // A pre-kernel install (manifest with a `files` map but NO `effects`) uninstalled
  // DIRECTLY through the consumer `uninstall()` — without a prior `install` to
  // migrate it — must still revert. The journal Driver's replayReverse only reads
  // `effects`, so uninstall MUST run migrateLegacyInstall first; otherwise it
  // deletes the manifest (the only ownership ledger) while leaving every installed
  // file orphaned. The proved files revert; a file the user edited after install
  // survives (P3 — the migrated hash is the only accepted ownership proof).
  it('user scope uninstall of a LEGACY manifest reverts proved files and preserves user-edited (P3)', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
    const writeAbs = (rel, content) => {
      const abs = join(fakeHome, rel);
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, content);
    };
    try {
      await withHome(fakeHome, async () => {
        // POSIX relative paths: manifest keys are always forward-slash.
        const provedRel = '.claude/skills/atomic-skills/proved.md';
        const editedRel = '.claude/skills/atomic-skills/edited.md';
        const provedContent = '---\nname: proved-skill\n---\n\nproved body\n';
        const editedOriginal = '---\nname: edited-skill\n---\n\noriginal body\n';
        writeAbs(provedRel, provedContent);
        writeAbs(editedRel, editedOriginal);
        // a LEGACY manifest: a `files` map keyed by installed_hash, NO `effects`
        const legacyManifest = {
          version: '0.9.0',
          language: 'en',
          ides: ['claude-code'],
          files: {
            [provedRel]: { installed_hash: sha(provedContent), source: 'skills' },
            [editedRel]: { installed_hash: sha(editedOriginal), source: 'skills' },
          },
          settingsCreated: false,
        };
        writeAbs(join('.atomic-skills', 'manifest.json'),
          JSON.stringify(legacyManifest, null, 2) + '\n');
        // user edits the second file AFTER the original install — must survive (P3)
        writeAbs(editedRel, '---\nname: edited-skill\n---\n\nEDITED by the user\n');

        await uninstall(projectDir, { scope: 'user', yes: true });

        // proved file (disk hash == installed_hash) → reverted
        assert.equal(existsSync(join(fakeHome, provedRel)), false,
          'proved legacy file is reverted (migrated → reconcileFileSet revert)');
        // user-edited proved file (disk hash != installed_hash) → preserved
        assert.equal(existsSync(join(fakeHome, editedRel)), true,
          'user-edited legacy file survives uninstall (P3: no proof-less deletion)');
        assert.equal(
          readFileSync(join(fakeHome, editedRel), 'utf8'),
          '---\nname: edited-skill\n---\n\nEDITED by the user\n',
          'user-edited legacy file is byte-identical',
        );
        // the manifest ledger is reclaimed
        assert.equal(existsSync(join(fakeHome, '.atomic-skills', 'manifest.json')), false,
          'legacy manifest removed after a real reversal');
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});


describe('optional global delegation instructions', () => {
  async function fixture(fn) {
    const home = mkdtempSync(join(tmpdir(), 'as-global-home-'));
    const repo = mkdtempSync(join(tmpdir(), 'as-global-repo-'));
    try { await withHome(home, () => fn(home, repo)); }
    finally { rmSync(home, { recursive: true, force: true }); rmSync(repo, { recursive: true, force: true }); }
  }
  const begin = '<!-- BEGIN atomic-skills:delegate -->';
  const end = '<!-- END atomic-skills:delegate -->';
  const opts = { yes: true, ide: ['codex'], lang: 'en', globalInstructions: true };
  for (const scenario of ['existing', 'absent', 'outside-edit', 'deleted-block']) {
    it(`global block roundtrip: ${scenario}`, () => fixture(async (home, repo) => {
      const file = join(home, '.codex/AGENTS.md');
      const original = Buffer.from('before\r\n\xff\n\nafter', 'latin1');
      if (scenario !== 'absent') { mkdirSync(join(home, '.codex'), { recursive: true }); writeFileSync(file, original); }
      await install(repo, opts);
      const installed = readFileSync(file, 'utf8');
      assert.ok(installed.includes(begin));
      let expected = original;
      if (scenario === 'outside-edit') { expected = Buffer.concat([Buffer.from('new user text\n'), original]); writeFileSync(file, Buffer.concat([Buffer.from('new user text\n'), readFileSync(file)])); }
      if (scenario === 'deleted-block') { expected = Buffer.from('user removed block\n'); writeFileSync(file, expected); }
      await uninstall(repo, { scope: 'user', yes: true });
      if (scenario === 'absent') assert.equal(existsSync(file), false);
      else assert.deepEqual(readFileSync(file), expected);
    }));
  }
  for (const scenario of ['root-created', 'root-existing', 'file', 'config-created', 'config-parent', 'opencode-root', 'gemini-root']) {
    it(`global symlink destination roundtrip: ${scenario}`, (t) => fixture(async (home, repo) => {
      const target = mkdtempSync(join(tmpdir(), 'as-global-target-'));
      try {
        const opencode = scenario.startsWith('config-') || scenario === 'opencode-root';
        const agent = opencode ? 'opencode' : scenario === 'file' ? 'claude-code' : scenario === 'gemini-root' ? 'antigravity' : 'codex';
        const logical = opencode ? '.config/opencode/AGENTS.md' : agent === 'claude-code' ? '.claude/CLAUDE.md' : agent === 'antigravity' ? '.gemini/GEMINI.md' : '.codex/AGENTS.md';
        const link = join(home, scenario.startsWith('config-') ? '.config' : scenario === 'opencode-root' ? '.config/opencode' : logical.split('/')[0]);
        const realFile = join(target, scenario.startsWith('config-') ? 'opencode/AGENTS.md' : logical.split('/').at(-1));
        const original = Buffer.from('user before\r\n\xff\nuser after', 'latin1');
        if (scenario !== 'config-created') mkdirSync(join(realFile, '..'), { recursive: true });
        if (!['root-created', 'config-created'].includes(scenario)) writeFileSync(realFile, original);
        if (scenario === 'file') {
          mkdirSync(link, { recursive: true });
          try { symlinkSync(realFile, join(home, logical)); }
          catch (err) { if (process.platform === 'win32' && err.code === 'EPERM') { t.skip('file symlink requires privileges (@henryavila 2026-11-27; runs when Windows Developer Mode or an elevated shell allows symlinks)'); return; } throw err; }
        } else {
          mkdirSync(join(link, '..'), { recursive: true });
          symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
        }
        const baseline = snapshotTree(target);
        const linkedPath = scenario === 'file' ? join(home, logical) : link;
        const output = execFileSync(process.execPath, [CLI, 'install', '--yes', '--ide', agent, '--lang', 'en', '--global-instructions'],
          { cwd: repo, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
        assert.doesNotMatch(output, /refused/i);
        assert.ok(readFileSync(realFile, 'utf8').includes(begin));
        assert.ok(lstatSync(linkedPath).isSymbolicLink());
        assert.deepEqual(installedGlobalInstructionPaths(home), [logical]);
        const status = execFileSync(process.execPath, [CLI, 'status'], { cwd: repo, encoding: 'utf8', env: process.env });
        assert.ok(status.includes(logical));
        await install(repo, { ...opts, ide: [agent], lang: 'pt' });
        assert.ok(readFileSync(realFile, 'utf8').includes(globalInstructionBody('pt')));
        assert.ok(lstatSync(linkedPath).isSymbolicLink());
        await install(repo, { ...opts, ide: [agent], globalInstructions: false });
        assert.ok(lstatSync(linkedPath).isSymbolicLink());
        if (['root-created', 'config-created'].includes(scenario)) assert.equal(existsSync(realFile), false);
        else assert.deepEqual(readFileSync(realFile), original);
        await install(repo, { ...opts, ide: [agent] });
        await uninstall(repo, { scope: 'user', yes: true });
        assert.deepEqual(snapshotTree(target), baseline);
        assert.ok(lstatSync(linkedPath).isSymbolicLink());
      } finally { rmSync(target, { recursive: true, force: true }); }
    }));
  }
  for (const kind of ['directory', 'file', 'reverse']) for (const action of ['lifecycle', 'uninstall']) {
    it(`R1-R01 ownership survives same-file migration: ${kind} ${action}`, (t) => fixture(async (home, repo) => {
      const dir = join(home, '.codex');
      const file = join(dir, 'AGENTS.md');
      const target = join(home, 'dotfiles');
      mkdirSync(dir);
      writeFileSync(file, 'user baseline\n');
      if (kind === 'reverse') {
        await rename(dir, target);
        symlinkSync(target, dir, process.platform === 'win32' ? 'junction' : 'dir');
      }
      await install(repo, opts);
      if (kind === 'reverse') {
        unlinkSync(dir);
        await rename(target, dir);
      } else if (kind === 'directory') {
        await rename(dir, target);
        symlinkSync(target, dir, process.platform === 'win32' ? 'junction' : 'dir');
      } else {
        await rename(file, target);
        try { symlinkSync(target, file); }
        catch (err) { if (process.platform === 'win32' && err.code === 'EPERM') { t.skip('file symlink requires privileges (@henryavila 2026-11-27; runs when Windows Developer Mode or an elevated shell allows symlinks)'); return; } throw err; }
      }
      assert.deepEqual(installedGlobalInstructionPaths(home), ['.codex/AGENTS.md']);
      const status = execFileSync(process.execPath, [CLI, 'status'], { cwd: repo, encoding: 'utf8', env: process.env });
      assert.ok(status.includes('.codex/AGENTS.md'));
      if (action === 'uninstall') {
        await uninstall(repo, { scope: 'user', yes: true });
        assert.equal(readFileSync(file, 'utf8'), 'user baseline\n');
        assert.equal(existsSync(join(home, '.atomic-skills/manifest.json')), false);
        return;
      }
      await install(repo, { ...opts, lang: 'pt' });
      assert.match(readFileSync(file, 'utf8'), /## Delegação/);
      await install(repo, { ...opts, globalInstructions: false });
      assert.equal(readFileSync(file, 'utf8'), 'user baseline\n');
      await install(repo, opts);
      await uninstall(repo, { scope: 'user', yes: true });
      assert.equal(readFileSync(file, 'utf8'), 'user baseline\n');
      assert.equal(existsSync(join(home, '.atomic-skills/manifest.json')), false);
    }));
  }
  it('R1-R02 owned unreadable destination parks ownership and installs every other agent', { skip: process.platform === 'win32' ? 'chmod 0 is not enforced on Windows (@henryavila 2026-11-27; runs on POSIX filesystems)' : false }, () => fixture(async (home, repo) => {
    await install(repo, opts);
    const file = join(home, '.codex/AGENTS.md');
    const before = readFileSync(file);
    const manifestFile = join(home, '.atomic-skills/manifest.json');
    const owned = JSON.parse(readFileSync(manifestFile)).effects.find(e => e.type === 'textBlock');
    chmodSync(file, 0);
    try {
      const result = spawnSync(process.execPath, [CLI, 'install', '--yes', '--ide', 'codex,claude-code', '--lang', 'en'],
        { cwd: repo, encoding: 'utf8', env: process.env });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      const output = result.stdout;
      assert.equal(output.split('Global instructions refused:').length - 1, 1);
      assert.doesNotMatch(output, / at .*\.js:\d/);
      assert.ok(existsSync(join(home, '.claude/commands/atomic-skills/fix.md')));
      assert.deepEqual(JSON.parse(readFileSync(manifestFile)).effects.find(e => e.type === 'textBlock'), owned);
    } finally { chmodSync(file, 0o600); }
    assert.deepEqual(readFileSync(file), before);
  }));
  for (const code of ['EACCES', 'EIO']) {
    it(`R1-R02 owned read failure ${code} parks ownership and continues`, () => fixture(async (home, repo) => {
      await install(repo, opts);
      const file = join(home, '.codex/AGENTS.md');
      const before = readFileSync(file);
      const manifestFile = join(home, '.atomic-skills/manifest.json');
      const owned = JSON.parse(readFileSync(manifestFile)).effects.find(e => e.type === 'textBlock');
      const preload = instructionReadFailure(repo, file, code);
      const result = spawnSync(process.execPath, ['--require', preload, CLI, 'install', '--yes', '--ide', 'codex,claude-code', '--lang', 'en'],
        { cwd: repo, encoding: 'utf8', env: process.env });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      const output = result.stdout;
      assert.equal(output.split('Global instructions refused:').length - 1, 1);
      assert.doesNotMatch(output, / at .*\.js:\d/);
      assert.ok(existsSync(join(home, '.claude/commands/atomic-skills/fix.md')));
      assert.deepEqual(JSON.parse(readFileSync(manifestFile)).effects.find(e => e.type === 'textBlock'), owned);
      assert.deepEqual(readFileSync(file), before);
    }));
  }
  for (const code of ['EACCES', 'EIO']) {
    it(`R1-R03 uninstall ${code} retains ownership for a successful retry`, () => fixture(async (home, repo) => {
      await install(repo, opts);
      const file = join(home, '.codex/AGENTS.md');
      const before = readFileSync(file);
      const manifestFile = join(home, '.atomic-skills/manifest.json');
      const owned = JSON.parse(readFileSync(manifestFile)).effects.find(e => e.type === 'textBlock');
      const preload = instructionReadFailure(repo, file, code);
      assert.throws(() => execFileSync(process.execPath, ['--require', preload, CLI, 'uninstall', '--yes'],
        { cwd: repo, encoding: 'utf8', env: process.env, stdio: 'pipe' }), err => {
        assert.equal(err.status, 1);
        assert.match(err.stderr, /uninstall.*incomplete.*retry.*uninstall --yes/i);
        assert.doesNotMatch(err.stderr, / at .*\.js:\d/);
        return true;
      });
      assert.deepEqual(JSON.parse(readFileSync(manifestFile)).effects.find(e => e.type === 'textBlock'), owned);
      assert.deepEqual(readFileSync(file), before);
      execFileSync(process.execPath, [CLI, 'uninstall', '--yes'], { cwd: repo, encoding: 'utf8', env: process.env });
      assert.equal(existsSync(file), false);
      assert.equal(existsSync(manifestFile), false);
    }));
  }
  for (const kind of ['changed', 'dangling', 'loop', 'wrong-type']) {
    it(`R1-R01/R02/R03 owned ${kind} destination refuses safely`, (t) => fixture(async (home, repo) => {
      const file = join(home, '.codex/AGENTS.md');
      await install(repo, opts);
      const old = join(home, 'old-instructions');
      await rename(file, old);
      const oldBytes = readFileSync(old);
      const next = join(home, 'new-instructions');
      writeFileSync(next, 'foreign text\n');
      if (kind === 'wrong-type') mkdirSync(file);
      else {
        try { symlinkSync(kind === 'changed' ? next : kind === 'loop' ? file : join(home, 'missing'), file); }
        catch (err) { if (process.platform === 'win32' && err.code === 'EPERM') { t.skip('file symlink requires privileges (@henryavila 2026-11-27; runs when Windows Developer Mode or an elevated shell allows symlinks)'); return; } throw err; }
      }
      const manifestFile = join(home, '.atomic-skills/manifest.json');
      const owned = JSON.parse(readFileSync(manifestFile)).effects.find(e => e.type === 'textBlock');
      for (const flag of ['--global-instructions', '--no-global-instructions']) {
        const output = execFileSync(process.execPath, [CLI, 'install', '--yes', '--ide', 'codex,claude-code', '--lang', 'en', flag],
          { cwd: repo, encoding: 'utf8', env: process.env, stdio: 'pipe' });
        assert.equal(output.split('Global instructions refused:').length - 1, 1);
        assert.ok(existsSync(join(home, '.claude/commands/atomic-skills/fix.md')));
        assert.deepEqual(JSON.parse(readFileSync(manifestFile)).effects.find(e => e.type === 'textBlock'), owned);
      }
      const output = execFileSync(process.execPath, [CLI, 'uninstall', '--yes'],
        { cwd: repo, encoding: 'utf8', env: process.env, stdio: 'pipe' });
      assert.equal(output.split('Global instructions refused:').length - 1, 1);
      assert.deepEqual(readFileSync(old), oldBytes);
      assert.equal(readFileSync(next, 'utf8'), 'foreign text\n');
    }));
  }
  for (const kind of ['directory', 'file']) {
    it(`global symlink repoint (${kind}) refuses the journaled file and leaves both destinations untouched`, (t) => fixture(async (home, repo) => {
      const old = join(home, 'old');
      const next = join(home, 'next');
      mkdirSync(old); mkdirSync(next);
      writeFileSync(join(old, 'AGENTS.md'), 'old user\n');
      writeFileSync(join(next, 'AGENTS.md'), 'new user\n');
      const link = join(home, kind === 'file' ? '.codex/AGENTS.md' : '.codex');
      if (kind === 'file') mkdirSync(join(home, '.codex'));
      const linkTo = (dir) => symlinkSync(kind === 'file' ? join(dir, 'AGENTS.md') : dir, link,
        kind === 'file' ? undefined : process.platform === 'win32' ? 'junction' : 'dir');
      try { linkTo(old); }
      catch (err) { if (process.platform === 'win32' && err.code === 'EPERM') { t.skip('file symlink requires privileges (@henryavila 2026-11-27; runs when Windows Developer Mode or an elevated shell allows symlinks)'); return; } throw err; }
      await install(repo, opts);
      const oldBytes = readFileSync(join(old, 'AGENTS.md'));
      const originalState = JSON.parse(readFileSync(join(home, '.atomic-skills/manifest.json'), 'utf8'))
        .effects.find(e => e.type === 'textBlock').beforeState;
      unlinkSync(link);
      linkTo(next);
      assert.deepEqual(installedGlobalInstructionPaths(home), []);
      for (const flag of ['--global-instructions', '--no-global-instructions']) {
        const update = execFileSync(process.execPath, [CLI, 'install', '--yes', '--ide', 'codex', '--lang', 'en', flag],
          { cwd: repo, encoding: 'utf8', env: process.env });
        assert.equal(update.split('Global instructions refused:').length - 1, 1);
        const journal = JSON.parse(readFileSync(join(home, '.atomic-skills/manifest.json'), 'utf8'));
        assert.deepEqual(journal.effects.find(e => e.type === 'textBlock').beforeState, originalState);
        assert.deepEqual(readFileSync(join(old, 'AGENTS.md')), oldBytes);
        assert.equal(readFileSync(join(next, 'AGENTS.md'), 'utf8'), 'new user\n');
      }
      const output = execFileSync(process.execPath, [CLI, 'uninstall', '--yes'], { cwd: repo, encoding: 'utf8', env: process.env });
      assert.match(output, /Global instructions refused: .*AGENTS.md/);
      assert.ok(output.includes(join(originalState.resolvedBase, originalState.resolvedPath)));
      assert.deepEqual(readFileSync(join(old, 'AGENTS.md')), oldBytes);
      assert.equal(readFileSync(join(next, 'AGENTS.md'), 'utf8'), 'new user\n');
    }));
  }
  for (const kind of ['dangling-root', 'loop-root', 'dangling', 'loop', 'wrong-directory-target', 'wrong-file-target', 'directory', 'unreadable', 'malformed']) {
    it(`R01 refuses ${kind} but CLI installs skills with exit 0`, { skip: kind === 'unreadable' && process.platform === 'win32' ? 'unreadable files are not enforced on Windows (@henryavila 2026-11-27; runs on POSIX filesystems)' : false }, (t) => fixture(async (home, repo) => {
      const file = join(home, '.codex/AGENTS.md');
      const target = join(home, 'dotfiles');
      mkdirSync(target);
      writeFileSync(join(target, 'AGENTS.md'), 'foreign text\n');
      mkdirSync(join(home, '.codex'));
      if (kind === 'dangling-root' || kind === 'loop-root') {
        rmSync(join(home, '.codex'), { recursive: true });
        symlinkSync(kind === 'dangling-root' ? join(target, 'missing') : join(home, '.codex'),
          join(home, '.codex'), process.platform === 'win32' ? 'junction' : 'dir');
      } else if (['dangling', 'loop', 'wrong-file-target'].includes(kind)) {
        try { symlinkSync(kind === 'dangling' ? join(target, 'missing') : kind === 'loop' ? file : target, file,
          kind === 'wrong-file-target' && process.platform === 'win32' ? 'junction' : undefined); }
        catch (err) { if (process.platform === 'win32' && err.code === 'EPERM') { t.skip('file symlink requires privileges (@henryavila 2026-11-27; runs when Windows Developer Mode or an elevated shell allows symlinks)'); return; } throw err; }
      } else if (kind === 'wrong-directory-target') {
        rmSync(join(home, '.codex'), { recursive: true });
        try { symlinkSync(join(target, 'AGENTS.md'), join(home, '.codex')); }
        catch (err) { if (process.platform === 'win32' && err.code === 'EPERM') { t.skip('file symlink requires privileges (@henryavila 2026-11-27; runs when Windows Developer Mode or an elevated shell allows symlinks)'); return; } throw err; }
      } else if (kind === 'directory') mkdirSync(file);
      else { writeFileSync(file, kind === 'malformed' ? `${begin}\nbroken\n` : 'private\n'); if (kind === 'unreadable') chmodSync(file, 0); }
      try {
        const output = execFileSync(process.execPath, [CLI,
          'install', '--yes', '--ide', 'codex', '--lang', 'en', '--global-instructions'],
        { cwd: repo, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
        assert.match(output, /Global instructions refused: .codex\/AGENTS.md/);
        assert.equal(output.split('Global instructions refused:').length - 1, 1);
        assert.ok(existsSync(join(home, '.agents/skills/atomic-skills/fix/SKILL.md')));
        assert.equal(readFileSync(join(target, 'AGENTS.md'), 'utf8'), 'foreign text\n');
        assert.doesNotMatch(output, / at .*\.js:\d/);
      } finally { if (kind === 'unreadable') chmodSync(file, 0o600); }
    }));
  }
  it('R02 status requires journal ownership, including after foreign block opt-out', () => fixture(async (home, repo) => {
    const file = join(home, '.codex/AGENTS.md');
    mkdirSync(join(home, '.codex'));
    const foreign = `${begin}\nforeign\n${end}\n`;
    writeFileSync(file, foreign);
    assert.deepEqual(installedGlobalInstructionPaths(home), []);
    await install(repo, opts);
    assert.deepEqual(installedGlobalInstructionPaths(home), ['.codex/AGENTS.md']);
    await install(repo, { ...opts, globalInstructions: false });
    assert.equal(readFileSync(file, 'utf8'), foreign);
    assert.deepEqual(installedGlobalInstructionPaths(home), []);
  }));
  it('R03 owned broken markers stop safely with recovery guidance (engine limitation)', () => fixture(async (home, repo) => {
    await install(repo, opts);
    const file = join(home, '.codex/AGENTS.md');
    const broken = readFileSync(file, 'utf8').replace(end, '');
    writeFileSync(file, broken);
    const journal = readFileSync(join(home, '.atomic-skills/manifest.json'));
    for (const globalInstructions of [undefined, false, true]) {
      await assert.rejects(install(repo, { ...opts, globalInstructions }), /missing END.*restore.*delete.*run install again/i);
    }
    try {
      execFileSync(process.execPath, [CLI,
        'install', '--yes', '--ide', 'codex', '--lang', 'en'], { cwd: repo, encoding: 'utf8', env: process.env, stdio: 'pipe' });
      assert.fail('engine must block this install');
    } catch (err) {
      assert.equal(err.status, 1);
      assert.match(err.stderr, /missing END.*Restore.*delete.*run install again/);
      assert.doesNotMatch(err.stderr, / at .*\.js:\d/);
    }
    assert.equal(readFileSync(file, 'utf8'), broken);
    assert.deepEqual(readFileSync(join(home, '.atomic-skills/manifest.json')), journal);
  }));
  it('R04 deleted owned block opts out until explicit flag', () => fixture(async (home, repo) => {
    await install(repo, opts);
    const file = join(home, '.codex/AGENTS.md');
    writeFileSync(file, 'user removed block\n');
    const lines = []; const log = console.log; console.log = (...args) => lines.push(args.join(' '));
    try { await install(repo, { yes: true, ide: ['codex'], lang: 'en' }); }
    finally { console.log = log; }
    assert.equal(readFileSync(file, 'utf8'), 'user removed block\n');
    assert.ok(lines.some(l => l.includes('.codex/AGENTS.md') && /opt.out/.test(l)));
    await install(repo, opts);
    assert.match(readFileSync(file, 'utf8'), /BEGIN atomic-skills:delegate/);
  }));
  it('R05 normalises CRLF source bodies and pins source files to LF', () => {
    // Exercise the read boundary without modifying versioned source files.
    assert.equal(globalInstructionBody('en', () => 'one\r\ntwo\r\n'), 'one\ntwo');
    const attrs = execFileSync('git', ['check-attr', 'eol', '--', 'src/global-instructions/en.md', 'src/global-instructions/pt.md'], { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.equal(attrs.split('eol: lf').length - 1, 2);
  });
  for (const kind of ['directory', 'unreadable']) {
    it(`R06 status treats owned ${kind} as not installed`, { skip: kind === 'unreadable' && process.platform === 'win32' ? 'unreadable files are not enforced on Windows (@henryavila 2026-11-27; runs on POSIX filesystems)' : false }, () => fixture(async (home, repo) => {
      await install(repo, opts);
      const file = join(home, '.codex/AGENTS.md');
      if (kind === 'directory') { rmSync(file); mkdirSync(file); }
      else chmodSync(file, 0);
      try {
        assert.deepEqual(installedGlobalInstructionPaths(home), []);
        const output = execFileSync(process.execPath, [CLI, 'status'], { cwd: repo, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
        assert.match(output, /Global instructions: not installed/);
      }
      finally { if (kind === 'unreadable') chmodSync(file, 0o600); }
    }));
  }
  it('update keeps and refreshes, explicit opt-out removes through journal', () => fixture(async (home, repo) => {
    const file = join(home, '.codex/AGENTS.md');
    await install(repo, { ...opts, lang: 'pt' });
    assert.match(readFileSync(file, 'utf8'), /## Delegação/);
    await install(repo, { yes: true, ide: ['codex'], lang: 'ja' });
    assert.match(readFileSync(file, 'utf8'), /## Delegation/);
    assert.equal(readFileSync(file, 'utf8').split(begin).length, 2);
    await install(repo, { ...opts, globalInstructions: false });
    assert.equal(existsSync(file), false);
    await uninstall(repo, { scope: 'user', yes: true });
  }));
  it('noninteractive default and project flag never write global instructions', () => fixture(async (home, repo) => {
    await install(repo, { yes: true, ide: ['codex'], lang: 'en' });
    assert.equal(existsSync(join(home, '.codex/AGENTS.md')), false);
    await uninstall(repo, { scope: 'user', yes: true });
    execFileSync('git', ['init', '-q'], { cwd: repo });
    await install(repo, { ...opts, project: true });
    assert.equal(existsSync(join(home, '.codex/AGENTS.md')), false);
    assert.equal(existsSync(join(repo, '.codex/AGENTS.md')), false);
    await uninstall(repo, { scope: 'project', yes: true });
  }));
  it('two agents get blocks, unsupported agents are named, malformed foreign block refuses only that file', () => fixture(async (home, repo) => {
    const lines = []; const log = console.log; console.log = (...args) => lines.push(args.join(' '));
    try {
      const file = join(home, '.claude/CLAUDE.md'); mkdirSync(join(home, '.claude'), { recursive: true });
      const malformed = `${begin}\nforeign unclosed block\n`; writeFileSync(file, malformed);
      await install(repo, { ...opts, ide: ['claude-code', 'codex', 'cursor'] });
      assert.equal(readFileSync(file, 'utf8'), malformed);
      assert.ok(readFileSync(join(home, '.codex/AGENTS.md'), 'utf8').includes(end));
      assert.ok(lines.some(l => /skip/i.test(l) && l.includes('cursor')));
      assert.ok(lines.some(l => /refus/i.test(l) && l.includes('.claude/CLAUDE.md')));
      assert.ok(existsSync(join(home, '.cursor/skills/atomic-skills/fix/SKILL.md')));
      await uninstall(repo, { scope: 'user', yes: true });
      rmSync(file);
      await install(repo, { ...opts, ide: ['claude-code', 'codex'] });
      for (const rel of ['.claude/CLAUDE.md', '.codex/AGENTS.md']) assert.ok(readFileSync(join(home, rel), 'utf8').includes(begin));
      await uninstall(repo, { scope: 'user', yes: true });
    } finally { console.log = log; }
  }));
  it('CLI flags cover every supported path, status, adoption and language fallback', () => fixture(async (home, repo) => {
    const run = (...args) => execFileSync(process.execPath, [CLI, ...args], { cwd: repo, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
    assert.match(run('status'), /Global instructions: not installed/);
    const adopted = join(home, '.codex/AGENTS.md');
    mkdirSync(join(home, '.codex'), { recursive: true });
    const original = `before\r\n${begin}\r\noriginal foreign body\r\n${end}\r\nafter`;
    writeFileSync(adopted, original);
    run('install', '--yes', '--ide', 'claude-code,codex,opencode,antigravity', '--lang', 'ja', '--global-instructions');
    const paths = ['.claude/CLAUDE.md', '.codex/AGENTS.md', '.config/opencode/AGENTS.md', '.gemini/GEMINI.md'];
    const output = run('status');
    for (const path of paths) {
      assert.match(readFileSync(join(home, path), 'utf8'), /## Delegation/);
      assert.ok(output.includes(path));
    }
    run('install', '--yes', '--ide', 'codex', '--lang', 'pt');
    // An unattended update never silently drops previously opted-in blocks,
    // including agents omitted from a later skill selection.
    for (const path of paths) assert.match(readFileSync(join(home, path), 'utf8'), /## Delegação/);
    run('install', '--yes', '--ide', 'codex', '--no-global-instructions');
    assert.equal(readFileSync(adopted, 'utf8'), original);
    assert.match(run('status'), /Global instructions: not installed/);
    for (const path of paths.filter(p => p !== '.codex/AGENTS.md')) assert.equal(existsSync(join(home, path)), false);
    run('uninstall', '--yes');
    assert.equal(readFileSync(adopted, 'utf8'), original);
  }));
  it('R08 interactive decision defaults no, defaults yes only when installed, and cancels', () => {
    assert.deepEqual(globalInstructionsDecision([]), { cancelled: false, enabled: false });
    assert.deepEqual(globalInstructionsDecision(['.codex/AGENTS.md']), { cancelled: false, enabled: true });
    assert.deepEqual(globalInstructionsDecision([], true), { cancelled: false, enabled: true });
    assert.deepEqual(globalInstructionsDecision(['.codex/AGENTS.md'], false), { cancelled: false, enabled: false });
    assert.deepEqual(globalInstructionsDecision([], Symbol('cancel')), { cancelled: true });
  });
  for (const lang of ['pt', 'en']) {
    it(`R09 installed bytes equal versioned body and markers: ${lang}`, () => fixture(async (home, repo) => {
      await install(repo, { ...opts, lang });
      const body = readFileSync(new URL(`../src/global-instructions/${lang}.md`, import.meta.url), 'utf8').replace(/\r\n/g, '\n').trimEnd();
      assert.deepEqual(readFileSync(join(home, '.codex/AGENTS.md')), Buffer.from(`${begin}\n${body}\n${end}\n`));
    }));
    it(`R07 prompt and log lines are localised: ${lang}`, () => fixture(async (home, repo) => {
      const messages = msg(lang);
      assert.match(messages.globalInstructionsPrompt, lang === 'pt' ? /Instalar instruções/ : /Install global/);
      assert.match(messages.globalInstructionsFiles('file'), lang === 'pt' ? /Arquivos/ : /files/);
      const file = join(home, '.codex/AGENTS.md');
      mkdirSync(join(home, '.codex'));
      writeFileSync(file, `${begin}\nmalformed\n`);
      const lines = []; const log = console.log; console.log = (...args) => lines.push(args.join(' '));
      try { await install(repo, { ...opts, lang, ide: ['codex', 'cursor'] }); }
      finally { console.log = log; }
      assert.ok(lines.some(l => l.includes(messages.globalInstructionsSkipped('cursor'))));
      assert.ok(lines.some(l => l.includes(messages.globalInstructionsRefused('.codex/AGENTS.md', 'missing END marker'))));
      rmSync(file);
      await install(repo, { ...opts, lang });
      rmSync(file);
      mkdirSync(file);
      const output = execFileSync(process.execPath, [CLI, 'uninstall', '--yes'],
        { cwd: repo, encoding: 'utf8', env: process.env });
      assert.ok(output.includes(messages.globalInstructionsRefused('.codex/AGENTS.md', `Expected regular file at ${file}; journaled file ${file}`)));
      assert.equal(output.split(lang === 'pt' ? 'Instruções globais recusadas:' : 'Global instructions refused:').length - 1, 1);
    }));
  }
  it('versioned block bodies stay neutral and contain the executor exception', () => {
    for (const lang of ['en', 'pt']) {
      const body = readFileSync(new URL(`../src/global-instructions/${lang}.md`, import.meta.url), 'utf8');
      assert.doesNotMatch(body, /claude|codex|opencode|antigravity|grok|copilot|cursor|deepseek|gemini|openai|gpt|opus|sonnet|flash/i);
      assert.match(body, /atomic-skills:delegate/);
      assert.match(body, lang === 'en' ? /you are the executor/ : /você é o executor/);
    }
  });
});
