/**
 * F5/T-005 — canonical projectId + safe JSON registration payload.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  deriveProjectId,
  resolveRegisteredProjectId,
  listProjects,
  buildRegisterPayload,
} from '../scripts/resolve-project-id.js';
import * as serve from '../src/serve.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const RESOLVE_CLI = join(__dirname, '..', 'scripts', 'resolve-project-id.js');

function makeNestedProject(root, projectId, planSlug = 'demo-plan') {
  const planDir = join(root, '.atomic-skills', 'projects', projectId, planSlug);
  mkdirSync(planDir, { recursive: true });
  writeFileSync(join(planDir, 'plan.md'), '---\nslug: demo\n---\n');
  return planDir;
}

describe('deriveProjectId normalization', () => {
  it('lowercases, strips invalid chars, removes leading digits, truncates 64', () => {
    assert.equal(deriveProjectId('/home/user/MyProject'), 'myproject');
    assert.equal(deriveProjectId('/home/user/my_project.v2'), 'my-project-v2');
    assert.equal(deriveProjectId('/home/user/123-project'), 'project');
    assert.equal(deriveProjectId('/home/user/123'), 'project');
    const long = 'a'.repeat(80);
    assert.equal(deriveProjectId(`/tmp/${long}`).length, 64);
  });
});

describe('resolveRegisteredProjectId', () => {
  it('uses the single nested project folder — not worktree basename', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-reg-wt-'));
    try {
      // Simulate plan worktree named after the plan, nested project = atomic-skills
      makeNestedProject(root, 'atomic-skills', 'integrity-remediation');
      // basename of root is random tmp name; canonical id must still be atomic-skills
      assert.equal(resolveRegisteredProjectId(root), 'atomic-skills');
      assert.equal(serve.resolveRegisteredProjectId(root), 'atomic-skills');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('falls back to basename normalize when no nested projects/', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-reg-flat-'));
    try {
      mkdirSync(join(root, '.atomic-skills', 'plans'), { recursive: true });
      writeFileSync(join(root, '.atomic-skills', 'plans', 'x.md'), '---\n---\n');
      const id = resolveRegisteredProjectId(root);
      assert.equal(id, deriveProjectId(root));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('falls back when multiple nested projects exist (ambiguous)', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-reg-multi-'));
    try {
      makeNestedProject(root, 'proj-a');
      makeNestedProject(root, 'proj-b');
      assert.equal(resolveRegisteredProjectId(root), deriveProjectId(root));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('buildRegisterPayload — safe JSON (no shell interp)', () => {
  it('produces valid JSON for roots with quotes and spaces', () => {
    const awkward = mkdtempSync(join(tmpdir(), 'as "quoted" root '));
    try {
      makeNestedProject(awkward, 'canonical-id');
      const json = buildRegisterPayload(awkward);
      const parsed = JSON.parse(json);
      assert.equal(parsed.projectId, 'canonical-id');
      assert.ok(parsed.rootDir.includes(awkward) || parsed.rootDir.endsWith(awkward.replace(/\/$/, '')));
      // Must be parseable even if root has double quotes in path components
      assert.equal(typeof parsed.rootDir, 'string');
      assert.equal(typeof parsed.projectId, 'string');
    } finally {
      rmSync(awkward, { recursive: true, force: true });
    }
  });

  it('CLI --register-json matches buildRegisterPayload', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-reg-cli-'));
    try {
      makeNestedProject(root, 'from-cli');
      const out = execFileSync(process.execPath, [RESOLVE_CLI, '--register-json', root], {
        encoding: 'utf8',
      }).trim();
      const parsed = JSON.parse(out);
      assert.equal(parsed.projectId, 'from-cli');
      assert.deepEqual(JSON.parse(buildRegisterPayload(root)), parsed);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('CLI prints projectId only by default', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-reg-cli2-'));
    try {
      makeNestedProject(root, 'only-id');
      const out = execFileSync(process.execPath, [RESOLVE_CLI, root], {
        encoding: 'utf8',
      }).trim();
      assert.equal(out, 'only-id');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('project-view registration instructions', () => {
  it('uses resolve-project-id and REGISTER_JSON (not basename-only + raw $PWD interp)', () => {
    const view = readFileSync(
      join(__dirname, '..', 'skills/shared/project-assets/project-view.md'),
      'utf8',
    );
    assert.ok(view.includes('resolve-project-id.js'), 'must call resolve-project-id.js');
    assert.ok(view.includes('REGISTER_JSON'), 'must use REGISTER_JSON payload');
    assert.ok(view.includes('--register-json'), 'must support --register-json');
    // Old broken pattern: -d "{\"rootDir\":\"$PWD\",\"projectId\":\"$pid\"}"
    assert.ok(
      !view.includes('\\"rootDir\\":\\"$PWD\\"'),
      'must not shell-interpolate rootDir into JSON',
    );
  });
});

describe('listProjects re-export parity', () => {
  it('serve.listProjects matches scripts/resolve-project-id listProjects', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-list-'));
    try {
      makeNestedProject(root, 'x', 'p1');
      const a = listProjects(join(root, '.atomic-skills'));
      const b = serve.listProjects(join(root, '.atomic-skills'));
      assert.deepEqual(a, b);
      assert.deepEqual(a, [{ projectId: 'x', plans: ['p1'] }]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
