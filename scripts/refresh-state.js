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
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fchmodSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { computeRollupsDir } from './compute-rollups.js';
import { reconcileDir } from './reconcile-focus.js';
import { emitFocus } from './emit-focus.js';
import { emitConsumerState } from './emit-consumer-state.js';
import { parseFrontmatter } from './validate-state.js';

const INDEX_REFRESH_ATTEMPTS = 3;

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

function markdownCell(value, field) {
  const cell = String(value);
  if (/[|\r\n]/.test(cell)) {
    throw new Error(`unsafe Markdown cell ${field}: pipe, CR, and LF are not allowed`);
  }
  return cell;
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

/** Pure projection boundary, rerun against every newer snapshot after a conflict. */
function renderProjectIndex(raw, projections) {
  let next = raw;
  let latestMatched = '';

  for (const projection of projections) {
    const replacement = [
      markdownCell(projection.slug, 'slug'),
      markdownCell(projection.phaseId, 'phaseId'),
      markdownCell(projection.status, 'status'),
      markdownCell(`${projection.tasksDone}/${projection.tasksTotal}`, 'tasks'),
      markdownCell(`${projection.gatesMet}/${projection.gatesTotal}`, 'gates'),
    ];
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
    const updatedSection = section.replace(row, () => `| ${replacement.join(' | ')} |`);
    next = `${next.slice(0, sectionStart)}${updatedSection}${next.slice(sectionEnd)}`;
    latestMatched = laterTimestamp(latestMatched, projection.lastUpdated);
  }

  if (latestMatched) {
    const match = next.match(/^lastUpdated:\s*(.+)$/m);
    const current = match?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
    const latest = laterTimestamp(current, latestMatched);
    if (match && latest !== current) {
      next = next.replace(/^lastUpdated:\s*.+$/m, () => `lastUpdated: ${latest}`);
    }
  }

  return next;
}

/** Transaction boundary: durable temp write, stale-snapshot check, atomic rename. */
function publishProjectIndex(indexPath, expected, next) {
  const temporaryPath = `${indexPath}.refresh-${process.pid}-${randomUUID()}.tmp`;
  const mode = statSync(indexPath).mode & 0o777;
  let fd = null;
  let published = false;

  try {
    fd = openSync(temporaryPath, 'wx', mode);
    fchmodSync(fd, mode);
    writeFileSync(fd, next, 'utf8');
    fsyncSync(fd);
    closeSync(fd);
    fd = null;

    // Optimistic conflict check for updates made since the snapshot read. This
    // is intentionally not a complete cross-writer CAS: F-001 defers authority
    // over the final check→rename window to the shared-writer work in F4.
    if (readFileSync(indexPath, 'utf8') !== expected) return false;

    renameSync(temporaryPath, indexPath);
    published = true;
    if (process.platform !== 'win32') {
      const directoryFd = openSync(dirname(indexPath), 'r');
      try {
        fsyncSync(directoryFd);
      } finally {
        closeSync(directoryFd);
      }
    }
    return true;
  } finally {
    if (fd !== null) closeSync(fd);
    if (!published) {
      try {
        unlinkSync(temporaryPath);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
  }
}

function refreshProjectIndex(indexPath, readProjections) {
  const publishPath = lstatSync(indexPath).isSymbolicLink()
    ? realpathSync(indexPath)
    : indexPath;

  for (let attempt = 1; attempt <= INDEX_REFRESH_ATTEMPTS; attempt += 1) {
    const projections = readProjections();
    const raw = readFileSync(publishPath, 'utf8');
    const next = renderProjectIndex(raw, projections);

    if (next === raw) return false;
    if (publishProjectIndex(publishPath, raw, next)) return true;
  }

  const error = new Error(
    `${basename(indexPath)} changed during refresh after ${INDEX_REFRESH_ATTEMPTS} attempts`,
  );
  error.code = 'PROJECT_INDEX_CONFLICT';
  throw error;
}

/** Refresh only existing initiative rows in nested per-project indexes. */
function refreshProjectIndexes(dir) {
  const root = existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
  const projectsDir = join(root, 'projects');
  let changed = 0;
  const errors = [];

  for (const projectId of directories(projectsDir)) {
    const projectDir = join(projectsDir, projectId);
    const indexPath = join(projectDir, 'PROJECT-STATUS.md');
    if (!existsSync(indexPath)) continue;
    const readProjections = () => {
      const projections = [];
      for (const planSlug of directories(projectDir)) {
        const phasesDir = join(projectDir, planSlug, 'phases');
        for (const filePath of markdownFiles(phasesDir)) {
          const projection = initiativeProjection(filePath);
          if (projection) projections.push({ ...projection, planSlug });
        }
      }
      return projections;
    };
    try {
      if (refreshProjectIndex(indexPath, readProjections)) changed += 1;
    } catch (error) {
      if (error?.code !== 'PROJECT_INDEX_CONFLICT') throw error;
      const message = error.message;
      errors.push(message);
      console.error(`refresh-state: project index failed, continuing — ${message}`);
    }
  }

  return { changed, errors };
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
    indexErrors: indexes.errors,
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
