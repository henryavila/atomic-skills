/* global React, window, Wordmark, LocalhostPill, IconBtn */

const TopChrome = ({ route, breadcrumb, highlightsCount, demo, onNav, onToggleHighlights, onToggleHelp }) => (
  <header style={{
    display: 'flex', alignItems: 'center', gap: 14, height: 52,
    padding: '0 18px',
    background: 'var(--bg-canvas)',
    borderBottom: '1px solid var(--border-default)',
    boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.025)',
    flex: 'none', position: 'relative', zIndex: 10,
  }}>
    <a href="#/" onClick={(e) => { e.preventDefault(); onNav('/'); }}
       style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', flex: 'none' }}>
      <Wordmark size={18} />
    </a>

    {/* divider */}
    <span style={{ width: 1, height: 20, background: 'var(--border-default)', flex: 'none' }} />

    {/* Breadcrumb */}
    <nav aria-label="breadcrumb" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontFamily: 'var(--font-mono)', fontSize: 12,
      whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0,
    }}>
      {breadcrumb.map((seg, i) => {
        const isLast = i === breadcrumb.length - 1;
        return <React.Fragment key={i}>
          {i > 0 && <span style={{ color: 'var(--fg-faint)', flex: 'none', fontSize: 10 }}>▸</span>}
          {isLast
            ? <span style={{ color: 'var(--fg-default)', flex: 'none', fontWeight: 500 }}>{seg.label}</span>
            : <a href={`#${seg.to}`} onClick={(e) => { e.preventDefault(); onNav(seg.to); }}
                 style={{ color: 'var(--accent-link)', textDecoration: 'none', flex: 'none' }}>{seg.label}</a>}
        </React.Fragment>;
      })}
    </nav>

    <div style={{ flex: 1 }} />

    {/* Command palette hint */}
    <button title="Command palette" style={{
      all: 'unset', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 8,
      height: 28, padding: '0 10px 0 12px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 6,
      fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)',
      transition: 'background 120ms, border-color 120ms',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border-bright)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}>
      <span style={{ color: 'var(--fg-subtle)' }}>Search</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
        padding: '2px 5px', background: 'var(--bg-sunken)',
        border: '1px solid var(--border-default)', borderRadius: 3,
        color: 'var(--fg-muted)', lineHeight: 1,
      }}>⌘K</span>
    </button>

    <LocalhostPill />

    <div style={{ display: 'flex', gap: 4 }}>
      <IconBtn label="Help" onClick={() => onNav('/help')}>?</IconBtn>
      <IconBtn label="Highlights" onClick={onToggleHighlights}
        badge={highlightsCount > 0 ? highlightsCount : null}>⚑</IconBtn>
      <IconBtn label="Menu">≡</IconBtn>
    </div>
  </header>
);

window.TopChrome = TopChrome;
