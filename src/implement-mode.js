/**
 * Pure implement mode parse + automate-active detection (design D1, D14).
 *
 * No I/O. Skill bodies and transitions share these helpers so CLI flag,
 * plan executionMode stamp, and clear path resolve consistently.
 */

/** @typedef {'default' | 'mode1' | '1' | 'automate' | '2'} ImplementMode */

/**
 * Known implement mode tokens. `default`/`mode1`/`1` are session-writer Mode 1;
 * `automate` is pure-maestro + phase writers; `2` reserved for Mode 2 surface.
 * @type {readonly string[]}
 */
export const IMPLEMENT_MODES = Object.freeze(['default', 'mode1', '1', 'automate', '2']);

const MODE1_ALIASES = new Set(['default', 'mode1', '1', 'session']);
const AUTOMATE_ALIASES = new Set(['automate']);
const MODE2_ALIASES = new Set(['2', 'mode2', 'codex']);

/**
 * Normalize a free-form mode token into a canonical ImplementMode-like string.
 * @param {string} raw
 * @returns {string}
 */
function normalizeModeToken(raw) {
  const s = String(raw).trim().toLowerCase();
  if (MODE1_ALIASES.has(s)) return s === 'session' ? 'mode1' : s === 'default' ? 'default' : s;
  if (AUTOMATE_ALIASES.has(s)) return 'automate';
  if (MODE2_ALIASES.has(s)) return s === 'mode2' || s === 'codex' ? '2' : s;
  return s;
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
function isKnownMode(raw) {
  const n = normalizeModeToken(raw);
  return MODE1_ALIASES.has(n) || n === 'automate' || n === '2' || IMPLEMENT_MODES.includes(n);
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
function isBlankMode(raw) {
  return raw == null || String(raw).trim() === '';
}

/**
 * Parse CLI-like tokens for implement mode and clear-execution-mode.
 * Accepts a string (space-split) or string array. Pure — no process.argv read.
 *
 * Tokens recognized:
 * - `--mode=automate` / `--mode=1` / `--mode=<token>`
 * - `--mode automate` (space form)
 * - `mode:automate` bare token
 * - `--clear-execution-mode`
 *
 * Rejects empty `--mode=`, blank mode values, and unknown tokens with a clear error.
 *
 * @param {string | string[] | null | undefined} argvLike
 * @returns {{ mode: string, clearExecutionMode: boolean, modeExplicit: boolean }}
 * @throws {Error} when an explicit mode token is unknown or blank
 */
export function parseImplementMode(argvLike) {
  /** @type {string[]} */
  let tokens;
  if (argvLike == null || argvLike === '') {
    tokens = [];
  } else if (typeof argvLike === 'string') {
    tokens = argvLike.trim() === '' ? [] : argvLike.trim().split(/\s+/);
  } else if (Array.isArray(argvLike)) {
    tokens = argvLike.map((t) => String(t));
  } else {
    tokens = [];
  }

  let mode = 'default';
  let clearExecutionMode = false;
  let modeExplicit = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t === '--clear-execution-mode' || t === 'clear-execution-mode') {
      clearExecutionMode = true;
      continue;
    }

    // Match --mode=VALUE including empty --mode=
    const eq = t.match(/^--mode=(.*)$/i);
    if (eq) {
      const raw = eq[1];
      if (isBlankMode(raw)) {
        throw new Error('Unknown implement mode: (empty)');
      }
      if (!isKnownMode(raw)) {
        throw new Error(`Unknown implement mode: ${raw}`);
      }
      mode = normalizeModeToken(raw);
      modeExplicit = true;
      continue;
    }

    if (t === '--mode' || t === '-m') {
      const next = tokens[i + 1];
      if (next == null || next.startsWith('-') || isBlankMode(next)) {
        throw new Error('Unknown implement mode: (missing value after --mode)');
      }
      if (!isKnownMode(next)) {
        throw new Error(`Unknown implement mode: ${next}`);
      }
      mode = normalizeModeToken(next);
      modeExplicit = true;
      i += 1;
      continue;
    }

    // Match mode:VALUE including empty mode:
    const colon = t.match(/^mode:(.*)$/i);
    if (colon) {
      const raw = colon[1];
      if (isBlankMode(raw)) {
        throw new Error('Unknown implement mode: (empty)');
      }
      if (!isKnownMode(raw)) {
        throw new Error(`Unknown implement mode: ${raw}`);
      }
      mode = normalizeModeToken(raw);
      modeExplicit = true;
    }
  }

  // Absent mode → default (Mode 1). Explicit mode1 aliases stay as normalized.
  if (!modeExplicit) {
    mode = 'default';
  }

  return { mode, clearExecutionMode, modeExplicit };
}

/**
 * Whether pure-maestro automate mode is active for this session.
 *
 * Precedence (design open-Q1 closed + M4 explicit non-automate CLI override):
 * 1. clearExecutionMode true → false (always wins)
 * 2. cliMode === 'automate' → true
 * 3. cliMode is an explicit known non-automate mode (1/mode1/default/2/mode2/codex)
 *    → false even if stamp is automate
 * 4. planExecutionMode / stamp === 'automate' with no explicit non-automate CLI
 *    → true (stamp-alone re-entry when cliMode absent/undefined)
 * 5. else false
 *
 * Automate is OFF by default when nothing is set.
 *
 * @param {{
 *   cliMode?: string | null,
 *   planExecutionMode?: string | null,
 *   clearExecutionMode?: boolean,
 * }} [input]
 * @returns {boolean}
 */
export function isAutomateActive(input = {}) {
  if (input.clearExecutionMode === true) {
    return false;
  }

  const cliRaw =
    input.cliMode != null && String(input.cliMode).trim() !== ''
      ? String(input.cliMode)
      : '';
  if (cliRaw !== '') {
    const cli = normalizeModeToken(cliRaw);
    if (cli === 'automate') {
      return true;
    }
    // Explicit known non-automate CLI overrides stamp (M4).
    if (isKnownMode(cliRaw)) {
      return false;
    }
    // Unknown cliMode: fall through to stamp (do not invent activate).
  }

  const stamp =
    input.planExecutionMode != null && String(input.planExecutionMode).trim() !== ''
      ? normalizeModeToken(String(input.planExecutionMode))
      : '';
  if (stamp === 'automate') {
    return true;
  }

  return false;
}
