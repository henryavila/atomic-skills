/**
 * Decompose a structured markdown plan into a Plan + Initiatives + Tasks
 * proposal that project-plan (Stage 5) presents to the user for confirmation
 * before any file is written.
 *
 * Pure function: no I/O, no globals. The skill body (project-plan.md) owns
 * the interactive confirmation flow and the eventual file write (Stage 6);
 * this module only owns the deterministic transform from markdown source to
 * structured proposal.
 *
 * Heuristics (the documented conventions a source markdown must follow):
 *
 *   1. The first H1 (`# ...`) becomes plan.title. Lines between that H1 and
 *      the first H2 become plan.narrative (whitespace-trimmed, joined as-is).
 *
 *   2. H2 whose title (case-insensitive, after trim) starts with `principle`
 *      becomes the principles section. Top-level bullets inside it become
 *      `principles[]` entries — each parsed as `**Title** — body` or
 *      `Title — body` or `Title: body`. The id is auto-assigned `P1`, `P2`, …
 *      unless the bullet starts with `- P<N>` / `- **P<N>` (then that id is
 *      kept).
 *
 *   3. H2 whose title starts with `glossary` becomes the glossary section.
 *      Bullets are parsed as `term — definition`, `term – definition`,
 *      `term: definition`, or `**term** — definition`.
 *
 *   4. H2 whose title matches /^(F\d+)\b\s*[-—–]?\s*(.+)?$/ becomes a phase.
 *      capture[1] (e.g. `F0`) is the phaseId; capture[2] is the title.
 *      Inside that phase H2:
 *        - the first paragraph beginning with `Goal:` / `Objetivo:` becomes
 *          phase.goal (stripped of the prefix).
 *        - H3 headings (`### ...`) become tasks. The H3 line is parsed for
 *          an optional leading task id (`### T0.1 ...` or `### T-001 ...`);
 *          if absent, ids are auto-assigned `T-001`, `T-002`, … within the
 *          phase. The remainder is the task title.
 *        - ```yaml ... ``` or ```yml ... ``` fenced blocks containing top-
 *          level `exit_gate:` or `exitGate:` (with `criteria:` inside) are
 *          parsed via the `yaml` package and become the phase's
 *          exitGate.criteria entries.
 *
 *   5. Any H2 not matching the principles / glossary / phase patterns is
 *      surfaced in `warnings` (the user can opt to ignore or move it).
 *
 *   6. The skill is opportunistic: missing principles / glossary do NOT
 *      abort the decompose — they become empty arrays. Missing phases DO
 *      abort (the function throws) because a Plan with zero phases is
 *      invalid by the JSON Schema (`phases.minItems: 1`).
 *
 * Slug suggestion: each phase's initiative slug is `<plan-slug>-<phaseId-lowercase>-<phase-title-kebab>`
 * truncated to schema slug regex (`^[a-z][a-z0-9-]{1,63}$`).
 *
 * @typedef {object} DecomposedTask
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 *
 * @typedef {object} DecomposedExitCriterion
 * @property {string} id
 * @property {string} description
 * @property {object} [verifier]
 * @property {string} status — always 'pending' on initial decompose
 *
 * @typedef {object} DecomposedInitiative
 * @property {string} phaseId
 * @property {string} slug
 * @property {string} title
 * @property {string} goal
 * @property {DecomposedTask[]} tasks
 * @property {DecomposedExitCriterion[]} exitGates
 *
 * @typedef {object} DecomposedPlan
 * @property {string} title
 * @property {string} narrative
 * @property {{id: string, title: string, body: string}[]} principles
 * @property {{term: string, definition: string}[]} glossary
 * @property {string[]} phaseIds
 *
 * @typedef {object} DecomposeResult
 * @property {DecomposedPlan} plan
 * @property {DecomposedInitiative[]} initiatives
 * @property {string[]} warnings
 *
 * @param {string} markdown — full markdown source
 * @param {object} [opts]
 * @param {string} [opts.planSlug] — used to derive initiative slugs; required
 *   for the slug-suggestion path. If omitted, `slug` fields are left empty
 *   and the caller (skill body) must fill them.
 * @returns {DecomposeResult}
 */

import { parse as parseYaml, stringify as yamlStringify } from 'yaml';

const H1_RE = /^#\s+(.+?)\s*$/m;
const H2_RE = /^##\s+(.+?)\s*$/;
const H3_RE = /^###\s+(.+?)\s*$/;
const PHASE_H2_RE = /^(F\d+)\b\s*[-—–]?\s*(.*)$/i;
const TASK_ID_RE = /^((?:T[-.]?\d+(?:\.\d+)?))\s+(.+)$/i;
const FENCED_YAML_RE = /^```(?:yaml|yml)\s*$/i;
const FENCE_CLOSE_RE = /^```\s*$/;
const BULLET_RE = /^\s*[-*]\s+(.+)$/;

// Numbered prefix on headings like `## 2. Princípios invioláveis` or
// `### 2.1 Fonte da verdade`. Stripped before content matching.
const NUMBERED_PREFIX_RE = /^\d+(?:\.\d+)*\.?\s*/;

// Heading marker H3 inside a phase section that signals "the next bullets are
// tasks", not free-form notes. Matches Sub-fases / Sub-phases / Tasks /
// Sub-tasks (PT + EN, with or without hyphen). The marker must be the WHOLE
// H3 title — optionally followed by a parenthesized suffix like `(menu)`.
// Anchoring with `$` prevents `### Task one` or `### Tasks cleanup` from
// being misclassified as a marker (which would then be dropped by Mode 2
// fallback in extractTasks).
const TASK_MARKER_H3_RE = /^(?:sub[-\s]?fases?|sub[-\s]?phases?|tasks?|sub[-\s]?tasks?)(?:\s*\([^)]*\))?\s*$/i;

// Bold-prefix task bullet: `- **<id> — <title>.** body`. The `<id>` may carry
// a phase prefix (`F0.T-001`) which we strip before storing.
const TASK_BULLET_RE = /^\s*[-*]\s*\*\*([^*]+?)\*\*\s*(.*)$/;

// Plain-bullet task fallback: `- T-001 Title` or `- T0.1 Title`.
const TASK_PLAIN_BULLET_RE = /^\s*[-*]\s*(T-?\d+(?:\.\d+)?|\d+\.\d+)\s+(.+)$/i;

/**
 * Lowercase, strip diacritics, strip leading numbered prefix.
 * Used for section-name matching so PT (`Princípios invioláveis`,
 * `Glossário`) and numbered-prefix English (`## 2. Principles`) both detect.
 */
function normalizeHeading(title) {
  return String(title || '')
    .replace(NUMBERED_PREFIX_RE, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Strip markdown bold markers (`**`) for pattern matching without losing
 * other content. Used by extractGoal + extractExitGateProse.
 */
function stripBold(s) {
  return s.replace(/\*\*/g, '');
}

function slugify(str, max = 60) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
}

const SLUG_MAX = 63;

function deriveInitiativeSlug(planSlug, phaseId, title) {
  // Reserve budget so the phase suffix never gets sliced off when the planSlug
  // is long. Layout: `<planTrimmed>-<phasePart>(-<titleTrimmed>)`
  const phasePart = String(phaseId || '').toLowerCase();
  if (!phasePart) {
    // No phase id — fall back to the legacy join (caller decides what to do
    // with the result; this branch is not exercised by decomposePlan).
    return slugify([planSlug, slugify(title, 40)].filter(Boolean).join('-'), SLUG_MAX);
  }
  const phaseChunk = phasePart.length + 1; // `-<phasePart>`
  const planBudget = Math.max(2, SLUG_MAX - phaseChunk);
  const planTrimmed = slugify(planSlug, planBudget);
  const remaining = SLUG_MAX - planTrimmed.length - phaseChunk;
  const titleBudget = remaining > 1 ? Math.min(40, remaining - 1) : 0;
  const titleTrimmed = titleBudget > 0 ? slugify(title, titleBudget) : '';
  const base = [planTrimmed, phasePart, titleTrimmed].filter(Boolean).join('-');
  return slugify(base, SLUG_MAX);
}

// Title/body separators:
//   - Dashes (`-`, em-dash, en-dash) require whitespace on BOTH sides so they
//     don't eat hyphens inside words (e.g. "well-known terms — definition").
//   - Colon allows zero whitespace before but requires whitespace after, so
//     plain `Term: definition` splits as documented in the skill body.
const DASH_SEP_RE = /^(.+?)\s+[-—–]\s+(.+)$/;
const COLON_SEP_RE = /^([^:]+?)\s*:\s+(.+)$/;

function splitOnSeparator(text) {
  const dash = text.match(DASH_SEP_RE);
  if (dash) return { head: dash[1].trim(), tail: dash[2].trim() };
  const colon = text.match(COLON_SEP_RE);
  if (colon) return { head: colon[1].trim(), tail: colon[2].trim() };
  return null;
}

function parsePrincipleBullet(line, autoId) {
  // Accept: `**P1 Title** — body`, `P1 Title — body`, `**Title** — body`,
  //         `Title — body`, `Title: body`, `body` (no separator).
  const raw = line.replace(/\*+/g, '').trim();

  // Try to extract id like `P1` or `P-1` at the start.
  const idMatch = raw.match(/^(P[-]?\d+)\b[\s:.\-—–]+(.*)$/i);
  let id = autoId;
  let rest = raw;
  if (idMatch) {
    id = idMatch[1].toUpperCase().replace('-', '');
    rest = idMatch[2].trim();
  }

  const split = splitOnSeparator(rest);
  if (split) return { id, title: split.head, body: split.tail };
  return { id, title: rest, body: '' };
}

function parseGlossaryBullet(line) {
  const raw = line.replace(/\*+/g, '').trim();
  const split = splitOnSeparator(raw);
  if (split) return { term: split.head, definition: split.tail };
  return { term: raw, definition: '' };
}

function splitH2Sections(lines, startIdx) {
  // From startIdx (after H1), group lines into [{titleLine, bodyLines: []}, ...]
  // each starting at an H2.
  const sections = [];
  let current = null;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (H2_RE.test(line)) {
      if (current) sections.push(current);
      current = { titleLine: line, title: line.match(H2_RE)[1], bodyLines: [] };
    } else if (current) {
      current.bodyLines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function extractFirstYamlBlock(bodyLines, key, warnings, phaseId) {
  // Return parsed YAML object if a fenced ```yaml block exists whose top-level
  // key matches `key`. Otherwise null. Parse failures push a message to
  // `warnings` (if provided) so the caller surfaces them in the preview.
  let inFence = false;
  let buf = [];
  for (const line of bodyLines) {
    if (!inFence && FENCED_YAML_RE.test(line)) {
      inFence = true;
      buf = [];
      continue;
    }
    if (inFence && FENCE_CLOSE_RE.test(line)) {
      inFence = false;
      const text = buf.join('\n');
      // Only consider it if it actually mentions the key at top level.
      if (new RegExp(`^${key}\\s*:`, 'm').test(text)) {
        try {
          const parsed = parseYaml(text);
          if (parsed && typeof parsed === 'object' && parsed[key]) {
            return parsed[key];
          }
        } catch (err) {
          if (Array.isArray(warnings)) {
            const where = phaseId ? ` in phase ${phaseId}` : '';
            warnings.push(
              `Malformed \`${key}:\` YAML block${where} — dropped from decompose. ` +
              `Parser said: ${String(err && err.message || err).split('\n')[0]}`
            );
          }
        }
      }
      buf = [];
      continue;
    }
    if (inFence) buf.push(line);
  }
  return null;
}

function extractGoal(bodyLines) {
  // Accepts `Goal: ...`, `**Goal:** ...`, `**Goal**: ...`, `**Objetivo:** ...`,
  // and bolded value (`**Goal:** **prose**`).
  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (H3_RE.test(trimmed)) break; // tasks start
    const stripped = stripBold(trimmed);
    const m = stripped.match(/^(?:goal|objetivo)\s*:\s*(.+)$/i);
    if (m) return m[1].trim();
  }
  return '';
}

function parseTaskBullet(line, autoCounter) {
  // Mode 1: bold-prefix bullet `- **<id> — <title>.** body`
  const bold = line.match(TASK_BULLET_RE);
  if (bold) {
    const boldContent = bold[1].trim();
    const descRaw = bold[2].trim().replace(/^[\s—–-]+/, '');
    const split = splitOnSeparator(boldContent);
    let id;
    let title;
    if (split) {
      id = split.head;
      title = split.tail.replace(/\.$/, '').trim();
    } else {
      id = `T-${String(autoCounter).padStart(3, '0')}`;
      title = boldContent.replace(/\.$/, '').trim();
    }
    // Strip phase prefix like `F0.` from id so the stored id is the
    // intra-initiative id (`T-001`) that matches the initiative task array.
    const idClean = id.replace(/^F\d+[.\-]\s*/i, '').trim();
    return {
      id: idClean || id,
      title: title || `Task ${autoCounter}`,
      ...(descRaw ? { description: descRaw } : {}),
    };
  }
  // Mode 2: plain bullet `- T-001 title — extra`
  const plain = line.match(TASK_PLAIN_BULLET_RE);
  if (plain) {
    const split = splitOnSeparator(plain[2]);
    return {
      id: plain[1].toUpperCase(),
      title: split ? split.head : plain[2].trim(),
      ...(split && split.tail ? { description: split.tail } : {}),
    };
  }
  return null;
}

// Read a `name: value` body field, tolerating a leading list marker and bold
// emphasis (`- Files:` and `- **Files:**` both parse). Mirrors the SPEC gate's
// reader in scripts/lint-source.js so decompose materializes exactly what the
// gate admits.
function fieldValue(line, name) {
  const clean = line.replace(/\*\*/g, '');
  const re = new RegExp(`^\\s*[-*]?\\s*${name}\\s*:\\s*(.*)$`, 'i');
  const m = clean.match(re);
  return m ? m[1].trim() : null;
}

function stripWrappingQuotes(s) {
  const t = String(s || '').trim();
  return /^(['"]).*\1$/.test(t) ? t.slice(1, -1) : t;
}

// Parse a per-task `verifier:` value into the schema verifier object. The
// canonical form is the same inline flow-map the exit_gate block uses
// (`{ kind: shell, command: "…", expectExitCode: 0 }`); a bare `kind: shell,
// command: …` is wrapped and parsed the same way. A loose `kind shell <cmd>`
// is the shell-only fallback. Returns null when no deterministic kind is found.
function parseTaskVerifier(value) {
  if (!value) return null;
  const v = String(value).trim();
  const candidate = v.startsWith('{') ? v : `{ ${v} }`;
  try {
    const parsed = parseYaml(candidate);
    if (parsed && typeof parsed === 'object' && parsed.kind) return parsed;
  } catch { /* fall through to the loose shell parse */ }
  const km = v.match(/\bkind[\s:]+(shell|test|query|manual)\b/i);
  if (!km) return null;
  const kind = km[1].toLowerCase();
  const rest = v.slice(km.index + km[0].length).replace(/^[\s,;:]+/, '').trim();
  if (kind === 'shell') {
    const cmd = stripWrappingQuotes(rest.replace(/^command\s*[:=]?\s*/i, ''));
    return cmd ? { kind, command: cmd } : { kind };
  }
  if (kind === 'query') {
    const sql = stripWrappingQuotes(rest.replace(/^sql\s*[:=]?\s*/i, ''));
    return sql ? { kind, sql } : { kind };
  }
  if (kind === 'manual') return rest ? { kind, description: stripWrappingQuotes(rest) } : { kind };
  // test: a runner+pattern needs the flow-map form; the loose form is ambiguous.
  return { kind };
}

// Parse a `### Tn` task section body into the per-task SPEC interior so the
// materialized task carries a completion signal (T1.5). Lead prose before the
// first field bullet becomes `description`; `- Files:` becomes `outputs[]`;
// scopeBoundary / acceptance become single-element arrays; `- verifier:` is
// structured via parseTaskVerifier. A body with none of these yields {} so an
// interior-less task stays id+title only (backward compatible).
function parseTaskInterior(bodyLines) {
  const interior = {};
  const descLines = [];
  let sawField = false;
  let files = null;
  let scope = null;
  let acceptance = null;
  let verifierRaw = null;
  for (const line of bodyLines) {
    const trimmed = line.trim();
    const f = fieldValue(line, 'files');
    if (f != null) { files = f; sawField = true; continue; }
    const s = fieldValue(line, 'scope[\\s_-]?boundary');
    if (s != null) { scope = s; sawField = true; continue; }
    const a = fieldValue(line, 'acceptance');
    if (a != null) { acceptance = a; sawField = true; continue; }
    const ver = fieldValue(line, 'verifier');
    if (ver != null) { verifierRaw = ver; sawField = true; continue; }
    // Lead prose (a non-bullet line before any field) → description. Other
    // bullets (e.g. `- RED→GREEN:`) are ignored.
    if (!sawField && trimmed && !/^[-*]\s/.test(trimmed)) descLines.push(trimmed);
  }
  const description = descLines.join(' ').trim();
  if (description) interior.description = description;
  if (scope) interior.scopeBoundary = [scope];
  if (acceptance) interior.acceptance = [acceptance];
  const verifier = parseTaskVerifier(verifierRaw);
  if (verifier) interior.verifier = verifier;
  if (files) {
    const paths = files.split(',').map((p) => p.trim()).filter(Boolean);
    if (paths.length > 0) interior.outputs = paths.map((p) => ({ kind: 'file', path: p }));
  }
  return interior;
}

function extractTasks(bodyLines) {
  // Mode 1: bullets under a marker H3 (`### Sub-fases`, `### Tasks`, …).
  // The bullets must start with `- **<id> — <title>.**` to qualify.
  let markerIdx = -1;
  for (let i = 0; i < bodyLines.length; i++) {
    const m = bodyLines[i].match(H3_RE);
    if (!m) continue;
    const h3Title = normalizeHeading(m[1]);
    if (TASK_MARKER_H3_RE.test(h3Title)) {
      markerIdx = i;
      break;
    }
  }
  if (markerIdx >= 0) {
    const tasks = [];
    let counter = 0;
    for (let i = markerIdx + 1; i < bodyLines.length; i++) {
      if (H3_RE.test(bodyLines[i])) break;
      const t = parseTaskBullet(bodyLines[i], counter + 1);
      if (!t) continue;
      counter += 1;
      tasks.push(t);
    }
    if (tasks.length > 0) return tasks;
  }
  // Mode 2: H3 = task (fallback). Skips marker H3s. Each task section's body
  // (the lines until the next H3) is parsed for the per-task SPEC interior
  // (description + Files + scopeBoundary + acceptance + verifier) so the
  // materialized task carries a completion signal (T1.5). An interior-less
  // section stays id+title only — backward compatible.
  const tasks = [];
  let counter = 0;
  for (let i = 0; i < bodyLines.length; i++) {
    const m = bodyLines[i].match(H3_RE);
    if (!m) continue;
    if (TASK_MARKER_H3_RE.test(normalizeHeading(m[1]))) continue;
    counter += 1;
    const raw = m[1];
    const idMatch = raw.match(TASK_ID_RE);
    const id = idMatch ? idMatch[1].toUpperCase() : `T-${String(counter).padStart(3, '0')}`;
    const title = idMatch ? idMatch[2].trim() : raw.trim();
    let end = bodyLines.length;
    for (let k = i + 1; k < bodyLines.length; k++) {
      if (H3_RE.test(bodyLines[k])) { end = k; break; }
    }
    const interior = parseTaskInterior(bodyLines.slice(i + 1, end));
    tasks.push({ id, title, ...interior });
  }
  return tasks;
}

function extractPrinciples(bodyLines) {
  // Mode 1: H3 children (each H3 = one principle; body = paragraphs until
  // the next H3). Triggered when the section has ≥ 2 H3s.
  const h3Hits = [];
  for (let i = 0; i < bodyLines.length; i++) {
    const m = bodyLines[i].match(H3_RE);
    if (m) h3Hits.push({ idx: i, title: m[1] });
  }
  if (h3Hits.length >= 2) {
    const principles = [];
    for (let i = 0; i < h3Hits.length; i++) {
      const h3 = h3Hits[i];
      const start = h3.idx + 1;
      const end = i + 1 < h3Hits.length ? h3Hits[i + 1].idx : bodyLines.length;
      const bodyText = bodyLines.slice(start, end).join('\n').trim();
      let id = `P${i + 1}`;
      let titleText = h3.title;
      const numMatch = titleText.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
      if (numMatch) {
        const lastSeg = numMatch[1].split('.').pop();
        id = `P${lastSeg}`;
        titleText = numMatch[2].trim();
      } else {
        const pMatch = titleText.match(/^(P-?\d+)\b[\s:.\-—–]+(.*)$/i);
        if (pMatch) {
          id = pMatch[1].toUpperCase().replace('-', '');
          titleText = pMatch[2].trim();
        }
      }
      principles.push({ id, title: titleText, body: bodyText });
    }
    return principles;
  }
  // Mode 2: bullets (fallback)
  const bulletPrinciples = [];
  let autoCounter = 0;
  for (const line of bodyLines) {
    const m = line.match(BULLET_RE);
    if (!m) continue;
    autoCounter += 1;
    bulletPrinciples.push(parsePrincipleBullet(m[1], `P${autoCounter}`));
  }
  return bulletPrinciples;
}

function extractGlossary(bodyLines) {
  // Mode 1: markdown table `| Termo | Significado |`. Detected by ≥ 1 pipe-
  // delimited row plus a separator row of dashes.
  const tableRows = [];
  let sawSeparator = false;
  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!/^\|.*\|$/.test(trimmed)) continue;
    // Separator row: cells contain only dashes/colons/spaces
    const inner = trimmed.slice(1, -1);
    if (/^[\s\-:|]+$/.test(inner)) {
      sawSeparator = true;
      continue;
    }
    const cells = inner.split('|').map((c) => c.trim());
    if (cells.length < 2) continue;
    tableRows.push(cells);
  }
  if (sawSeparator && tableRows.length > 0) {
    let dataRows = tableRows;
    const headerKw = /^(termo|term|word|definicao|definition|significado|meaning)$/i;
    const firstStripped = tableRows[0].map((c) => normalizeHeading(c.replace(/\*+/g, '')));
    if (firstStripped.every((c) => headerKw.test(c))) {
      dataRows = tableRows.slice(1);
    }
    const entries = [];
    for (const row of dataRows) {
      const term = (row[0] || '').replace(/\*+/g, '').trim();
      const definition = (row[1] || '').replace(/\*+/g, '').trim();
      if (term && definition) entries.push({ term, definition });
    }
    if (entries.length > 0) return entries;
  }
  // Mode 2: bullets (fallback)
  const bulletEntries = [];
  for (const line of bodyLines) {
    const m = line.match(BULLET_RE);
    if (!m) continue;
    const entry = parseGlossaryBullet(m[1]);
    if (entry.term && entry.definition) bulletEntries.push(entry);
  }
  return bulletEntries;
}

function extractExitGateProse(bodyLines) {
  // Looks for a line like `**Exit gate da fase:** prose` (PT/EN bold-prefix
  // variants). Returns a single manual-verifier criterion when found.
  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const stripped = stripBold(trimmed);
    const m = stripped.match(/^(?:exit\s+gate(?:\s+da\s+fase)?|gate\s+de\s+saida(?:\s+da\s+fase)?)\s*:\s*(.+)$/i);
    if (m) {
      const description = m[1].trim();
      if (description) {
        return [{
          id: 'G-1',
          description,
          status: 'pending',
          verifier: { kind: 'manual', description: 'Verify exit-gate prose with the user during phase-done.' },
        }];
      }
    }
  }
  return null;
}

function normalizeExitGateCriteria(raw) {
  // The fenced block looked like:
  //   exit_gate:
  //     - id: ...
  //       description: ...
  //       verifier: { ... }
  // OR:
  //   exit_gate:
  //     criteria:
  //       - id: ...
  // Accept both shapes.
  if (Array.isArray(raw)) {
    return raw.map((c, i) => ({
      id: c.id || `G-${i + 1}`,
      description: c.description || '',
      verifier: c.verifier,
      status: 'pending',
    })).filter((c) => c.description);
  }
  if (raw && Array.isArray(raw.criteria)) {
    return normalizeExitGateCriteria(raw.criteria);
  }
  return [];
}

/**
 * Decompose ONE phase section into its initiative object. Extracted from
 * decomposePlan's per-phase loop as a strictly mechanical refactor (R-ORCH-10):
 * the heuristics, field order, and emitted object shape are byte-identical to
 * the previous inline logic. Exposed so the F3 `materialize` verb can decompose
 * a single phase in isolation — given its phaseId + title + bodyLines, plus the
 * shared plan slug (for slug derivation) and warnings sink.
 *
 * The cross-phase invariants (duplicate-phaseId rejection, phaseIds bookkeeping)
 * are NOT part of one-phase decomposition; decomposePlan keeps those in its loop.
 *
 * @param {object} phaseSource — the phase section to decompose
 * @param {string} phaseSource.phaseId — uppercased phase id (e.g. `F0`)
 * @param {string} phaseSource.title — phase title (H2 remainder after the id);
 *   falls back to phaseId when empty/whitespace
 * @param {string[]} phaseSource.bodyLines — the section body lines
 * @param {object} [ctx] — shared decompose context
 * @param {string} [ctx.planSlug] — plan slug (for slug derivation; falsy ⇒ slug `''`)
 * @param {string[]} [ctx.warnings] — sink for parse warnings (malformed YAML, …)
 * @returns {DecomposedInitiative}
 */
export function decomposeOnePhase(phaseSource, ctx = {}) {
  const { phaseId, title: titleRaw, bodyLines } = phaseSource;
  const { planSlug = '', warnings = [] } = ctx;
  const phaseTitle = (titleRaw || '').trim() || phaseId;
  const goal = extractGoal(bodyLines);
  const tasks = extractTasks(bodyLines);
  const exitGateRaw = extractFirstYamlBlock(bodyLines, 'exit_gate', warnings, phaseId)
    ?? extractFirstYamlBlock(bodyLines, 'exitGate', warnings, phaseId);
  const exitGatesFromYaml = normalizeExitGateCriteria(exitGateRaw);
  const exitGates = exitGatesFromYaml.length > 0
    ? exitGatesFromYaml
    : (extractExitGateProse(bodyLines) || []);
  return {
    phaseId,
    slug: planSlug ? deriveInitiativeSlug(planSlug, phaseId, phaseTitle) : '',
    title: phaseTitle,
    goal,
    tasks,
    exitGates,
  };
}

/**
 * Main entry — decompose a markdown plan into structured proposal.
 */
export function decomposePlan(markdown, opts = {}) {
  if (typeof markdown !== 'string') {
    throw new TypeError('decomposePlan: markdown must be a string');
  }

  const planSlug = opts.planSlug || '';
  const warnings = [];
  const lines = markdown.split(/\r?\n/);

  // --- Plan title + narrative ---
  let h1Idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#\s+/.test(lines[i])) {
      h1Idx = i;
      break;
    }
  }
  if (h1Idx < 0) {
    warnings.push('No H1 heading found; plan.title is empty (user must fill before Stage 6).');
  }
  const planTitle = h1Idx >= 0 ? lines[h1Idx].match(H1_RE)[1] : '';

  // Narrative: lines after H1, before first H2.
  let narrativeStart = h1Idx >= 0 ? h1Idx + 1 : 0;
  let narrativeEnd = lines.length;
  for (let i = narrativeStart; i < lines.length; i++) {
    if (H2_RE.test(lines[i])) {
      narrativeEnd = i;
      break;
    }
  }
  const narrative = lines.slice(narrativeStart, narrativeEnd).join('\n').trim();

  // --- Sections ---
  const sections = splitH2Sections(lines, narrativeEnd);

  const principles = [];
  const glossary = [];
  const initiatives = [];
  const phaseIds = [];

  for (const section of sections) {
    const normalized = normalizeHeading(section.title);

    // Principles section (EN `principles` / PT `princípios`; numbered prefix
    // like `## 2. ...` is stripped by normalizeHeading).
    if (/^(inviolable\s+)?princip/.test(normalized)) {
      for (const p of extractPrinciples(section.bodyLines)) principles.push(p);
      continue;
    }

    // Glossary section (EN `glossary` / PT `glossário`).
    if (/^glossar/.test(normalized)) {
      for (const g of extractGlossary(section.bodyLines)) glossary.push(g);
      continue;
    }

    // Phase section — phase H2s are NOT stripped of numbered prefix (the
    // `F<N>` token is the phase id and must remain at the start of the title).
    const phaseMatch = section.title.match(PHASE_H2_RE);
    if (phaseMatch) {
      const phaseId = phaseMatch[1].toUpperCase();
      if (phaseIds.includes(phaseId)) {
        throw new Error(
          `decomposePlan: duplicate phase id "${phaseId}" (H2 "${section.title}"). ` +
          `Each phase H2 must declare a unique id like F0, F1, F2, …`
        );
      }
      // Per-phase extraction lives in decomposeOnePhase (F1/T-004); the loop
      // only owns the cross-phase invariants (duplicate id + phaseIds order).
      initiatives.push(
        decomposeOnePhase(
          { phaseId, title: phaseMatch[2] || '', bodyLines: section.bodyLines },
          { planSlug, warnings },
        ),
      );
      phaseIds.push(phaseId);
      continue;
    }

    // Unrecognized section
    warnings.push(`Skipped H2 section: "${section.title}" (no matching heuristic).`);
  }

  if (initiatives.length === 0) {
    throw new Error('decomposePlan: source markdown has no phase H2 (matching /^F\\d+/); plan needs at least one phase.');
  }

  return {
    plan: {
      title: planTitle,
      narrative,
      principles,
      glossary,
      phaseIds,
    },
    initiatives,
    warnings,
  };
}

/**
 * Build ONE initiative file ({kind, slug, relativePath, content}) for a phase.
 * Extracted from materializeDecomposition's per-phase loop as a strictly
 * mechanical refactor (R-ORCH-10): the frontmatter shape, body, path layout,
 * and collision guard are byte-identical to the previous inline logic. Exposed
 * so F2 (materialize F0 only) and F3 (the `materialize` verb) can write a single
 * initiative without re-running the whole-plan materialization.
 *
 * @param {DecomposedInitiative} initiative — the phase's decomposed initiative
 * @param {string} planSlug — the plan slug (parentPlan + slug-derivation basis)
 * @param {object} ctx — shared materialize context
 * @param {string} ctx.iso — ISO timestamp for started/lastUpdated/openedAt
 * @param {string|null} [ctx.branch] — branch (null ⇒ emitted as `null`)
 * @param {boolean} [ctx.active] — true ⇒ status 'active' (first phase, or a
 *   phase activating via the F3 `materialize` verb); false ⇒ 'pending'
 * @param {string} ctx.stateRoot — state-dir prefix for the flat layout
 * @param {string|null} ctx.planDir — nested plan dir (null ⇒ flat layout)
 * @param {string|null} ctx.projectId — set ⇒ nested layout; null ⇒ flat
 * @param {object|null} [ctx.businessIntent] — ratified businessIntent spine
 *   for active phase materialization
 * @param {Set<string>} ctx.seenSlugs — collision-guard slug set (mutated in place)
 * @param {Set<string>} ctx.seenPaths — collision-guard path set (mutated in place)
 * @returns {MaterializedFile} the {kind:'initiative', slug, relativePath, content}
 */
export function writeInitiativeFile(initiative, planSlug, ctx) {
  const init = initiative;
  const {
    iso, branch = null, active = false,
    stateRoot, planDir, projectId, businessIntent = null, seenSlugs, seenPaths,
  } = ctx;
  const initSlug = init.slug || `${planSlug}-${init.phaseId.toLowerCase()}`;
  for (const t of init.tasks) {
    if (Number.isFinite(t.weight) && t.weight < 0) {
      throw new RangeError(
        `writeInitiativeFile: task ${t.id} weight must be >= 0 (got ${JSON.stringify(t.weight)})`,
      );
    }
  }
  const tasks = init.tasks.map((t) => ({
    id: t.id,
    title: t.title || `Task ${t.id}`,
    ...(typeof t.summary === 'string' && t.summary.trim() !== '' ? { summary: t.summary } : {}),
    ...(Number.isFinite(t.weight) ? { weight: t.weight } : {}),
    ...(t.description ? { description: t.description } : {}),
    status: 'pending',
    lastUpdated: iso,
    ...(t.scopeBoundary ? { scopeBoundary: t.scopeBoundary } : {}),
    ...(t.acceptance ? { acceptance: t.acceptance } : {}),
    ...(t.verifier ? { verifier: t.verifier } : {}),
    ...(t.outputs ? { outputs: t.outputs } : {}),
  }));
  const exitGates = init.exitGates.map((g, gIdx) => {
    const c = {
      id: g.id || `${init.phaseId}-G${gIdx + 1}`,
      description: g.description || `TODO: fill criterion description for ${init.phaseId}`,
      status: 'pending',
    };
    if (g.verifier) c.verifier = g.verifier;
    return c;
  });
  const title = init.title || init.phaseId;
  const initFm = {
    schemaVersion: '0.1',
    slug: initSlug,
    title,
    goal: init.goal || `TODO: fill goal for ${init.phaseId}`,
    status: active ? 'active' : 'pending',
    branch: branch || null,
    started: iso,
    lastUpdated: iso,
    nextAction: typeof init.nextAction === 'string' && init.nextAction.trim() !== ''
      ? init.nextAction
      : (tasks[0] ? `Start ${tasks[0].id}: ${tasks[0].title}` : null),
    parentPlan: planSlug,
    phaseId: init.phaseId,
    ...(businessIntent ? { businessIntent } : {}),
    // Rollups precomputed for the dashboard (aiDeck stays read-in-place). At
    // materialization every task/gate is pending, so done/met start at 0;
    // the project-status skill recomputes these on every task/gate mutation.
    tasksDone: tasks.filter((t) => t.status === 'done').length,
    tasksTotal: tasks.length,
    gatesMet: exitGates.filter((g) => g.status === 'met').length,
    gatesTotal: exitGates.length,
    exitGates,
    stack: [{
      id: 1,
      title,
      type: 'task',
      openedAt: iso,
    }],
    tasks,
    parked: [],
    emerged: [],
  };
  const initBody = renderInitiativeBody(init);
  const initContent = `---\n${yamlStringify(initFm)}---\n\n${initBody}\n`;
  // Nested filename drops the redundant `<planSlug>-` prefix (the phases/ dir
  // already encodes the plan) → `f0-<title>.md`; flat keeps the full slug.
  const phaseFileName = initSlug.startsWith(`${planSlug}-`) ? initSlug.slice(planSlug.length + 1) : initSlug;
  const relativePath = projectId
    ? `${planDir}/phases/${phaseFileName}.md`
    : `${stateRoot}/initiatives/${initSlug}.md`;
  // Collision guard — per-call (per-plan), so the same slug in TWO different
  // plans never collides (separate calls, separate sets); two phases in ONE
  // plan that produce the same identity slug OR the same emitted path throw.
  if (seenSlugs.has(initSlug) || seenPaths.has(relativePath)) {
    throw new Error(
      `materializeDecomposition: slug collision for phase ${init.phaseId} ` +
      `(slug "${initSlug}"). Two phases produced the same initiative path; ` +
      `shorten the plan slug or rename the conflicting phase title.`
    );
  }
  seenSlugs.add(initSlug);
  seenPaths.add(relativePath);
  return {
    kind: 'initiative',
    slug: initSlug,
    relativePath,
    content: initContent,
  };
}

/**
 * Build ONE per-phase source sidecar ({kind:'source', slug, relativePath,
 * content}) for a descriptor-only phase (F1..N) that `new plan` did NOT
 * materialize into an initiative. The sidecar is a CAPTURE artifact (F-002),
 * not validated state: validate-state.js and the find-*.js detectors iterate
 * phases/ filtering *.md (endsWith('.md')), so the .json is skipped. It holds
 * the phase's parsed initiative (goal + raw tasks + exitGates) so the F3
 * `materialize` verb can re-materialize it via writeInitiativeFile WITHOUT
 * re-running decomposePlan on the whole plan — the laziness hinge (D1/D2).
 *
 * @param {DecomposedInitiative} initiative — the phase's decomposed initiative
 * @param {string} planSlug — plan slug (slug-derivation basis)
 * @param {object} ctx — shared materialize context
 * @param {string} ctx.stateRoot — state-dir prefix for the flat layout
 * @param {string|null} ctx.planDir — nested plan dir (null ⇒ flat layout)
 * @param {string|null} ctx.projectId — set ⇒ nested layout; null ⇒ flat
 * @param {Set<string>} ctx.seenSlugs — collision-guard slug set (mutated in place)
 * @param {Set<string>} ctx.seenPaths — collision-guard path set (mutated in place)
 * @returns {MaterializedFile} the {kind:'source', slug, relativePath, content}
 */
export function writePhaseSourceSidecar(initiative, planSlug, ctx) {
  const init = initiative;
  const { stateRoot, planDir, projectId, seenSlugs, seenPaths } = ctx;
  const initSlug = init.slug || `${planSlug}-${init.phaseId.toLowerCase()}`;
  // Same filename convention as writeInitiativeFile: nested drops the redundant
  // <planSlug>- prefix (the phases/ dir already encodes the plan).
  const phaseFileName = initSlug.startsWith(`${planSlug}-`) ? initSlug.slice(planSlug.length + 1) : initSlug;
  const relativePath = projectId
    ? `${planDir}/phases/${phaseFileName}.source.json`
    : `${stateRoot}/initiatives/${initSlug}.source.json`;
  // A descriptor-only phase shares the initiative slug namespace: if two phases
  // derive the same slug, the F3 `materialize` verb would later overwrite one
  // initiative file with the other. Guard the slug up-front — the same guarantee
  // writeInitiativeFile gives F0 — so the collision surfaces at `new plan` time,
  // not silently deferred to materialization.
  if (seenSlugs.has(initSlug) || seenPaths.has(relativePath)) {
    throw new Error(
      `materializeDecomposition: slug collision for phase ${init.phaseId} ` +
      `(slug "${initSlug}"). Two phases produced the same source path; ` +
      `shorten the plan slug or rename the conflicting phase title.`,
    );
  }
  seenSlugs.add(initSlug);
  seenPaths.add(relativePath);
  const capture = {
    captureVersion: '0.1',
    phaseId: init.phaseId,
    slug: initSlug,
    title: init.title || init.phaseId,
    goal: init.goal,
    tasks: init.tasks,
    exitGates: init.exitGates,
  };
  return {
    kind: 'source',
    slug: initSlug,
    relativePath,
    content: `${JSON.stringify(capture, null, 2)}\n`,
  };
}

/**
 * Materialize a decompose result into Plan + Initiative file contents that
 * Stage 6 (and `adopt`) write to disk. Pure function: returns a list of
 * `{kind, slug, relativePath, content}` items; the skill body owns the actual
 * fs writes and the post-write `npm run validate-state` invocation.
 *
 * Materialization rules:
 *
 *   - Plan frontmatter: schemaVersion '0.1', slug = opts.planSlug, status
 *     'active', started/lastUpdated = opts.now ISO timestamp, parallelismAllowed
 *     false (user can flip later), currentPhase = first phase id.
 *
 *   - Phase descriptors: built from decompose.initiatives in order. Each
 *     phase's dependsOn is set to [prevPhaseId] so the default decompose
 *     produces a strictly sequential plan (the user can edit later). The
 *     first phase is `status: active`; the rest are `pending`. subPhaseCount
 *     is the number of H3-derived tasks for F0; for F1..N it is 0 (D1 lazy:
 *     descriptor-only, pending materialization — an honest "unknown" that is
 *     distinct from a materialized-empty phase). exitGate.criteria are
 *     retained up-front for every phase from the source.
 *
 *   - Initiative file: ONLY F0 (the active phase) is materialized up-front
 *     (D1 lazy FORTE). F1..N stay descriptor-only — instead of an initiative
 *     file, a per-phase source sidecar `phases/<slug>.source.json` (kind
 *     'source') captures the parsed initiative for the F3 `materialize` verb.
 *
 *   - Exit-gate summary: when criteria exist, "N criterion(a) to meet";
 *     when empty, "TODO: define exit gate" (schema requires minLength 1).
 *
 *   - Initiative frontmatter: parentPlan + phaseId always set (this skill
 *     only materializes in-plan initiatives — standalone is project-status'
 *     job). exitGates is the phase's criteria array (same shape). stack
 *     seeds a single frame opened at `started`. tasks all start `pending`.
 *     parked + emerged are empty arrays.
 *
 *   - Required-but-empty fallbacks: when decompose left a required string
 *     empty (e.g., goal, principle body, glossary definition), a `TODO: ...`
 *     sentinel is written so the output validates against the schema. The
 *     user is expected to fix these — every sentinel is visible.
 *
 * @typedef {object} MaterializedFile
 * @property {'plan'|'initiative'|'source'} kind
 * @property {string} slug
 * @property {string} relativePath — relative to repo root
 * @property {string} content — full file content (frontmatter + body)
 *
 * @param {DecomposeResult} decompose
 * @param {object} opts
 * @param {string} opts.planSlug — required
 * @param {string} [opts.branch] — optional branch name
 * @param {string} [opts.version] — Plan `version` field (default '1.0')
 * @param {Date} [opts.now] — defaults to new Date()
 * @param {string} [opts.projectId] — when set, emit the NESTED layout
 *   `<stateRoot>/projects/<projectId>/<planSlug>/{plan.md,phases/f<N>-*.md}`
 *   (R-MIG-04/05, R-ORCH-25). When omitted, emit the legacy FLAT layout
 *   (`<stateRoot>/plans/<slug>.md` + `initiatives/<slug>.md`) for backward
 *   compatibility during the migration coexistence window.
 * @param {string} [opts.stateRoot] — state-dir prefix (default '.atomic-skills').
 *   The F-D1 redirectable root: a dogfood copy can be targeted without touching
 *   the live (gitignored, non-git-restorable) tree. Applies to BOTH layouts.
 * @param {object} [opts.businessIntent] — optional ratified spine for the
 *   initially active F0; legacy callers may omit it. When PRESENT it must be
 *   COMPLETE (see assertCompleteBusinessIntent) — an incomplete spine fails
 *   closed here rather than writing schema-invalid state (C-2 / audit C1#1).
 * @returns {MaterializedFile[]}
 */

/** The schema-required businessIntent spine fields (mirrors initiative/plan schema). */
const BUSINESS_INTENT_REQUIRED = Object.freeze(['value', 'workflow', 'rules', 'outOfScope', 'doneWhen']);

/**
 * Fail-closed guard (C-2 / audit C1#1): a businessIntent passed to materialize is
 * written verbatim onto BOTH the plan phase descriptor and the F0 initiative, so a
 * partial/blank spine would produce state that only a downstream validate step
 * rejects. Reject it at the write boundary instead. Returns the object unchanged
 * when every required field is a non-empty string; throws otherwise.
 */
export function assertCompleteBusinessIntent(bi) {
  const missing = BUSINESS_INTENT_REQUIRED.filter(
    (k) => typeof bi[k] !== 'string' || bi[k].trim().length === 0,
  );
  if (missing.length > 0) {
    throw new Error(
      `materializeDecomposition: businessIntent is incomplete — missing/blank required field(s): ${missing.join(', ')} (all of ${BUSINESS_INTENT_REQUIRED.join(', ')} must be non-empty strings)`,
    );
  }
  return bi;
}

export function materializeDecomposition(decompose, opts = {}) {
  if (!decompose || typeof decompose !== 'object' || !decompose.plan) {
    throw new TypeError('materializeDecomposition: decompose result must be the object returned by decomposePlan()');
  }
  if (!opts.planSlug || typeof opts.planSlug !== 'string') {
    throw new Error('materializeDecomposition: opts.planSlug is required');
  }
  const planSlug = opts.planSlug;
  const branch = opts.branch || null;
  const version = opts.version || '1.0';
  const now = opts.now instanceof Date ? opts.now : new Date();
  const iso = now.toISOString();
  const stateRoot = (opts.stateRoot && typeof opts.stateRoot === 'string') ? opts.stateRoot : '.atomic-skills';
  const projectId = (opts.projectId && typeof opts.projectId === 'string') ? opts.projectId : null;
  const businessIntent = (opts.businessIntent && typeof opts.businessIntent === 'object' && !Array.isArray(opts.businessIntent))
    ? assertCompleteBusinessIntent(opts.businessIntent)
    : null;
  // Nested-layout plan directory (null in flat mode).
  const planDir = projectId ? `${stateRoot}/projects/${projectId}/${planSlug}` : null;

  const plan = decompose.plan;
  const initiatives = decompose.initiatives;

  if (initiatives.length === 0) {
    throw new Error('materializeDecomposition: decompose has no initiatives — cannot materialize an empty plan');
  }

  // Phase descriptors (built from initiatives, sequential by default)
  const phases = initiatives.map((init, idx) => {
    const prevId = idx > 0 ? initiatives[idx - 1].phaseId : null;
    const criteria = init.exitGates.map((g, gIdx) => {
      const c = {
        id: g.id || `${init.phaseId}-G${gIdx + 1}`,
        description: g.description || `TODO: fill criterion description for ${init.phaseId}`,
        status: 'pending',
      };
      if (g.verifier) c.verifier = g.verifier;
      return c;
    });
    const descriptor = {
      id: init.phaseId,
      slug: init.slug || `${planSlug}-${init.phaseId.toLowerCase()}`,
      title: init.title || init.phaseId,
      goal: init.goal || `TODO: fill goal for ${init.phaseId}`,
      dependsOn: prevId ? [prevId] : [],
      // D1 lazy: F0 reports its real task count; F1..N stay descriptor-only
      // (subPhaseCount:0 is an honest "unknown until materialized" placeholder,
      // distinct from a materialized-empty phase).
      subPhaseCount: idx === 0 ? init.tasks.length : 0,
      exitGate: {
        summary: criteria.length > 0
          ? `${criteria.length} ${criteria.length === 1 ? 'criterion' : 'criteria'} to meet`
          : 'TODO: define exit gate',
        criteria,
      },
      status: idx === 0 ? 'active' : 'pending',
    };
    if (idx === 0 && businessIntent) descriptor.businessIntent = businessIntent;
    return descriptor;
  });

  // Principles + glossary: fill empty fields with sentinels so schema passes
  const principles = plan.principles.map((p, idx) => ({
    id: p.id || `P${idx + 1}`,
    title: p.title || `Principle ${idx + 1}`,
    body: p.body || p.title || `TODO: fill principle ${p.id || idx + 1} body`,
  }));
  const glossary = plan.glossary.map((g) => ({
    term: g.term,
    definition: g.definition || `TODO: fill definition for "${g.term}"`,
  }));

  // Plan frontmatter
  const planFm = {
    schemaVersion: '0.1',
    slug: planSlug,
    title: plan.title || `TODO: fill plan title (${planSlug})`,
    version,
    status: 'active',
    started: iso,
    lastUpdated: iso,
    ...(branch ? { branch } : {}),
    currentPhase: phases[0].id,
    parallelismAllowed: false,
    principles,
    glossary,
    phases,
    references: [],
  };

  const planBody = renderPlanBody(plan, decompose.warnings);
  const planContent = `---\n${yamlStringify(planFm)}---\n\n${planBody}\n`;
  const files = [{
    kind: 'plan',
    slug: planSlug,
    relativePath: projectId ? `${planDir}/plan.md` : `${stateRoot}/plans/${planSlug}.md`,
    content: planContent,
  }];

  const seenPaths = new Set([files[0].relativePath]);
  const seenSlugs = new Set();

  // D1 lazy FORTE: only F0 (the active phase) is materialized into an
  // initiative file up-front. F1..N stay descriptor-only — no initiative file,
  // just a per-phase source sidecar (F-002 capture) that the F3 `materialize`
  // verb consumes later. writeInitiativeFile owns F0's file (F1/T-005);
  // writePhaseSourceSidecar owns the descriptor-only captures.
  files.push(
    writeInitiativeFile(initiatives[0], planSlug, {
      iso,
      branch,
      active: true,
      stateRoot,
      planDir,
      projectId,
      businessIntent,
      seenSlugs,
      seenPaths,
    }),
  );
  for (let idx = 1; idx < initiatives.length; idx++) {
    files.push(
      writePhaseSourceSidecar(initiatives[idx], planSlug, {
        stateRoot,
        planDir,
        projectId,
        seenSlugs,
        seenPaths,
      }),
    );
  }

  return files;
}

function renderPlanBody(plan, warnings) {
  const lines = [];
  lines.push(`# ${plan.title || 'TODO: fill plan title'}`);
  lines.push('');
  lines.push('## 1. Context');
  lines.push('');
  lines.push(plan.narrative || '_(narrative — fill or paste here)_');
  lines.push('');
  lines.push('## 2. Inviolable principles');
  lines.push('');
  if (plan.principles.length > 0) {
    for (const p of plan.principles) {
      const body = p.body || p.title || '(no body)';
      lines.push(`- **${p.id} ${p.title}** — ${body}`);
    }
  } else {
    lines.push('_(no principles captured by decompose; fill in.)_');
  }
  lines.push('');
  lines.push('## 3. Phase tree');
  lines.push('');
  lines.push('_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_');
  if (Array.isArray(warnings) && warnings.length > 0) {
    lines.push('');
    lines.push('## Decompose warnings');
    lines.push('');
    for (const w of warnings) lines.push(`- ${w}`);
  }
  return lines.join('\n');
}

function renderInitiativeBody(init) {
  return [
    '# Narrative / notes',
    '',
    `Initiative for phase **${init.phaseId} — ${init.title || init.phaseId}**.`,
    '',
    '## Decisions',
    '',
    '_(record decisions here as they are made)_',
    '',
    '## Links',
    '',
    '_(plan doc, external refs)_',
  ].join('\n');
}

/**
 * Render a one-screen preview of the decompose result for user confirmation
 * (Stage 5). Pure function; the skill body decides how to display it.
 *
 * @param {DecomposeResult} result
 * @returns {string}
 */
export function previewDecomposition(result) {
  const lines = [];
  lines.push(`Plan title: ${result.plan.title || '(none — must fill)'}`);
  lines.push(`Principles: ${result.plan.principles.length}`);
  lines.push(`Glossary:   ${result.plan.glossary.length}`);
  lines.push(`Phases:     ${result.initiatives.length}`);
  const totalTasks = result.initiatives.reduce((n, i) => n + i.tasks.length, 0);
  const totalGates = result.initiatives.reduce((n, i) => n + i.exitGates.length, 0);
  lines.push(`Tasks:      ${totalTasks}`);
  lines.push(`Exit gates: ${totalGates}`);
  lines.push('');
  lines.push('First phases:');
  for (const init of result.initiatives.slice(0, 3)) {
    lines.push(`  - ${init.phaseId} — ${init.title} (${init.tasks.length} tasks, ${init.exitGates.length} gates)`);
  }
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const w of result.warnings) lines.push(`  ! ${w}`);
  }
  return lines.join('\n');
}
