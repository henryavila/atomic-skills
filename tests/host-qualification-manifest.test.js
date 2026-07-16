/**
 * F2/T-001 — host-qualification.json is the canonical support-tier registry.
 * Validator rejects missing hosts, duplicates, unknown tiers, operational
 * without adapter/version/discovery/load/invoke, and layout-only with
 * supportDeclared:true.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_IDE_IDS } from '../src/config.js';
import {
  validateHostQualification,
  loadHostQualification,
} from '../scripts/validate-host-qualification.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(ROOT, 'meta', 'host-qualification.json');
const SCHEMA_PATH = join(ROOT, 'meta', 'schemas', 'host-qualification.schema.json');

describe('host-qualification manifest (F2/T-001)', () => {
  it('manifest and schema files exist', () => {
    assert.ok(existsSync(MANIFEST_PATH), 'meta/host-qualification.json required');
    assert.ok(existsSync(SCHEMA_PATH), 'meta/schemas/host-qualification.schema.json required');
  });

  it('covers every PUBLIC_IDE_ID exactly once', () => {
    const doc = loadHostQualification(MANIFEST_PATH);
    const ids = doc.hosts.map((h) => h.id);
    assert.deepEqual([...ids].sort(), [...PUBLIC_IDE_IDS].sort());
    assert.equal(new Set(ids).size, ids.length, 'no duplicate host ids');
  });

  it('canonical manifest validates cleanly', () => {
    const report = validateHostQualification(loadHostQualification(MANIFEST_PATH), {
      publicIdeIds: PUBLIC_IDE_IDS,
    });
    assert.equal(report.ok, true, report.errors.join('\n'));
    assert.equal(report.errors.length, 0);
  });

  it('rejects missing public host', () => {
    const doc = loadHostQualification(MANIFEST_PATH);
    const truncated = {
      ...doc,
      hosts: doc.hosts.filter((h) => h.id !== 'codex'),
    };
    const report = validateHostQualification(truncated, { publicIdeIds: PUBLIC_IDE_IDS });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /missing host.*codex/i.test(e)));
  });

  it('rejects duplicate host id', () => {
    const doc = loadHostQualification(MANIFEST_PATH);
    const dup = {
      ...doc,
      hosts: [...doc.hosts, { ...doc.hosts[0] }],
    };
    const report = validateHostQualification(dup, { publicIdeIds: PUBLIC_IDE_IDS });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /duplicate/i.test(e)));
  });

  it('rejects unknown support tier', () => {
    const doc = loadHostQualification(MANIFEST_PATH);
    const bad = {
      ...doc,
      hosts: doc.hosts.map((h, i) =>
        i === 0 ? { ...h, supportTier: 'beta' } : h,
      ),
    };
    const report = validateHostQualification(bad, { publicIdeIds: PUBLIC_IDE_IDS });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /unknown.*tier|supportTier/i.test(e)));
  });

  it('rejects operational without adapter version + discovery/load/invoke', () => {
    const incomplete = {
      schemaVersion: '1',
      hosts: PUBLIC_IDE_IDS.map((id) => ({
        id,
        supportTier: 'operational',
        supportDeclared: true,
        adapter: { id: `${id}-adapter` },
        // missing version, discovery, load, invoke
      })),
    };
    const report = validateHostQualification(incomplete, { publicIdeIds: PUBLIC_IDE_IDS });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /operational/i.test(e) && /adapter|version|discovery|load|invoke/i.test(e)));
  });

  it('rejects layout-only with supportDeclared true', () => {
    const bad = {
      schemaVersion: '1',
      hosts: PUBLIC_IDE_IDS.map((id) => ({
        id,
        supportTier: 'layout-only',
        supportDeclared: true,
        justification: 'claimed support without operational tier',
      })),
    };
    const report = validateHostQualification(bad, { publicIdeIds: PUBLIC_IDE_IDS });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /layout-only/i.test(e) && /supportDeclared/i.test(e)));
  });

  it('rejects layout-only without justification', () => {
    const bad = {
      schemaVersion: '1',
      hosts: PUBLIC_IDE_IDS.map((id) => ({
        id,
        supportTier: 'layout-only',
        supportDeclared: false,
      })),
    };
    const report = validateHostQualification(bad, { publicIdeIds: PUBLIC_IDE_IDS });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /justification/i.test(e)));
  });

  it('schema file is parseable JSON Schema', () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    assert.equal(schema.$schema.includes('json-schema'), true);
    assert.ok(schema.properties?.hosts || schema.$defs || schema.definitions);
  });
});
