/* global React, window, InlineBadge, StatusGlyph, StatusChip, VerifierBadge,
   ENTITY_TITLES, FEEDBACK_ITEMS, computeBadgeRollup */

// ─────────────────────────────────────────────────────────────────────────
// Host backdrop for the Feedback Channel screen.
//
// Shows the F0 · Foundation Repair initiative — phase rail, tasks, and exit
// gates — with InlineBadge attached to every entity that has unresolved
// items. Clicking a badge (or any row affordance) opens the drawer filtered
// to that target. The host itself is read-only — the feedback channel is the
// subject of this screen, the work is the supporting cast.
// ─────────────────────────────────────────────────────────────────────────

// 9-phase rail data (matches existing data.jsx)
const PHASE_RAIL = [
  { id: 'F-2', status: 'done',    title: 'Inception & Audit' },
  { id: 'F-1', status: 'done',    title: 'Repo Bootstrap' },
  { id: 'F0',  status: 'active',  title: 'Foundation Repair' },
  { id: 'F1',  status: 'pending', title: 'Filament Redesign' },
  { id: 'F2',  status: 'pending', title: 'Nuxt Redesign' },
  { id: 'F3',  status: 'pending', title: 'Planning Mode' },
  { id: 'F4',  status: 'pending', title: 'Ministry Oversight' },
  { id: 'F5',  status: 'pending', title: 'Set Curation' },
  { id: 'F6',  status: 'pending', title: 'Migration A' },
];

const TASKS = [
  { id: 'T-001', status: 'done',    title: 'Pin pnpm to lockfile' },
  { id: 'T-002', status: 'active',  title: 'Unicode normalization in matcher', here: true,
    description: 'Make the song-title matcher round-trip every Latin-1 + emoji ZWJ + Brazilian-Portuguese combining-mark sequence in the fixture set.' },
  { id: 'T-003', status: 'pending', title: 'Replace deprecated zod APIs' },
  { id: 'T-004', status: 'pending', title: 'Migrate to Vue 3.4 reactive' },
  { id: 'T-005', status: 'blocked', title: 'Wire SSE channel',
    blockedBy: ['T-003', 'T-004'] },
  { id: 'T-006', status: 'pending', title: 'Schema validator at boundary' },
];

const EXIT_GATES = [
  { id: 'F0-G1', status: 'pending', description: 'pnpm install passes clean',
    verifier: { kind: 'shell', command: 'pnpm install --frozen-lockfile' } },
  { id: 'F0-G2', status: 'pending', description: 'matcher passes unicode suite',
    verifier: { kind: 'query', command: 'SELECT COUNT(*) FROM matches WHERE expected != actual' } },
  { id: 'F0-G3', status: 'pending', description: 'full-pipeline.sh exits 0',
    verifier: { kind: 'shell', command: 'bash scripts/full-pipeline.sh' } },
];

// ── Section header (eyebrow + small caption) ────────────────────────────
const SectionEyebrow = ({ children, hint }) => (
  <div style={{
    display: 'flex', alignItems: 'baseline', gap: 12,
    padding: '0 0 8px',
  }}>
    <span className="t-eyebrow" style={{ color: 'var(--fg-muted)' }}>{children}</span>
    {hint && <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
    }}>{hint}</span>}
  </div>
);

// ── Phase pip (compact dot+id in the phase rail) ────────────────────────
const PhasePip = ({ phase, rollup, onClick }) => {
  const here = phase.status === 'active';
  const done = phase.status === 'done';
  const idCol = here ? 'var(--status-active)' : done ? 'var(--status-done)' : 'var(--fg-muted)';
  return (
    <div onClick={onClick} style={{
      cursor: rollup ? 'pointer' : 'default',
      position: 'relative',
      padding: '8px 10px 9px',
      minWidth: 78,
      background: here ? 'color-mix(in srgb, var(--status-active) 7%, var(--bg-surface))' : 'var(--bg-surface)',
      border: `1px solid ${here ? 'color-mix(in srgb, var(--status-active) 40%, transparent)' : 'var(--border-default)'}`,
      borderRadius: 6,
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <StatusGlyph status={phase.status} size={12} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
          color: idCol, letterSpacing: '-0.01em',
        }}>{phase.id}</span>
        {/* Badge anchors top-right so it never pushes layout. */}
        <span style={{
          position: 'absolute', top: 4, right: 4,
        }}>
          <InlineBadge rollup={rollup} variant="standard" onClick={onClick} />
        </span>
      </div>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 10,
        color: 'var(--fg-subtle)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{phase.title}</span>
    </div>
  );
};

// ── Task row ────────────────────────────────────────────────────────────
const HostTaskRow = ({ task, rollup, onOpen }) => {
  const here = task.here;
  return (
    <div style={{
      padding: '9px 14px',
      borderBottom: '1px solid var(--border-subtle)',
      background: here ? 'color-mix(in srgb, var(--status-active) 5%, transparent)' : 'transparent',
      display: 'flex', alignItems: 'center', gap: 10,
      position: 'relative',
    }}>
      <StatusGlyph status={task.status} size={13} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)',
        width: 48, flex: 'none',
      }}>{task.id}</span>
      {/* Badge reserves space via min-width — no layout shift on appear/disappear */}
      <span style={{ width: 28, flex: 'none', display: 'inline-flex', justifyContent: 'flex-start' }}>
        <InlineBadge rollup={rollup} variant="standard" onClick={() => onOpen(`tasks.${task.id}`)} />
      </span>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 13,
        color: 'var(--fg-default)', flex: 1, minWidth: 0,
      }}>
        {task.title}
        {task.blockedBy && (
          <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--status-blocked)' }}>
            ⊘ blocked by {task.blockedBy.join(', ')}
          </span>
        )}
      </span>
      {here && <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
        color: 'var(--status-active)', letterSpacing: '0.08em',
      }}>HERE</span>}
    </div>
  );
};

// ── Exit gate row ───────────────────────────────────────────────────────
const HostGateRow = ({ gate, rollup, onOpen }) => (
  <div style={{
    padding: '9px 14px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex', alignItems: 'center', gap: 10,
  }}>
    <StatusGlyph status={gate.status === 'met' ? 'done' : 'pending'} size={13} />
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)',
      width: 56, flex: 'none',
    }}>{gate.id}</span>
    <span style={{ width: 28, flex: 'none', display: 'inline-flex', justifyContent: 'flex-start' }}>
      <InlineBadge rollup={rollup} variant="standard" onClick={() => onOpen(`exitGates.${gate.id}`)} />
    </span>
    <span style={{
      fontFamily: 'var(--font-sans)', fontSize: 13,
      color: 'var(--fg-default)', flex: 1, minWidth: 0,
    }}>{gate.description}</span>
    <VerifierBadge kind={gate.verifier.kind} />
  </div>
);

// ── Initiative hero ─────────────────────────────────────────────────────
const InitiativeHero = ({ rollup, onOpen }) => (
  <div style={{
    display: 'flex', alignItems: 'stretch', gap: 16,
    marginBottom: 20,
  }}>
    {/* mono ID block */}
    <div style={{
      padding: '10px 20px 12px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      boxShadow: 'var(--shadow-glow-active)',
      position: 'relative', overflow: 'hidden', flex: 'none',
    }}>
      <span style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
        background: 'var(--status-active)',
      }} />
      <div className="t-eyebrow" style={{ color: 'var(--status-active)', marginBottom: 4 }}>PHASE</div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 600,
        color: 'var(--status-active)', letterSpacing: '-0.02em', lineHeight: 1,
      }}>F0</div>
    </div>
    {/* Title block */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
      <div className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginBottom: 6 }}>
        INITIATIVE · v3-redesign
      </div>
      <h1 style={{
        margin: 0, fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 600,
        color: 'var(--fg-default)', letterSpacing: '-0.022em', lineHeight: 1.15,
        display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        Foundation Repair
        <InlineBadge rollup={rollup} variant="standard" onClick={() => onOpen('self')} />
      </h1>
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 8,
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
      }}>
        <StatusChip status="active" />
        <span>started 2026-05-19</span>
        <span style={{ width: 1, height: 10, background: 'var(--border-default)' }} />
        <span>branch <span style={{ color: 'var(--fg-default)' }}>v2-rebuild</span></span>
      </div>
    </div>
  </div>
);

// ── Inline badge gallery (variant + state showcase) ─────────────────────
const VariantSwatch = ({ label, children }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', gap: 6,
    padding: '10px 12px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 6,
    minWidth: 0,
  }}>
    <span className="t-eyebrow" style={{ color: 'var(--fg-faint)' }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {children}
    </div>
  </div>
);

const BadgeGallery = ({ onOpen }) => {
  // Hand-rolled rollups so the gallery is deterministic regardless of fixture
  const mockCritical = { path: 'mock.crit',  count: 2, maxSeverity: 'critical', firstReason: 'Drift detected: agent wrote outside active phase scope.', hasAi: true, hasHuman: false };
  const mockWarn     = { path: 'mock.warn',  count: 1, maxSeverity: 'warn',     firstReason: 'Gate verifier likely O(n) over full songs table.', hasAi: true, hasHuman: false };
  const mockInfo     = { path: 'mock.info',  count: 1, maxSeverity: 'info',     firstReason: 'Phase has been active 9 days — average is 4.2d.', hasAi: true, hasHuman: false };
  const mockNeutral  = { path: 'mock.neu',   count: 3, maxSeverity: null,       firstReason: 'Three open annotations on this task.', hasAi: true, hasHuman: true };
  const mockSingle   = { path: 'mock.single', count: 1, maxSeverity: 'warn', firstReason: 'This query might be expensive on 50M rows.', hasAi: false, hasHuman: true };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
      <VariantSwatch label="WHISPER · dot + count">
        <InlineBadge rollup={mockCritical} variant="whisper" onClick={() => onOpen('mock.crit')} />
        <InlineBadge rollup={mockWarn}     variant="whisper" onClick={() => onOpen('mock.warn')} />
        <InlineBadge rollup={mockInfo}     variant="whisper" onClick={() => onOpen('mock.info')} />
        <InlineBadge rollup={mockNeutral}  variant="whisper" onClick={() => onOpen('mock.neu')} />
      </VariantSwatch>
      <VariantSwatch label="STANDARD · ⚑ + count">
        <InlineBadge rollup={mockCritical} variant="standard" onClick={() => onOpen('mock.crit')} />
        <InlineBadge rollup={mockWarn}     variant="standard" onClick={() => onOpen('mock.warn')} />
        <InlineBadge rollup={mockInfo}     variant="standard" onClick={() => onOpen('mock.info')} />
        <InlineBadge rollup={mockNeutral}  variant="standard" onClick={() => onOpen('mock.neu')} />
      </VariantSwatch>
      <VariantSwatch label="LOUD · ⚑ + count + reason">
        <InlineBadge rollup={mockSingle} variant="loud" onClick={() => onOpen('mock.single')} />
        <InlineBadge rollup={mockCritical} variant="loud" onClick={() => onOpen('mock.crit')} />
      </VariantSwatch>
    </div>
  );
};

// ── FeedbackHost ────────────────────────────────────────────────────────
const FeedbackHost = ({ items, badgeVariant, onOpen, showGallery }) => {
  const rollup = React.useMemo(() => computeBadgeRollup(items), [items]);

  // For phase rail: aggregate by phase id. Items target paths inside this initiative
  // use 'self' / 'tasks.*' / 'exitGates.*', all rolling up to F0. Other phases get
  // synthetic rollups so the rail isn't suspiciously empty across F-2 → F6.
  const phaseRollup = (phaseId) => {
    if (phaseId === 'F0') {
      // F0 = sum of all items in current items[] (drawer scope)
      const total = items.filter(it => !((it.kind === 'annotation' && it.resolved) || (it.kind === 'highlight' && it.acknowledged))).length;
      // pick highest severity present
      let maxSev = null;
      const rank = { critical: 3, warn: 2, info: 1 };
      for (const it of items) {
        if (it.kind === 'highlight' && it.severity) {
          if ((rank[it.severity] || 0) > (rank[maxSev] || 0)) maxSev = it.severity;
        }
      }
      return total > 0 ? { path: 'phases.F0', count: total, maxSeverity: maxSev,
        firstReason: 'Open feedback on Foundation Repair', hasAi: true, hasHuman: true } : null;
    }
    // Synthetic chrome rollups for other phases (just for the rail demo)
    const dec = { 'F2': { count: 1, maxSeverity: 'info' },
                  'F3': { count: 2, maxSeverity: 'warn' },
                  'F6': { count: 1, maxSeverity: 'critical' } };
    if (dec[phaseId]) {
      return { path: `phases.${phaseId}`, count: dec[phaseId].count, maxSeverity: dec[phaseId].maxSeverity,
        firstReason: 'Roll-up from peer phase', hasAi: true, hasHuman: false };
    }
    return null;
  };

  return (
    <div style={{
      padding: '24px 28px 60px',
      display: 'flex', flexDirection: 'column', gap: 22,
      maxWidth: 880, margin: '0 auto', minWidth: 0,
    }}>
      <InitiativeHero rollup={rollup['self']} onOpen={onOpen} />

      {/* Phase rail */}
      <section>
        <SectionEyebrow hint="9 phases · v3-redesign">PLAN · PHASE RAIL</SectionEyebrow>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(9, minmax(0, 1fr))',
          gap: 6, alignItems: 'stretch',
        }}>
          {PHASE_RAIL.map(p => (
            <PhasePip key={p.id} phase={p} rollup={phaseRollup(p.id)}
              onClick={() => p.id === 'F0' ? onOpen('self') : null} />
          ))}
        </div>
      </section>

      {/* Exit gates */}
      <section>
        <SectionEyebrow hint={`0 of ${EXIT_GATES.length} met`}>EXIT GATES</SectionEyebrow>
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)', borderRadius: 8,
          overflow: 'hidden',
        }}>
          {EXIT_GATES.map(g => (
            <HostGateRow key={g.id} gate={g} rollup={rollup[`exitGates.${g.id}`]} onOpen={onOpen} />
          ))}
        </div>
      </section>

      {/* Tasks */}
      <section>
        <SectionEyebrow hint={`${TASKS.filter(t => t.status === 'done').length} of ${TASKS.length} tasks done`}>TASKS</SectionEyebrow>
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)', borderRadius: 8,
          overflow: 'hidden',
        }}>
          {TASKS.map(t => (
            <HostTaskRow key={t.id} task={t} rollup={rollup[`tasks.${t.id}`]} onOpen={onOpen} />
          ))}
        </div>
      </section>

      {/* Inline badge gallery */}
      {showGallery && (
        <section>
          <SectionEyebrow hint="all three variants share severity rules + click-to-filter">INLINE BADGE · VARIANTS</SectionEyebrow>
          <BadgeGallery onOpen={onOpen} />
        </section>
      )}
    </div>
  );
};

window.FeedbackHost = FeedbackHost;
