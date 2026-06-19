/**
 * refresh-state.js — the single idempotent chokepoint that keeps derived state
 * coherent. Runs, in order:
 *   1. compute-rollups   — tasksDone/tasksTotal/gatesMet/gatesTotal onto each phase
 *   2. reconcile-focus   — planActive/current/planTitle focus markers
 *   3. emit-focus        — the flat focus.json digest for claudebar
 *   4. emit-consumer-state — the aiDeck state series/projection
 *
 * Everything that mutates `.atomic-skills/` should funnel through here so a raw
 * edit (no command run) still leaves rollups AND the digest consistent. Called
 * by the session-start and stop hooks (layers 2–3 of the freshness contract,
 * docs/design/statusline-focus-integration.md) and safe to run anytime — each
 * step is a pure function of on-disk state and rewrites only what changed.
 *
 * CLI:  node scripts/refresh-state.js [<dir>]     (defaults to ./)
 */
import { resolve } from 'node:path';
import { computeRollupsDir } from './compute-rollups.js';
import { reconcileDir } from './reconcile-focus.js';
import { emitFocus } from './emit-focus.js';
import { emitConsumerState } from './emit-consumer-state.js';

/** Run the derived-state passes for a repo dir. Returns a summary. */
export function refreshState(dir, opts = {}) {
  const rollups = computeRollupsDir(dir);
  const focus = reconcileDir(dir);
  const emitted = emitFocus(dir, opts);
  const nowMs = opts.nowMs ?? Date.now();
  let series = null;
  try {
    series = emitConsumerState(dir, nowMs);
  } catch {
    // fail-open: the series is best-effort; the three core passes above are authoritative
  }
  return {
    rollupsChanged: rollups.changed,
    focusChanged: focus.changed,
    digestWritten: emitted.written,
    digest: emitted.digest,
    seriesWritten: series?.written?.length ?? 0,
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const r = refreshState(target);
  const p = r.digest?.plan;
  console.log(
    `refresh-state: rollups ${r.rollupsChanged} changed, focus ${r.focusChanged} changed, ` +
    `digest ${r.digestWritten ? (p ? `→ ${p.slug} · ${r.digest.phase?.id ?? '—'}` : '→ no active plan') : 'skipped (no state)'}`,
  );
}
