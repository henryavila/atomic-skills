import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  GROK_AGENTS_ATOMIC_SKILLS_IGNORE,
  GROK_FOREIGN_ATOMIC_SKILLS_IGNORES,
  ensureSkillsIgnoreEntry,
  ensureAllForeignSkillsIgnores,
  removeSkillsIgnoreEntry,
  removeAllForeignSkillsIgnores,
  skillsIgnoreContains,
  skillsIgnoreContainsAll,
  applyGrokAgentsIsolation,
  revertGrokAgentsIsolation,
  resolveGrokUserConfigPath,
} from '../../src/runtime-layers/grok-agents-isolation.js';
import { writeManifest } from '../../src/manifest.js';

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'grok-agents-iso-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('ensureSkillsIgnoreEntry creates [skills] ignore on empty file', () => {
  const { text, changed, createdSection } = ensureSkillsIgnoreEntry('', GROK_AGENTS_ATOMIC_SKILLS_IGNORE);
  assert.equal(changed, true);
  assert.equal(createdSection, true);
  assert.ok(skillsIgnoreContains(text, GROK_AGENTS_ATOMIC_SKILLS_IGNORE));
  assert.match(text, /\[skills\]/);
  assert.match(text, /ignore\s*=\s*\[/);
});

test('ensureSkillsIgnoreEntry is idempotent', () => {
  const first = ensureSkillsIgnoreEntry('', GROK_AGENTS_ATOMIC_SKILLS_IGNORE).text;
  const second = ensureSkillsIgnoreEntry(first, GROK_AGENTS_ATOMIC_SKILLS_IGNORE);
  assert.equal(second.changed, false);
  assert.equal(second.text, first);
});

test('ensureSkillsIgnoreEntry appends to existing ignore without dropping others', () => {
  const src = `[ui]\nyolo = true\n\n[skills]\nignore = ["~/other"]\npaths = ["~/x"]\n`;
  const { text, changed } = ensureSkillsIgnoreEntry(src, GROK_AGENTS_ATOMIC_SKILLS_IGNORE);
  assert.equal(changed, true);
  assert.ok(skillsIgnoreContains(text, '~/other'));
  assert.ok(skillsIgnoreContains(text, GROK_AGENTS_ATOMIC_SKILLS_IGNORE));
  assert.match(text, /paths\s*=/);
  assert.match(text, /yolo\s*=\s*true/);
});

test('ensureSkillsIgnoreEntry inserts ignore under existing [skills] without ignore', () => {
  const src = `[skills]\npaths = ["~/x"]\n`;
  const { text, changed } = ensureSkillsIgnoreEntry(src, GROK_AGENTS_ATOMIC_SKILLS_IGNORE);
  assert.equal(changed, true);
  assert.ok(skillsIgnoreContains(text, GROK_AGENTS_ATOMIC_SKILLS_IGNORE));
  assert.match(text, /paths\s*=\s*\["~\/x"\]/);
});

test('ensureAllForeignSkillsIgnores covers agents+cursor+claude roots', () => {
  const { text, changed } = ensureAllForeignSkillsIgnores('');
  assert.equal(changed, true);
  assert.ok(skillsIgnoreContainsAll(text));
  for (const entry of GROK_FOREIGN_ATOMIC_SKILLS_IGNORES) {
    assert.ok(skillsIgnoreContains(text, entry), `missing ${entry}`);
  }
  // Cursor path is the live duplicate source (user:project)
  assert.ok(GROK_FOREIGN_ATOMIC_SKILLS_IGNORES.some((e) => e.includes('.cursor/skills/')));
});

test('ensureAllForeignSkillsIgnores upgrades agents-only config to full set', () => {
  const partial = `[skills]\nignore = ["${GROK_AGENTS_ATOMIC_SKILLS_IGNORE}"]\n`;
  const { text, changed } = ensureAllForeignSkillsIgnores(partial);
  assert.equal(changed, true);
  assert.ok(skillsIgnoreContainsAll(text));
  assert.ok(skillsIgnoreContains(text, GROK_AGENTS_ATOMIC_SKILLS_IGNORE));
});

test('removeSkillsIgnoreEntry is surgical — keeps other ignores and sections', () => {
  const src = `[cli]\ninstaller = "internal"\n\n[skills]\nignore = ["~/other", "${GROK_AGENTS_ATOMIC_SKILLS_IGNORE}"]\npaths = ["~/x"]\n`;
  const { text, changed } = removeSkillsIgnoreEntry(src, GROK_AGENTS_ATOMIC_SKILLS_IGNORE);
  assert.equal(changed, true);
  assert.ok(!skillsIgnoreContains(text, GROK_AGENTS_ATOMIC_SKILLS_IGNORE));
  assert.ok(skillsIgnoreContains(text, '~/other'));
  assert.match(text, /paths/);
  assert.match(text, /installer/);
});

test('removeSkillsIgnoreEntry drops empty ignore and empty [skills]', () => {
  const src = `[skills]\nignore = ["${GROK_AGENTS_ATOMIC_SKILLS_IGNORE}"]\n`;
  const { text, changed, removedFileWorthEmpty } = removeSkillsIgnoreEntry(src, GROK_AGENTS_ATOMIC_SKILLS_IGNORE);
  assert.equal(changed, true);
  assert.equal(removedFileWorthEmpty, true);
  assert.equal(text.trim(), '');
});

test('removeAllForeignSkillsIgnores is surgical — keeps unrelated ignore entries', () => {
  const full = ensureAllForeignSkillsIgnores(`[skills]\nignore = ["~/other"]\n`).text;
  const { text, changed } = removeAllForeignSkillsIgnores(full);
  assert.equal(changed, true);
  assert.ok(!skillsIgnoreContainsAll(text));
  assert.ok(skillsIgnoreContains(text, '~/other'));
  for (const entry of GROK_FOREIGN_ATOMIC_SKILLS_IGNORES) {
    assert.ok(!skillsIgnoreContains(text, entry), `still has ${entry}`);
  }
});

test('applyGrokAgentsIsolation writes all foreign roots under HOME', () => {
  withTmp((home) => {
    const result = applyGrokAgentsIsolation({ ides: ['grok'], home });
    assert.equal(result.status, 'applied');
    const cfg = resolveGrokUserConfigPath({ home });
    assert.ok(existsSync(cfg));
    const body = readFileSync(cfg, 'utf8');
    assert.ok(skillsIgnoreContainsAll(body));
    assert.ok(skillsIgnoreContains(body, GROK_AGENTS_ATOMIC_SKILLS_IGNORE));
    assert.ok(skillsIgnoreContains(body, `~/.cursor/skills/atomic-skills`));

    const again = applyGrokAgentsIsolation({ ides: ['grok'], home });
    assert.equal(again.status, 'already');
  });
});

test('applyGrokAgentsIsolation upgrades partial (agents-only) isolation', () => {
  withTmp((home) => {
    const cfg = resolveGrokUserConfigPath({ home });
    mkdirSync(join(home, '.grok'), { recursive: true });
    writeFileSync(cfg, `[skills]\nignore = ["${GROK_AGENTS_ATOMIC_SKILLS_IGNORE}"]\n`);
    const result = applyGrokAgentsIsolation({ ides: ['grok'], home });
    assert.equal(result.status, 'applied');
    assert.ok(skillsIgnoreContainsAll(readFileSync(cfg, 'utf8')));
  });
});

test('applyGrokAgentsIsolation skips when grok not selected', () => {
  withTmp((home) => {
    const result = applyGrokAgentsIsolation({ ides: ['codex'], home });
    assert.equal(result.status, 'skipped');
    assert.ok(!existsSync(resolveGrokUserConfigPath({ home })));
  });
});

test('revertGrokAgentsIsolation removes all foreign entries when no other grok install', () => {
  withTmp((home) => {
    applyGrokAgentsIsolation({ ides: ['grok'], home });
    // Pre-seed unrelated config so we prove surgical edit
    const cfg = resolveGrokUserConfigPath({ home });
    writeFileSync(cfg, `[cli]\ninstaller = "internal"\n\n${readFileSync(cfg, 'utf8')}`);

    const result = revertGrokAgentsIsolation({
      basePath: home,
      ides: ['grok'],
      home,
      listInstallBases: () => [home],
    });
    assert.equal(result.status, 'removed');
    const body = readFileSync(cfg, 'utf8');
    assert.ok(!skillsIgnoreContainsAll(body));
    for (const entry of GROK_FOREIGN_ATOMIC_SKILLS_IGNORES) {
      assert.ok(!skillsIgnoreContains(body, entry));
    }
    assert.match(body, /installer\s*=\s*"internal"/);
  });
});

test('revertGrokAgentsIsolation keeps ignore when another install still has grok', () => {
  withTmp((home) => {
    applyGrokAgentsIsolation({ ides: ['grok'], home });
    const project = join(home, 'proj');
    mkdirSync(join(project, '.atomic-skills'), { recursive: true });
    writeManifest(project, {
      effects: [],
      version: '2.0.0',
      language: 'en',
      ides: ['grok'],
      modules: {},
      files: {},
    });

    const result = revertGrokAgentsIsolation({
      basePath: home,
      ides: ['grok'],
      home,
      listInstallBases: () => [home, project],
    });
    assert.equal(result.status, 'kept');
    const body = readFileSync(resolveGrokUserConfigPath({ home }), 'utf8');
    assert.ok(skillsIgnoreContainsAll(body));
  });
});
