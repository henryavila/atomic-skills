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

  it('skill body documents the `adopt` mode and Markdown decompose / Superpowers sections (placeholders for C.T-002/003/004)', () => {
    const content = install();
    assert.match(content, /## Markdown decompose/);
    assert.match(content, /## Superpowers integration/);
    assert.match(content, /## `adopt <file\.md>`/);
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
