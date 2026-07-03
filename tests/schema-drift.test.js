import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseDocument } from 'yaml';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaDir = join(repoRoot, 'meta', 'schemas');

// Guards the regen step: the committed assets/aideck-consumer/schema.json must
// always equal a fresh bundle of meta/schemas/. If a schema field is added to
// meta/schemas/ but the generator isn't re-run + committed, aideck validate-file
// rejects live state carrying that field (the exact drift the review caught for
// task.summary / verifierLabel / evidenceSummary). `--check` exits 1 on drift.
test('consumer schema.json is in sync with meta/schemas/ (no drift)', () => {
  assert.doesNotThrow(() => {
    execFileSync('node', ['scripts/build-aideck-consumer-schema.mjs', '--check'], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
  }, 'run `npm run build:aideck-schema` and commit assets/aideck-consumer/schema.json');
});

test('meta/schemas/*.json do not contain duplicate object keys', () => {
  const failures = [];
  for (const entry of readdirSync(schemaDir).filter((name) => name.endsWith('.json')).sort()) {
    const filePath = join(schemaDir, entry);
    const doc = parseDocument(readFileSync(filePath, 'utf8'), { uniqueKeys: true });
    const duplicateErrors = doc.errors.filter((err) => /Map keys must be unique/.test(err.message));
    for (const err of duplicateErrors) {
      failures.push(`${entry}: ${err.message}`);
    }
  }
  assert.deepEqual(failures, []);
});
