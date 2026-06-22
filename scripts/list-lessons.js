/**
 * list-lessons.js — deterministic, zero-token enumerator of phase-end LESSONS
 * (Spec 2 — Phase-end lessons consolidation / G1).
 *
 * Lessons are captured at `phase-done` (drafted from real failure signals,
 * ratified by the user) into one file per initiative at
 * `.atomic-skills/projects/<id>/<slug>/lessons/<initiative-slug>.md` and
 * validated by `validate-state` against `meta/schemas/lesson.schema.json`.
 *
 * This script is the PUSH side of the push-not-pull rule (a write-only lessons
 * repo degrades as it grows): at a phase's START, only the DISTILLATE — the
 * `scope: reusable` + `status: open` lessons whose `appliesTo` matches the phase
 * about to begin — reaches the agent (the phase-start disposition gate in
 * project-create-initiative.md). It is PURE READ; it never mutates and never
 * runs a verifier. Like its sibling detectors it is fail-soft (an unreadable /
 * malformed file degrades to "no lessons", never an exception).
 *
 * CLI:
 *   node scripts/list-lessons.js [<dir>] [--project <id>] [--plan <slug>]
 *        [--phase <id>] [--stats] [--json]
 *
 *   (no flags)   → the distillate of reusable+open lessons (all future phases)
 *   --phase <id> → the distillate applicable to phase <id> (appliesTo match)
 *   --stats      → deterministic burndown (identified/open/closed/stale/…)
 *   --json       → machine output
 *
 * Exit code is always 0 — this is an enumerator, not a gate. The phase-start
 * disposition decision lives in the skill body, not here.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFrontmatter } from './validate-state.js';

function fmOf(filePath) {
  try {
    const parsed = parseFrontmatter(readFileSync(filePath, 'utf8'));
    return parsed.error ? null : parsed.frontmatter;
  } catch {
    return null;
  }
}

/** statSync().isDirectory() that never throws (fail-soft scan). */
function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

const stateRootOf = (dir) =>
  existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;

/**
 * Collect every lesson across `projects/<id>/<slug>/lessons/*.md`, each flattened
 * with its file context. Optional `{ projectId, planSlug }` narrow the scan.
 * @returns {Array<object>} lessons, each carrying projectId/planSlug/initiativeSlug/file
 */
export function collectLessons(dir, { projectId, planSlug } = {}) {
  const root = stateRootOf(dir);
  const out = [];
  const projectsDir = join(root, 'projects');
  if (!isDir(projectsDir)) return out;

  for (const projId of readdirSync(projectsDir)) {
    if (projectId && projId !== projectId) continue;
    const projPath = join(projectsDir, projId);
    if (!isDir(projPath)) continue;
    for (const slug of readdirSync(projPath)) {
      if (planSlug && slug !== planSlug) continue;
      const lessonsDir = join(projPath, slug, 'lessons');
      if (!isDir(lessonsDir)) continue;
      for (const entry of readdirSync(lessonsDir)) {
        if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
        const fm = fmOf(join(lessonsDir, entry));
        if (!fm || !Array.isArray(fm.lessons)) continue;
        for (const lesson of fm.lessons) {
          if (!lesson || typeof lesson !== 'object') continue;
          out.push({
            ...lesson,
            projectId: projId,
            planSlug: slug,
            initiativeSlug: fm.slug ?? entry.replace(/\.md$/, ''),
            file: join(lessonsDir, entry),
          });
        }
      }
    }
  }
  return out;
}

/** True iff `lesson.appliesTo` admits `phaseId` ([] = all future phases). */
function appliesToPhase(lesson, phaseId) {
  const a = lesson.appliesTo;
  if (!Array.isArray(a) || a.length === 0) return true; // [] = all future phases
  if (!phaseId) return false; // a targeted lesson needs a phase to match against
  return a.includes(phaseId);
}

/**
 * The DISTILLATE the phase-start gate consumes: reusable + open lessons whose
 * `appliesTo` admits `phaseId`. `local` and `closed` lessons are never surfaced.
 */
export function applicableLessons(dir, { projectId, planSlug, phaseId } = {}) {
  return collectLessons(dir, { projectId, planSlug }).filter(
    (l) => l.scope === 'reusable' && l.status === 'open' && appliesToPhase(l, phaseId),
  );
}

/**
 * Deterministic burndown over the lesson set (Google-SRE created-vs-closed +
 * the recurrence signal). Honest about the available fields: `status` is
 * open|closed, so `applied` is not a distinct status — `closedNonStale` is the
 * resolved-by-action proxy, surfaced as such (not over-claimed as apply-rate).
 */
export function lessonStats(dir, opts = {}) {
  const lessons = collectLessons(dir, opts);
  const open = lessons.filter((l) => l.status === 'open').length;
  const closed = lessons.filter((l) => l.status === 'closed').length;
  const stale = lessons.filter((l) => l.status === 'closed' && typeof l.staleReason === 'string' && l.staleReason.trim()).length;
  return {
    identified: lessons.length,
    open,
    closed,
    stale,
    closedNonStale: closed - stale, // resolved-by-action proxy (no separate 'applied' status)
    reusable: lessons.filter((l) => l.scope === 'reusable').length,
    local: lessons.filter((l) => l.scope === 'local').length,
    recurrence: lessons.filter((l) => typeof l.recurrenceOf === 'string' && l.recurrenceOf.trim()).length,
  };
}

// --- CLI ---
function parseArgs(argv) {
  const opts = { dir: null, json: false, stats: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--stats') opts.stats = true;
    else if (a === '--project') opts.projectId = argv[++i];
    else if (a === '--plan') opts.planSlug = argv[++i];
    else if (a === '--phase') opts.phaseId = argv[++i];
    else if (!a.startsWith('--') && !opts.dir) opts.dir = a;
  }
  return opts;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const opts = parseArgs(process.argv.slice(2));
  const dir = resolve(opts.dir || process.cwd());

  if (opts.stats) {
    const s = lessonStats(dir, opts);
    if (opts.json) { console.log(JSON.stringify(s, null, 2)); process.exit(0); }
    console.log(`list-lessons (burndown): identified=${s.identified} open=${s.open} closed=${s.closed} stale=${s.stale} reusable=${s.reusable} recurrence=${s.recurrence}`);
    if (s.recurrence > 0) console.log(`  ⚠ ${s.recurrence} lesson(s) recur (recurrenceOf set) — the same mistake is repeating; learning isn't sticking.`);
    process.exit(0);
  }

  const lessons = applicableLessons(dir, opts);
  if (opts.json) { console.log(JSON.stringify(lessons, null, 2)); process.exit(0); }
  if (!lessons.length) {
    console.log(`list-lessons: no applicable reusable+open lessons${opts.phaseId ? ` for phase ${opts.phaseId}` : ''}.`);
    process.exit(0);
  }
  console.log(`list-lessons: ${lessons.length} applicable lesson(s)${opts.phaseId ? ` for phase ${opts.phaseId}` : ''} — disposition each at phase-start (Apply / Keep / Stale / Reject):`);
  for (const l of lessons) {
    console.log(`  [${l.id}] (${l.planSlug}/${l.initiativeSlug}, conf ${l.confidence}) ${l.statement}`);
    console.log(`        → ${l.corrective}`);
  }
  process.exit(0);
}
