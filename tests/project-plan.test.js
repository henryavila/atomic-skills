import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { installSkills } from '../src/install.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SKILLS_DIR = join(__dirname, '..', 'skills');
const META_DIR = join(__dirname, '..', 'meta');

describe('project-plan skill (C.T-001 scaffold)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-pp-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function install(language = 'en') {
    installSkills(tempDir, {
      language,
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    return readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-plan.md'),
      'utf8'
    );
  }

  it('renders skill file without template leaks', () => {
    const content = install();
    assert.ok(existsSync(join(tempDir, '.claude/commands/atomic-skills/project-plan.md')));
    assert.ok(!content.includes('{{BASH_TOOL}}'), '{{BASH_TOOL}} must be rendered');
    assert.ok(!content.includes('{{ARG_VAR}}'), '{{ARG_VAR}} must be rendered');
    assert.ok(!content.includes('{{READ_TOOL}}'), '{{READ_TOOL}} must be rendered');
  });

  it('skill body documents the Iron Law (NO PLAN WITHOUT NARRATIVE)', () => {
    const content = install();
    assert.match(content, /Iron Law/);
    assert.match(content, /NO PLAN WITHOUT NARRATIVE/);
  });

  it('skill body documents all 7 stages of the default flow', () => {
    const content = install();
    for (const stage of [
      'Stage 1 — Validate slug',
      'Stage 2 — Detect superpowers',
      'Stage 3 — Optional delegation',
      'Stage 4 — Receive markdown plan',
      'Stage 5 — Decompose',
      'Stage 6 — Create Plan + Initiatives',
      'Stage 7 — Activate first phase',
    ]) {
      assert.ok(content.includes(stage), `missing stage heading: ${stage}`);
    }
  });

  it('skill body references the canonical Plan + Initiative templates', () => {
    const content = install();
    assert.match(content, /skills\/shared\/project-status-assets\/plan\.template\.md/);
    assert.match(content, /skills\/shared\/project-status-assets\/initiative\.template\.md/);
  });

  it('skill body references schema validation via npm run validate-state', () => {
    const content = install();
    assert.match(content, /npm run validate-state/);
  });

  it('skill body documents the Markdown decompose section in detail (C.T-002)', () => {
    const content = install();
    assert.match(content, /## Markdown decompose/);
    // Heuristics: plan title, narrative, principles, glossary, phases, exit-gate, warnings, no-phase guard
    assert.match(content, /first H1.*plan\.title/);
    assert.match(content, /plan\.narrative/);
    assert.match(content, /starts with `princip`/);
    assert.match(content, /starts with `glossar`/);
    // C.T-005 additions
    assert.match(content, /numbered prefixes/);
    assert.match(content, /Princípios invioláveis/);
    assert.match(content, /Sub-fases bullet mode/);
    assert.match(content, /Prose mode/);
    assert.match(content, /Duplicate phase id guard/);
    assert.match(content, /F\\d\+/); // phase regex documented
    assert.match(content, /exit_gate.*exitGate/);
    assert.match(content, /Unrecognized H2/);
    assert.match(content, /No-phase guard/);
    // Helper invocation
    assert.match(content, /src\/decompose\.js/);
    assert.match(content, /decomposePlan/);
    assert.match(content, /previewDecomposition/);
    // Slug derivation
    assert.match(content, /sample-f0-foundation-repair/);
  });

  it('skill body documents Superpowers integration in detail (C.T-003)', () => {
    const content = install();
    assert.match(content, /## Superpowers integration/);
    // Detection: probes both ~/.claude/plugins/superpowers and PATH
    assert.match(content, /\.claude\/plugins\/superpowers/);
    assert.match(content, /command -v superpowers/);
    // Branches A + B with explicit options
    assert.match(content, /Branch A — superpowers available/);
    assert.match(content, /Branch B — superpowers absent/);
    // Delegation commands
    assert.match(content, /superpowers:brainstorm/);
    assert.match(content, /superpowers:write-execution-plan/);
    // Minimal-template fallback
    assert.match(content, /minimal-source\.template\.md/);
    assert.match(content, /\.atomic-skills\/_drafts\//);
    // Explicit failure-mode handling
    assert.match(content, /Failure modes/);
    assert.match(content, /never errors out just because superpowers is absent/);
  });

  it('skill body documents the `adopt` mode in detail (C.T-004)', () => {
    const content = install();
    assert.match(content, /## `adopt <file\.md>`/);
    // Step-by-step
    assert.match(content, /Validate the input/);
    assert.match(content, /Derive the plan slug/);
    assert.match(content, /Collision check/);
    assert.match(content, /Decompose/);
    assert.match(content, /Preview \+ explicit confirmation/);
    assert.match(content, /Materialize/);
    assert.match(content, /Validate/);
    assert.match(content, /Update PROJECT-STATUS\.md/);
    assert.match(content, /Optional source archive/);
    assert.match(content, /Activate first phase/);
    // Helper invocation
    assert.match(content, /materializeDecomposition/);
    // Rollback discipline
    assert.match(content, /roll back/);
    // Failure modes documented
    assert.match(content, /Failure-mode summary/);
    // Reference to the v3-redesign use case is no longer required (cleaner section);
    // assert decompose-throws case is mentioned.
    assert.match(content, /Decompose throws/);
  });

  it('project-plan-assets ship a minimal-source template', () => {
    install();
    const assetPath = join(
      tempDir,
      '.claude/commands/atomic-skills/_assets/minimal-source.template.md'
    );
    assert.ok(existsSync(assetPath), `expected asset at ${assetPath}`);
    const asset = readFileSync(assetPath, 'utf8');
    // Sanity: template has the REPLACE_* markers + at least one phase H2
    assert.match(asset, /REPLACE_PLAN_TITLE/);
    assert.match(asset, /^## F0 —/m);
    assert.match(asset, /exit_gate:/);
  });

  it('skill body documents Red Flags and Rationalization sections', () => {
    const content = install();
    assert.match(content, /## Red Flags/);
    assert.match(content, /## Rationalization/);
  });

  it('skill body declares it depends on .atomic-skills/ existing', () => {
    const content = install();
    assert.match(content, /Run `atomic-skills:project-status` setup first/);
  });

  it('skill body documents schemaVersion 0.1 contract', () => {
    const content = install();
    assert.match(content, /schemaVersion.*'0\.1'/);
  });

  it('skill renders communication-language directive at top when language=pt', () => {
    const content = install('pt');
    assert.match(content.slice(0, 500), /Communicate with the user in Portuguese/);
  });
});
