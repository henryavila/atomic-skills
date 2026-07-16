#!/usr/bin/env node
/**
 * Validate meta/host-qualification.json against product rules:
 * - every PUBLIC_IDE_ID present exactly once
 * - supportTier ∈ {operational, layout-only}
 * - operational → adapter.{id,version,discovery,load,invoke}
 * - layout-only → supportDeclared === false + non-empty justification
 *
 * Usage:
 *   node scripts/validate-host-qualification.js --manifest meta/host-qualification.json
 *
 * Exit 0 on success, 1 on validation errors, 2 on I/O/usage errors.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SUPPORTED_TIERS = new Set(['operational', 'layout-only']);

/**
 * @param {string} path
 * @returns {object}
 */
export function loadHostQualification(path) {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(`host-qualification manifest not found: ${abs}`);
  }
  return JSON.parse(readFileSync(abs, 'utf8'));
}

/**
 * @param {object} doc
 * @param {{ publicIdeIds?: string[] }} [opts]
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateHostQualification(doc, opts = {}) {
  const errors = [];
  if (doc == null || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, errors: ['root must be an object'] };
  }
  if (doc.schemaVersion !== '1') {
    errors.push(`schemaVersion must be "1" (got ${JSON.stringify(doc.schemaVersion)})`);
  }
  if (!Array.isArray(doc.hosts)) {
    errors.push('hosts must be an array');
    return { ok: false, errors };
  }

  const seen = new Set();
  for (const [i, host] of doc.hosts.entries()) {
    const prefix = `hosts[${i}]`;
    if (!host || typeof host !== 'object') {
      errors.push(`${prefix}: entry must be an object`);
      continue;
    }
    if (typeof host.id !== 'string' || host.id.length === 0) {
      errors.push(`${prefix}: id is required`);
      continue;
    }
    if (seen.has(host.id)) {
      errors.push(`${prefix}: duplicate host id "${host.id}"`);
    }
    seen.add(host.id);

    if (!SUPPORTED_TIERS.has(host.supportTier)) {
      errors.push(
        `${prefix} (${host.id}): unknown supportTier ${JSON.stringify(host.supportTier)} (expected operational|layout-only)`,
      );
      continue;
    }

    if (host.supportTier === 'operational') {
      const adapter = host.adapter;
      if (!adapter || typeof adapter !== 'object') {
        errors.push(`${prefix} (${host.id}): operational requires adapter object`);
      } else {
        for (const field of ['id', 'version', 'discovery', 'load', 'invoke']) {
          if (typeof adapter[field] !== 'string' || adapter[field].trim() === '') {
            errors.push(
              `${prefix} (${host.id}): operational adapter missing ${field}`,
            );
          }
        }
      }
      if (host.supportDeclared === false) {
        errors.push(
          `${prefix} (${host.id}): operational must not set supportDeclared:false`,
        );
      }
    }

    if (host.supportTier === 'layout-only') {
      if (host.supportDeclared !== false) {
        errors.push(
          `${prefix} (${host.id}): layout-only requires supportDeclared:false (no operational support claim)`,
        );
      }
      if (typeof host.justification !== 'string' || host.justification.trim().length < 8) {
        errors.push(
          `${prefix} (${host.id}): layout-only requires justification (min 8 chars)`,
        );
      }
    }
  }

  const publicIdeIds = opts.publicIdeIds;
  if (Array.isArray(publicIdeIds)) {
    for (const id of publicIdeIds) {
      if (!seen.has(id)) {
        errors.push(`missing host for PUBLIC_IDE_ID "${id}"`);
      }
    }
    for (const id of seen) {
      if (!publicIdeIds.includes(id)) {
        errors.push(`unknown host id "${id}" (not in PUBLIC_IDE_IDS)`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function parseArgs(argv) {
  let manifest = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--manifest' && argv[i + 1]) {
      manifest = argv[++i];
    }
  }
  return { manifest };
}

async function main() {
  const { manifest } = parseArgs(process.argv.slice(2));
  if (!manifest) {
    console.error('Usage: node scripts/validate-host-qualification.js --manifest <path>');
    process.exit(2);
  }

  let publicIdeIds;
  try {
    const cfg = await import(new URL('../src/config.js', import.meta.url).href);
    publicIdeIds = cfg.PUBLIC_IDE_IDS;
  } catch (err) {
    console.error(`ERROR: failed to load PUBLIC_IDE_IDS: ${err.message}`);
    process.exit(2);
  }

  let doc;
  try {
    doc = loadHostQualification(manifest);
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(2);
  }

  const report = validateHostQualification(doc, { publicIdeIds });
  if (!report.ok) {
    for (const e of report.errors) console.error(`ERROR: ${e}`);
    process.exit(1);
  }
  console.log(`OK: host-qualification (${doc.hosts.length} hosts)`);
}

const isDirect = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
