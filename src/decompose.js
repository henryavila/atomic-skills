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
      if (phaseIds.includes(phaseId)) {
        throw new Error(
          `decomposePlan: duplicate phase id "${phaseId}" (H2 "${section.title}"). ` +
          `Each phase H2 must declare a unique id like F0, F1, F2, …`
        );
      }
      const phaseTitleRaw = (phaseMatch[2] || '').trim();
      const phaseTitle = phaseTitleRaw || phaseId;
      const goal = extractGoal(section.bodyLines);
      const tasks = extractTasks(section.bodyLines);
      const exitGateRaw = extractFirstYamlBlock(section.bodyLines, 'exit_gate', warnings, phaseId)
        ?? extractFirstYamlBlock(section.bodyLines, 'exitGate', warnings, phaseId);
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
 *     equals the number of H3-derived tasks.
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
 * @property {'plan'|'initiative'} kind
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
 * @returns {MaterializedFile[]}
 */
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
    return {
      id: init.phaseId,
      slug: init.slug || `${planSlug}-${init.phaseId.toLowerCase()}`,
      title: init.title || init.phaseId,
      goal: init.goal || `TODO: fill goal for ${init.phaseId}`,
      dependsOn: prevId ? [prevId] : [],
      subPhaseCount: init.tasks.length,
      exitGate: {
        summary: criteria.length > 0
          ? `${criteria.length} ${criteria.length === 1 ? 'criterion' : 'criteria'} to meet`
          : 'TODO: define exit gate',
        criteria,
      },
      status: idx === 0 ? 'active' : 'pending',
    };
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
    relativePath: `.atomic-skills/plans/${planSlug}.md`,
    content: planContent,
  }];

  const seenPaths = new Set([files[0].relativePath]);
  const seenSlugs = new Set();

  // Initiative files (one per phase)
  for (let idx = 0; idx < initiatives.length; idx++) {
    const init = initiatives[idx];
    const initSlug = init.slug || `${planSlug}-${init.phaseId.toLowerCase()}`;
    const tasks = init.tasks.map((t) => ({
      id: t.id,
      title: t.title || `Task ${t.id}`,
      status: 'pending',
      lastUpdated: iso,
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
      status: idx === 0 ? 'active' : 'pending',
      branch: branch || null,
      started: iso,
      lastUpdated: iso,
      nextAction: tasks[0] ? `Start ${tasks[0].id}: ${tasks[0].title}` : null,
      parentPlan: planSlug,
      phaseId: init.phaseId,
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
    const relativePath = `.atomic-skills/initiatives/${initSlug}.md`;
    if (seenSlugs.has(initSlug) || seenPaths.has(relativePath)) {
      throw new Error(
        `materializeDecomposition: slug collision for phase ${init.phaseId} ` +
        `(slug "${initSlug}"). Two phases produced the same initiative path; ` +
        `shorten the plan slug or rename the conflicting phase title.`
      );
    }
    seenSlugs.add(initSlug);
    seenPaths.add(relativePath);
    files.push({
      kind: 'initiative',
      slug: initSlug,
      relativePath,
      content: initContent,
    });
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
