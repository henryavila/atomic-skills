/* global React, window, Wordmark, LocalhostPill, IconBtn, Kbd */

/* ─────────────────────────────────────────────────────────────────────
   LayoutShell
   ─────────────────────────────────────────────────────────────────────
   The persistent chrome that wraps every aiDeck screen. Briefing 1
   establishes its skeleton so subsequent screens slot in cleanly.

   Slots, top-to-bottom:
     • DemoBanner (optional) — non-dismissible, present on every screen
       while demo mode is on. Lives ABOVE the chrome so it can never be
       cropped by a scrolling main region.
     • TopChrome (52px fixed)
         ◦ Wordmark (links to /)
         ◦ Breadcrumb (hidden on /)
         ◦ Command palette (⌘K)
         ◦ Localhost trust pill (127.0.0.1:7777)
         ◦ Help · Highlights · Menu
     • Skip-to-content link (visually hidden until focused)
     • <main id="content"> — the per-screen content area
     • Right-side drawer slot — zero width when closed (brief constraint)
   ───────────────────────────────────────────────────────────────────── */

const SkipLink = () => (
  <a href="#content" style={{
    position: 'absolute', top: -40, left: 12, zIndex: 1000,
    padding: '8px 14px',
    background: 'var(--bg-elevated)', color: 'var(--fg-default)',
    border: '1px solid var(--accent-focus)',
    borderRadius: 6,
    fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
    textDecoration: 'none',
    transition: 'top 120ms var(--ease-out)',
  }}
  onFocus={(e) => { e.currentTarget.style.top = '8px'; }}
  onBlur={(e)  => { e.currentTarget.style.top = '-40px'; }}>
    Skip to content
  </a>
);

const Breadcrumb = ({ segments, onNav }) => {
  if (!segments || segments.length === 0) return null;
  return (
    <nav aria-label="breadcrumb" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontFamily: 'var(--font-mono)', fontSize: 12,
      whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0,
    }}>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: 'var(--fg-faint)', flex: 'none', fontSize: 10 }}>▸</span>}
            {isLast
              ? <span style={{ color: 'var(--fg-default)', flex: 'none', fontWeight: 500 }}>{seg.label}</span>
              : <a href={`#${seg.to}`} onClick={(e) => { e.preventDefault(); onNav && onNav(seg.to); }}
                   style={{ color: 'var(--accent-link)', textDecoration: 'none', flex: 'none' }}>{seg.label}</a>}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

const CommandPaletteButton = () => (
  <button title="Command palette (⌘K)" style={{
    all: 'unset', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 8,
    height: 28, padding: '0 8px 0 12px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    borderRadius: 6,
    fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)',
    transition: 'background 120ms, border-color 120ms',
  }}
  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border-bright)'; }}
  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}>
    <span style={{ color: 'var(--fg-subtle)' }}>Jump to plan, initiative…</span>
    <Kbd>⌘K</Kbd>
  </button>
);

const TopChrome = ({ breadcrumb, highlights, annotationsUnread, demo, route, onNav, onToggleHighlights, onToggleHelp, onToggleMenu }) => {
  const onHome = route && route.name === 'home';
  return (
    <header role="banner" style={{
      display: 'flex', alignItems: 'center', gap: 14, height: 52,
      padding: '0 18px',
      background: 'var(--bg-canvas)',
      borderBottom: '1px solid var(--border-default)',
      boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.025)',
      flex: 'none', position: 'relative', zIndex: 10,
    }}>
      <a href="#/" onClick={(e) => { e.preventDefault(); onNav && onNav('/'); }}
         style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', flex: 'none' }}
         aria-label="aiDeck home">
        <Wordmark size={18} />
      </a>

      {!onHome && <React.Fragment>
        <span style={{ width: 1, height: 20, background: 'var(--border-default)', flex: 'none' }} />
        <Breadcrumb segments={breadcrumb} onNav={onNav} />
      </React.Fragment>}

      <div style={{ flex: 1 }} />

      <CommandPaletteButton />

      <LocalhostPill />

      <div style={{ display: 'flex', gap: 4 }}>
        <IconBtn label="Help — skills directory" onClick={onToggleHelp}>?</IconBtn>
        <IconBtn label={`Highlights (${highlights.total} open)`}
                 onClick={onToggleHighlights}
                 badge={highlights.total > 0 ? highlights.total : null}
                 badgeColor={highlights.critical > 0 ? 'var(--severity-critical)' : 'var(--status-highlighted)'}>⚑</IconBtn>
        <IconBtn label={demo ? 'Menu (demo mode)' : 'Menu'} onClick={onToggleMenu}>
          {demo ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, background: 'var(--status-blocked)', borderRadius: 999, flex: 'none', boxShadow: '0 0 6px color-mix(in srgb, var(--status-blocked) 70%, transparent)' }} />
            ≡
          </span> : '≡'}
        </IconBtn>
      </div>
    </header>
  );
};

const OverflowMenu = ({ open, onClose, demo, version, onNav }) => {
  if (!open) return null;
  return (
    <React.Fragment>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 30, background: 'transparent',
      }} />
      <div role="menu" aria-label="Application menu" style={{
        position: 'absolute', top: 56, right: 18, zIndex: 40,
        width: 240,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        boxShadow: 'var(--shadow-md)',
        padding: 6,
        fontFamily: 'var(--font-sans)', fontSize: 13,
      }}>
        <div style={{ padding: '6px 10px 8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>aiDeck {version}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-faint)', marginTop: 2 }}>localhost · MIT · zero telemetry</div>
        </div>
        {[
          { label: 'Skills directory', to: '/help', kbd: 'g h' },
          { label: 'Highlights drawer', to: '__highlights', kbd: '⌘⇧H' },
          { label: 'Command palette', to: '__palette', kbd: '⌘K' },
        ].map((m) => (
          <button key={m.label} role="menuitem"
            onClick={() => { onClose(); if (m.to.startsWith('/')) onNav && onNav(m.to); }}
            style={{
              all: 'unset', cursor: 'pointer',
              display: 'flex', alignItems: 'center', width: '100%',
              padding: '7px 10px', borderRadius: 5,
              color: 'var(--fg-default)',
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-overlay)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <span style={{ flex: 1 }}>{m.label}</span>
            <Kbd>{m.kbd}</Kbd>
          </button>
        ))}
        {demo && (
          <div style={{
            margin: '6px 0 2px', padding: '8px 10px',
            background: 'color-mix(in srgb, var(--status-blocked) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--status-blocked) 25%, transparent)',
            borderRadius: 5,
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ color: 'var(--status-blocked)' }}>⚠</span>
            <span>Demo mode — quit with Ctrl+C</span>
          </div>
        )}
      </div>
    </React.Fragment>
  );
};

// LayoutShell — wraps demo banner, top chrome, main + drawer slot
const LayoutShell = ({
  demo,
  route,
  breadcrumb,
  highlights,
  annotationsUnread,
  drawerOpen,
  drawerSlot,
  onNav,
  onToggleHighlights,
  onToggleHelp,
  version,
  children,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  return (
    <React.Fragment>
      <SkipLink />
      {demo && <window.DemoBanner visible={true} />}
      <TopChrome
        breadcrumb={breadcrumb}
        highlights={highlights}
        annotationsUnread={annotationsUnread}
        demo={demo}
        route={route}
        onNav={onNav}
        onToggleHighlights={onToggleHighlights}
        onToggleHelp={onToggleHelp}
        onToggleMenu={() => setMenuOpen(o => !o)}
      />
      <OverflowMenu open={menuOpen} onClose={() => setMenuOpen(false)} demo={demo} version={version} onNav={onNav} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        <main id="content" tabIndex={-1} style={{
          flex: 1, overflowY: 'auto',
          background: 'var(--bg-canvas)',
        }}>
          {children}
        </main>
        {/* Drawer slot — zero width when closed (per brief: no permanent sliver) */}
        {drawerOpen && drawerSlot}
      </div>
    </React.Fragment>
  );
};

Object.assign(window, { LayoutShell, TopChrome, SkipLink, Breadcrumb, OverflowMenu });
