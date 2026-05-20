/* global React, window */

// ── References modal ──────────────────────────────────────────────────────
// Lists all cross-doc refs the plan depends on. Three visual states:
//   in-project · external · gitignored

const REF_STATE_META = {
  'in-project': {
    label: 'in project',
    color: 'var(--fg-muted)',
    glyph: '·',
    title: 'Present in this repo',
  },
  'external': {
    label: 'external',
    color: 'var(--accent-link)',
    glyph: '↗',
    title: 'Path outside this repo — depends on developer machine',
  },
  'gitignored': {
    label: 'gitignored',
    color: 'var(--status-blocked)',
    glyph: '⊘',
    title: 'Present in working copy, not committed (PII, dumps, creds)',
  },
};

const REF_KIND_META = {
  prd:      { label: 'PRD',      tint: 'var(--accent-link)' },
  runbook:  { label: 'runbook',  tint: 'var(--status-active)' },
  adr:      { label: 'ADR',      tint: 'var(--status-emerged)' },
  spec:     { label: 'spec',     tint: 'var(--fg-muted)' },
  fixture:  { label: 'fixture',  tint: 'var(--fg-subtle)' },
  schema:   { label: 'schema',   tint: 'var(--status-active)' },
  doc:      { label: 'doc',      tint: 'var(--fg-muted)' },
  repo:     { label: 'repo',     tint: 'var(--status-emerged)' },
  dump:     { label: 'dump',     tint: 'var(--status-blocked)' },
  note:     { label: 'note',     tint: 'var(--fg-muted)' },
  cred:     { label: 'cred',     tint: 'var(--severity-critical)' },
  log:      { label: 'log',      tint: 'var(--fg-subtle)' },
  snapshot: { label: 'snapshot', tint: 'var(--status-parked)' },
};

const RefRow = ({ r }) => {
  const state = REF_STATE_META[r.state];
  const kind = REF_KIND_META[r.kind] || REF_KIND_META.doc;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '78px 88px 1fr auto',
      alignItems: 'center', gap: 12,
      padding: '7px 14px',
      borderBottom: '1px solid var(--border-subtle)',
      fontFamily: 'var(--font-mono)', fontSize: 12,
    }}>
      <span style={{
        color: kind.tint,
        textTransform: 'lowercase',
        letterSpacing: '0.04em',
        fontSize: 10, fontWeight: 600,
      }}>{kind.label}</span>

      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 18, padding: '0 7px',
        color: state.color,
        background: `color-mix(in srgb, ${state.color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${state.color} 30%, transparent)`,
        borderRadius: 999,
        fontSize: 10, fontWeight: 500,
        whiteSpace: 'nowrap',
        justifySelf: 'start',
      }} title={state.title}>
        <span style={{ fontSize: 10 }}>{state.glyph}</span>
        {state.label}
      </span>

      <span style={{
        color: 'var(--fg-default)',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }} title={r.path}>
        {r.path}
        {r.section && <span style={{ color: 'var(--fg-subtle)' }}>{' '}· {r.section}</span>}
      </span>

      <button style={{
        all: 'unset', cursor: 'pointer',
        color: 'var(--fg-subtle)', fontSize: 11, padding: '2px 6px',
      }} aria-label="Open">→</button>
    </div>
  );
};

const ReferencesModal = ({ open, refs, onClose }) => {
  if (!open) return null;
  const [filter, setFilter] = React.useState('all');

  // Count by state
  const counts = React.useMemo(() => {
    const c = { 'in-project': 0, 'external': 0, 'gitignored': 0 };
    refs.forEach(r => { c[r.state] = (c[r.state] || 0) + 1; });
    return c;
  }, [refs]);

  const filtered = filter === 'all' ? refs : refs.filter(r => r.state === filter);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'color-mix(in srgb, var(--bg-sunken) 80%, transparent)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 72,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(880px, calc(100vw - 48px))',
        maxHeight: 'calc(100vh - 120px)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-canvas)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span className="t-eyebrow" style={{ color: 'var(--fg-default)' }}>References</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
            padding: '2px 8px', borderRadius: 999,
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          }}>{refs.length}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Close" style={{
            all: 'unset', cursor: 'pointer', color: 'var(--fg-muted)',
            fontFamily: 'var(--font-mono)', fontSize: 18, padding: '0 4px',
          }}>×</button>
        </div>

        {/* Filter strip */}
        <div style={{
          display: 'flex', gap: 6, padding: '12px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}>
          {[
            { id: 'all',         label: 'all',         count: refs.length, color: 'var(--fg-default)' },
            { id: 'in-project',  label: 'in project',  count: counts['in-project'],  color: REF_STATE_META['in-project'].color },
            { id: 'external',    label: 'external',    count: counts['external'],    color: REF_STATE_META['external'].color },
            { id: 'gitignored',  label: 'gitignored',  count: counts['gitignored'],  color: REF_STATE_META['gitignored'].color },
          ].map(f => {
            const isActive = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                all: 'unset', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 26, padding: '0 12px',
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
                color: isActive ? f.color : 'var(--fg-muted)',
                border: `1px solid ${isActive ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
                borderRadius: 999,
                fontFamily: 'var(--font-sans)', fontSize: 12,
                whiteSpace: 'nowrap',
              }}>
                {f.label}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: isActive ? f.color : 'var(--fg-subtle)',
                }}>{f.count}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: 36, textAlign: 'center',
              fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-subtle)',
            }}>(empty)</div>
          ) : filtered.map((r, i) => <RefRow key={i} r={r} />)}
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap',
          padding: '10px 18px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          fontFamily: 'var(--font-mono)', fontSize: 10,
        }}>
          {Object.entries(REF_STATE_META).map(([k, m]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--fg-subtle)' }}>
              <span style={{ color: m.color, fontSize: 11 }}>{m.glyph}</span>
              <span>{m.label}</span>
              <span style={{ color: 'var(--fg-faint)' }}>· {m.title}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

window.ReferencesModal = ReferencesModal;
window.REF_STATE_META = REF_STATE_META;
window.REF_KIND_META = REF_KIND_META;
