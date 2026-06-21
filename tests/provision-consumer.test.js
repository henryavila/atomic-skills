import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  provisionConsumer,
  humanizeProjectId,
  stampIdTitle,
  stampRootDir,
  sanitizeMcpNamespace,
} from '../src/provision-consumer.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const TEMPLATE_DIR = join(__dirname, '..', 'assets', 'aideck-consumer');

// Read the top-level (column-0) `id:` / `title:` / `mcpNamespace:` of a manifest.
function readIdTitle(manifestPath) {
  const raw = readFileSync(manifestPath, 'utf8');
  const id = raw.match(/^id:[ \t]*(.+)$/m)?.[1].trim();
  const title = raw.match(/^title:[ \t]*'?([^'\n]+)'?$/m)?.[1].trim();
  const mcpNamespace = raw.match(/^mcpNamespace:[ \t]*(.+)$/m)?.[1].trim();
  return { id, title, mcpNamespace };
}

describe('provisionConsumer — consumer id + title ARE the consuming project', () => {
  let consumersDir;

  beforeEach(() => {
    consumersDir = mkdtempSync(join(tmpdir(), 'as-consumers-'));
  });
  afterEach(() => {
    rmSync(consumersDir, { recursive: true, force: true });
  });

  // The core regression: the SAME skill, run in project `foo`, must produce a
  // consumer keyed/titled `foo` — never the hardcoded atomic-skills/Project Status.
  it('stamps id=projectId and a humanized title for an arbitrary project', () => {
    const r = provisionConsumer('foo', { templateDir: TEMPLATE_DIR, consumersDir });

    assert.equal(r.consumerId, 'foo');
    assert.equal(r.title, 'Foo');
    assert.equal(r.dir, join(consumersDir, 'foo'));

    const { id, title } = readIdTitle(join(consumersDir, 'foo', 'manifest.yaml'));
    assert.equal(id, 'foo', 'manifest.id must be the projectId');
    assert.equal(title, 'Foo', 'manifest.title must be the humanized project name');
    // Lock the bug we are fixing: NEVER the generic identity.
    assert.notEqual(id, 'atomic-skills');
    assert.notEqual(title, 'Project Status');
  });

  it('handles multi-word slugs (atomic-skills → Atomic Skills, atomic_skills ns)', () => {
    provisionConsumer('atomic-skills', { templateDir: TEMPLATE_DIR, consumersDir });
    assert.deepEqual(
      readIdTitle(join(consumersDir, 'atomic-skills', 'manifest.yaml')),
      { id: 'atomic-skills', title: 'Atomic Skills', mcpNamespace: 'atomic_skills' },
    );
  });

  // Per-project consumers MUST get distinct mcpNamespaces, else their MCP tools
  // (aideck_<ns>_<tool>) collide in the shared registry.
  it('stamps a per-project mcpNamespace so two projects never collide', () => {
    const a = provisionConsumer('foo', { templateDir: TEMPLATE_DIR, consumersDir });
    const b = provisionConsumer('bar', { templateDir: TEMPLATE_DIR, consumersDir });
    assert.equal(a.mcpNamespace, 'foo');
    assert.equal(b.mcpNamespace, 'bar');
    assert.notEqual(a.mcpNamespace, b.mcpNamespace);
    assert.equal(readIdTitle(join(consumersDir, 'foo', 'manifest.yaml')).mcpNamespace, 'foo');
  });

  it('copies the template handlers + schema alongside the stamped manifest', () => {
    provisionConsumer('foo', { templateDir: TEMPLATE_DIR, consumersDir });
    assert.ok(existsSync(join(consumersDir, 'foo', 'schema.json')), 'schema.json copied');
    assert.ok(existsSync(join(consumersDir, 'foo', 'handlers')), 'handlers/ copied');
  });

  it('is idempotent — re-provisioning yields the same identity', () => {
    provisionConsumer('foo', { templateDir: TEMPLATE_DIR, consumersDir });
    const r2 = provisionConsumer('foo', { templateDir: TEMPLATE_DIR, consumersDir });
    assert.deepEqual(
      readIdTitle(join(consumersDir, 'foo', 'manifest.yaml')),
      { id: 'foo', title: 'Foo', mcpNamespace: 'foo' },
    );
    assert.equal(r2.consumerId, 'foo');
  });

  it('does NOT rewrite nested (indented) title: keys — only the top-level one', () => {
    provisionConsumer('foo', { templateDir: TEMPLATE_DIR, consumersDir });
    const raw = readFileSync(join(consumersDir, 'foo', 'manifest.yaml'), 'utf8');
    // The Home page section title authored in the manifest stays intact.
    assert.ok(raw.includes("title: 'Foco'"), 'nested page/section titles preserved');
  });

  it('rejects an invalid projectId rather than guessing', () => {
    assert.throws(() => provisionConsumer('', { templateDir: TEMPLATE_DIR, consumersDir }));
    assert.throws(() => provisionConsumer('Bad Slug', { templateDir: TEMPLATE_DIR, consumersDir }));
    assert.throws(() => provisionConsumer('-leading', { templateDir: TEMPLATE_DIR, consumersDir }));
  });

  // The durable consumer→project binding: aiDeck auto-registers the project from
  // the consumer manifest's top-level `rootDir`, so the binding survives a
  // restart and /api/consumers/:id/projects never leaks a sibling's data.
  it('stamps the bound rootDir when provided', () => {
    const r = provisionConsumer('foo', { templateDir: TEMPLATE_DIR, consumersDir, rootDir: '/home/me/foo' });
    assert.equal(r.rootDir, '/home/me/foo');
    const raw = readFileSync(join(consumersDir, 'foo', 'manifest.yaml'), 'utf8');
    const rootDir = raw.match(/^rootDir:[ \t]*'?([^'\n]+)'?$/m)?.[1].trim();
    assert.equal(rootDir, '/home/me/foo', 'top-level rootDir must be stamped for aiDeck auto-register');
  });

  it('omits the rootDir line when none is provided (backward-compat)', () => {
    provisionConsumer('foo', { templateDir: TEMPLATE_DIR, consumersDir });
    const raw = readFileSync(join(consumersDir, 'foo', 'manifest.yaml'), 'utf8');
    assert.ok(!/^rootDir:/m.test(raw), 'no top-level rootDir line when none provided');
  });
});

describe('humanizeProjectId / stampIdTitle units', () => {
  it('humanizes slugs', () => {
    assert.equal(humanizeProjectId('foo'), 'Foo');
    assert.equal(humanizeProjectId('atomic-skills'), 'Atomic Skills');
    assert.equal(humanizeProjectId('acme_api-v2'), 'Acme Api V2');
  });

  it('stampIdTitle replaces only column-0 keys and escapes single quotes', () => {
    const src = "id: tmpl\ntitle: 'Old'\npages:\n  - title: 'Foco'\n";
    const out = stampIdTitle(src, 'foo', "O'Brien");
    assert.ok(out.includes('id: foo'));
    assert.ok(out.includes("title: 'O''Brien'"));
    assert.ok(out.includes("  - title: 'Foco'"), 'nested title untouched');
  });

  it('stampRootDir inserts a column-0 rootDir line and escapes single quotes', () => {
    const src = "id: tmpl\ntitle: 'Old'\nmcpNamespace: tmpl\n";
    const out = stampRootDir(src, "/home/o'brien/foo");
    assert.match(out, /^rootDir: '\/home\/o''brien\/foo'$/m);
    assert.ok(out.includes('id: tmpl'), 'existing keys preserved');
  });

  it('stampRootDir replaces an existing rootDir line rather than duplicating it', () => {
    const src = "id: tmpl\nrootDir: '/old'\ntitle: 'Old'\n";
    const out = stampRootDir(src, '/new');
    assert.ok(out.includes("rootDir: '/new'"));
    assert.ok(!out.includes("rootDir: '/old'"));
    assert.equal((out.match(/^rootDir:/mg) || []).length, 1, 'exactly one rootDir line');
  });

  it('sanitizeMcpNamespace yields valid [a-z][a-z0-9_]{0,31} namespaces', () => {
    const re = /^[a-z][a-z0-9_]{0,31}$/;
    assert.equal(sanitizeMcpNamespace('atomic-skills'), 'atomic_skills');
    assert.equal(sanitizeMcpNamespace('foo'), 'foo');
    assert.equal(sanitizeMcpNamespace('acme-api-v2'), 'acme_api_v2');
    assert.equal(sanitizeMcpNamespace('123app'), 'as_123app'); // letter-prefixed
    for (const id of ['atomic-skills', 'foo', 'acme-api-v2', '123app', 'a'.repeat(50)]) {
      assert.match(sanitizeMcpNamespace(id), re, `ns for ${id} must match aideck regex`);
    }
  });

  it('sanitizeMcpNamespace disambiguates long IDs sharing a 32-char prefix (F-004)', () => {
    const re = /^[a-z][a-z0-9_]{0,31}$/;
    const a = sanitizeMcpNamespace('a'.repeat(32) + '-x');
    const b = sanitizeMcpNamespace('a'.repeat(32) + '-y');
    assert.match(a, re, 'truncated ns must still match the aideck regex');
    assert.match(b, re, 'truncated ns must still match the aideck regex');
    assert.notEqual(a, b, 'distinct long ids sharing a 32-char prefix must not collide');
    // Deterministic: same long id → same namespace (idempotent provisioning).
    assert.equal(a, sanitizeMcpNamespace('a'.repeat(32) + '-x'));
    // Short ids are never truncated, so they keep their exact legacy value.
    assert.equal(sanitizeMcpNamespace('atomic-skills'), 'atomic_skills');
  });
});
