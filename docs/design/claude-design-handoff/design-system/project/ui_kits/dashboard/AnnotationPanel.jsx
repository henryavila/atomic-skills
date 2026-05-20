/* global React, window, annotations, HighlightBadge, Btn */
const { useState: useStateAnn } = React;

const AnnotationEntry = ({ a }) => (
  <div style={{
    padding: '12px 14px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex', flexDirection: 'column', gap: 8,
  }}>
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
      lineHeight: 1.4,
    }}>► {a.target.slug}/{a.target.path}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, height: 18, padding: '0 6px',
        borderRadius: 999, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
        color: a.author === 'ai' ? 'var(--status-emerged)' : 'var(--status-active)',
        background: a.author === 'ai' ? 'var(--status-emerged-bg)' : 'var(--status-active-bg)',
        border: `1px solid color-mix(in srgb, ${a.author === 'ai' ? 'var(--status-emerged)' : 'var(--status-active)'} 35%, transparent)`,
      }}>{a.author}</span>
      {a.severity && <HighlightBadge severity={a.severity} count={1} />}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
        whiteSpace: 'nowrap', flex: 'none',
      }}
            title={a.createdAt === '2 hrs ago' ? '2026-05-19T13:42:11Z'
                 : a.createdAt === '1 hr ago'  ? '2026-05-19T14:08:55Z'
                 : '2026-05-19T15:31:20Z'}>{a.createdAt}</span>
    </div>
    <div style={{
      fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)',
      lineHeight: 1.55, borderLeft: '2px solid var(--border-strong)',
      paddingLeft: 10,
    }}>{a.body}</div>
    <div style={{ display: 'flex', gap: 6 }}>
      <button style={{
        height: 22, padding: '0 8px', background: 'transparent',
        color: 'var(--accent-link)', border: '1px solid var(--border-default)',
        borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
      }}>[Resolve]</button>
      <button style={{
        height: 22, padding: '0 8px', background: 'transparent',
        color: 'var(--fg-muted)', border: 'none',
        fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
      }}>[Reply]</button>
    </div>
  </div>
);

const AnnotationPanel = ({ open, onClose }) => {
  const [filter, setFilter] = useStateAnn('all');
  const filtered = annotations.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'resolved') return a.resolved;
    return a.author === filter;
  });

  if (!open) return null;
  return (
    <aside style={{
      width: 360, flex: 'none',
      background: 'var(--bg-canvas)',
      borderLeft: '1px solid var(--border-default)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-default)',
      }}>
        <span className="t-eyebrow" style={{ color: 'var(--fg-default)' }}>Annotations</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>({annotations.length})</span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} aria-label="Close" style={{
          all: 'unset', cursor: 'pointer', color: 'var(--fg-muted)',
          fontFamily: 'var(--font-mono)', fontSize: 16, padding: '0 4px',
        }}>×</button>
      </div>
      <div style={{
        display: 'flex', gap: 4, padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {['all', 'human', 'ai', 'resolved'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            height: 22, padding: '0 10px',
            background: filter === f ? 'var(--bg-elevated)' : 'transparent',
            color: filter === f ? 'var(--fg-default)' : 'var(--fg-muted)',
            border: `1px solid ${filter === f ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
            borderRadius: 999, fontFamily: 'var(--font-sans)', fontSize: 11, cursor: 'pointer',
          }}>{f}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0
          ? <div style={{ padding: 20, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-subtle)' }}>No annotations match this filter.</div>
          : filtered.map(a => <AnnotationEntry key={a.id} a={a} />)}
      </div>
    </aside>
  );
};

window.AnnotationPanel = AnnotationPanel;
