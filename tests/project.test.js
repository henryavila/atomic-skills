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

// After the v2.0.0 unification, `project-status` + `project-plan` are a single
// `project` skill: a thin router (skills/core/project.md) plus lazy detail
// files (skills/shared/project-assets/project-*.md) installed to _assets/.
// The router holds dispatch + always-resident invariants; procedures live in
// the lazy files. Tests therefore assert against BOTH the rendered router and
// the rendered asset files.

describe('project skill (unified router + lazy assets)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-project-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function install(language = 'en', ides = ['claude-code']) {
    installSkills(tempDir, {
      language,
      ides,
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
  }

  const ROUTER = '.claude/commands/atomic-skills/project.md';
  const ASSET = (name) => `.claude/commands/atomic-skills/_assets/${name}`;

  function readRouter() {
    return readFileSync(join(tempDir, ROUTER), 'utf8');
  }
  function readAsset(name) {
    return readFileSync(join(tempDir, ASSET(name)), 'utf8');
  }

  // ─── Router: rendering + structure ──────────────────────────────────────

  it('router renders for claude-code without template leaks', () => {
    install();
    const content = readRouter();
    assert.ok(!content.includes('{{BASH_TOOL}}'), '{{BASH_TOOL}} must be rendered');
    assert.ok(!content.includes('{{ARG_VAR}}'), '{{ARG_VAR}} must be rendered');
    assert.ok(!content.includes('{{READ_TOOL}}'), '{{READ_TOOL}} must be rendered');
    assert.ok(!content.includes('{{ASSETS_PATH}}'), '{{ASSETS_PATH}} must be rendered');
  });

  it('old skill files are gone (project-status.md / project-plan.md)', () => {
    install();
    assert.ok(existsSync(join(tempDir, ROUTER)), 'project.md must exist');
    assert.ok(
      !existsSync(join(tempDir, '.claude/commands/atomic-skills/project-status.md')),
      'project-status.md must NOT be installed'
    );
    assert.ok(
      !existsSync(join(tempDir, '.claude/commands/atomic-skills/project-plan.md')),
      'project-plan.md must NOT be installed'
    );
  });

  it('router documents the Iron Law', () => {
    install();
    const content = readRouter();
    assert.match(content, /Iron Law/);
    assert.match(content, /NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE/);
  });

  it('router holds the always-resident invariants (gate-status, ratify, reconciliation, ladder)', () => {
    install();
    const content = readRouter();
    assert.match(content, /Gate-status invariant/i);
    assert.match(content, /Ratify gate/i);
    assert.match(content, /[Rr]econciliation gate/);
    assert.match(content, /[Ee]mergence ladder/);
    // The magnitude→action table is resident so ambient triggers are recognized.
    assert.match(content, /magnitude/i);
    assert.match(content, /\bpark\b/);
    assert.match(content, /\bsplit-phase\b/);
  });

  it('router holds the dispatch table referencing each lazy detail file', () => {
    install();
    const content = readRouter();
    for (const f of [
      'project-view.md', 'project-verify.md', 'project-setup.md',
      'project-create-plan.md', 'project-create-initiative.md', 'project-discover.md',
      'project-emergence.md', 'project-transitions.md', 'project-migrate.md',
      'project-drift.md',
    ]) {
      assert.ok(content.includes(f), `dispatch table must reference ${f}`);
    }
  });

  it('router stays thin (≤ ~250 lines so the token economy holds)', () => {
    install();
    const lineCount = readRouter().split('\n').length;
    assert.ok(lineCount <= 260, `router should stay thin, got ${lineCount} lines`);
  });

  it('router documents the git-style grammar + new menu (plan | initiative)', () => {
    install();
    const content = readRouter();
    assert.match(content, /atomic-skills:project status/);
    assert.match(content, /\bverify\b/);
    assert.match(content, /new plan/);
    assert.match(content, /new initiative/);
    // new menu exposes only the two file entities
    assert.match(content, /What do you want to create\?/);
  });

  it('router no-args summary does NOT open the browser', () => {
    install();
    const content = readRouter();
    assert.match(content, /No-args/i);
    assert.match(content, /does NOT open the browser|cheap; does NOT/i);
  });

  it('router documents schema quick-reference (Plan / Initiative / Task fields)', () => {
    install();
    const content = readRouter();
    assert.match(content, /Schema quick-reference/i);
    for (const field of [
      'currentPhase', 'parallelismAllowed', 'phases[]',
      'parentPlan', 'phaseId', 'exitGates[]', 'scope',
      'StackFrame', 'CrossTaskRef', 'ExitCriterion',
      'shell', 'query', 'test', 'manual',
    ]) {
      assert.ok(content.includes(field), `schema quick-ref must mention: ${field}`);
    }
  });

  it('router injects communication-language directive at top when language=pt', () => {
    install('pt');
    const content = readRouter();
    assert.match(content.slice(0, 900), /Communicate with the user in Portuguese/);
    assert.match(content, /Iron Law/);
  });

  it('router renders for gemini with proper tool-name substitution', () => {
    install('en', ['gemini']);
    const content = readFileSync(
      join(tempDir, '.gemini/skills/atomic-skills/project/SKILL.md'),
      'utf8'
    );
    assert.ok(content.includes('run_shell_command'), 'Gemini should get run_shell_command');
    assert.ok(!content.includes('{{BASH_TOOL}}'));
  });

  // ─── Lazy asset: view modes ─────────────────────────────────────────────

  it('project-view documents view modes default/--list/--stack/--archived/--browser/--report', () => {
    install();
    const content = readAsset('project-view.md');
    for (const mode of ['--list', '--stack', '--archived', '--browser', '--report', '--terminal', '--plan', '--phase']) {
      assert.ok(content.includes(mode), `project-view must document ${mode}`);
    }
    assert.ok(content.toLowerCase().includes('disambig'), 'view must hold the disambiguation flow');
    assert.ok(content.includes('aiDeck'), 'view must reference aiDeck');
  });

  it('project-view quarantines the aiDeck contract behind a single named constant', () => {
    install();
    const content = readAsset('project-view.md');
    // The cross-repo domain string is preserved (NOT renamed) and parameterized.
    assert.match(content, /AIDECK_STATE_DOMAIN="project-status"/);
    assert.match(content, /AIDECK CONTRACT/);
    // The curl uses the parameter, not a hardcoded inline domain.
    assert.match(content, /state\/\$AIDECK_STATE_DOMAIN/);
    // Separation of produce-data vs deliver-to-aiDeck is documented.
    assert.match(content, /[Pp]roduce the data/);
    assert.match(content, /[Dd]eliver to aiDeck/);
  });

  // ─── Lazy asset: verify (NEW) ───────────────────────────────────────────

  it('project-verify defines an explicit contract (NEW command)', () => {
    install();
    const content = readAsset('project-verify.md');
    assert.match(content, /\bverify\b/);
    assert.match(content, /## Contract/);
    // read-only by default; only --fix mutates, and only via normalize.
    assert.match(content, /READ-ONLY/);
    assert.match(content, /--fix/);
    // wraps the existing machinery
    assert.match(content, /validate-state/);
    assert.match(content, /branch/i);
    assert.match(content, /[Oo]rphan/);
    assert.match(content, /scope/i);
    assert.match(content, /aideck|aiDeck/i);
    // failure messages
    assert.match(content, /FAIL/);
  });

  // ─── Lazy asset: setup ──────────────────────────────────────────────────

  it('project-setup documents the first-time setup flow + gitignore', () => {
    install();
    const content = readAsset('project-setup.md');
    assert.match(content, /CLAUDE\.md/);
    assert.match(content, /AGENTS\.md/);
    assert.match(content, /hooks/);
    assert.match(content, /bootstrap-drafts/);
    assert.match(content, /mkdir -p \.atomic-skills/);
  });

  // ─── Lazy asset: create-plan (former project-plan bootstrap) ─────────────

  it('project-create-plan documents the Iron Law (NO PLAN WITHOUT NARRATIVE)', () => {
    install();
    const content = readAsset('project-create-plan.md');
    assert.match(content, /NO PLAN WITHOUT NARRATIVE/);
  });

  it('project-create-plan documents all 7 stages of the default bootstrap', () => {
    install();
    const content = readAsset('project-create-plan.md');
    for (const stage of [
      'Stage 1 — Validate slug',
      'Stage 2 — Detect superpowers',
      'Stage 3 — Optional delegation',
      'Stage 4 — Receive markdown plan',
      'Stage 5 — Decompose',
      'Stage 6 — Create Plan + Initiatives',
      'Stage 7 — Activate first phase',
    ]) {
      assert.ok(content.includes(stage), `missing stage: ${stage}`);
    }
  });

  it('project-create-plan references templates via ASSETS_PATH (no raw skills/shared path)', () => {
    install();
    const content = readAsset('project-create-plan.md');
    // Rendered ASSETS_PATH form, not the raw source path.
    assert.match(content, /plan\.template\.md/);
    assert.match(content, /initiative\.template\.md/);
    assert.ok(
      !content.includes('skills/shared/project-status-assets'),
      'must not reference the raw source asset path'
    );
    assert.ok(
      !content.includes('skills/shared/project-plan-assets'),
      'must not reference the raw source asset path'
    );
  });

  it('project-create-plan documents the Markdown decompose heuristics', () => {
    install();
    const content = readAsset('project-create-plan.md');
    assert.match(content, /## Markdown decompose/);
    assert.match(content, /first H1.*plan\.title/);
    assert.match(content, /plan\.narrative/);
    assert.match(content, /starts with `princip`/);
    assert.match(content, /starts with `glossar`/);
    assert.match(content, /Princípios invioláveis/);
    assert.match(content, /Sub-fases bullet mode/);
    assert.match(content, /Prose mode/);
    assert.match(content, /Duplicate phase id guard/);
    assert.match(content, /No-phase guard/);
    assert.match(content, /decomposePlan/);
    assert.match(content, /previewDecomposition/);
    assert.match(content, /sample-f0-foundation-repair/);
  });

  it('project-create-plan documents Superpowers integration', () => {
    install();
    const content = readAsset('project-create-plan.md');
    assert.match(content, /## Superpowers integration/);
    assert.match(content, /\.claude\/plugins\/superpowers/);
    assert.match(content, /command -v superpowers/);
    assert.match(content, /Branch A — superpowers available/);
    assert.match(content, /Branch B — superpowers absent/);
    assert.match(content, /superpowers:brainstorm/);
    assert.match(content, /superpowers:write-execution-plan/);
    assert.match(content, /minimal-source\.template\.md/);
    assert.match(content, /never errors out just because superpowers is absent/);
  });

  it('project-create-plan documents the adopt flow in detail', () => {
    install();
    const content = readAsset('project-create-plan.md');
    assert.match(content, /## `adopt <file\.md>`/);
    assert.match(content, /Validate the input/);
    assert.match(content, /Collision check/);
    assert.match(content, /Preview \+ explicit confirmation/);
    assert.match(content, /materializeDecomposition/);
    assert.match(content, /roll back/);
    assert.match(content, /Failure-mode summary/);
  });

  it('router references schemaVersion 0.1', () => {
    install();
    assert.match(readRouter(), /schemaVersion.*'0\.1'/);
  });

  // ─── Lazy asset: create-initiative ──────────────────────────────────────

  it('project-create-initiative documents the new-initiative flow', () => {
    install();
    const content = readAsset('project-create-initiative.md');
    assert.match(content, /standalone/);
    assert.match(content, /active plan/);
    assert.match(content, /plan-membership-block/);
    assert.match(content, /initiative\.template\.md/);
  });

  // ─── Lazy asset: discover (former project-plan discover) ─────────────────

  it('project-discover documents the multi-source pipeline (Phases 1a/1b/2/3/4)', () => {
    install();
    const content = readAsset('project-discover.md');
    for (const token of ['discover', '--dry-run', '--commit', '--scope']) {
      assert.ok(content.includes(token), `missing token: ${token}`);
    }
    assert.match(content, /Phase 1a/);
    assert.match(content, /Phase 1b/);
    for (const cmd of ['git for-each-ref', 'git log --since', 'gh pr list', 'docs/superpowers/plans', 'TODO.md', '.ai/memory']) {
      assert.ok(content.includes(cmd), `missing scan command: ${cmd}`);
    }
    assert.match(content, /topic_hint/);
    assert.match(content, /evidence_quote/);
    assert.match(content, /candidate_completion/);
    for (const token of [
      'Phase 2', 'clusterByExactSlug', 'mergeFuzzySingletons', 'pickCanonicalSlug',
      'Phase 3', 'classifyBucket', 'calculateConfidence',
      'Phase 4', 'draftToInitiative', 'bootstrap-drafts', 'INDEX.md', 'mdprobe',
    ]) {
      assert.ok(content.includes(token), `missing token: ${token}`);
    }
  });

  // ─── Lazy asset: emergence ──────────────────────────────────────────────

  it('project-emergence documents the proposal/ratify/commit pattern + per-rung procedures', () => {
    install();
    const content = readAsset('project-emergence.md');
    assert.match(content, /Proposed mutation:/);
    assert.match(content, /Drafted context/);
    assert.match(content, /never as ratify/);
    for (const cmd of ['park', 'emerge', 'promote', 'new-task', 'new-phase', 'split-phase']) {
      assert.ok(content.includes(cmd), `emergence must document: ${cmd}`);
    }
  });

  // ─── Lazy asset: transitions (verifiers, phase-done, archive, switch) ────

  it('project-transitions documents the daily mutations + transitions', () => {
    install();
    const content = readAsset('project-transitions.md');
    for (const cmd of ['done', 'phase-done', 'phase-reopen', 'detect-scope', 'push', 'pop', 'archive', 'switch']) {
      assert.ok(content.includes(cmd), `transitions must document: ${cmd}`);
    }
    assert.match(content, /Pre-mutation migration check/);
    assert.match(content, /migrateLegacyInitiative/);
    assert.match(content, /Plan archival/i);
    assert.match(content, /Plan switch/i);
    assert.match(content, /propagate/i);
  });

  it('project-transitions documents the Verifier execution patterns workflow', () => {
    install();
    const content = readAsset('project-transitions.md');
    assert.match(content, /Verifier execution patterns/);
    assert.match(content, /verify_exit_gate/);
    for (const kind of ['shell', 'manual', 'query', 'test']) {
      assert.ok(content.includes('### `kind: ' + kind + '`'), `must document verifier kind: ${kind}`);
    }
    assert.match(content, /evidence:/);
    assert.match(content, /verifierKind/);
    assert.match(content, /verifiedAt/);
    assert.match(content, /outputSummary/);
    assert.match(content, /Per-task verifiers/);
  });

  it('uses camelCase fields, no legacy snake_case in canonical state contexts', () => {
    install();
    const blob = readRouter() + readAsset('project-transitions.md') + readAsset('project-view.md') + readAsset('project-emergence.md');
    for (const legacy of ['initiative_id', 'scope_paths', 'opened_at', 'surfaced_at', 'from_frame']) {
      assert.ok(!blob.includes(legacy), `must not reference legacy field: ${legacy}`);
    }
    assert.ok(blob.includes('lastUpdated'));
    assert.ok(blob.includes('nextAction'));
    assert.ok(blob.includes('openedAt'));
    assert.ok(blob.includes('surfacedAt'));
    assert.ok(blob.includes('fromFrame'));
  });

  // ─── Lazy asset: migrate / re-bootstrap ─────────────────────────────────

  it('project-migrate documents migrate + re-bootstrap', () => {
    install();
    const content = readAsset('project-migrate.md');
    assert.match(content, /## `migrate <slug>`/);
    assert.match(content, /## `re-bootstrap <slug>`/);
    assert.match(content, /migrateLegacyInitiative/);
    assert.match(content, /isMigratedPlaceholder/);
    assert.match(content, /Pasted-edit canonical format/);
  });

  // ─── Lazy asset: drift / codex review ───────────────────────────────────

  it('project-drift documents scope-creep / why / re-ratify / codex review tracking', () => {
    install();
    const content = readAsset('project-drift.md');
    assert.match(content, /## `scope-creep`/);
    assert.match(content, /## `why <id>`/);
    assert.match(content, /## `re-ratify <id>`/);
    assert.match(content, /Codex review tracking/);
    assert.match(content, /last-review\.json/);
    assert.match(content, /review-due/);
  });

  // ─── Asset shipping ─────────────────────────────────────────────────────

  it('project assets ship the templates (minimal-source, plan, initiative, bootstrap-*)', () => {
    install();
    for (const name of [
      'minimal-source.template.md', 'plan.template.md', 'initiative.template.md',
      'bootstrap-draft.template.md', 'bootstrap-archived.template.md', 'bootstrap-index.template.md',
      'PROJECT-STATUS.md.template.md', 'CLAUDE.md-gate.template.md', 'AGENTS.md.template.md',
    ]) {
      assert.ok(existsSync(join(tempDir, ASSET(name))), `expected asset: ${name}`);
    }
  });

  it('bootstrap-draft template ships with required markers (3-level camelCase)', () => {
    install();
    const content = readAsset('bootstrap-draft.template.md');
    for (const marker of [
      'REPLACE_CANONICAL_SLUG', 'REPLACE_PROPOSED_AT', 'REPLACE_PROPOSED_BUCKET',
      'REPLACE_STARTED_ISO_TIMESTAMP', 'REPLACE_LAST_UPDATED', 'REPLACE_BRANCH',
      'REPLACE_PLAN_LINK', 'REPLACE_TITLE', 'REPLACE_NEXT_ACTION', 'REPLACE_GOAL',
      'REPLACE_RATIONALE', 'REPLACE_CONFIDENCE', 'REPLACE_SLUG_MATCH_TYPE',
      'REPLACE_CONTEXT_PARAGRAPHS', 'REPLACE_EVIDENCE_BLOCK',
    ]) {
      assert.ok(content.includes(marker), `missing marker: ${marker}`);
    }
    assert.ok(content.includes("schemaVersion: '0.1'"));
    assert.ok(!content.includes('initiative_id:'), 'legacy snake_case field must be gone');
  });

  it('minimal-source template has REPLACE markers + a phase H2 + exit_gate', () => {
    install();
    const asset = readAsset('minimal-source.template.md');
    assert.match(asset, /REPLACE_PLAN_TITLE/);
    assert.match(asset, /^## F0 —/m);
    assert.match(asset, /exit_gate:/);
  });
});
