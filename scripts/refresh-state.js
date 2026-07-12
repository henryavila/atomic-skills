/**
 * refresh-state.js — the single idempotent chokepoint that keeps derived state
 * coherent. Runs, in order:
 *   1. compute-rollups   — tasksDone/tasksTotal/gatesMet/gatesTotal onto each phase
 *   2. reconcile-focus   — planActive/current/planTitle focus markers
 *   3. project indexes   — existing PROJECT-STATUS initiative rows
 *   4. emit-focus        — the flat focus.json digest for claudebar
 *   5. emit-consumer-state — the aiDeck state series/projection
 *
 * Everything that mutates `.atomic-skills/` should funnel through here so a raw
 * edit (no command run) still leaves rollups AND the digest consistent. Called
 * by the session-start and stop hooks (layers 2–3 of the freshness contract,
 * docs/design/statusline-focus-integration.md) and safe to run anytime — each
 * step is a pure function of on-disk state and rewrites only what changed.
 *
 * CLI:  node scripts/refresh-state.js [<dir>]     (defaults to ./)
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { computeRollupsDir } from './compute-rollups.js';
import { reconcileDir } from './reconcile-focus.js';
import { emitFocus } from './emit-focus.js';
import { emitConsumerState } from './emit-consumer-state.js';
import { parseFrontmatter } from './validate-state.js';

function directories(path) {
  if (!existsSync(path) || !statSync(path).isDirectory()) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function markdownFiles(path) {
  if (!existsSync(path) || !statSync(path).isDirectory()) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.'))
    .map((entry) => join(path, entry.name))
    .sort();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function laterTimestamp(left, right) {
  if (!right) return left;
  if (!left) return right;
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (!Number.isFinite(rightMs)) return left;
  if (!Number.isFinite(leftMs) || rightMs > leftMs) return right;
  return left;
}

function initiativeProjection(filePath) {
  const parsed = parseFrontmatter(readFileSync(filePath, 'utf8'));
  if (parsed.error) return null;
  const fm = parsed.frontmatter;
  if (typeof fm.slug !== 'string' || fm.slug.trim() === '') return null;
  const tasks = Array.isArray(fm.tasks) ? fm.tasks : [];
  const gates = Array.isArray(fm.exitGates) ? fm.exitGates : [];
  return {
    slug: fm.slug,
    phaseId: typeof fm.phaseId === 'string' ? fm.phaseId : '',
    status: typeof fm.status === 'string' ? fm.status : '',
    tasksDone: tasks.filter((task) => task?.status === 'done').length,
    tasksTotal: tasks.length,
    gatesMet: gates.filter((gate) => gate?.status === 'met').length,
    gatesTotal: gates.length,
    lastUpdated: typeof fm.lastUpdated === 'string' ? fm.lastUpdated : '',
  };
}

function refreshProjectIndex(indexPath, projections) {
  const raw = readFileSync(indexPath, 'utf8');
  let next = raw;
  let latestMatched = '';

  for (const projection of projections) {
    const heading = new RegExp(
      `^###\\s+${escapeRegExp(projection.planSlug)}\\s+phases\\s*$`,
      'm',
    ).exec(next);
    if (!heading) continue;
    const sectionStart = heading.index + heading[0].length;
    const following = next.slice(sectionStart);
    const nextHeadingOffset = following.search(/^#{1,3}\s+/m);
    const sectionEnd = nextHeadingOffset === -1
      ? next.length
      : sectionStart + nextHeadingOffset;
    const section = next.slice(sectionStart, sectionEnd);
    const row = new RegExp(`^\\|\\s*${escapeRegExp(projection.slug)}\\s*\\|[^\\r\\n]*$`, 'm');
    if (!row.test(section)) continue;
    const replacement = [
      projection.slug,
      projection.phaseId,
      projection.status,
      `${projection.tasksDone}/${projection.tasksTotal}`,
      `${projection.gatesMet}/${projection.gatesTotal}`,
    ];
    const updatedSection = section.replace(row, `| ${replacement.join(' | ')} |`);
    next = `${next.slice(0, sectionStart)}${updatedSection}${next.slice(sectionEnd)}`;
    latestMatched = laterTimestamp(latestMatched, projection.lastUpdated);
  }

  if (latestMatched) {
    const match = next.match(/^lastUpdated:\s*(.+)$/m);
    const current = match?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
    const latest = laterTimestamp(current, latestMatched);
    if (match && latest !== current) {
      next = next.replace(/^lastUpdated:\s*.+$/m, `lastUpdated: ${latest}`);
    }
  }

  if (next === raw) return false;
  writeFileSync(indexPath, next, 'utf8');
  return true;
}

/** Refresh only existing initiative rows in nested per-project indexes. */
function refreshProjectIndexes(dir) {
  const root = existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
  const projectsDir = join(root, 'projects');
  let changed = 0;

  for (const projectId of directories(projectsDir)) {
    const projectDir = join(projectsDir, projectId);
    const indexPath = join(projectDir, 'PROJECT-STATUS.md');
    if (!existsSync(indexPath)) continue;
    const projections = [];
    for (const planSlug of directories(projectDir)) {
      const phasesDir = join(projectDir, planSlug, 'phases');
      for (const filePath of markdownFiles(phasesDir)) {
        const projection = initiativeProjection(filePath);
        if (projection) projections.push({ ...projection, planSlug });
      }
    }
    if (refreshProjectIndex(indexPath, projections)) changed += 1;
  }

  return { changed };
}

/** Run the derived-state passes for a repo dir. Returns a summary. */
export function refreshState(dir, opts = {}) {
  const rollups = computeRollupsDir(dir);
  const focus = reconcileDir(dir);
  const indexes = refreshProjectIndexes(dir);
  const emitted = emitFocus(dir, opts);
  const nowMs = opts.nowMs ?? Date.now();
  let series = null;
  let seriesError = null;
  try {
    series = emitConsumerState(dir, nowMs);
  } catch (err) {
    // fail-open: the four core passes above are authoritative. Surface the
    // failure (stderr + summary) so a regression that breaks the series is
    // visible, not silently swallowed into a clean-looking seriesWritten:0.
    seriesError = err?.message ?? String(err);
    console.error(`refresh-state: emit-consumer-state (series) failed, skipping — ${seriesError}`);
  }
  return {
    rollupsChanged: rollups.changed,
    focusChanged: focus.changed,
    indexesChanged: indexes.changed,
    digestWritten: emitted.written,
    digest: emitted.digest,
    seriesWritten: series?.written?.length ?? 0,
    seriesError,
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const r = refreshState(target);
  const p = r.digest?.plan;
  console.log(
    `refresh-state: rollups ${r.rollupsChanged} changed, focus ${r.focusChanged} changed, ` +
    `indexes ${r.indexesChanged} changed, ` +
    `digest ${r.digestWritten ? (p ? `→ ${p.slug} · ${r.digest.phase?.id ?? '—'}` : '→ no active plan') : 'skipped (no state)'}`,
  );
}
