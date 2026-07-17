/**
 * P0-D — Full-path fault E2E matrix for installer hardening P0 findings.
 *
 * Drives atomic-skills consumer APIs (`installSkills`, recovery CLI mutators,
 * `syncGrokPluginHostAfterInstall`) under hermetic HOME/basePath isolation —
 * not bare engine-only repros. Complements (does not replace) unit suites:
 *   - tests/recovery-cli.test.js (P0-A mutators / CLI flags)
 *   - tests/auto-update-drop-revert.test.js (P0-B helpers + shrink)
 *   - test/runtime-layers/grok-shrink-cleanup.test.js (P0-C refcount gates)
 *   - tests/release-fault-matrix.test.js (engine-level incomplete + registry)
 *
 * Mandatory scenarios (docs/plans/installer-hardening-p0-p1.md § P0-D):
 *   1. Incomplete: fail on 2nd effect mid-install → force-incomplete → reinstallable
 *   2. Mid-repair kill: interrupt recovery mutator → no false `complete`
 *   3. Shrink auto-update: claude-code → codex (no Claude hook/settings residue)
 *   4. Shrink multi: claude-code+grok → cursor (auto-update surfaces gone)
 *   5. Grok host last owner: install with grok → reinstall without (host+isolation cleaned)
 *   6. Grok host multi-owner: A+B with grok → shrink A (kept) → shrink B (gone)
 */
import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineInstaller, describeRecovery, TX_STATE_INCOMPLETE } from '@henryavila/minimalist-installer';

import {
  installSkills,
  registerInstall,
  syncGrokPluginHostAfterInstall,
} from '../src/install.js';
import {
  forceIncompleteUninstall,
  repairIncompleteInstall,
  RECOVERY_LEDGER_FILE,
} from '../src/recovery-cli.js';
import { createSkillsProvider } from '../src/providers/skills-provider.js';
import { createAutoUpdateRuntimeProvider } from '../src/runtime-layers/auto-update.js';
import { createStageRuntimeArtifactsEffect } from '../src/runtime-layers/effects/stage-runtime-artifacts.js';
import {
  isAutoUpdateJournalEffect,
  VERSION_CHECK_REL,
  CLAUDE_SETTINGS_REL,
} from '../src/runtime-layers/auto-update-drop-revert.js';
import { GROK_AUTO_UPDATE_HOOK_REL } from '../src/runtime-layers/auto-update.js';
import {
  applyGrokAgentsIsolation,
  resolveGrokUserConfigPath,
  skillsIgnoreContainsAll,
} from '../src/runtime-layers/grok-agents-isolation.js';
import {
  GROK_PLUGIN_NAME,
  GROK_PLUGIN_PACKAGE_REL,
} from '../src/runtime-layers/grok-plugin-host.js';
import { MANIFEST_DIR, readManifest } from '../src/manifest.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SKILLS_DIR = join(ROOT, 'skills');
const META_DIR = join(ROOT, 'meta');

// ─── hermetic helpers ────────────────────────────────────────────────────────

/** Unique tmp root; restores HOME / SKIP_GROK after fn. Never touches real HOME. */
function withIsolatedHome(fn) {
  const home = mkdtempSync(join(tmpdir(), 'as-p0d-home-'));
  const prevHome = process.env.HOME;
  const prevSkip = process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
  process.env.HOME = home;
  process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = '1';
  let result;
  try {
    result = fn(home);
  } catch (err) {
    rmSync(home, { recursive: true, force: true });
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevSkip === undefined) delete process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
    else process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = prevSkip;
    throw err;
  }
  const restore = () => {
    rmSync(home, { recursive: true, force: true });
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevSkip === undefined) delete process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
    else process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = prevSkip;
  };
  if (result && typeof result.then === 'function') {
    return result.finally(restore);
  }
  restore();
  return result;
}

function projectDir(home, name = 'proj') {
  const dir = join(home, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function installOpts(ides, extras = {}) {
  return {
    language: 'en',
    ides,
    skillsDir: SKILLS_DIR,
    metaDir: META_DIR,
    scope: 'project',
    ...extras,
  };
}

function readTxState(basePath) {
  const desc = describeRecovery(basePath, MANIFEST_DIR);
  return desc.state;
}

function mockHostRunner(overrides = {}) {
  const calls = [];
  const run = (bin, args) => {
    calls.push({ bin, args: [...args] });
    if (typeof overrides.run === 'function') {
      return overrides.run(bin, args, calls);
    }
    const sub = args[1];
    if (sub === 'install') {
      return { status: 0, stdout: 'Installed 1 plugin(s)\n', stderr: '' };
    }
    if (sub === 'uninstall') {
      return { status: 0, stdout: `Uninstalled 1 plugin(s): ${GROK_PLUGIN_NAME}\n`, stderr: '' };
    }
    return { status: 1, stdout: '', stderr: `unexpected: ${args.join(' ')}` };
  };
  return { calls, run };
}

/**
 * Full project install path: journal materialize + host sync + registry.
 * Mirrors non-interactive `install()` after IDE selection.
 */
function fullProjectInstall(basePath, ides, { home, host } = {}) {
  const priorIdes = readManifest(basePath)?.ides;
  const result = installSkills(basePath, installOpts(ides));
  const syncOpts = { priorIdes, home: home || process.env.HOME };
  if (host) {
    syncOpts.run = host.run;
    syncOpts.resolveBin = () => '/mock/grok';
    syncOpts.env = { HOME: syncOpts.home };
  }
  syncGrokPluginHostAfterInstall(basePath, ides, 'en', syncOpts);
  registerInstall(basePath);
  return result;
}

/**
 * Consumer-equivalent installer (same providers/effects as buildInstaller)
 * with a boom on the Nth planned effect apply (1-based). Used to inject a
 * mid-install fault without bare-engine-only fixtures.
 *
 * Plan order for claude-code: reconcileFileSet → stageRuntimeArtifacts → jsonMerge.
 * failOnEffectIndex=2 fails after skills are journaled (post-F-001 per-effect flush).
 */
function buildConsumerInstallerFailingOnNth(config, failOnEffectIndex = 2) {
  const realStage = createStageRuntimeArtifactsEffect();
  let applyIndex = 0;

  // Wrap stageRuntimeArtifacts so we can also fail *after* reconcile without
  // touching the builtin reconciler. For failOnEffectIndex=2 this is the boom.
  const stageWrapper = {
    type: realStage.type,
    apply(args) {
      applyIndex += 1;
      // stage is always effect #2 when auto-update is planned (claude/grok).
      // Map wrapper-local count onto global planned index by adding 1 for
      // reconcileFileSet that already applied before we are called.
      const globalIndex = applyIndex + 1; // +1 for prior reconcileFileSet
      if (globalIndex === failOnEffectIndex || applyIndex === failOnEffectIndex - 1) {
        const err = new Error(
          `injected mid-install failure on effect index ${failOnEffectIndex} (stageRuntimeArtifacts)`,
        );
        err.code = 'INJECTED_MID_INSTALL';
        throw err;
      }
      return realStage.apply(args);
    },
    revert(ctx, beforeState) {
      return realStage.revert(ctx, beforeState);
    },
  };

  // Also wrap via a secondary boom provider when fail index is not stage —
  // for the mandatory "2nd effect" case, stage is sufficient.
  return defineInstaller({
    config: { manifestDir: MANIFEST_DIR, ...config },
    providers: [createSkillsProvider(), createAutoUpdateRuntimeProvider()],
    effects: [stageWrapper],
  });
}

function isVersionCheckCommand(command, absPath) {
  if (typeof command !== 'string') return false;
  const unquoted = command.replace(/^'|'$/g, '').replace(/'\\''/g, "'");
  return (
    command === absPath
    || unquoted === absPath
    || command === `'${absPath}'`
    || /version-check\.sh'?$/.test(command)
    || unquoted.endsWith('version-check.sh')
  );
}

function assertNoAtomicSessionStart(settingsPath, hookAbs) {
  if (!existsSync(settingsPath)) return;
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  const starts = settings.hooks?.SessionStart ?? [];
  const cmds = starts.flatMap((e) => (e.hooks ?? []).map((h) => h.command));
  assert.equal(
    cmds.some((c) => isVersionCheckCommand(c, hookAbs)),
    false,
    'Atomic Skills version-check SessionStart must not remain',
  );
}

// ─── 1. Incomplete mid-install → force-incomplete → reinstallable ────────────

describe('P0-D E2E: incomplete mid-install recovery (full path)', () => {
  let home;
  afterEach(() => {
    // withIsolatedHome cleans per-test; keep no leaked roots
    home = undefined;
  });

  it('fail on 2nd effect → incomplete blocks install → force-incomplete → installSkills succeeds', () => {
    withIsolatedHome((h) => {
      home = h;
      const project = projectDir(h, 'proj-incomplete');

      // Mid-install crash on 2nd effect via consumer providers (not bare engine).
      const installer = buildConsumerInstallerFailingOnNth(
        {
          language: 'en',
          ides: ['claude-code'],
          skillsDir: SKILLS_DIR,
          metaDir: META_DIR,
          scope: 'project',
        },
        2,
      );

      let threw = null;
      try {
        installer.install({ projectDir: project });
      } catch (err) {
        threw = err;
      }
      assert.ok(threw, '2nd-effect failure must throw');
      assert.equal(threw.code, 'INJECTED_MID_INSTALL');

      const desc = describeRecovery(project, MANIFEST_DIR);
      assert.equal(desc.state, TX_STATE_INCOMPLETE, 'must leave incomplete journal marker');
      assert.ok(
        (desc.effectCount ?? desc.manifest?.effects?.length ?? 0) >= 1,
        'per-effect flush: first effect (reconcileFileSet) must be journaled',
      );
      // Skills tree partially present from effect 1
      assert.ok(
        existsSync(join(project, '.claude/commands/atomic-skills'))
          || (desc.manifest?.effects || []).some((e) => e.type === 'reconcileFileSet'),
        'first effect applied ownership must be recoverable from journal',
      );

      // Normal installSkills is fail-closed on incomplete.
      assert.throws(
        () => installSkills(project, installOpts(['claude-code'])),
        (err) => err?.code === 'INCOMPLETE_TRANSACTION' || /incomplete/i.test(String(err?.message || err)),
      );

      // Product recovery (not rm -rf): force-incomplete reverse + residual ledger.
      const recovery = forceIncompleteUninstall(project);
      assert.equal(recovery.ok, true, `force-incomplete should succeed: ${recovery.message || ''}`);
      assert.notEqual(readTxState(project), TX_STATE_INCOMPLETE, 'incomplete marker cleared');
      assert.equal(
        existsSync(join(project, MANIFEST_DIR, RECOVERY_LEDGER_FILE)),
        true,
        'residual recovery ledger remains discoverable',
      );

      // Tree is installable again via real installSkills.
      const result = installSkills(project, installOpts(['claude-code']));
      assert.ok(result.files?.length > 0, 'reinstall materializes skills');
      assert.equal(readTxState(project), 'complete');
      assert.ok(
        existsSync(join(project, '.claude/commands/atomic-skills/fix.md')),
        'post-recovery install wrote skill bodies',
      );
    });
  });
});

// ─── 2. Mid-repair kill → no false complete ──────────────────────────────────

describe('P0-D E2E: mid-repair interrupt (recovery mutator)', () => {
  it('injected fail during force-incomplete leaves incomplete or residual ledger, never complete', () => {
    withIsolatedHome((h) => {
      const project = projectDir(h, 'proj-mid-force');

      // Produce a real incomplete via mid-install fault, then kill recovery.
      const installer = buildConsumerInstallerFailingOnNth(
        {
          language: 'en',
          ides: ['claude-code'],
          skillsDir: SKILLS_DIR,
          metaDir: META_DIR,
          scope: 'project',
        },
        2,
      );
      assert.throws(() => installer.install({ projectDir: project }));
      assert.equal(readTxState(project), TX_STATE_INCOMPLETE);

      assert.throws(
        () => forceIncompleteUninstall(project, { injectFailAfter: 'before-reverse' }),
        /injected mid-repair failure/i,
      );

      if (existsSync(join(project, MANIFEST_DIR, 'manifest.json'))) {
        const manifest = JSON.parse(
          readFileSync(join(project, MANIFEST_DIR, 'manifest.json'), 'utf8'),
        );
        assert.notEqual(
          manifest.transaction?.state,
          'complete',
          'mid-force kill must never write transaction complete',
        );
      } else {
        // Manifest removed only if residual ledger preserves discoverability.
        assert.equal(
          existsSync(join(project, MANIFEST_DIR, RECOVERY_LEDGER_FILE)),
          true,
          'if manifest gone, recovery ledger must remain',
        );
      }
    });
  });

  it('injected fail during post-U repair leaves incomplete, never complete', () => {
    withIsolatedHome((h) => {
      const project = projectDir(h, 'proj-mid-repair');
      // Gap note: consumer classifyJournalTrust still requires flushedAt/durable
      // on every effect (not only journalMode). Real engine incomplete is pre-U
      // and install --repair refuses; post-U reverse path is exercised here with
      // durable markers matching recovery-cli trust contract.
      const dir = join(project, MANIFEST_DIR);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'manifest.json'),
        `${JSON.stringify({
          journalVersion: 2,
          version: '2.0.0',
          language: 'en',
          ides: ['claude-code'],
          effects: [
            {
              type: 'reconcileFileSet',
              id: 'reconcileFileSet',
              beforeState: [],
              flushedAt: '2026-07-17T00:00:01.000Z',
            },
          ],
          transaction: {
            id: 'tx-e2e-repair',
            state: 'incomplete',
            journalMode: 'per-effect',
            appliedCount: 1,
            startedAt: '2026-07-17T00:00:00.000Z',
          },
        }, null, 2)}\n`,
        'utf8',
      );

      assert.throws(
        () => repairIncompleteInstall(project, { injectFailAfter: 'before-reverse' }),
        /injected mid-repair failure/i,
      );

      const manifest = JSON.parse(
        readFileSync(join(project, MANIFEST_DIR, 'manifest.json'), 'utf8'),
      );
      assert.equal(manifest.transaction?.state, 'incomplete');
      assert.notEqual(manifest.transaction?.state, 'complete');
    });
  });
});

// ─── 3–4. Auto-update IDE shrink via installSkills ───────────────────────────

describe('P0-D E2E: auto-update shrink via installSkills (P0-B path)', () => {
  it('claude-code → codex removes version-check and Atomic SessionStart residue', () => {
    withIsolatedHome((h) => {
      const project = projectDir(h, 'proj-shrink-codex');

      // Preserve third-party SessionStart through shrink.
      const settingsPath = join(project, CLAUDE_SETTINGS_REL);
      mkdirSync(join(project, '.claude'), { recursive: true });
      const thirdParty = { type: 'command', command: '/usr/local/bin/other-hook.sh' };
      writeFileSync(
        settingsPath,
        `${JSON.stringify({
          theme: 'dark',
          hooks: { SessionStart: [{ matcher: '*', hooks: [thirdParty] }] },
        }, null, 2)}\n`,
      );

      installSkills(project, installOpts(['claude-code']));
      const hookAbs = join(project, VERSION_CHECK_REL);
      assert.ok(existsSync(hookAbs), 'precondition: version-check staged');
      const pre = JSON.parse(readFileSync(settingsPath, 'utf8'));
      assert.ok(
        pre.hooks.SessionStart.flatMap((e) => e.hooks)
          .some((hh) => isVersionCheckCommand(hh.command, hookAbs)),
        'precondition: Atomic SessionStart present',
      );

      installSkills(project, installOpts(['codex']));

      assert.equal(existsSync(hookAbs), false, 'version-check.sh gone after codex shrink');
      assert.ok(existsSync(settingsPath), 'settings.json kept for third-party content');
      const post = JSON.parse(readFileSync(settingsPath, 'utf8'));
      assert.equal(post.theme, 'dark');
      assert.ok(
        post.hooks.SessionStart.flatMap((e) => e.hooks)
          .some((hh) => hh.command === thirdParty.command),
        'third-party SessionStart preserved',
      );
      assertNoAtomicSessionStart(settingsPath, hookAbs);

      const journal = readManifest(project);
      assert.equal(
        (journal.effects || []).filter(isAutoUpdateJournalEffect).length,
        0,
        'journal has no auto-update effects after codex-only installSkills',
      );
      assert.ok(
        existsSync(join(project, '.agents/skills/atomic-skills/fix/SKILL.md')),
        'codex skill tree present after shrink',
      );
    });
  });

  it('claude-code+grok → cursor clears both auto-update surfaces', () => {
    withIsolatedHome((h) => {
      const project = projectDir(h, 'proj-shrink-cursor');

      installSkills(project, installOpts(['claude-code', 'grok']));
      const hookAbs = join(project, VERSION_CHECK_REL);
      const grokHookPath = join(project, GROK_AUTO_UPDATE_HOOK_REL);
      assert.ok(existsSync(hookAbs), 'precondition: version-check');
      assert.ok(existsSync(grokHookPath), 'precondition: grok auto-update hook');

      installSkills(project, installOpts(['cursor']));

      assert.equal(existsSync(hookAbs), false, 'version-check removed');
      assert.equal(existsSync(grokHookPath), false, 'grok auto-update hook removed');
      assertNoAtomicSessionStart(join(project, CLAUDE_SETTINGS_REL), hookAbs);

      const journal = readManifest(project);
      assert.equal(
        (journal.effects || []).filter(isAutoUpdateJournalEffect).length,
        0,
      );
      assert.ok(
        existsSync(join(project, '.cursor/skills/atomic-skills/fix/SKILL.md')),
        'cursor skill tree present',
      );
    });
  });
});

// ─── 5–6. Grok host + isolation via installSkills + host sync (mock) ─────────

describe('P0-D E2E: Grok host last-owner / multi-owner shrink (P0-C path)', () => {
  it('last owner: installSkills with grok → reinstall without grok cleans host + isolation', () => {
    withIsolatedHome((h) => {
      const project = projectDir(h, 'proj-grok-last');
      const host = mockHostRunner();

      fullProjectInstall(project, ['grok'], { home: h, host });

      assert.ok(
        existsSync(join(project, GROK_PLUGIN_PACKAGE_REL, 'plugin.json')),
        'precondition: grok plugin package on disk',
      );
      assert.ok(
        host.calls.some((c) => c.args[1] === 'install'),
        'precondition: host register invoked',
      );
      // Isolation applied during full install path
      const cfgPath = resolveGrokUserConfigPath({ home: h });
      assert.ok(existsSync(cfgPath), 'precondition: grok user config');
      assert.ok(
        skillsIgnoreContainsAll(readFileSync(cfgPath, 'utf8')),
        'precondition: foreign-skills isolation present',
      );

      // Shrink away from grok (last owner).
      const host2 = mockHostRunner();
      fullProjectInstall(project, ['cursor'], { home: h, host: host2 });

      assert.ok(
        host2.calls.some((c) => c.args[1] === 'uninstall'),
        'last-owner shrink must unregister host plugin',
      );
      if (existsSync(cfgPath)) {
        assert.ok(
          !skillsIgnoreContainsAll(readFileSync(cfgPath, 'utf8')),
          'last-owner shrink removes foreign-skills isolation',
        );
      }
      // Package tree is journal-owned — shrink to cursor should drop .grok plugin tree.
      assert.equal(
        existsSync(join(project, GROK_PLUGIN_PACKAGE_REL, 'plugin.json')),
        false,
        'grok plugin package removed from install base after shrink',
      );
    });
  });

  it('multi-owner: shrink A keeps host+isolation; shrink B removes both', () => {
    withIsolatedHome((h) => {
      const a = projectDir(h, 'proj-a');
      const b = projectDir(h, 'proj-b');

      const hostA = mockHostRunner();
      fullProjectInstall(a, ['grok'], { home: h, host: hostA });
      const hostB = mockHostRunner();
      fullProjectInstall(b, ['grok'], { home: h, host: hostB });

      const cfgPath = resolveGrokUserConfigPath({ home: h });
      assert.ok(skillsIgnoreContainsAll(readFileSync(cfgPath, 'utf8')));

      // Shrink A away from grok — B still owns host.
      const hostShrinkA = mockHostRunner({
        run: (_bin, args) => {
          if (args[1] === 'install') {
            // Survivor already registered — non-destructive restage path.
            return { status: 1, stdout: '', stderr: 'Plugin already installed' };
          }
          if (args[1] === 'uninstall') {
            return { status: 0, stdout: 'uninstalled\n', stderr: '' };
          }
          return { status: 1, stdout: '', stderr: 'unexpected' };
        },
      });
      fullProjectInstall(a, ['cursor'], { home: h, host: hostShrinkA });

      assert.ok(
        !hostShrinkA.calls.some((c) => c.args[1] === 'uninstall'),
        'shrink A must not unregister host while B still has grok',
      );
      assert.ok(
        skillsIgnoreContainsAll(readFileSync(cfgPath, 'utf8')),
        'isolation kept while B remains a grok owner',
      );
      assert.ok(
        existsSync(join(b, GROK_PLUGIN_PACKAGE_REL, 'plugin.json')),
        'survivor B package intact',
      );

      // Shrink B (last grok owner) → host + isolation gone.
      const hostShrinkB = mockHostRunner();
      fullProjectInstall(b, ['cursor'], { home: h, host: hostShrinkB });

      assert.ok(
        hostShrinkB.calls.some((c) => c.args[1] === 'uninstall'),
        'last owner B must unregister host',
      );
      if (existsSync(cfgPath)) {
        assert.ok(
          !skillsIgnoreContainsAll(readFileSync(cfgPath, 'utf8')),
          'isolation removed after last grok owner leaves',
        );
      }
    });
  });
});
