/**
 * merge-external-both.js — CLI wrapper around mergeExternalBothFindings.
 *
 * Usage:
 *   node scripts/merge-external-both.js <codex.json> <grok.json> [claude.json]
 *
 * Each argument is a path to a JSON file, or `-` / `skip` / empty to mark that
 * provider as skipped. Omitting the third arg leaves Claude as skipped
 * (2-arg legacy callers keep working).
 *
 * File contents may be:
 *   - a provider payload: { findings?, error?, status?, reason? }
 *   - a raw findings array: [ { file, line, claim, severity, ... }, ... ]
 *
 * Prints the merged result as JSON on stdout. Exit 0 always on successful merge
 * (including partial/both-failed/both-skipped); exit 1 on I/O or parse errors.
 *
 * Package-root invocation (installed):
 *   node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/merge-external-both.js" \
 *     /tmp/codex-findings.json /tmp/grok-findings.json [/tmp/claude-findings.json]
 */
import { readFileSync } from 'node:fs';
import { mergeExternalBothFindings } from '../src/external-both-merge.js';

/**
 * @param {string} arg
 * @returns {boolean}
 */
function isSkipToken(arg) {
  if (arg == null || arg === '') return true;
  const s = String(arg).trim().toLowerCase();
  return s === '-' || s === 'skip' || s === 'skipped' || s === 'none';
}

/**
 * @param {string} pathArg
 * @param {'codex'|'grok'|'claude'} provider
 * @returns {{ findings?: object[], error?: string, status?: string, reason?: string } | null}
 *   null → provider omitted (skipped)
 */
export function loadProviderArg(pathArg, provider) {
  if (isSkipToken(pathArg)) return null;
  let raw;
  try {
    raw = readFileSync(pathArg, 'utf8');
  } catch (err) {
    throw new Error(`${provider}: cannot read ${pathArg}: ${err?.message ?? err}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${provider}: invalid JSON in ${pathArg}: ${err?.message ?? err}`);
  }
  if (Array.isArray(parsed)) {
    return { status: 'succeeded', findings: parsed };
  }
  if (parsed == null || typeof parsed !== 'object') {
    throw new Error(`${provider}: expected object or array in ${pathArg}`);
  }
  return parsed;
}

/**
 * @param {string[]} argv
 * @returns {object}
 */
export function mergeFromArgs(argv) {
  const codexArg = argv[0];
  const grokArg = argv[1];
  const claudeArg = argv[2]; // optional — omit = skipped
  if (codexArg === undefined || grokArg === undefined) {
    throw new Error(
      'usage: node scripts/merge-external-both.js <codex.json|-|skip> <grok.json|-|skip> [claude.json|-|skip]',
    );
  }
  /** @type {Record<string, object>} */
  const input = {};
  const codex = loadProviderArg(codexArg, 'codex');
  const grok = loadProviderArg(grokArg, 'grok');
  if (codex != null) input.codex = codex;
  if (grok != null) input.grok = grok;
  if (claudeArg !== undefined) {
    const claude = loadProviderArg(claudeArg, 'claude');
    if (claude != null) input.claude = claude;
  }
  return mergeExternalBothFindings(input);
}

function main(argv) {
  try {
    const result = mergeFromArgs(argv);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = 0;
  } catch (err) {
    process.stderr.write(`${err?.message ?? err}\n`);
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('merge-external-both.js') ||
    process.argv[1].includes('merge-external-both'));

if (isMain) {
  main(process.argv.slice(2));
}
