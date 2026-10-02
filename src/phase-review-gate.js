/**
 * Pure phase-done review gate under durable automate (cross-model both).
 *
 * Dogfood: pure-maestro stamped reviewGate.mode=local with narrative override
 * and skipped real --mode=both. Under automate, phase-done default is both;
 * local/skip only with explicit operator-owned reason (same pattern as
 * phaseReviewMode overrideReason).
 *
 * Authenticity floor (F4 medium — dual-leg, not full codex parse):
 *   - mode both requires dual receipt paths (local + codex/external)
 *   - each receipt: min size, non-binary (no null-byte), not a one-line stub
 *   - accepts dual non-stub with CLEAN or findings
 * Content checks use injected receiptContents or optional FS read — medium floor.
 *
 * Non-automate: inactive (allows close) — commitGuard still requires a complete
 * reviewGate when requireReview is true.
 */

import { isAbsolute, resolve } from 'node:path';
import { isDurableAutomateActive } from './plan-end-review.js';

/** Modes that satisfy automate phase-done cross-model default. */
export const AUTOMATE_PHASE_BOTH_MODES = Object.freeze([
  'both',
  'both-codex',
  'both-grok',
  'both-claude',
  'external-both', // stricter than both; also satisfies
]);

const BOTH_SET = new Set(AUTOMATE_PHASE_BOTH_MODES);

const GIT_SHA_RE = /^[0-9a-f]{7,40}$/i;

/**
 * Medium authenticity floor: min UTF-8 byte length for a dual-leg receipt.
 * Not a full transcript parser — rejects stubs, not incomplete reviews.
 */
export const PHASE_REVIEW_RECEIPT_MIN_BYTES = 64;

/**
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 * }} [input]
 * @returns {boolean}
 */
export function isDurableAutomateForPhaseReview(input = {}) {
  return isDurableAutomateActive(input);
}

/**
 * @typedef {{
 *   status?: string | null,
 *   mode?: string | null,
 *   at?: string | null,
 *   reviewFile?: string | null,
 *   localReceiptPath?: string | null,
 *   codexReceiptPath?: string | null,
 *   externalReceiptPath?: string | null,
 *   legs?: Array<{
 *     provider?: string | null,
 *     receiptPath?: string | null,
 *     path?: string | null,
 *     reviewFile?: string | null,
 *   }> | null,
 *   reason?: string | null,
 *   operatorSkip?: boolean | null,
 *   overrideReason?: string | null,
 *   verifiedAt?: string | null,
 *   externalStderr?: string | null,
 *   stderr?: string | null,
 * }} ReviewGate
 */

/** External review CLIs the program may store on the plan (not the open host). */
export const REVIEW_EXTERNAL_CLIS = Object.freeze(['claude', 'codex', 'grok']);

const REVIEW_EXTERNAL_CLI_SET = new Set(REVIEW_EXTERNAL_CLIS);

const HOST_TO_CLI = Object.freeze({
  claude: 'claude',
  'claude-code': 'claude',
  codex: 'codex',
  grok: 'grok',
});

/**
 * CLI name for an automate host id (`claude-code` → `claude`).
 * @param {unknown} host
 * @returns {string}
 */
export function hostCliName(host) {
  const raw = host != null ? String(host).trim().toLowerCase() : '';
  if (!raw) return '';
  if (HOST_TO_CLI[raw]) return HOST_TO_CLI[raw];
  const base = raw.replace(/\\/g, '/').split('/').pop() || raw;
  const name = base.replace(/\.exe$/i, '');
  return HOST_TO_CLI[name] || name;
}

/**
 * @param {unknown} cli
 * @param {unknown} openHost
 * @returns {{ ok: boolean, reason?: string, cli?: string }}
 */
export function isValidReviewExternalCli(cli, openHost) {
  const name = hostCliName(cli);
  if (!REVIEW_EXTERNAL_CLI_SET.has(name)) {
    return {
      ok: false,
      reason: `reviewExternalCli must be claude|codex|grok (got ${cli == null ? 'missing' : String(cli)})`,
    };
  }
  const hostCli = hostCliName(openHost);
  if (hostCli && name === hostCli) {
    return {
      ok: false,
      reason: `reviewExternalCli must not equal the open host (${openHost})`,
    };
  }
  return { ok: true, cli: name };
}

/**
 * Read `reviewExternalCli:` from plan frontmatter (size-capped; not a YAML parser).
 * @param {string | null | undefined} planText
 * @returns {string}
 */
export function readPlanReviewExternalCli(planText) {
  if (typeof planText !== 'string' || planText === '') return '';
  const m = planText.match(/^reviewExternalCli:\s*["']?([A-Za-z0-9_-]+)/m);
  return m ? m[1].trim().toLowerCase() : '';
}

/**
 * Insert or keep `reviewExternalCli` on plan frontmatter. Does not re-ask.
 * @param {string} planText
 * @param {string} cli
 * @returns {string}
 */
export function upsertPlanReviewExternalCli(planText, cli) {
  const text = typeof planText === 'string' ? planText : '';
  const name = hostCliName(cli);
  if (readPlanReviewExternalCli(text) === name) return text;
  if (/^reviewExternalCli:\s*/m.test(text)) {
    return text.replace(/^reviewExternalCli:\s*.*$/m, `reviewExternalCli: ${name}`);
  }
  if (text.startsWith('---')) {
    const nl = text.indexOf('\n');
    if (nl !== -1) {
      return `${text.slice(0, nl + 1)}reviewExternalCli: ${name}\n${text.slice(nl + 1)}`;
    }
  }
  return `---\nreviewExternalCli: ${name}\n---\n${text}`;
}

/**
 * Ask once for the external review CLI and store it. Never asks again mid-run.
 * @param {{
 *   openHost?: string | null,
 *   planText?: string | null,
 *   planReviewExternalCli?: string | null,
 *   ask?: (() => string | Promise<string>) | null,
 * }} [input]
 * @returns {{
 *   ok: boolean,
 *   reason?: string,
 *   cli?: string,
 *   asked: boolean,
 *   planText?: string,
 * }}
 */
export function resolveReviewExternalCli(input = {}) {
  const storedRaw =
    input.planReviewExternalCli != null && String(input.planReviewExternalCli).trim() !== ''
      ? String(input.planReviewExternalCli).trim()
      : readPlanReviewExternalCli(input.planText);
  if (storedRaw) {
    const valid = isValidReviewExternalCli(storedRaw, input.openHost);
    if (!valid.ok) return { ok: false, asked: false, reason: valid.reason };
    return {
      ok: true,
      asked: false,
      cli: valid.cli,
      planText: input.planText != null ? String(input.planText) : undefined,
    };
  }
  if (typeof input.ask !== 'function') {
    return {
      ok: false,
      asked: false,
      reason: 'reviewExternalCli missing; ask once before the first phase',
    };
  }
  const answered = input.ask();
  const finish = (raw) => {
    const valid = isValidReviewExternalCli(raw, input.openHost);
    if (!valid.ok) return { ok: false, asked: true, reason: valid.reason };
    const planText =
      input.planText != null
        ? upsertPlanReviewExternalCli(String(input.planText), valid.cli)
        : upsertPlanReviewExternalCli('---\n---\n', valid.cli);
    return { ok: true, asked: true, cli: valid.cli, planText };
  };
  if (answered && typeof answered.then === 'function') {
    return answered.then(finish);
  }
  return finish(answered);
}

/**
 * @param {string} rest
 * @returns {Record<string, string>}
 */
function parseReceiptAssignments(rest) {
  const re = /(?:^|[|,])\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/g;
  const matches = [...String(rest).matchAll(re)];
  /** @type {Record<string, string>} */
  const fields = {};
  for (let i = 0; i < matches.length; i++) {
    const key = matches[i][1].toLowerCase();
    const valueStart = matches[i].index + matches[i][0].length;
    const valueEnd = i + 1 < matches.length ? matches[i + 1].index : rest.length;
    fields[key] = String(rest).slice(valueStart, valueEnd).trim();
  }
  return fields;
}

/**
 * @param {string} text
 * @returns {string}
 */
function extractVerdictToken(text) {
  const m = String(text).match(
    /\bverdict\s*:\s*(CLEAN|PASS|PASSED|FAILED|needs_changes)\b/i,
  );
  if (m) {
    const v = m[1].toUpperCase();
    return v === 'PASS' ? 'PASSED' : v;
  }
  const token = String(text).match(/\b(CLEAN|PASSED|PASS)\b/);
  if (!token) return '';
  return token[1].toUpperCase() === 'PASS' ? 'PASSED' : token[1].toUpperCase();
}

/**
 * Format a durable external-CLI receipt line (command, exit, stderr, verdict).
 * @param {{
 *   cli?: string | null,
 *   command: string,
 *   exit: number,
 *   stderr?: string | null,
 *   verdict?: string | null,
 * }} fields
 * @returns {string}
 */
export function formatExternalReviewReceipt(fields) {
  const cli = hostCliName(fields.cli) || 'external';
  const command = fields.command != null ? String(fields.command).trim() : '';
  const exit = Number(fields.exit);
  const stderr = fields.stderr != null ? String(fields.stderr).replace(/\s+/g, ' ').trim() : '';
  const verdict = fields.verdict != null ? String(fields.verdict).trim() : '';
  return `- ${cli}: command=${command} | exit=${Number.isFinite(exit) ? exit : ''} | stderr=${stderr} | verdict=${verdict}`;
}

/**
 * Parse an external CLI receipt. Session `- internal:` lines do not count.
 * Missing verdict does not count. Non-zero exit still exposes real stderr.
 *
 * @param {string | null | undefined} content
 * @returns {{
 *   ok: boolean,
 *   reason?: string,
 *   command?: string,
 *   exit?: number,
 *   stderr?: string,
 *   verdict?: string,
 *   cli?: string,
 * }}
 */
export function parseExternalReviewReceipt(content) {
  if (content == null || String(content).trim() === '') {
    return { ok: false, reason: 'missing external CLI receipt (command, exit, stderr, verdict)' };
  }
  const text = String(content);
  const lines = text.split(/\r?\n/);
  /** @type {string | null} */
  let chosen = null;
  for (const line of lines) {
    const m = line.match(/^\s*-\s*([^:]+)\s*:/);
    if (!m) continue;
    const label = m[1].trim();
    if (/^internal$/i.test(label) || /^ground-truth$/i.test(label) || /^cross-model(\s|$|\()/i.test(label)) {
      continue;
    }
    chosen = line;
    break;
  }
  if (chosen == null) {
    if (lines.some((l) => /^\s*-\s*internal\s*:/i.test(l))) {
      return {
        ok: false,
        reason: 'session-written - internal: line is not an external CLI receipt',
      };
    }
    return { ok: false, reason: 'missing external CLI receipt (command, exit, stderr, verdict)' };
  }
  const head = chosen.match(/^\s*-\s*([^:]+)\s*:/);
  const cli = head ? hostCliName(head[1]) : '';
  const rest = chosen.slice(head ? head[0].length : 0);
  const fields = parseReceiptAssignments(rest);
  const command = (fields.command || fields.cli || '').trim();
  const stderr = fields.stderr != null ? fields.stderr : '';
  const verdictRaw = fields.verdict != null ? fields.verdict.replace(/[.,;]+$/, '') : '';
  const exitRaw = fields.exit != null ? fields.exit.trim() : '';
  const exit = /^-?\d+$/.test(exitRaw) ? Number(exitRaw) : NaN;
  const out = {
    command,
    exit: Number.isFinite(exit) ? exit : undefined,
    stderr,
    verdict: verdictRaw,
    cli,
  };
  if (!command) {
    return { ok: false, reason: 'external CLI receipt missing command', ...out };
  }
  if (!Number.isFinite(exit)) {
    return { ok: false, reason: 'external CLI receipt missing exit', ...out };
  }
  if (!verdictRaw) {
    return { ok: false, reason: 'output without a verdict does not count', ...out };
  }
  return { ok: true, ...out };
}

/**
 * Honesty for the spawned external CLI process receipt.
 * `overrideReason` without stderr of that process fails.
 * A session-written `- internal:` body does not count.
 *
 * @param {{
 *   overrideReason?: string | null,
 *   externalStderr?: string | null,
 *   stderr?: string | null,
 *   command?: string | null,
 *   exit?: number | null,
 *   verdict?: string | null,
 *   body?: string | null,
 *   reviewFile?: string | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function externalReviewReceiptHonesty(input = {}) {
  if (input.body != null && String(input.body).trim() !== '') {
    const parsed = parseExternalReviewReceipt(input.body);
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
  }
  const override =
    input.overrideReason != null ? String(input.overrideReason).trim() : '';
  if (override !== '') {
    const stderr =
      input.externalStderr != null
        ? String(input.externalStderr)
        : input.stderr != null
          ? String(input.stderr)
          : '';
    if (stderr.trim() === '') {
      return {
        ok: false,
        reason:
          'overrideReason without stderr of that external CLI process fails',
      };
    }
  }
  return { ok: true };
}

/**
 * Brief for the external review: ratified flow graph + chosen architecture sketch.
 * Complex tasks enter this same review before phase close.
 *
 * @param {{
 *   flowGraph?: unknown,
 *   architectureSketch?: unknown,
 *   complexTasks?: unknown[] | null,
 * }} [input]
 * @returns {string}
 */
export function buildPhaseReviewBrief(input = {}) {
  const lines = ['# Phase review brief', ''];
  lines.push('## Ratified flow graph');
  lines.push(JSON.stringify(input.flowGraph ?? {}, null, 2));
  lines.push('');
  lines.push('## Chosen architecture sketch');
  lines.push(JSON.stringify(input.architectureSketch ?? {}, null, 2));
  const complex = Array.isArray(input.complexTasks) ? input.complexTasks : [];
  if (complex.length > 0) {
    lines.push('');
    lines.push('## Complex tasks (same review before phase close)');
    for (const task of complex) {
      lines.push(JSON.stringify(task));
    }
  }
  return lines.join('\n');
}

/** Cap of both-reviews per phase before travei. */
export const PHASE_REVIEW_CAP = 3;

const CRITICAL_MAJOR = new Set(['critical', 'major', 'blocker', 'high']);

/**
 * Mix finding of the stamped architecture block — stop, do not enter the loop.
 * @param {unknown} finding
 * @param {unknown} [architectureCard]
 * @returns {boolean}
 */
export function isArchitectureMixFinding(finding, architectureCard) {
  if (finding == null || typeof finding !== 'object') return false;
  const f = /** @type {Record<string, unknown>} */ (finding);
  if (f.stampedBlockMix === true) return true;
  const kind = f.kind != null ? String(f.kind).trim().toLowerCase() : '';
  const axis = f.axis != null ? String(f.axis).trim().toLowerCase() : '';
  if (kind === 'mix' || axis === 'mix') return true;
  const text = `${f.title || ''} ${f.summary || ''} ${f.body || ''} ${f.message || ''}`
    .toLowerCase();
  if (/mistura do bloco|mix of the stamped block|stamped block mix/.test(text)) {
    return true;
  }
  if (architectureCard && typeof architectureCard === 'object') {
    const chosen = /** @type {{ chosen?: unknown }} */ (architectureCard).chosen;
    if (chosen && new RegExp(`\\bmix\\b.*${String(chosen)}`, 'i').test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * @param {unknown} finding
 * @returns {string}
 */
function findingSeverity(finding) {
  if (finding == null || typeof finding !== 'object') return '';
  const raw =
    /** @type {{ severity?: unknown }} */ (finding).severity ??
    /** @type {{ level?: unknown }} */ (finding).level;
  return raw != null ? String(raw).trim().toLowerCase() : '';
}

/**
 * @param {unknown[] | null | undefined} findings
 * @returns {boolean}
 */
function hasCriticalOrMajor(findings) {
  if (!Array.isArray(findings)) return false;
  return findings.some((f) => CRITICAL_MAJOR.has(findingSeverity(f)));
}

/**
 * Maestro cursor path — never a residuals park target.
 * @param {string} slug
 * @returns {string}
 */
export function maestroCursorStatusPath(slug) {
  const name = String(slug || '').trim() || 'plan';
  return `.atomic-skills/status/automate/${name}.json`;
}

/**
 * Sidecar for parked residual findings. Distinct from the maestro cursor.
 * @param {string} slug
 * @returns {string}
 */
export function residualFindingsStatusPath(slug) {
  const name = String(slug || '').trim() || 'plan';
  return `.atomic-skills/status/automate/${name}-residuals.json`;
}

/**
 * If rel is the maestro cursor, rewrite to the residuals sidecar.
 * @param {string} rel
 * @returns {string}
 */
export function redirectParkPathOffMaestroCursor(rel) {
  const posix = String(rel || '').replace(/\\/g, '/');
  const m = posix.match(/^(?:\.\/)?(\.atomic-skills\/status\/automate\/)([^/]+)\.json$/);
  if (!m) return posix;
  const file = m[2];
  if (file.endsWith('-residuals')) return posix;
  return `${m[1]}${file}-residuals.json`;
}

/**
 * Park remaining (non-critical/major) findings for the final report.
 * Writes a sidecar, never the maestro cursor `<slug>.json`.
 * @param {string} slug
 * @param {unknown[]} findings
 * @returns {{ path: string, body: { remainingFindings: unknown[] } }}
 */
export function parkResidualFindings(slug, findings) {
  return {
    path: residualFindingsStatusPath(slug),
    body: { remainingFindings: Array.isArray(findings) ? findings : [] },
  };
}

/**
 * Next action for the 3-review loop. Mix of the stamped block never enters.
 * @param {{
 *   round?: number | null,
 *   findings?: unknown[] | null,
 *   architectureCard?: unknown,
 *   slug?: string | null,
 * }} [input]
 * @returns {{
 *   action: 'fix-and-review' | 'close-and-advance' | 'stop',
 *   reason?: string,
 *   dispatch?: string,
 *   enterLoop?: boolean,
 *   openNext?: boolean,
 *   parkPath?: string,
 *   parkFindings?: unknown[],
 * }}
 */
export function nextPhaseReviewAction(input = {}) {
  const round = Number(input.round) > 0 ? Number(input.round) : 1;
  const findings = Array.isArray(input.findings) ? input.findings : [];
  const mix = findings.find((f) => isArchitectureMixFinding(f, input.architectureCard));
  if (mix) {
    return {
      action: 'stop',
      reason: 'mix',
      enterLoop: false,
      openNext: false,
    };
  }
  if (hasCriticalOrMajor(findings)) {
    if (round >= PHASE_REVIEW_CAP) {
      return {
        action: 'stop',
        reason: 'travei',
        enterLoop: true,
        openNext: false,
      };
    }
    return {
      action: 'fix-and-review',
      dispatch: 'isolated-fix',
      enterLoop: true,
      openNext: false,
    };
  }
  const parked = parkResidualFindings(input.slug || 'plan', findings);
  return {
    action: 'close-and-advance',
    openNext: true,
    enterLoop: false,
    parkPath: parked.path,
    parkFindings: parked.body.remainingFindings,
  };
}

/**
 * Run one step of the review loop (injectable I/O).
 * @param {{
 *   slug: string,
 *   round?: number | null,
 *   findings?: unknown[] | null,
 *   architectureCard?: unknown,
 *   writeStatus?: ((path: string, body: unknown) => unknown) | null,
 *   spawnFixAgent?: (() => unknown) | null,
 *   closePhase?: (() => unknown) | null,
 *   openNext?: (() => unknown) | null,
 * }} input
 */
export function runPhaseReviewLoop(input) {
  const decision = nextPhaseReviewAction(input);
  if (decision.action === 'close-and-advance') {
    if (typeof input.writeStatus === 'function' && decision.parkPath) {
      input.writeStatus(decision.parkPath, {
        remainingFindings: decision.parkFindings,
      });
    }
    if (typeof input.closePhase === 'function') input.closePhase();
    if (typeof input.openNext === 'function') input.openNext();
    return decision;
  }
  if (decision.action === 'fix-and-review' && typeof input.spawnFixAgent === 'function') {
    input.spawnFixAgent();
  }
  return decision;
}

/**
 * Spawn the external review CLI, wait, and write command/exit/stderr/verdict.
 * Non-zero exit stores the real stderr. Missing verdict does not count.
 */
export function runExternalReviewCli(input) {
  const cli = hostCliName(input.cli) || String(input.cli || '').trim();
  const argv = Array.isArray(input.argv) ? input.argv.map(String) : [];
  const finish = (res) => {
    const stdout = res && res.stdout != null ? String(res.stdout) : '';
    const stderr = res && res.stderr != null ? String(res.stderr) : '';
    const exitRaw = res && (res.status != null ? res.status : res.exit);
    const exit = Number.isFinite(Number(exitRaw)) ? Number(exitRaw) : 1;
    const verdict = extractVerdictToken(stdout) || extractVerdictToken(stderr);
    const command = [cli, ...argv].join(' ').trim();
    return {
      exit,
      stderr,
      stdout,
      verdict,
      command,
      receipt: formatExternalReviewReceipt({ cli, command, exit, stderr, verdict }),
    };
  };
  const spawned = input.spawn(cli, argv);
  if (spawned && typeof spawned.then === 'function') {
    return spawned.then(finish);
  }
  return finish(spawned);
}

/**
 * Collect dual-leg receipt paths from a reviewGate (mode both authenticity).
 * Prefer legs[] with ≥2 path-bearing entries; else local + codex/external;
 * else reviewFile + external when distinct.
 *
 * @param {ReviewGate | null | undefined} gate
 * @returns {{ paths: string[], labels: string[] }}
 */
export function dualLegReceiptPaths(gate) {
  /** @type {string[]} */
  const paths = [];
  /** @type {string[]} */
  const labels = [];
  if (gate == null || typeof gate !== 'object') {
    return { paths, labels };
  }

  const seen = new Set();
  /**
   * @param {string | null | undefined} raw
   * @param {string} label
   */
  function push(raw, label) {
    if (raw == null) return;
    const p = String(raw).trim();
    if (p === '' || seen.has(p)) return;
    seen.add(p);
    paths.push(p);
    labels.push(label);
  }

  if (Array.isArray(gate.legs)) {
    for (let i = 0; i < gate.legs.length; i++) {
      const leg = gate.legs[i];
      if (leg == null || typeof leg !== 'object') continue;
      const raw = leg.receiptPath ?? leg.path ?? leg.reviewFile;
      const provider =
        leg.provider != null ? String(leg.provider).trim().toLowerCase() : `leg${i}`;
      push(raw, provider || `leg${i}`);
    }
  }

  push(gate.localReceiptPath, 'local');
  push(gate.codexReceiptPath, 'codex');
  push(gate.externalReceiptPath, 'external');
  // Combined reviewFile only when we still need a second path companion later.
  push(gate.reviewFile, 'reviewFile');

  return { paths, labels };
}

/**
 * Pure content authenticity floor for one receipt (medium floor).
 * Rejects binary/null-byte, undersized, and one-line stubs.
 * Accepts multi-line CLEAN or findings-style bodies meeting min size.
 *
 * @param {string | Buffer | Uint8Array | null | undefined} content
 * @param {{ label?: string, minBytes?: number }} [opts]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function receiptContentAuthenticity(content, opts = {}) {
  const label = opts.label != null ? String(opts.label) : 'receipt';
  const minBytes =
    typeof opts.minBytes === 'number' && opts.minBytes > 0
      ? opts.minBytes
      : PHASE_REVIEW_RECEIPT_MIN_BYTES;

  if (content == null) {
    return {
      ok: false,
      reason: `dual-leg authenticity: ${label} content missing`,
    };
  }

  /** @type {Buffer} */
  let buf;
  if (Buffer.isBuffer(content)) {
    buf = content;
  } else if (content instanceof Uint8Array) {
    buf = Buffer.from(content);
  } else if (typeof content === 'string') {
    buf = Buffer.from(content, 'utf8');
  } else {
    return {
      ok: false,
      reason: `dual-leg authenticity: ${label} content must be string or bytes`,
    };
  }

  // Non-binary: null byte anywhere fails closed.
  if (buf.includes(0)) {
    return {
      ok: false,
      reason: `dual-leg authenticity: ${label} is binary/null-byte (non-binary floor)`,
    };
  }

  const text = buf.toString('utf8');
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes < minBytes) {
    return {
      ok: false,
      reason: `dual-leg authenticity: ${label} below min size (${bytes} < ${minBytes} bytes) — stub/corrupt reject`,
    };
  }

  const nonEmptyLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // One-line stub under mode both (e.g. lone "CLEAN" / "ok") — fail closed.
  if (nonEmptyLines.length <= 1) {
    return {
      ok: false,
      reason: `dual-leg authenticity: ${label} is a one-line stub (need multi-line CLEAN or findings)`,
    };
  }

  // Soft stub: only 2 short lines with no CLEAN/findings vocabulary.
  const joined = nonEmptyLines.join('\n').toLowerCase();
  const hasCleanOrFindings =
    /\bclean\b/.test(joined) ||
    /\bfindings?\b/.test(joined) ||
    /\bblocker\b/.test(joined) ||
    /\bcritical\b/.test(joined) ||
    /\bmajor\b/.test(joined) ||
    /\bminor\b/.test(joined) ||
    /\breview\b/.test(joined) ||
    /\bverdict\b/.test(joined);

  if (nonEmptyLines.length <= 2 && bytes < minBytes * 2 && !hasCleanOrFindings) {
    return {
      ok: false,
      reason: `dual-leg authenticity: ${label} thin stub (need CLEAN or findings body)`,
    };
  }

  return { ok: true };
}

/**
 * Dual-leg authenticity floor for mode both (paths + content).
 *
 * @param {ReviewGate | null | undefined} gate
 * @param {{
 *   receiptContents?: Record<string, string | Buffer | Uint8Array> | null,
 *   readFile?: ((path: string) => string | Buffer) | null,
 *   cwd?: string | null,
 *   minBytes?: number,
 * }} [opts]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function phaseReviewAuthenticity(gate, opts = {}) {
  if (gate == null || typeof gate !== 'object') {
    return {
      ok: false,
      reason: 'dual-leg authenticity requires reviewGate object',
    };
  }

  const status =
    gate.status != null ? String(gate.status).trim().toLowerCase() : '';
  if (status !== 'passed') {
    return { ok: true };
  }

  const mode = gate.mode != null ? String(gate.mode).trim().toLowerCase() : '';
  if (!BOTH_SET.has(mode)) {
    // Local override / non-both: single reviewFile content check when provided.
    if (mode === 'local' && opts.receiptContents != null) {
      const rf = gate.reviewFile != null ? String(gate.reviewFile).trim() : '';
      if (rf !== '') {
        const content = resolveReceiptContent(rf, opts);
        if (content == null) {
          return {
            ok: false,
            reason: `dual-leg authenticity: missing content for local receipt ${rf}`,
          };
        }
        return receiptContentAuthenticity(content, {
          label: 'local',
          minBytes: opts.minBytes,
        });
      }
    }
    return { ok: true };
  }

  const dual = dualLegReceiptPaths(gate);
  // Need two distinct dual-leg paths under mode both (not single reviewFile alone).
  // Prefer local+codex without counting reviewFile double; require ≥2 paths that
  // are not only the combined reviewFile.
  const legPaths = dual.paths.filter((_, i) => dual.labels[i] !== 'reviewFile');
  let paths = legPaths;
  let labels = dual.labels.filter((l) => l !== 'reviewFile');
  if (paths.length < 2) {
    // Allow reviewFile + one external/local companion
    paths = dual.paths;
    labels = dual.labels;
  }
  if (paths.length < 2) {
    return {
      ok: false,
      reason:
        'dual-leg authenticity: mode both requires dual receipt paths (localReceiptPath + codexReceiptPath, or legs[] with ≥2 paths) — single reviewFile alone is not enough',
    };
  }

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const label = labels[i] || `leg${i}`;
    const content = resolveReceiptContent(path, opts);
    if (content == null) {
      return {
        ok: false,
        reason: `dual-leg authenticity: missing content for ${label} path ${path} (inject receiptContents or readFile)`,
      };
    }
    const floor = receiptContentAuthenticity(content, {
      label,
      minBytes: opts.minBytes,
    });
    if (!floor.ok) return floor;
  }

  return { ok: true };
}

/**
 * @param {string} path
 * @param {{
 *   receiptContents?: Record<string, string | Buffer | Uint8Array> | null,
 *   readFile?: ((path: string) => string | Buffer) | null,
 *   cwd?: string | null,
 * }} opts
 * @returns {string | Buffer | Uint8Array | null}
 */
function resolveReceiptContent(path, opts) {
  const map = opts.receiptContents;
  if (map != null && typeof map === 'object') {
    if (Object.prototype.hasOwnProperty.call(map, path)) {
      return map[path];
    }
    // basename key fallback for tests
    const base = path.split(/[/\\]/).pop();
    if (base && Object.prototype.hasOwnProperty.call(map, base)) {
      return map[base];
    }
  }
  if (typeof opts.readFile === 'function') {
    try {
      const abs =
        isAbsolute(path) || !opts.cwd
          ? path
          : resolve(String(opts.cwd), path);
      return opts.readFile(abs);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Pure honesty for a phase reviewGate under automate (no stamp check).
 * Includes dual-leg path shape for mode both (medium authenticity floor).
 *
 * @param {ReviewGate | null | undefined} gate
 * @returns {{ ok: boolean, reason?: string }}
 */
export function phaseReviewHonesty(gate) {
  if (gate == null || typeof gate !== 'object') {
    return {
      ok: false,
      reason:
        'automate requires reviewGate before phase-done (run review-code --mode=both, or operator skip with reason)',
    };
  }

  const status =
    gate.status != null ? String(gate.status).trim().toLowerCase() : '';

  if (status === 'passed') {
    const mode = gate.mode != null ? String(gate.mode).trim().toLowerCase() : '';
    if (!BOTH_SET.has(mode)) {
      // local without operator override reason is the dogfood skip
      if (mode === 'local') {
        // Require explicit overrideReason only — plain `reason` was the dogfood
        // fig leaf for skipped-both (`status:passed, mode:local, reason:...`).
        // Full skip uses status:skipped + operatorSkip + reason separately.
        const override =
          gate.overrideReason != null
            ? String(gate.overrideReason).trim()
            : '';
        if (override === '') {
          return {
            ok: false,
            reason:
              'automate phase-done default is review mode both; local requires non-empty overrideReason (operator-owned downgrade) — plain reason alone is not enough',
          };
        }
        const overrideHonesty = externalReviewReceiptHonesty({
          overrideReason: override,
          externalStderr: gate.externalStderr,
          stderr: gate.stderr,
        });
        if (!overrideHonesty.ok) return overrideHonesty;
        // Allow explicit local downgrade with reason (operator-owned)
        const at = gate.at != null ? String(gate.at).trim() : '';
        if (!GIT_SHA_RE.test(at)) {
          return {
            ok: false,
            reason:
              'reviewGate status=passed requires real git SHA at (even for local override)',
          };
        }
        const reviewFile =
          gate.reviewFile != null ? String(gate.reviewFile).trim() : '';
        if (reviewFile === '') {
          return {
            ok: false,
            reason:
              'reviewGate status=passed requires non-empty reviewFile under automate',
          };
        }
        return { ok: true };
      }
      return {
        ok: false,
        reason: `automate phase-done requires reviewGate.mode both (or both-*/external-both); got ${mode || 'missing'}`,
      };
    }
    const at = gate.at != null ? String(gate.at).trim() : '';
    if (!GIT_SHA_RE.test(at)) {
      return {
        ok: false,
        reason: 'reviewGate status=passed requires real git SHA at',
      };
    }
    const reviewFile =
      gate.reviewFile != null ? String(gate.reviewFile).trim() : '';
    if (reviewFile === '') {
      return {
        ok: false,
        reason:
          'reviewGate status=passed requires non-empty reviewFile under automate (durable receipt)',
      };
    }
    // Dual-leg path shape (authenticity floor — medium): mode both needs ≥2
    // distinct receipt paths. Single reviewFile alone is the dogfood stub shape.
    const dual = dualLegReceiptPaths(gate);
    if (dual.paths.length < 2) {
      return {
        ok: false,
        reason:
          'dual-leg authenticity: mode both requires dual receipt paths (localReceiptPath + codexReceiptPath, or legs[] with ≥2 paths) — single reviewFile alone is not enough',
      };
    }
    return { ok: true };
  }

  if (status === 'skipped') {
    const reason = gate.reason != null ? String(gate.reason).trim() : '';
    // Prefer operatorSkip true; also accept non-empty reason alone for skip
    // (GATE-R3), but under automate require operatorSkip === true to match
    // evaluation skip authenticity.
    if (gate.operatorSkip !== true) {
      return {
        ok: false,
        reason:
          'reviewGate status=skipped under automate requires operatorSkip=true + non-empty reason',
      };
    }
    if (reason === '') {
      return {
        ok: false,
        reason:
          'reviewGate status=skipped requires non-empty reason under automate',
      };
    }
    return { ok: true };
  }

  return {
    ok: false,
    reason: `unknown or missing reviewGate.status: ${status || '(empty)'}`,
  };
}

/**
 * Whether phase-done may proceed under automate review policy.
 * Non-automate → ok (inactive).
 * Under automate: honesty + dual-leg authenticity content floor when
 * receiptContents / readFile / checkAuthenticity is set (fail closed for
 * stubs when content is checked).
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 *   reviewGate?: ReviewGate | null,
 *   phase?: { reviewGate?: ReviewGate | null } | null,
 *   receiptContents?: Record<string, string | Buffer | Uint8Array> | null,
 *   readFile?: ((path: string) => string | Buffer) | null,
 *   cwd?: string | null,
 *   checkAuthenticity?: boolean | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function phaseReviewAllowsClose(input = {}) {
  if (!isDurableAutomateForPhaseReview(input)) {
    return { ok: true };
  }
  const gate =
    input.reviewGate != null
      ? input.reviewGate
      : input.phase != null && typeof input.phase === 'object'
        ? input.phase.reviewGate
        : null;
  const honesty = phaseReviewHonesty(gate);
  if (!honesty.ok) return honesty;

  const mode =
    gate != null && gate.mode != null
      ? String(gate.mode).trim().toLowerCase()
      : '';
  const status =
    gate != null && gate.status != null
      ? String(gate.status).trim().toLowerCase()
      : '';
  const shouldCheckContent =
    input.checkAuthenticity === true ||
    input.receiptContents != null ||
    typeof input.readFile === 'function';

  if (
    shouldCheckContent &&
    status === 'passed' &&
    (BOTH_SET.has(mode) || mode === 'local')
  ) {
    return phaseReviewAuthenticity(gate, {
      receiptContents: input.receiptContents,
      readFile: input.readFile,
      cwd: input.cwd,
    });
  }

  return honesty;
}
