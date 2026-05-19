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

import { parse as parseYaml } from 'yaml';

const H1_RE = /^#\s+(.+?)\s*$/m;
const H2_RE = /^##\s+(.+?)\s*$/;
const H3_RE = /^###\s+(.+?)\s*$/;
const PHASE_H2_RE = /^(F\d+)\b\s*[-—–]?\s*(.*)$/i;
const TASK_ID_RE = /^((?:T[-.]?\d+(?:\.\d+)?))\s+(.+)$/i;
const GOAL_PREFIX_RE = /^(?:goal|objetivo)\s*:\s*(.+)$/i;
const FENCED_YAML_RE = /^```(?:yaml|yml)\s*$/i;
const FENCE_CLOSE_RE = /^```\s*$/;
const BULLET_RE = /^\s*[-*]\s+(.+)$/;

function slugify(str, max = 60) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
}

function deriveInitiativeSlug(planSlug, phaseId, title) {
  const phasePart = String(phaseId || '').toLowerCase();
  const titlePart = slugify(title, 40);
  const base = [planSlug, phasePart, titlePart].filter(Boolean).join('-');
  return slugify(base, 63);
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

  // Try to split title/body on em-dash, en-dash, colon, or hyphen with spaces.
  const splitMatch = rest.match(/^(.+?)\s+[-—–:]\s+(.+)$/);
  if (splitMatch) {
    return { id, title: splitMatch[1].trim(), body: splitMatch[2].trim() };
  }
  return { id, title: rest, body: '' };
}

function parseGlossaryBullet(line) {
  const raw = line.replace(/\*+/g, '').trim();
  const m = raw.match(/^(.+?)\s+[-—–:]\s+(.+)$/);
  if (m) return { term: m[1].trim(), definition: m[2].trim() };
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

function extractFirstYamlBlock(bodyLines, key) {
  // Return parsed YAML object if a fenced ```yaml block exists whose top-level
  // key matches `key`. Otherwise null.
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
        } catch {
          // ignore parse errors — surface as warning at caller level
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
  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (H3_RE.test(trimmed)) break; // tasks start
    const m = trimmed.match(GOAL_PREFIX_RE);
    if (m) return m[1].trim();
    // First non-empty, non-H3 paragraph that isn't a fenced block or bullet
    // is treated as goal candidate ONLY when prefix-matched. Otherwise
    // we leave goal empty and the user fills it.
  }
  return '';
}

function extractTasks(bodyLines) {
  // Each H3 line becomes a task. Lines between H3s are NOT captured as
  // descriptions in v0.1 — keeps the proposal short. The skill body can
  // add a follow-up prompt asking the user to describe each task.
  const tasks = [];
  let counter = 0;
  for (const line of bodyLines) {
    const m = line.match(H3_RE);
    if (!m) continue;
    counter += 1;
    const raw = m[1];
    const idMatch = raw.match(TASK_ID_RE);
    const id = idMatch ? idMatch[1].toUpperCase() : `T-${String(counter).padStart(3, '0')}`;
    const title = idMatch ? idMatch[2].trim() : raw.trim();
    tasks.push({ id, title });
  }
  return tasks;
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
    const titleLower = section.title.toLowerCase().trim();

    // Principles section
    if (/^(inviolable\s+)?principle/.test(titleLower)) {
      let autoCounter = 0;
      for (const line of section.bodyLines) {
        const m = line.match(BULLET_RE);
        if (!m) continue;
        autoCounter += 1;
        principles.push(parsePrincipleBullet(m[1], `P${autoCounter}`));
      }
      continue;
    }

    // Glossary section
    if (/^glossary/.test(titleLower)) {
      for (const line of section.bodyLines) {
        const m = line.match(BULLET_RE);
        if (!m) continue;
        const entry = parseGlossaryBullet(m[1]);
        if (entry.term) glossary.push(entry);
      }
      continue;
    }

    // Phase section
    const phaseMatch = section.title.match(PHASE_H2_RE);
    if (phaseMatch) {
      const phaseId = phaseMatch[1].toUpperCase();
      const phaseTitleRaw = (phaseMatch[2] || '').trim();
      const phaseTitle = phaseTitleRaw || phaseId;
      const goal = extractGoal(section.bodyLines);
      const tasks = extractTasks(section.bodyLines);
      const exitGateRaw = extractFirstYamlBlock(section.bodyLines, 'exit_gate')
        ?? extractFirstYamlBlock(section.bodyLines, 'exitGate');
      const exitGates = normalizeExitGateCriteria(exitGateRaw);

      initiatives.push({
        phaseId,
        slug: planSlug ? deriveInitiativeSlug(planSlug, phaseId, phaseTitle) : '',
        title: phaseTitle,
        goal,
        tasks,
        exitGates,
      });
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
