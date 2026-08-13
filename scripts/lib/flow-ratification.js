#!/usr/bin/env node
/**
 * buildFlowRatification — the only writer of ratifiedAt + ratifiedGraphSha.
 *
 * Pure: returns a new document. Does not mutate `doc`. The CLI (--ratify)
 * is the disk write path used by `project flow` after show + AskUserQuestion.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateFlow } from './validate-flow.js';
import { flowDocumentSha } from '../find-missing-flow.js';

/**
 * Only function that writes ratifiedAt + ratifiedGraphSha on a document.
 * Does not mutate `doc` and does not write disk.
 *
 * @param {object} doc
 * @param {{ ratifiedAt?: string, ratifiedBy?: string }} [opts]
 */
export function buildFlowRatification(doc, opts = {}) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('buildFlowRatification: doc must be a flow object');
  }
  if (!doc.graph || typeof doc.graph !== 'object' || Array.isArray(doc.graph)) {
    throw new Error('buildFlowRatification: doc.graph required');
  }
  const ratifiedAt =
    opts.ratifiedAt != null && String(opts.ratifiedAt).trim()
      ? String(opts.ratifiedAt).trim()
      : new Date().toISOString();
  const next = {
    ...doc,
    ratifiedAt,
    ratifiedGraphSha: flowDocumentSha(doc),
  };
  if (opts.ratifiedBy != null) next.ratifiedBy = String(opts.ratifiedBy);
  return next;
}

function formatFlowError(error) {
  if (!error) return 'invalid';
  if (typeof error === 'string') return error;
  return error.message ?? String(error);
}

function flagValue(args, flag) {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const v = args[i + 1];
  if (!v || v.startsWith('--')) return undefined;
  return v;
}

/**
 * Read flow.json, stamp via buildFlowRatification, write back.
 * @param {string} flowJsonPath
 * @param {{ ratifiedBy?: string, ratifiedAt?: string }} [opts]
 */
export function ratifyFlowFile(flowJsonPath, opts = {}) {
  const abs = resolve(flowJsonPath);
  if (!existsSync(abs)) {
    const err = new Error(`flow-ratification: not found: ${flowJsonPath}`);
    err.exitCode = 2;
    throw err;
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    const wrapped = new Error(
      `flow-ratification: L1 parse error: ${err instanceof Error ? err.message : String(err)}`,
    );
    wrapped.exitCode = 1;
    throw wrapped;
  }
  const v = validateFlow(raw);
  if (!v.valid) {
    const wrapped = new Error(
      `flow-ratification: L1 invalid:\n${v.errors.map((e) => `  - ${formatFlowError(e)}`).join('\n')}`,
    );
    wrapped.exitCode = 1;
    throw wrapped;
  }
  const next = buildFlowRatification(raw, {
    ratifiedBy: opts.ratifiedBy,
    ratifiedAt: opts.ratifiedAt,
  });
  writeFileSync(abs, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

function main(argv) {
  if (argv.includes('--ratify')) {
    const flowJson = flagValue(argv, '--ratify');
    if (!flowJson) {
      console.error('usage: flow-ratification.js --ratify <flow.json> [--ratified-by <who>]');
      process.exit(2);
    }
    try {
      const next = ratifyFlowFile(flowJson, { ratifiedBy: flagValue(argv, '--ratified-by') });
      console.log(`flow-ratification: ratified ${resolve(flowJson)}`);
      console.log(`ratifiedGraphSha ${next.ratifiedGraphSha}`);
      process.exit(0);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(err && typeof err === 'object' && 'exitCode' in err ? err.exitCode : 1);
    }
  }
  console.error('usage: flow-ratification.js --ratify <flow.json> [--ratified-by <who>]');
  process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
