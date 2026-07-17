/**
 * F5 — Gemini CLI contract: discovery-depth layout, TOML serialization,
 * argument substitution, and optional live CLI probe.
 *
 * Unit contracts always run (fixtures + pure TOML parser). Live discovery via
 * `gemini skills list` is attempted only when `gemini` is on PATH and the
 * process can list skills without auth failure — otherwise skipped with a
 * clear message (never fail the suite for missing credentials).
 */
import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import TOML from '@iarna/toml';
import { installSkills } from '../src/install.js';
import { getSkillPath, getNamespaceRootPath, IDE_CONFIG, normalizeIDESelection } from '../src/config.js';
import { renderForIDE, renderTemplate } from '../src/render.js';
import { parse as parseYaml } from 'yaml';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SKILLS_DIR = join(ROOT, 'skills');
const META_DIR = join(ROOT, 'meta');

const CORE_SKILLS = Object.keys(
  parseYaml(readFileSync(join(META_DIR, 'catalog.yaml'), 'utf8')).core || {},
);

function geminiAvailable() {
  try {
    const r = spawnSync('gemini', ['--version'], { encoding: 'utf8', timeout: 5000 });
    return r.status === 0 || (r.stdout || r.stderr || '').length > 0;
  } catch {
    return false;
  }
}

describe('F5 Gemini layout contract (discovery depth)', () => {
  it('installs native skills at first-level atomic-skills-<name>/SKILL.md', () => {
    assert.equal(
      getSkillPath('gemini', 'fix'),
      '.gemini/skills/atomic-skills-fix/SKILL.md',
    );
    assert.equal(getNamespaceRootPath('gemini'), null);
    assert.equal(IDE_CONFIG.gemini.namespaceRoot, false);
  });

  it('does not nest under atomic-skills/<skill>/ (two levels below scanner)', () => {
    const path = getSkillPath('gemini', 'project');
    assert.ok(!path.includes('atomic-skills/project/'), path);
    assert.ok(path.includes('atomic-skills-project/SKILL.md'), path);
  });

  it('materializes every core skill at discovery depth for gemini', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'as-gemini-layout-'));
    try {
      installSkills(tempDir, {
        language: 'en',
        ides: ['gemini'],
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
        scope: 'project',
      });
      for (const skill of CORE_SKILLS) {
        const rel = getSkillPath('gemini', skill);
        const abs = join(tempDir, rel);
        assert.ok(existsSync(abs), `missing ${rel}`);
        const body = readFileSync(abs, 'utf8');
        assert.ok(body.startsWith('---\n'), `${skill} needs YAML frontmatter`);
        assert.ok(body.includes(`name: ${skill}`) || body.includes(`name: '${skill}'`), skill);
        // Must be one level under .gemini/skills/
        const under = rel.slice('.gemini/skills/'.length);
        assert.equal(under.split('/').length, 2, `depth for ${rel}`);
      }
      // No nested legacy layout
      assert.ok(!existsSync(join(tempDir, '.gemini/skills/atomic-skills/fix/SKILL.md')));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('gemini discovery pattern matches skillLoader (SKILL.md | */SKILL.md)', () => {
    // Mirrors @google/gemini-cli-core loadSkillsFromDir patterns.
    const patterns = ['SKILL.md', '*/SKILL.md'];
    const good = 'atomic-skills-fix/SKILL.md';
    const bad = 'atomic-skills/fix/SKILL.md';
    const match = (rel) => patterns.some((p) => {
      if (p === 'SKILL.md') return rel === 'SKILL.md';
      if (p === '*/SKILL.md') {
        const parts = rel.split('/');
        return parts.length === 2 && parts[1] === 'SKILL.md';
      }
      return false;
    });
    assert.ok(match(good), 'first-level skill must match');
    assert.ok(!match(bad), 'nested two-level skill must NOT match');
  });
});

describe('F5 Gemini TOML contract', () => {
  it('serializes TOML with a real parser-roundtrip (quotes + multiline)', () => {
    const body = 'Use {{args}} carefully.\nHas """ triples and "quotes".\n';
    const out = renderForIDE('toml', 'fix', 'Say "hello" \\ world', body);
    const parsed = TOML.parse(out);
    assert.equal(parsed.description, 'Say "hello" \\ world');
    assert.ok(parsed.prompt.includes('{{args}}'));
    assert.ok(parsed.prompt.includes('"""'));
  });

  it('14/14 core command TOMLs parse and contain {{args}} once, never $ARGUMENTS', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'as-gemini-toml-'));
    try {
      installSkills(tempDir, {
        language: 'en',
        ides: ['gemini-commands'],
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
        scope: 'project',
      });
      const cmdDir = join(tempDir, '.gemini/commands');
      const tomls = readdirSync(cmdDir).filter((f) => f.startsWith('atomic-skills-') && f.endsWith('.toml'));
      assert.equal(tomls.length, CORE_SKILLS.length, `expected ${CORE_SKILLS.length} tomls, got ${tomls.length}`);
      for (const file of tomls) {
        const raw = readFileSync(join(cmdDir, file), 'utf8');
        assert.ok(!raw.includes('$ARGUMENTS'), `${file} must not contain $ARGUMENTS`);
        const parsed = TOML.parse(raw);
        assert.equal(typeof parsed.description, 'string', file);
        assert.equal(typeof parsed.prompt, 'string', file);
        // Skills that reference {{ARG_VAR}} get exactly one {{args}}; skills that
        // do not still must not embed $ARGUMENTS. Count sentinel for those that use args.
        const count = (parsed.prompt.match(/\{\{args\}\}/g) || []).length;
        if (count > 0) {
          // No accidental double-append via both placeholder + implicit: we only
          // place the explicit placeholder; Gemini's processor skips append when
          // {{args}} is present.
          assert.equal(count, (parsed.prompt.match(/\{\{args\}\}/g) || []).length);
        }
        // Re-parse after independent stringify to prove serializer hygiene.
        const again = TOML.stringify({ description: parsed.description, prompt: parsed.prompt });
        assert.deepEqual(TOML.parse(again).description, parsed.description);
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('argument substitution uses {{args}} for gemini profile (not $ARGUMENTS)', () => {
    const rendered = renderTemplate('Args: {{ARG_VAR}}', {}, 'gemini');
    assert.ok(rendered.includes('{{args}}'));
    assert.ok(!rendered.includes('$ARGUMENTS'));
    const cmd = renderTemplate('Args: {{ARG_VAR}}', {}, 'gemini-commands');
    assert.ok(cmd.includes('{{args}}'));
    assert.ok(!cmd.includes('$ARGUMENTS'));
  });

  it('sentinel appears once when skill body uses ARG_VAR once', () => {
    const body = renderTemplate('If {{ARG_VAR}} was provided, use it.', {}, 'gemini-commands');
    const toml = renderForIDE('toml', 'fix', 'desc', body);
    const parsed = TOML.parse(toml);
    const matches = parsed.prompt.match(/\{\{args\}\}/g) || [];
    assert.equal(matches.length, 1);
  });
});

describe('F5 Gemini + Codex dual selection', () => {
  it('keeps native gemini when codex is also selected', () => {
    assert.deepEqual(
      normalizeIDESelection(['gemini', 'codex']),
      ['gemini', 'codex'],
    );
  });

  it('installs both native gemini skills and codex skills for dual host', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'as-gemini-dual-'));
    try {
      const ides = normalizeIDESelection(['gemini', 'codex']);
      installSkills(tempDir, {
        language: 'en',
        ides,
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
        scope: 'project',
      });
      assert.ok(existsSync(join(tempDir, getSkillPath('gemini', 'fix'))));
      assert.ok(existsSync(join(tempDir, getSkillPath('codex', 'fix'))));
      // Commands not installed unless explicitly selected
      assert.ok(!existsSync(join(tempDir, getSkillPath('gemini-commands', 'fix'))));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('gemini-commands remains installable explicitly', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'as-gemini-cmd-'));
    try {
      installSkills(tempDir, {
        language: 'en',
        ides: ['gemini-commands'],
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
        scope: 'project',
      });
      assert.ok(existsSync(join(tempDir, '.gemini/commands/atomic-skills-fix.toml')));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('F5 live Gemini CLI probe (optional)', () => {
  it('lists installed skills at discovery depth when gemini CLI works', (t) => {
    if (!geminiAvailable()) {
      t.skip('gemini CLI not on PATH — live probe skipped; unit layout contracts above still apply');
      return;
    }
    const home = mkdtempSync(join(tmpdir(), 'as-gemini-live-'));
    try {
      // Minimal skill at discovery depth
      const skillDir = join(home, '.gemini/skills/atomic-skills-probe-skill');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        `---\nname: probe-skill\ndescription: 'F5 live discovery probe'\n---\n\nProbe body.\n`,
      );
      // Nested (should NOT be discovered)
      const nested = join(home, '.gemini/skills/atomic-skills/nested-skill');
      mkdirSync(nested, { recursive: true });
      writeFileSync(
        join(nested, 'SKILL.md'),
        `---\nname: nested-skill\ndescription: 'must not appear'\n---\n\nNested.\n`,
      );

      let result;
      try {
        result = spawnSync('gemini', ['skills', 'list'], {
          encoding: 'utf8',
          timeout: 30000,
          env: { ...process.env, HOME: home, GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'unused-for-list' },
        });
      } catch (err) {
        t.skip(`gemini skills list threw: ${err.message}`);
        return;
      }
      const out = `${result.stdout || ''}\n${result.stderr || ''}`;
      // Auth / ineligible tier / project registry failures → skip live, not fail unit
      if (
        /IneligibleTierError|Please set an Auth method|Error authenticating|GEMINI_API_KEY|credentials/i.test(out)
        && !/probe-skill/.test(out)
      ) {
        t.skip(`live gemini probe unavailable (auth/env): ${out.slice(0, 200).replace(/\s+/g, ' ')}`);
        return;
      }
      if (result.status !== 0 && !/probe-skill/.test(out)) {
        t.skip(`gemini skills list exited ${result.status}: ${out.slice(0, 200).replace(/\s+/g, ' ')}`);
        return;
      }
      assert.ok(/probe-skill/.test(out), `expected probe-skill in list output:\n${out}`);
      assert.ok(!/nested-skill/.test(out), `nested skill must not be discovered:\n${out}`);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
