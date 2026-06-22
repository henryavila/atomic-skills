import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSkillsProvider } from '../../src/providers/skills-provider.js';
import { installSkills } from '../../src/install.js';
import { readManifest } from '../../src/manifest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..', '..');

// A representative config exercising all three IDE formats (command, markdown
// with a namespace root, toml with the flat assets path) + shared assets owned
// by core skills, INCLUDING the nested project-assets/hooks/ subdir.
//
// scope: 'project' keeps the whole install hermetic inside the tmp dir — with
// 'user' scope installSkills would write to the real ~/.atomic-skills and merge
// the real ~/.claude/settings.json (installAutoUpdateHook is catalog-driven, so
// it always runs). The auto-update hook is the runtime layer's domain (T-F3-3),
// not the SkillsProvider's, so it is excluded from the parity set below by its
// `_hooks` manifest source.
const baseConfig = {
  language: 'en',
  ides: ['claude-code', 'codex', 'gemini-commands'],
  modules: {},
  skillsDir: join(PACKAGE_ROOT, 'skills'),
  metaDir: join(PACKAGE_ROOT, 'meta'),
  scope: 'project',
};

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'skills-provider-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// The skills file set the SkillsProvider owns = installSkills' manifest entries
// MINUS the auto-update hook (runtime-layer domain).
function oracleFileSet(oracleDir) {
  const manifest = readManifest(oracleDir);
  assert.ok(manifest && manifest.files, 'oracle manifest written');
  const oracle = new Map();
  for (const [relPath, entry] of Object.entries(manifest.files)) {
    if (entry.source && entry.source.startsWith('_hooks')) continue;
    oracle.set(relPath, readFileSync(join(oracleDir, relPath), 'utf8'));
  }
  return oracle;
}

test('SkillsProvider — plan() emits a single reconcileFileSet effect', () => {
  withTmp((basePath) => {
    const effects = createSkillsProvider().plan(baseConfig, { basePath });
    assert.equal(effects.length, 1);
    const [eff] = effects;
    assert.equal(eff.type, 'reconcileFileSet');
    assert.equal(eff.args.basePath, basePath);
    assert.ok(Array.isArray(eff.args.desired));
    assert.ok(eff.args.desired.length > 0, 'desired file set is non-empty');
    for (const f of eff.args.desired) {
      assert.equal(typeof f.path, 'string');
      assert.equal(typeof f.content, 'string');
    }
  });
});

test('SkillsProvider — desired reproduces installSkills footprint byte-for-byte', () => {
  withTmp((oracleDir) => {
    installSkills(oracleDir, baseConfig); // ground truth
    const oracle = oracleFileSet(oracleDir);

    const [eff] = createSkillsProvider().plan(baseConfig, { basePath: '/anywhere' });
    const desired = new Map(eff.args.desired.map((f) => [f.path, f.content]));

    // Bijection on paths — no missing, no extra.
    assert.deepEqual([...desired.keys()].sort(), [...oracle.keys()].sort());

    // Byte-for-byte content per path.
    for (const [path, content] of oracle) {
      assert.equal(desired.get(path), content, `content mismatch at ${path}`);
    }
  });
});

test('SkillsProvider — covers shared assets including the nested subdir', () => {
  withTmp((oracleDir) => {
    installSkills(oracleDir, baseConfig);
    const oracle = oracleFileSet(oracleDir);
    const [eff] = createSkillsProvider().plan(baseConfig, { basePath: '/anywhere' });
    const desiredPaths = new Set(eff.args.desired.map((f) => f.path));

    const assetPaths = [...oracle.keys()].filter(
      (p) => p.includes('/_assets/') || p.includes('-_assets/')
    );
    assert.ok(assetPaths.length > 0, 'fixture installs shared assets');
    const nested = assetPaths.filter((p) => /_assets\/[^/]+\/[^/]+$/.test(p));
    assert.ok(nested.length > 0, 'fixture exercises a nested asset subdir (project-assets/hooks/)');
    for (const p of assetPaths) assert.ok(desiredPaths.has(p), `provider missing asset ${p}`);
  });
});
