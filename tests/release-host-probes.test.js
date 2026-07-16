/**
 * F6/T-001 — Host probes honor support tiers.
 *
 * layout-only: install/layout/parser only; supportDeclared must stay false.
 * operational: real CLI discovery/load/invoke required (none claimed today).
 * Missing CLI for layout-only is recorded, never promoted to operational green.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { PUBLIC_IDE_IDS } from '../src/config.js';
import {
  loadHostQualification,
  validateHostQualification,
} from '../scripts/validate-host-qualification.js';
import {
  runHostProbes,
  checkReceiptAgainstManifest,
} from '../scripts/run-host-probes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'meta/host-qualification.json');
const RECEIPT = join(ROOT, 'docs/audits/host-contract-receipt.json');

describe('F6 release host probes', () => {
  it('canonical host-qualification is valid and layout-only by default', () => {
    const doc = loadHostQualification(MANIFEST);
    const report = validateHostQualification(doc, { publicIdeIds: PUBLIC_IDE_IDS });
    assert.equal(report.ok, true, report.errors.join('\n'));
    for (const host of doc.hosts) {
      if (host.supportTier === 'layout-only') {
        assert.equal(host.supportDeclared, false, `${host.id} must not claim support`);
        assert.ok(
          typeof host.justification === 'string' && host.justification.length >= 8,
          `${host.id} needs justification`,
        );
      }
    }
  });

  it('runHostProbes succeeds for current layout-only matrix', () => {
    const { ok, receipt, errors } = runHostProbes({ manifest: MANIFEST });
    assert.equal(ok, true, errors.join('\n'));
    assert.equal(receipt.summary.total, PUBLIC_IDE_IDS.length);
    assert.equal(receipt.summary.layoutOk, PUBLIC_IDE_IDS.length);
    assert.equal(receipt.summary.operationalClaimed, 0);
    for (const host of receipt.hosts) {
      assert.equal(host.layout.ok, true, `${host.id}: ${host.layout.error}`);
      assert.equal(host.supportDeclared, false);
      assert.equal(host.operational?.skipped, true);
      // CLI may or may not be present — never promotes tier.
      assert.ok(['boolean'].includes(typeof host.cli.present));
    }
  });

  it('checkReceipt rejects layout-only host claiming supportDeclared', () => {
    const doc = loadHostQualification(MANIFEST);
    const bad = {
      schemaVersion: '1',
      ok: true,
      hosts: doc.hosts.map((h) => ({
        id: h.id,
        supportTier: h.supportTier,
        supportDeclared: true,
        layout: { ok: true, skillPath: 'x' },
        operational: { skipped: true },
      })),
    };
    const report = checkReceiptAgainstManifest(bad, doc);
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /supportDeclared/i.test(e)));
  });

  it('checkReceipt rejects operational host without discovery/load/invoke', () => {
    const doc = {
      schemaVersion: '1',
      hosts: [
        {
          id: 'gemini',
          supportTier: 'operational',
          supportDeclared: true,
          adapter: {
            id: 'gemini-tools',
            version: '1',
            discovery: 'd',
            load: 'l',
            invoke: 'i',
          },
        },
        ...PUBLIC_IDE_IDS.filter((id) => id !== 'gemini').map((id) => ({
          id,
          supportTier: 'layout-only',
          supportDeclared: false,
          justification: 'fixture layout-only host for probe contract test',
        })),
      ],
    };
    const receipt = {
      hosts: doc.hosts.map((h) => ({
        id: h.id,
        supportTier: h.supportTier,
        supportDeclared: h.supportTier === 'operational',
        layout: { ok: true },
        operational:
          h.supportTier === 'operational'
            ? { ok: false, discovery: false, load: false, invoke: false }
            : { skipped: true },
      })),
    };
    const report = checkReceiptAgainstManifest(receipt, doc);
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /discovery\/load\/invoke/i.test(e)));
  });

  it('CLI script --check accepts a well-formed receipt file', () => {
    // Write a temp receipt from a live probe run, then --check it.
    const dir = mkdtempSync(join(tmpdir(), 'as-host-receipt-'));
    try {
      const { ok, receipt, errors } = runHostProbes({ manifest: MANIFEST });
      assert.equal(ok, true, errors.join('\n'));
      const path = join(dir, 'receipt.json');
      writeFileSync(path, JSON.stringify(receipt, null, 2));
      const result = spawnSync(
        process.execPath,
        [
          join(ROOT, 'scripts/run-host-probes.js'),
          '--manifest',
          MANIFEST,
          '--receipt',
          path,
          '--check',
        ],
        { encoding: 'utf8', cwd: ROOT },
      );
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('committed receipt if present matches host ids and layout-only policy', () => {
    if (!existsSync(RECEIPT)) return; // written in T-005 freeze path
    const receipt = JSON.parse(readFileSync(RECEIPT, 'utf8'));
    const doc = loadHostQualification(MANIFEST);
    const report = checkReceiptAgainstManifest(receipt, doc);
    assert.equal(report.ok, true, report.errors.join('\n'));
    assert.equal(receipt.ok, true);
  });
});
