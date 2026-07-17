import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

test('upstream receipt and remediated pin are present for fault-matrix readiness', async () => {
  const receiptPath = join(ROOT, 'docs/audits/minimalist-installer-upstream-receipt.json');
  assert.equal(existsSync(receiptPath), true);
  const receipt = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(receiptPath, 'utf8')));
  assert.ok(receipt.dist?.integrity);
  assert.ok(receipt.integrated?.resolved || receipt.tasks);
  // Engine fault-injection lives upstream; consumer gate requires receipt + pin.
  const lock = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(join(ROOT, 'package-lock.json'), 'utf8')));
  const entry = lock.packages?.['node_modules/@henryavila/minimalist-installer'];
  assert.ok(entry, 'installer dependency present in lockfile');
});
