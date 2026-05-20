/* global window */
// ─────────────────────────────────────────────────────────────────────────
// Feedback fixtures: annotations + highlights bound to entities in F0
// Both authored by humans and the AI. Includes edge cases:
//   - markdown / code blocks in an AI annotation body
//   - orphan targets (entity deleted, items still reference it)
//   - mix of severities for the inline-badge color rollup
// ─────────────────────────────────────────────────────────────────────────

const ENTITY_TITLES = {
  'self':              { label: 'F0 · Foundation Repair', kind: 'phase' },
  'tasks.T-001':       { label: 'T-001 · Pin pnpm to lockfile', kind: 'task' },
  'tasks.T-002':       { label: 'T-002 · Unicode normalization in matcher', kind: 'task' },
  'tasks.T-003':       { label: 'T-003 · Replace deprecated zod APIs', kind: 'task' },
  'tasks.T-004':       { label: 'T-004 · Migrate to Vue 3.4 reactive', kind: 'task' },
  'tasks.T-005':       { label: 'T-005 · Wire SSE channel', kind: 'task' },
  'tasks.T-006':       { label: 'T-006 · Schema validator at boundary', kind: 'task' },
  'exitGates.F0-G1':   { label: 'F0-G1 · pnpm install passes clean', kind: 'gate' },
  'exitGates.F0-G2':   { label: 'F0-G2 · matcher passes unicode suite', kind: 'gate' },
  'exitGates.F0-G3':   { label: 'F0-G3 · full-pipeline.sh exits 0', kind: 'gate' },
  // orphan — referenced but no longer present in the plan
  'tasks.T-009':       { label: 'T-009 · (deleted)', kind: 'task', orphan: true },
  'exitGates.F0-G4':   { label: 'F0-G4 · (deleted)', kind: 'gate', orphan: true },
};

// ── Annotations ──────────────────────────────────────────────────────────
const FEEDBACK_ANNOTATIONS = [
  {
    kind: 'annotation',
    id: 'a1',
    target: { slug: 'v3-f0-foundation-repair', path: 'tasks.T-002' },
    author: 'ai',
    createdAt: '2 hrs ago', createdAtSort: -120,
    body:
`Need to verify unicode normalization for emoji edge cases. The current matcher fixture only covers Latin-1 + common BMP.

Suggest adding a fixture with U+1F3F4 ZWJ tag-sequences before claiming \`F0-G2\` is met:

\`\`\`yaml
# tests/fixtures/unicode-edge.yaml
- input: "🏴󠁧󠁢󠁳󠁣󠁴󠁿"    # Scotland flag (ZWJ sequence)
  expect: { codepoints: 7, grapheme_clusters: 1 }
- input: "👨‍👩‍👧‍👦"        # family (4 ZWJs)
  expect: { codepoints: 7, grapheme_clusters: 1 }
\`\`\`

Without these, G2 can pass on synthetic data and fail in production on Brazilian-Portuguese names containing combining marks.`,
    resolved: false,
    replies: [
      { id: 'a1-r1', author: 'human', createdAt: '1 hr ago',
        body: 'Good call. Adding to tests/fixtures/unicode-edge.yaml.' },
      { id: 'a1-r2', author: 'ai', createdAt: '52 min ago',
        body: 'Confirmed — fixture covers four flag variants + the family ZWJ. Will reopen if I find more.' },
    ],
  },
  {
    kind: 'annotation',
    id: 'a2',
    target: { slug: 'v3-f0-foundation-repair', path: 'exitGates.F0-G2' },
    author: 'human',
    createdAt: '1 hr ago', createdAtSort: -60,
    body: 'This query might be expensive on 50M rows in production. Consider an indexed materialized view, or filter to last 30 days for the gate check.',
    resolved: false,
    replies: [],
  },
  {
    kind: 'annotation',
    id: 'a3',
    target: { slug: 'v3-f0-foundation-repair', path: 'self' },
    author: 'human',
    createdAt: '6 hrs ago', createdAtSort: -360,
    body: 'Reminder to self: do not advance F0 until G3 (full-pipeline.sh exit 0) actually passes on the second dev\'s machine, not just mine.',
    resolved: false,
    replies: [],
  },
  {
    kind: 'annotation',
    id: 'a4',
    target: { slug: 'v3-f0-foundation-repair', path: 'tasks.T-005' },
    author: 'human',
    createdAt: 'yesterday', createdAtSort: -1440,
    body: 'Picked up. Spec is in docs/sse-channel.md — keep heartbeats at 15s, NOT 30. The proxy in front of localhost will close idle connections at 28s.',
    resolved: true,
    resolution: { author: 'human', createdAt: '3 hrs ago',
      body: 'Heartbeat set to 15s; tested with the staging proxy fixture. Closing.' },
    replies: [],
  },
  {
    kind: 'annotation',
    id: 'a5',
    target: { slug: 'v3-f0-foundation-repair', path: 'tasks.T-009', orphan: true },
    author: 'ai',
    createdAt: '3 days ago', createdAtSort: -4320,
    body: 'T-009 was the migration helper script. It looks like it was deleted in commit a3f9e2 without a redirect — this annotation will outlive its target. Surfaced here so you can either restore T-009 or mark this annotation as moot.',
    resolved: false,
    replies: [],
  },
];

// ── Highlights ───────────────────────────────────────────────────────────
const FEEDBACK_HIGHLIGHTS = [
  {
    kind: 'highlight',
    id: 'h1',
    target: { slug: 'v3-f0-foundation-repair', path: 'tasks.T-002' },
    author: 'ai',
    severity: 'critical',
    createdAt: '8 min ago', createdAtSort: -8,
    reason: 'Drift detected: currentPhase is F0 but the agent wrote to phases/F3/* — outside the active phase scope.',
    acknowledged: false,
  },
  {
    kind: 'highlight',
    id: 'h2',
    target: { slug: 'v3-f0-foundation-repair', path: 'exitGates.F0-G2' },
    author: 'ai',
    severity: 'warn',
    createdAt: '22 min ago', createdAtSort: -22,
    reason: 'Gate verifier query likely O(n) over the full songs table. Suggest filtering to last 30d or building a materialized view before re-running on production.',
    acknowledged: false,
  },
  {
    kind: 'highlight',
    id: 'h3',
    target: { slug: 'v3-f0-foundation-repair', path: 'tasks.T-005' },
    author: 'human',
    severity: 'warn',
    createdAt: '1 hr ago', createdAtSort: -60,
    reason: 'Two upstream blockers (T-003, T-004) + one cross-init blocker. Verify the cross-init dep on inception-audit/T-007 is still informational.',
    acknowledged: false,
  },
  {
    kind: 'highlight',
    id: 'h4',
    target: { slug: 'v3-f0-foundation-repair', path: 'self' },
    author: 'ai',
    severity: 'info',
    createdAt: '4 hrs ago', createdAtSort: -240,
    reason: 'Phase has been active for 9 days — average for F-tier phases in this plan is 4.2 days. Not a blocker, but worth noting.',
    acknowledged: false,
  },
  {
    kind: 'highlight',
    id: 'h5',
    target: { slug: 'v3-f0-foundation-repair', path: 'tasks.T-001' },
    author: 'ai',
    severity: 'info',
    createdAt: 'yesterday', createdAtSort: -1440,
    reason: 'pnpm lockfile pinned successfully. Logged for the audit trail.',
    acknowledged: true,
    acknowledgement: { author: 'human', createdAt: '20 hrs ago',
      body: 'Seen — closing.' },
  },
  {
    kind: 'highlight',
    id: 'h6',
    target: { slug: 'v3-f0-foundation-repair', path: 'exitGates.F0-G4', orphan: true },
    author: 'ai',
    severity: 'warn',
    createdAt: '2 days ago', createdAtSort: -2880,
    reason: 'F0-G4 was removed from the gate set but a highlight against it remains. Mark resolved or restore the gate definition.',
    acknowledged: false,
  },
];

const FEEDBACK_ITEMS = [...FEEDBACK_HIGHLIGHTS, ...FEEDBACK_ANNOTATIONS];

// Roll-up counts per target path → used by inline badges
const computeBadgeRollup = (items) => {
  const rollup = {};
  const sevRank = { critical: 3, warn: 2, info: 1 };
  for (const it of items) {
    // Skip resolved / acknowledged from the badge counts.
    if (it.kind === 'annotation' && it.resolved) continue;
    if (it.kind === 'highlight'  && it.acknowledged) continue;
    const key = it.target.path;
    if (!rollup[key]) rollup[key] = { path: key, count: 0, maxSeverity: null, firstReason: null, hasAi: false, hasHuman: false };
    const r = rollup[key];
    r.count++;
    if (it.kind === 'highlight') {
      const cur = sevRank[r.maxSeverity] || 0;
      const next = sevRank[it.severity] || 0;
      if (next > cur) r.maxSeverity = it.severity;
    }
    if (!r.firstReason) {
      r.firstReason = it.kind === 'highlight' ? it.reason : it.body;
    }
    if (it.author === 'ai') r.hasAi = true;
    if (it.author === 'human') r.hasHuman = true;
  }
  return rollup;
};

Object.assign(window, {
  FEEDBACK_ANNOTATIONS,
  FEEDBACK_HIGHLIGHTS,
  FEEDBACK_ITEMS,
  ENTITY_TITLES,
  computeBadgeRollup,
});
