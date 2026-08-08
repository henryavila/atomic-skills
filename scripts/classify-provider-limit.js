#!/usr/bin/env node
/**
 * CLI: classify provider stdout/stderr for session/rate/usage/auth limits.
 *
 * Usage:
 *   node scripts/classify-provider-limit.js \
 *     --provider=claude --exit=0 --stdout=out.md --stderr=err.log \
 *     [--mode=external-both|claude|codex] [--json]
 *
 * Exit:
 *   0 — not a limit failure (safe to validate as review output)
 *   2 — classified as limit/auth failure (print message on stderr; JSON on stdout with --json)
 *   1 — usage / I/O error
 */
import { readFileSync, existsSync } from 'node:fs';
import {
  classifyProviderLimitFailure,
  formatProviderLimitFailureMessage,
} from '../src/provider-limit-failure.js';

function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') {
      out.json = true;
      continue;
    }
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2] !== undefined ? m[2] : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    out[key] = val;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  const provider = String(args.provider || 'claude');
  const exitCode = args.exit != null ? Number(args.exit) : null;
  const mode = String(args.mode || 'claude');
  const stdoutPath = args.stdout ? String(args.stdout) : null;
  const stderrPath = args.stderr ? String(args.stderr) : null;

  let stdout = '';
  let stderr = '';
  try {
    if (stdoutPath) {
      if (!existsSync(stdoutPath)) {
        process.stderr.write(`ERROR: stdout file missing: ${stdoutPath}\n`);
        process.exit(1);
      }
      stdout = readFileSync(stdoutPath, 'utf8');
    }
    if (stderrPath && existsSync(stderrPath)) {
      stderr = readFileSync(stderrPath, 'utf8');
    }
  } catch (e) {
    process.stderr.write(`ERROR: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }

  const failure = classifyProviderLimitFailure({
    provider,
    exitCode,
    stdout,
    stderr,
  });

  if (!failure) {
    if (args.json) {
      process.stdout.write(JSON.stringify({ limitFailure: false }) + '\n');
    }
    process.exit(0);
  }

  const message = formatProviderLimitFailureMessage(failure, {
    mode,
    alternateModes: provider === 'claude' ? ['codex', 'grok'] : ['codex', 'claude', 'grok'],
  });

  if (args.json) {
    process.stdout.write(
      JSON.stringify({
        limitFailure: true,
        ...failure,
        formatted: message,
      }) + '\n',
    );
  } else {
    process.stderr.write(message + '\n');
  }
  process.exit(2);
}

main();