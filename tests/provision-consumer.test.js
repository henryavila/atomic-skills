import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  provisionConsumer,
  defaultTemplateDir,
  CONSUMER_ID,
  CONSUMER_MCP_NAMESPACE,
  CONSUMER_TITLE,
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

describe('provisionConsumer — ONE shared atomic-skills consumer (Q10)', () => {
  let consumersDir;

  beforeEach(() => {
    consumersDir = mkdtempSync(join(tmpdir(), 'as-consumers-'));
  });
  afterEach(() => {
    rmSync(consumersDir, { recursive: true, force: true });
  });

  it('provisions the single fixed-identity consumer (no per-project id)', () => {
    const r = provisionConsumer({ templateDir: TEMPLATE_DIR, consumersDir });
    assert.equal(r.consumerId, CONSUMER_ID);
    assert.equal(r.consumerId, 'atomic-skills');
    assert.equal(r.title, CONSUMER_TITLE);
    assert.equal(r.mcpNamespace, CONSUMER_MCP_NAMESPACE);

    const { id, title, mcpNamespace } = readIdTitle(join(consumersDir, 'atomic-skills', 'manifest.yaml'));
    assert.equal(id, 'atomic-skills');
    assert.equal(title, 'Atomic Skills');
    assert.equal(mcpNamespace, 'atomic_skills');
  });

  it('always lands in ~/.aideck/consumers/atomic-skills regardless of cwd/repo', () => {
    const r = provisionConsumer({ templateDir: TEMPLATE_DIR, consumersDir });
    assert.equal(r.dir, join(consumersDir, 'atomic-skills'));
    assert.ok(existsSync(r.dir));
  });

  it('copies the template handlers + schema alongside the manifest', () => {
    provisionConsumer({ templateDir: TEMPLATE_DIR, consumersDir });
    const dir = join(consumersDir, 'atomic-skills');
    assert.ok(existsSync(join(dir, 'schema.json')));
    assert.ok(existsSync(join(dir, 'handlers', '_lib.js')));
  });

  it('is idempotent — re-provisioning yields the same single consumer', () => {
    const a = provisionConsumer({ templateDir: TEMPLATE_DIR, consumersDir });
    const b = provisionConsumer({ templateDir: TEMPLATE_DIR, consumersDir });
    assert.deepEqual(a, b);
  });

  it('re-stamps the canonical identity even if the template id drifts', () => {
    // Simulate a drifted template (someone hand-edits the top-level id) — the
    // deployed consumer must still be `atomic-skills`, or the skill's
    // AIDECK_CONSUMER=atomic-skills would resolve nothing.
    const drifted = mkdtempSync(join(tmpdir(), 'as-tmpl-'));
    try {
      const raw = readFileSync(join(TEMPLATE_DIR, 'manifest.yaml'), 'utf8')
        .replace(/^id:.*$/m, 'id: drifted')
        .replace(/^mcpNamespace:.*$/m, 'mcpNamespace: drifted_ns')
        .replace(/^title:.*$/m, "title: 'Drifted'");
      // copy the rest of the template so provisioning succeeds
      cpSync(TEMPLATE_DIR, drifted, { recursive: true });
      writeFileSync(join(drifted, 'manifest.yaml'), raw);

      provisionConsumer({ templateDir: drifted, consumersDir });
      const { id, title, mcpNamespace } = readIdTitle(join(consumersDir, 'atomic-skills', 'manifest.yaml'));
      assert.equal(id, 'atomic-skills');
      assert.equal(title, 'Atomic Skills');
      assert.equal(mcpNamespace, 'atomic_skills');
    } finally {
      rmSync(drifted, { recursive: true, force: true });
    }
  });

  it('throws a clear error when the template manifest is missing', () => {
    const empty = mkdtempSync(join(tmpdir(), 'as-empty-'));
    try {
      assert.throws(
        () => provisionConsumer({ templateDir: empty, consumersDir }),
        /template manifest not found/,
      );
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('does NOT rewrite nested (indented) title: keys — only the top-level one', () => {
    provisionConsumer({ templateDir: TEMPLATE_DIR, consumersDir });
    const raw = readFileSync(join(consumersDir, 'atomic-skills', 'manifest.yaml'), 'utf8');
    // page titles (indented) must survive untouched (only the column-0 title: is stamped)
    assert.match(raw, /^\s+title: 'Foco agora'/m);
  });
});

describe('defaultTemplateDir', () => {
  it('resolves the shipped template (package src/ layout)', () => {
    assert.ok(existsSync(join(defaultTemplateDir(), 'manifest.yaml')));
  });
});
