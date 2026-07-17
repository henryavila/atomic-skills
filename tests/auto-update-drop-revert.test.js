/**
 * P0-B / F-002 — consumer fallback: IDE shrink must revert dropped auto-update
 * effects (stageRuntimeArtifacts + jsonMerge) before the Driver rewrites the
 * journal. REMOVE this suite's workaround-only paths when engine drop-revert
 * lands in the pin (same PR as deleting auto-update-drop-revert.js).
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineInstaller } from '@henryavila/minimalist-installer';
import { createStageRuntimeArtifactsEffect } from '../src/runtime-layers/effects/stage-runtime-artifacts.js';
import {
  createAutoUpdateRuntimeProvider,
  GROK_AUTO_UPDATE_HOOK_REL,
  shellQuote,
} from '../src/runtime-layers/auto-update.js';
import {
  revertDroppedAutoUpdateEffects,
  autoUpdateDropPendingPath,
  isAutoUpdateJournalEffect,
  findDroppedAutoUpdateEffects,
  plannedAutoUpdateEffectIds,
  VERSION_CHECK_REL,
  CLAUDE_SETTINGS_REL,
} from '../src/runtime-layers/auto-update-drop-revert.js';
import { installSkills } from '../src/install.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SKILLS_DIR = join(__dirname, '..', 'skills');
const META_DIR = join(__dirname, '..', 'meta');

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'as-autoupdate-drop-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function makeSkillsDir(root) {
  const skillsDir = join(root, 'skills');
  mkdirSync(join(skillsDir, 'shared', 'auto-update-hook'), { recursive: true });
  writeFileSync(
    join(skillsDir, 'shared', 'auto-update-hook', 'version-check.sh'),
    '#!/usr/bin/env bash\necho hi\n',
  );
  return skillsDir;
}

function autoUpdateInstaller(skillsDir, ides) {
  return defineInstaller({
    effects: [createStageRuntimeArtifactsEffect()],
    providers: [createAutoUpdateRuntimeProvider()],
    config: { manifestDir: '.atomic-skills', skillsDir, ides },
  });
}

function isVersionCheckCommand(command, absPath) {
  if (typeof command !== 'string') return false;
  return command === absPath
    || command === shellQuote(absPath)
    || command.replace(/^'|'$/g, '') === absPath;
}

function assertNoAtomicSessionStart(settingsPath, hookAbs) {
  if (!existsSync(settingsPath)) return;
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  const starts = settings.hooks?.SessionStart ?? [];
  const cmds = starts.flatMap((e) => (e.hooks ?? []).map((h) => h.command));
  assert.equal(
    cmds.some((c) => isVersionCheckCommand(c, hookAbs)),
    false,
    'Atomic Skills version-check SessionStart must not remain in settings',
  );
}

describe('auto-update drop-revert helpers (P0-B / F-002)', () => {
  it('classifies journal auto-update effects by id and beforeState', () => {
    assert.equal(
      isAutoUpdateJournalEffect({
        type: 'stageRuntimeArtifacts',
        id: `stageRuntimeArtifacts:${VERSION_CHECK_REL}`,
        beforeState: { created: [VERSION_CHECK_REL] },
      }),
      true,
    );
    assert.equal(
      isAutoUpdateJournalEffect({
        type: 'jsonMerge',
        id: `jsonMerge:${CLAUDE_SETTINGS_REL}`,
        beforeState: { path: CLAUDE_SETTINGS_REL, inserts: [] },
      }),
      true,
    );
    assert.equal(
      isAutoUpdateJournalEffect({
        type: 'jsonMerge',
        id: `jsonMerge:${GROK_AUTO_UPDATE_HOOK_REL}`,
        beforeState: { path: GROK_AUTO_UPDATE_HOOK_REL, inserts: [] },
      }),
      true,
    );
    assert.equal(
      isAutoUpdateJournalEffect({
        type: 'reconcileFileSet',
        id: 'reconcileFileSet',
        beforeState: [],
      }),
      false,
    );
  });

  it('findDroppedAutoUpdateEffects returns reverse-order drops vs plan', () => {
    withTmp((root) => {
      const skillsDir = makeSkillsDir(root);
      const projectDir = join(root, 'install');
      mkdirSync(projectDir, { recursive: true });
      autoUpdateInstaller(skillsDir, ['claude-code', 'grok']).install({ projectDir });

      const prior = JSON.parse(
        readFileSync(join(projectDir, '.atomic-skills', 'manifest.json'), 'utf8'),
      );
      const plannedIds = plannedAutoUpdateEffectIds(
        { skillsDir, ides: ['codex'] },
        projectDir,
      );
      assert.equal(plannedIds.size, 0, 'codex plan has zero auto-update effects');

      const dropped = findDroppedAutoUpdateEffects(prior, plannedIds);
      assert.ok(dropped.length >= 2, 'stage + at least one host surface dropped');
      // Reverse application order: last applied first.
      const ids = dropped.map((d) => d.id);
      assert.ok(ids.includes(`stageRuntimeArtifacts:${VERSION_CHECK_REL}`));
      assert.ok(ids.includes(`jsonMerge:${CLAUDE_SETTINGS_REL}`));
      assert.ok(ids.includes(`jsonMerge:${GROK_AUTO_UPDATE_HOOK_REL}`));
      assert.equal(ids[ids.length - 1], `stageRuntimeArtifacts:${VERSION_CHECK_REL}`);
    });
  });
});

describe('auto-update IDE shrink (P0-B / F-002)', () => {
  it('claude-code → codex removes version-check and Atomic SessionStart residue', () => {
    withTmp((root) => {
      const skillsDir = makeSkillsDir(root);
      const projectDir = join(root, 'install');
      mkdirSync(projectDir, { recursive: true });

      // Preserve third-party SessionStart through shrink.
      const settingsPath = join(projectDir, '.claude', 'settings.json');
      mkdirSync(join(projectDir, '.claude'), { recursive: true });
      const thirdParty = { type: 'command', command: '/usr/local/bin/other-hook.sh' };
      writeFileSync(
        settingsPath,
        `${JSON.stringify({ theme: 'dark', hooks: { SessionStart: [{ matcher: '*', hooks: [thirdParty] }] } }, null, 2)}\n`,
      );

      autoUpdateInstaller(skillsDir, ['claude-code']).install({ projectDir });

      const hookAbs = join(projectDir, VERSION_CHECK_REL);
      assert.ok(existsSync(hookAbs), 'precondition: version-check staged');
      const pre = JSON.parse(readFileSync(settingsPath, 'utf8'));
      assert.ok(
        pre.hooks.SessionStart.flatMap((e) => e.hooks)
          .some((h) => isVersionCheckCommand(h.command, hookAbs)),
        'precondition: Atomic SessionStart present',
      );

      // Shrink: drop auto-update surfaces, then install codex-only plan.
      revertDroppedAutoUpdateEffects(projectDir, { skillsDir, ides: ['codex'] });
      autoUpdateInstaller(skillsDir, ['codex']).install({ projectDir });

      assert.equal(
        existsSync(hookAbs),
        false,
        'version-check.sh must be gone after shrink to codex',
      );
      assert.ok(existsSync(settingsPath), 'settings.json kept for third-party content');
      const post = JSON.parse(readFileSync(settingsPath, 'utf8'));
      assert.equal(post.theme, 'dark', 'unrelated settings preserved');
      assert.ok(
        post.hooks.SessionStart.flatMap((e) => e.hooks)
          .some((h) => h.command === thirdParty.command),
        'third-party SessionStart preserved surgically',
      );
      assertNoAtomicSessionStart(settingsPath, hookAbs);

      // Journal must not still claim auto-update ownership after shrink.
      const journal = JSON.parse(
        readFileSync(join(projectDir, '.atomic-skills', 'manifest.json'), 'utf8'),
      );
      const autoFx = (journal.effects || []).filter(isAutoUpdateJournalEffect);
      assert.equal(autoFx.length, 0, 'no auto-update effects remain in journal');
      assert.equal(existsSync(autoUpdateDropPendingPath(projectDir)), false);
    });
  });

  it('claude-code+grok → cursor clears both auto-update surfaces', () => {
    withTmp((root) => {
      const skillsDir = makeSkillsDir(root);
      const projectDir = join(root, 'install');
      mkdirSync(projectDir, { recursive: true });

      autoUpdateInstaller(skillsDir, ['claude-code', 'grok']).install({ projectDir });

      const hookAbs = join(projectDir, VERSION_CHECK_REL);
      const settingsPath = join(projectDir, CLAUDE_SETTINGS_REL);
      const grokHookPath = join(projectDir, GROK_AUTO_UPDATE_HOOK_REL);
      assert.ok(existsSync(hookAbs));
      assert.ok(existsSync(settingsPath));
      assert.ok(existsSync(grokHookPath));

      revertDroppedAutoUpdateEffects(projectDir, { skillsDir, ides: ['cursor'] });
      autoUpdateInstaller(skillsDir, ['cursor']).install({ projectDir });

      assert.equal(existsSync(hookAbs), false, 'version-check.sh removed');
      assert.equal(existsSync(grokHookPath), false, 'Grok auto-update hook removed');
      assertNoAtomicSessionStart(settingsPath, hookAbs);
      // Claude settings file may be fully removed if we created it and emptied it.
      if (existsSync(settingsPath)) {
        const post = JSON.parse(readFileSync(settingsPath, 'utf8'));
        const starts = post.hooks?.SessionStart ?? [];
        assert.equal(
          starts.flatMap((e) => e.hooks ?? []).length,
          0,
          'no residual SessionStart entries from Atomic Skills',
        );
      }

      const journal = JSON.parse(
        readFileSync(join(projectDir, '.atomic-skills', 'manifest.json'), 'utf8'),
      );
      assert.equal(
        (journal.effects || []).filter(isAutoUpdateJournalEffect).length,
        0,
      );
    });
  });

  it('mid-drop fault leaves pending ledger; resume cleans residue', () => {
    withTmp((root) => {
      const skillsDir = makeSkillsDir(root);
      const projectDir = join(root, 'install');
      mkdirSync(projectDir, { recursive: true });

      autoUpdateInstaller(skillsDir, ['claude-code', 'grok']).install({ projectDir });
      const hookAbs = join(projectDir, VERSION_CHECK_REL);
      const settingsPath = join(projectDir, CLAUDE_SETTINGS_REL);
      const grokHookPath = join(projectDir, GROK_AUTO_UPDATE_HOOK_REL);

      assert.throws(
        () => revertDroppedAutoUpdateEffects(
          projectDir,
          { skillsDir, ides: ['cursor'] },
          { injectFailAfterN: 1 },
        ),
        (err) => err?.code === 'AUTO_UPDATE_DROP_INJECTED_FAIL',
      );

      assert.ok(
        existsSync(autoUpdateDropPendingPath(projectDir)),
        'drop intent ledger survives mid-drop kill',
      );
      const ledger = JSON.parse(readFileSync(autoUpdateDropPendingPath(projectDir), 'utf8'));
      assert.ok(ledger.items.some((i) => i.status === 'reverted'));
      assert.ok(ledger.items.some((i) => i.status === 'pending'));

      // At least one surface may still be present — resume must finish the job.
      const result = revertDroppedAutoUpdateEffects(projectDir, { skillsDir, ides: ['cursor'] });
      assert.equal(result.resumed, true);
      assert.equal(existsSync(autoUpdateDropPendingPath(projectDir)), false);

      autoUpdateInstaller(skillsDir, ['cursor']).install({ projectDir });

      assert.equal(existsSync(hookAbs), false);
      assert.equal(existsSync(grokHookPath), false);
      assertNoAtomicSessionStart(settingsPath, hookAbs);
    });
  });

  it('installSkills claude → codex shrink removes auto-update residue (integration)', () => {
    withTmp((root) => {
      const projectDir = join(root, 'install');
      mkdirSync(projectDir, { recursive: true });

      installSkills(projectDir, {
        language: 'en',
        ides: ['claude-code'],
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
        scope: 'project',
      });

      const hookAbs = join(projectDir, VERSION_CHECK_REL);
      const settingsPath = join(projectDir, CLAUDE_SETTINGS_REL);
      assert.ok(existsSync(hookAbs), 'precondition: version-check from installSkills');
      assert.ok(existsSync(settingsPath), 'precondition: Claude settings from installSkills');

      installSkills(projectDir, {
        language: 'en',
        ides: ['codex'],
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
        scope: 'project',
      });

      assert.equal(existsSync(hookAbs), false, 'installSkills shrink drops version-check');
      assertNoAtomicSessionStart(settingsPath, hookAbs);

      const journal = JSON.parse(
        readFileSync(join(projectDir, '.atomic-skills', 'manifest.json'), 'utf8'),
      );
      assert.equal(
        (journal.effects || []).filter(isAutoUpdateJournalEffect).length,
        0,
        'journal has no auto-update effects after codex-only installSkills',
      );
    });
  });

  it('installSkills claude+grok → cursor shrink clears both surfaces (integration)', () => {
    withTmp((root) => {
      const projectDir = join(root, 'install');
      mkdirSync(projectDir, { recursive: true });

      installSkills(projectDir, {
        language: 'en',
        ides: ['claude-code', 'grok'],
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
        scope: 'project',
      });

      const hookAbs = join(projectDir, VERSION_CHECK_REL);
      const grokHookPath = join(projectDir, GROK_AUTO_UPDATE_HOOK_REL);
      assert.ok(existsSync(hookAbs));
      assert.ok(existsSync(grokHookPath));

      installSkills(projectDir, {
        language: 'en',
        ides: ['cursor'],
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
        scope: 'project',
      });

      assert.equal(existsSync(hookAbs), false);
      assert.equal(existsSync(grokHookPath), false);
      assertNoAtomicSessionStart(join(projectDir, CLAUDE_SETTINGS_REL), hookAbs);
    });
  });
});
