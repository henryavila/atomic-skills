#!/usr/bin/env node
/**
 * Deterministic decompose-source lint (R-ORCH-12 / R-SP-24 = No-Placeholders;
 * R-ORCH-19/23 = the per-task SPEC admission gate).
 *
 * Mirrors `scripts/lint-design.js`: pure, zero-token, no network, no tool calls
 * — a string scan callable from any agent (including Gemini's read-only
 * investigator). It is the deterministic backstop the thin task bodies depend
 * on, and it never touches `src/decompose.js` (R-ORCH-10: decompose heuristics
 * + the `## F0/F1` + `### Tn` + `exit_gate` YAML grammar stay UNCHANGED).
 *
 * Two exported checks, one shared substrate:
 *
 *   lintSource(markdown) — No-Placeholders. Rejects authored fill-me markers
 *     that must never reach materialized state: `REPLACE_*`, TODO/FIXME/TBD/WIP/
 *     HACK/XXX sentinels, fuzzy `<path>`-class placeholders, and vague
 *     cross-task references ("similar to Task N"). Wired as the PLAN-stage
 *     pre-materialize gate: a violation aborts decompose/materialize, 0 files
 *     written. Note: `materializeDecomposition` still *generates* `TODO:`
 *     sentinels for genuinely-empty fields (decompose.test.js:293) — that is a
 *     separate safety net on the OUTPUT; this lint runs on the SOURCE so those
 *     under-specified sources are rejected before they ever materialize.
 *
 *   lintSpec(markdown) — the SPEC / per-task admission gate. Subsumes
 *     lintSource, then requires every `### Tn` task section to carry exact
 *     paths (a Files block), a scopeBoundary, acceptance criteria, and a
 *     DETERMINISTIC verifier (shell/test/query — never manual/absent). No
 *     panel (R-ORCH-19). A task lacking any of the four fails admission with a
 *     named error (R-ORCH-23). Bullet-mode tasks (a `### Tasks` marker + task
 *     bullets, no per-task `### Tn` body) cannot express the interior, so the
 *     gate requires the verbose `### Tn` form.
 *
 * What this lint deliberately does NOT do: distinguish a documented path
 * VARIABLE (`projects/<id>/<slug>/`) from a fuzzy fill-me placeholder. Only a
 * fixed placeholder vocabulary (`<path>`, `<file>`, `<dir>`, `<...>`, …) is
 * flagged, so path patterns using `<id>`/`<slug>` pass.
 *
 * Usage:
 *   node scripts/lint-source.js <source.md>          # No-Placeholders only
 *   node scripts/lint-source.js <source.md> --spec   # full per-task SPEC gate
 *
 * Exit codes:
 *   0 — clean
 *   1 — one or more violations
 *   2 — file/usage error
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// --- placeholder vocabularies -------------------------------------------------

// Unfilled template marker — unmistakable, always a violation.
const REPLACE_RE = /REPLACE_[A-Z0-9_]+/g;

// Sentinel placeholder words, only in sentinel POSITIONS (so "Build a TODO app"
// in prose does not trip — only `TODO:`, `[TODO]`, `(TODO)`, or a bare `- TODO`).
const SENTINEL_WORDS = 'TODO|FIXME|TBD|WIP|HACK|XXX';
const SENTINEL_COLON_RE = new RegExp(`\\b(${SENTINEL_WORDS})\\b\\s*:`, 'gi');
// Wrapped in quotes/parens/brackets: `"FIXME"`, `(TODO)`, `[XXX]`.
const SENTINEL_WRAPPED_RE = new RegExp(`["'(\\[]\\s*(${SENTINEL_WORDS})\\s*["')\\]]`, 'gi');
// A bare bullet/line that IS the sentinel: `- TODO`.
const SENTINEL_BARE_RE = new RegExp(`^(${SENTINEL_WORDS})$`, 'i');
// A value that is JUST a sentinel after a separator: `goal — TBD`, `x: FIXME`.
const SENTINEL_TRAILING_RE = new RegExp(`[:—–-]\\s*(${SENTINEL_WORDS})\\s*\\.?\\s*$`, 'i');

// Fuzzy fill-me placeholders inside angle brackets — a FIXED vocabulary so
// real path variables (`<id>`, `<slug>`, `<N>`) and autolinks (`<https://…>`)
// are NOT flagged.
const FUZZY_ANGLE_RE =
  /<\s*(?:\.{2,}|…|path|paths|file|files|filename|filepath|dir|directory|directories|folder|name|value|placeholder|insert[^>]*|your[-\s][^>]*|todo|tbd|xxx+)\s*>/gi;

// Vague cross-task references — an under-specified task that defers its HOW to
// another task instead of stating it.
const VAGUE_REFS = [
  /\b(?:similar to|same as|like)\s+(?:the\s+)?(?:previous\s+|prior\s+|above\s+)?task\b/i,
  /\bsee\s+task\s+\S/i,
  /\bas\s+(?:in\s+)?task\s*[#\d]/i,
];

// Level-confusion: a TASK whose title masquerades as a PHASE ("Phase A — …",
// "Fase 2: …"). The hierarchy is Plan → Phase → Task; a task titled like a phase
// lies about its level and confuses the dashboard. Requires a phase word + a
// SHORT id token (single letter or digits) + a separator (— – : -) so prose like
// "Phase out the legacy parser" or "Phase 1 rollout is done" is NOT flagged.
const LEVEL_PREFIX_RE = /^\s*(?:phase|fase)\s+(?:[a-z]|\d{1,3})\b\s*[—–:-]/i;

/** True if a task title masquerades as a phase-level heading. Pure predicate. */
export function levelConfusedTaskTitle(title) {
  return typeof title === 'string' && LEVEL_PREFIX_RE.test(title.trim());
}

// --- markdown tokenizer (fence-aware) ----------------------------------------

/**
 * Tokenize markdown into lines annotated with fence state, blockquote flag, and
 * heading level/title. Headings and blockquotes inside ``` / ~~~ fences are
 * inert. Pure: no I/O.
 *
 * @param {string} markdown
 * @returns {Array<{raw:string, lineNo:number, inFence:boolean, isBlockquote:boolean, level:number, title:string}>}
 */
function tokenize(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const tokens = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const fenceMatch = raw.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const inFenceNow = fence != null;
      if (fence == null) fence = fenceMatch[1][0];
      else if (raw.trim().startsWith(fence.repeat(3))) fence = null;
      // The fence marker line itself carries no scannable placeholder content.
      tokens.push({ raw, lineNo: i + 1, inFence: inFenceNow, isBlockquote: false, level: 0, title: '' });
      continue;
    }
    const inFence = fence != null;
    let level = 0;
    let title = '';
    if (!inFence) {
      const h = raw.match(/^(#{1,6})\s+(.*\S)\s*$/);
      if (h) { level = h[1].length; title = h[2]; }
    }
    tokens.push({
      raw,
      lineNo: i + 1,
      inFence,
      isBlockquote: !inFence && /^\s*>/.test(raw),
      level,
      title,
    });
  }
  return tokens;
}

/** Lowercase, strip numbered prefix + diacritics + emphasis markers. */
function normalizeHeading(text) {
  return String(text || '')
    .replace(/^\d+(?:\.\d+)*\.?\s*/, '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[`*]/g, '')
    .trim()
    .toLowerCase();
}

// H3 markers that mean "the following bullets are tasks", not a task themselves.
const TASK_MARKER_RE = /^(?:sub[-\s]?fases?|sub[-\s]?phases?|tasks?|sub[-\s]?tasks?)(?:\s*\([^)]*\))?\s*$/i;
// Leading task id on an H3 title: `T0.1`, `T-001`, `T1`.
const TASK_ID_RE = /^(T[-.]?\d+(?:\.\d+)?)\b\s*(.*)$/i;
// A bullet that is itself a task (bullet-mode): `- **T-001 — …**` or `- T0.1 …`.
const TASK_BULLET_RE = /^\s*[-*]\s*(?:\*\*[^*]+\*\*|T-?\d+(?:\.\d+)?\b)/i;
// Read a `name: value` body field, tolerating a leading list marker and bold
// emphasis (`- Files:` and `- **Files:**` both parse).
function fieldValue(line, name) {
  const clean = line.replace(/\*\*/g, '');
  const re = new RegExp(`^\\s*[-*]?\\s*${name}\\s*:\\s*(.*)$`, 'i');
  const m = clean.match(re);
  return m ? m[1].trim() : null;
}

// --- text scrubbing for placeholder scanning ---------------------------------

/** Remove inline-code spans so documented tokens in backticks don't false-positive. */
function stripInlineCode(text) {
  return text.replace(/`[^`]*`/g, ' ');
}

// --- public: parseTaskSections -----------------------------------------------

/**
 * Enumerate `### Tn` task sections (fence-aware), each under its `## F<N>`
 * phase, skipping `### Tasks`/`### Sub-fases` markers. Pure: no I/O.
 *
 * @param {string} markdown
 * @returns {Array<{phaseId:string, taskId:string, title:string, startLine:number, bodyLines:string[]}>}
 */
export function parseTaskSections(markdown) {
  const tokens = tokenize(markdown);
  const headings = tokens.filter((t) => t.level > 0);
  const sections = [];
  let currentPhase = null;
  let phaseCounter = 0;
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    if (h.level === 2) {
      const pm = h.title.match(/^(F\d+)\b/i);
      currentPhase = pm ? pm[1].toUpperCase() : null;
      phaseCounter = 0;
      continue;
    }
    if (h.level !== 3 || !currentPhase) continue;
    const norm = normalizeHeading(h.title);
    if (TASK_MARKER_RE.test(norm)) continue; // a marker, not a task
    phaseCounter += 1;
    const idm = h.title.match(TASK_ID_RE);
    const taskId = idm ? idm[1].toUpperCase() : `T-${String(phaseCounter).padStart(3, '0')}`;
    const title = idm ? idm[2].trim() : h.title.trim();
    // Body = lines after this heading until the next heading of level <= 3.
    let endLineNo = Infinity;
    for (let k = i + 1; k < headings.length; k++) {
      if (headings[k].level <= 3) { endLineNo = headings[k].lineNo; break; }
    }
    const bodyLines = tokens
      .filter((t) => t.lineNo > h.lineNo && t.lineNo < endLineNo)
      .map((t) => t.raw);
    sections.push({ phaseId: currentPhase, taskId, title, startLine: h.lineNo, bodyLines });
  }
  return sections;
}

// --- public: lintSource (No-Placeholders) ------------------------------------

/**
 * No-Placeholders lint (R-ORCH-12 / R-SP-24). Pure: no I/O. Returns [] when
 * the source is free of fill-me placeholders.
 *
 * @param {string} markdown
 * @returns {string[]} violation messages (empty = clean)
 */
export function lintSource(markdown) {
  if (typeof markdown !== 'string' || markdown.trim() === '') return [];
  const tokens = tokenize(markdown);
  const violations = [];
  for (const t of tokens) {
    // Blockquote instruction lines are deleted before decompose — skip them.
    if (t.isBlockquote) continue;
    // Inside fences, scan raw (placeholders in a verifier command are real);
    // outside, strip inline-code so `^F<N>\b`-style docs don't trip.
    const text = t.inFence ? t.raw : stripInlineCode(t.raw);
    const at = `(line ${t.lineNo})`;

    for (const m of text.matchAll(REPLACE_RE)) {
      violations.push(`unfilled template placeholder "${m[0]}" ${at}.`);
    }
    for (const m of text.matchAll(SENTINEL_COLON_RE)) {
      violations.push(`placeholder sentinel "${m[1].toUpperCase()}:" ${at}.`);
    }
    for (const m of text.matchAll(SENTINEL_WRAPPED_RE)) {
      violations.push(`placeholder sentinel "${m[1].toUpperCase()}" ${at}.`);
    }
    const bare = text.replace(/^\s*[-*>\s]+/, '').trim();
    if (SENTINEL_BARE_RE.test(bare)) {
      violations.push(`placeholder sentinel "${bare.toUpperCase()}" ${at}.`);
    }
    const trail = text.match(SENTINEL_TRAILING_RE);
    if (trail) violations.push(`placeholder sentinel "${trail[1].toUpperCase()}" ${at}.`);
    for (const m of text.matchAll(FUZZY_ANGLE_RE)) {
      violations.push(`fuzzy placeholder "${m[0].replace(/\s+/g, '')}" ${at} — replace with a concrete value.`);
    }
    for (const re of VAGUE_REFS) {
      const m = text.match(re);
      if (m) violations.push(`vague cross-task reference "${m[0].trim()}" ${at} — state the HOW in this task.`);
    }
  }
  return [...new Set(violations)];
}

// --- public: lintSpec (per-task SPEC admission gate) -------------------------

/** Does a Files value carry at least one concrete path (and not only a placeholder)? */
function hasConcretePath(value) {
  if (!value) return false;
  const cleaned = value.replace(FUZZY_ANGLE_RE, ' ').replace(REPLACE_RE, ' ');
  return /[\w@.-]*\/[\w@./-]+|[\w-]+\.[A-Za-z0-9]+/.test(cleaned);
}

/**
 * Is a verifier value a deterministic kind (shell/test/query, not manual)?
 * Reads the declared `kind <X>` token first, so a `kind manual` verifier whose
 * free-text description merely mentions "test" does NOT pass.
 */
function isDeterministicVerifier(value) {
  if (!value) return false;
  const m = value.match(/\bkind\s+(shell|test|query|manual)\b/i);
  if (m) return /^(shell|test|query)$/i.test(m[1]);
  // No explicit `kind` token — accept a deterministic word only if not manual.
  if (/\bmanual\b/i.test(value)) return false;
  return /\b(shell|test|query)\b/i.test(value);
}

/** Exact-match tautological command bodies after kind (design seed ban). */
export const TAUTOLOGICAL_COMMANDS = new Set([
  'exit 0',
  'true',
  ':',
  'echo ok',
  'echo OK',
  '',
]);

/**
 * Extract shell/test command body from a verifier field value for smoke checks.
 * @param {string} value
 * @returns {string|null}
 */
export function extractVerifierCommand(value) {
  if (!value || typeof value !== 'string') return null;
  const cmd =
    value.match(/\bcommand\s*[:=]\s*["']([^"']+)["']/i)?.[1] ??
    value.match(/\bcommand\s*[:=]\s*([^\n,;]+)/i)?.[1] ??
    null;
  if (cmd != null) return cmd.trim();
  // bare `kind: shell` with nothing else
  if (/\bkind\s*[:=]?\s*(shell|test)\b/i.test(value) && !/\bcommand\b/i.test(value)) {
    return '';
  }
  return null;
}

/**
 * @param {string} value verifier field
 * @returns {boolean} true if tautological / empty shell-test command
 */
export function isTautologicalVerifier(value) {
  if (!value || typeof value !== 'string') return false;
  if (/\bkind\s*[:=]?\s*query\b/i.test(value)) return false;
  if (/\bkind\s*[:=]?\s*manual\b/i.test(value)) return false;
  const cmd = extractVerifierCommand(value);
  if (cmd === null) return false;
  return TAUTOLOGICAL_COMMANDS.has(cmd.trim());
}

/**
 * Basenames + argv0 tokens for acceptance↔verifier overlap.
 * @returns {{ paths: Set<string>, tokens: Set<string> }}
 */
export function extractOverlapTokens(...texts) {
  const paths = new Set();
  const tokens = new Set();
  const joined = texts.filter(Boolean).join('\n');
  for (const m of joined.matchAll(/[\w@./-]+\.[A-Za-z0-9]+/g)) {
    const base = m[0].split('/').pop().toLowerCase();
    if (base) paths.add(base);
    paths.add(m[0].toLowerCase());
  }
  for (const m of joined.matchAll(/(?:^|[\s"'`])([a-zA-Z][\w.-]*)/g)) {
    const t = m[1].toLowerCase();
    if (t.length >= 2 && !['kind', 'shell', 'test', 'query', 'command', 'it'].includes(t)) {
      tokens.add(t);
    }
  }
  return { paths, tokens };
}

/**
 * Whole-suite runners without a file path argument are legitimate SPEC
 * verifiers (project suite as oracle). Do not HARD-block on zero path/token
 * overlap for these shapes.
 * @param {string} verifierVal
 * @returns {boolean}
 */
export function isWholeSuiteVerifier(verifierVal) {
  if (!verifierVal || typeof verifierVal !== 'string') return false;
  // Prefer the command field when present (YAML/JSON-ish verifier blocks).
  const cmdMatch = verifierVal.match(
    /(?:command|cmd)\s*[:=]\s*["'`]?([^"'`\n]+)/i,
  );
  const cmd = (cmdMatch ? cmdMatch[1] : verifierVal).trim();
  const normalized = cmd.replace(/\s+/g, ' ').trim();
  // Bare or near-bare suite runners (optional trailing flags that are not paths)
  return (
    /^(npm|pnpm|yarn)\s+test(\s|$)/i.test(normalized) ||
    /^npx\s+[\w@/.-]*\s*test(\s|$)/i.test(normalized) ||
    /^pytest(\s|$)/i.test(normalized) ||
    /^cargo\s+test(\s|$)/i.test(normalized) ||
    /^go\s+test(\s|\.\/|\.\/\.\.\.|$)/i.test(normalized) ||
    /^make\s+test(\s|$)/i.test(normalized) ||
    /^node\s+--test(\s|$)/i.test(normalized) ||
    /^bun\s+test(\s|$)/i.test(normalized) ||
    /^vitest(\s+run)?(\s|$)/i.test(normalized) ||
    /^jest(\s|$)/i.test(normalized)
  );
}

/**
 * @returns {'ok'|'warn'|'hard'}
 */
export function acceptanceVerifierOverlap(filesVal, acceptanceVal, verifierVal) {
  if (!verifierVal || /\bmanual\b/i.test(verifierVal)) return 'ok';
  // Project-wide suite runners are deterministic oracles without path tokens.
  if (isWholeSuiteVerifier(String(verifierVal))) return 'ok';
  const a = extractOverlapTokens(filesVal, acceptanceVal);
  const v = extractOverlapTokens(verifierVal);
  let pathHit = false;
  for (const p of a.paths) if (v.paths.has(p) || v.tokens.has(p.replace(/\.[^.]+$/, ''))) pathHit = true;
  let tokenHit = false;
  for (const t of a.tokens) if (v.tokens.has(t) || v.paths.has(t)) tokenHit = true;
  // also acceptance path mentioned in verifier string directly
  for (const p of a.paths) {
    if (String(verifierVal).toLowerCase().includes(p)) pathHit = true;
  }
  if (pathHit || tokenHit) return 'ok';
  // zero overlap
  return 'hard';
}

/**
 * SPEC / per-task admission gate (R-ORCH-19/23). Subsumes lintSource, then
 * requires every task to carry exact paths + scopeBoundary + acceptance + a
 * deterministic verifier. No panel. Pure: no I/O.
 *
 * @param {string} markdown
 * @returns {string[]} violation messages (empty = every task admitted)
 */
export function lintSpec(markdown) {
  const violations = lintSource(markdown);
  if (typeof markdown !== 'string' || markdown.trim() === '') return violations;

  const tokens = tokenize(markdown);
  const headings = tokens.filter((t) => t.level > 0);
  const taskSections = parseTaskSections(markdown);

  // Per-phase: detect bullet-mode (task bullets, no `### Tn` section).
  const phases = [];
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const pm = h.level === 2 && h.title.match(/^(F\d+)\b/i);
    if (!pm) continue;
    let endLineNo = Infinity;
    for (let k = i + 1; k < headings.length; k++) {
      if (headings[k].level <= 2) { endLineNo = headings[k].lineNo; break; }
    }
    phases.push({ id: pm[1].toUpperCase(), startLine: h.lineNo, endLineNo });
  }
  for (const phase of phases) {
    const h3Tasks = taskSections.filter((s) => s.phaseId === phase.id);
    if (h3Tasks.length > 0) continue;
    const bulletTasks = tokens.filter(
      (t) => !t.inFence && t.lineNo > phase.startLine && t.lineNo < phase.endLineNo && TASK_BULLET_RE.test(t.raw),
    );
    if (bulletTasks.length > 0) {
      violations.push(
        `phase ${phase.id}: tasks are in bullet-mode; the SPEC gate requires per-task ### Tn ` +
        `sections so each carries Files / scopeBoundary / acceptance / verifier.`,
      );
    }
  }

  // Per-task: the four required interior fields.
  for (const s of taskSections) {
    const where = `task ${s.taskId} (phase ${s.phaseId})`;
    if (levelConfusedTaskTitle(s.title)) {
      violations.push(`${where}: task title "${s.title}" masquerades as a phase — a task is not a phase; drop the "Phase/Fase <X> —" prefix.`);
    }
    const find = (name) => {
      for (const line of s.bodyLines) {
        const v = fieldValue(line, name);
        if (v != null) return v;
      }
      return null;
    };
    const files = find('files');
    if (files == null) {
      violations.push(`${where}: missing a Files block (the exact files this task creates/edits).`);
    } else if (!hasConcretePath(files)) {
      violations.push(`${where}: Files block has no exact path (only placeholders).`);
    }
    const scope = find('scope[\\s_-]?boundary');
    if (scope == null || scope === '') {
      violations.push(`${where}: missing scopeBoundary (what this task must NOT touch).`);
    }
    const acceptance = find('acceptance');
    if (acceptance == null || acceptance === '') {
      violations.push(`${where}: missing acceptance (≤5 testable checks).`);
    }
    const verifier = find('verifier');
    if (verifier == null) {
      violations.push(`${where}: missing a deterministic verifier (shell/test/query).`);
    } else if (!isDeterministicVerifier(verifier)) {
      violations.push(`${where}: verifier is not deterministic ("${verifier}"); needs a shell/test/query verifier.`);
    } else if (isIncompleteQueryVerifier(verifier)) {
      violations.push(
        `${where}: kind:query verifier is incomplete — requires sql and expectRowCount (connectionCommand optional; without it the criterion defers).`,
      );
    } else if (isTautologicalVerifier(verifier)) {
      violations.push(
        `${where}: verifier command is tautological/smoke-banned ("${extractVerifierCommand(verifier) ?? ''}"); use a real shell/test command.`,
      );
    } else {
      const overlap = acceptanceVerifierOverlap(files, acceptance, verifier);
      if (overlap === 'hard') {
        violations.push(
          `${where}: acceptance/Files and verifier have zero path/token overlap — HARD; mention a shared basename or command token.`,
        );
      }
    }
  }
  return violations;
}

/**
 * A query verifier is incomplete when it declares kind:query but lacks either
 * sql or a numeric expectRowCount (F3/T-004 — no silent open-ended query).
 * @param {string} value
 * @returns {boolean}
 */
export function isIncompleteQueryVerifier(value) {
  if (!value || typeof value !== 'string') return false;
  const isQuery =
    /\bkind\s*[:=]?\s*query\b/i.test(value) ||
    (/\bquery\b/i.test(value) && !/\bkind\s*[:=]?\s*(shell|test|manual)\b/i.test(value));
  if (!isQuery) return false;
  const hasSql = /\bsql\s*[:=]/i.test(value) || /SELECT\b/i.test(value);
  const hasExpect =
    /\bexpectRowCount\s*[:=]\s*\d+/i.test(value) ||
    /\bexpectRowCount\s*:\s*\d+/i.test(value);
  return !(hasSql && hasExpect);
}

// --- CLI ---------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const spec = args.includes('--spec');
  const files = args.filter((a) => a !== '--spec');
  if (files.length !== 1) {
    console.error('Usage: node scripts/lint-source.js <source.md> [--spec]');
    process.exit(2);
  }
  let raw;
  try {
    raw = readFileSync(files[0], 'utf8');
  } catch (err) {
    console.error(`ERROR: cannot read ${files[0]}: ${err.message}`);
    process.exit(2);
  }
  const violations = spec ? lintSpec(raw) : lintSource(raw);
  const label = spec ? 'SPEC per-task gate' : 'No-Placeholders lint';
  if (violations.length === 0) {
    console.log(`✓ ${files[0]} — ${label} clean`);
    process.exit(0);
  }
  console.error(`✖ ${files[0]} — ${label} failed (${violations.length}):`);
  for (const v of violations) console.error(`    - ${v}`);
  process.exit(1);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main();
}
