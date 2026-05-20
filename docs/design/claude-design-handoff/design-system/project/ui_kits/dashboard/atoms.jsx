/* global React, window */
const { useState } = React;

// ── Status vocabulary (source of truth) ─────────────────────────────
const STATUS = {
  done:        { glyph: '✓', color: 'var(--status-done)',        bg: 'var(--status-done-bg)' },
  active:      { glyph: '◉', color: 'var(--status-active)',      bg: 'var(--status-active-bg)' },
  pending:     { glyph: '·', color: 'var(--status-pending)',     bg: 'var(--status-pending-bg)' },
  blocked:     { glyph: '⊘', color: 'var(--status-blocked)',     bg: 'var(--status-blocked-bg)' },
  parked:      { glyph: '⌂', color: 'var(--status-parked)',      bg: 'var(--status-parked-bg)' },
  emerged:     { glyph: '⇥', color: 'var(--status-emerged)',     bg: 'var(--status-emerged-bg)' },
  highlighted: { glyph: '⚑', color: 'var(--status-highlighted)', bg: 'var(--status-highlighted-bg)' },
};

const SEVERITY = {
  info:     { color: 'var(--severity-info)',     bg: 'var(--severity-info-bg)' },
  warn:     { color: 'var(--severity-warn)',     bg: 'var(--severity-warn-bg)' },
  critical: { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
};

const VERIFIER = {
  shell:  { glyph: '$_',  color: 'var(--verifier-shell)' },
  query:  { glyph: 'SQL', color: 'var(--verifier-query)' },
  test:   { glyph: '✓✓',  color: 'var(--verifier-test)' },
  manual: { glyph: '👁',  color: 'var(--verifier-manual)' },
};

// ── Atoms ───────────────────────────────────────────────────────────

const StatusGlyph = ({ status, size = 14 }) => {
  const s = STATUS[status] || STATUS.pending;
  return <span style={{
    fontFamily: 'var(--font-mono)', color: s.color, width: size + 4,
    display: 'inline-flex', justifyContent: 'center', fontSize: size,
    lineHeight: 1,
  }}>{s.glyph}</span>;
};

const StatusChip = ({ status, children }) => {
  const s = STATUS[status] || STATUS.pending;
  return <span className="chip" style={{
    display: 'inline-flex', alignItems: 'center', gap: 4, height: 20,
    padding: '0 8px', borderRadius: 999, fontFamily: 'var(--font-mono)',
    fontSize: 11, fontWeight: 500,
    color: s.color, background: s.bg,
    border: `1px solid color-mix(in srgb, ${s.color} 30%, transparent)`,
    whiteSpace: 'nowrap',
  }}>
    <span style={{ fontSize: 12 }}>{s.glyph}</span>
    {children || status}
  </span>;
};

const TagChip = ({ kind = 'neutral', children }) => {
  const colorMap = {
    neutral: 'var(--fg-subtle)',
    critical: 'var(--severity-critical)',
    legacy: 'var(--status-blocked)',
    uigate: 'var(--status-active)',
    parallel: 'var(--status-emerged)',
  };
  const c = colorMap[kind] || colorMap.neutral;
  return <span style={{
    display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 6px',
    borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
    color: c, background: 'transparent',
    border: `1px solid color-mix(in srgb, ${c} 45%, transparent)`,
    whiteSpace: 'nowrap',
  }}>{children}</span>;
};

const HighlightBadge = ({ severity, count }) => {
  const s = SEVERITY[severity] || SEVERITY.info;
  return <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4, height: 20,
    padding: '0 8px', borderRadius: 999, fontFamily: 'var(--font-mono)',
    fontSize: 11, fontWeight: 600,
    color: s.color, background: s.bg,
    border: `1px solid color-mix(in srgb, ${s.color} 35%, transparent)`,
    whiteSpace: 'nowrap',
  }}>⚑ {count != null ? `${count} ${severity}` : severity}</span>;
};

const VerifierBadge = ({ kind }) => {
  const v = VERIFIER[kind] || VERIFIER.shell;
  return <span style={{
    display: 'inline-flex', alignItems: 'center', minWidth: 38, height: 20,
    padding: '0 7px', borderRadius: 4,
    background: `color-mix(in srgb, ${v.color} 16%, var(--bg-surface))`,
    color: v.color, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
    border: `1px solid color-mix(in srgb, ${v.color} 35%, transparent)`,
    gap: 4, whiteSpace: 'nowrap',
  }}>{v.glyph} {kind}</span>;
};

const Btn = ({ variant = 'secondary', size = 'md', children, onClick, style, ...rest }) => {
  const h = size === 'sm' ? 24 : 32;
  const fs = size === 'sm' ? 12 : 13;
  const base = {
    height: h, padding: size === 'sm' ? '0 10px' : '0 14px',
    fontFamily: 'var(--font-sans)', fontSize: fs, fontWeight: 500,
    borderRadius: 6, cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', gap: 6, transition: 'background 120ms, border-color 120ms',
    whiteSpace: 'nowrap', flex: 'none',
  };
  const variants = {
    primary: {
      background: 'linear-gradient(180deg, color-mix(in srgb, var(--status-active) 100%, white 5%), var(--status-active))',
      color: 'var(--fg-on-accent)', border: 'none', fontWeight: 600,
      boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 1px 2px rgba(0,0,0,0.3), 0 0 0 1px color-mix(in srgb, var(--status-active) 60%, transparent)',
    },
    secondary: {
      background: 'var(--bg-elevated)', color: 'var(--fg-default)',
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-ambient)',
    },
    ghost: {
      background: 'transparent', color: 'var(--fg-muted)',
      border: '1px solid var(--border-subtle)',
    },
    tertiary: {
      background: 'transparent', color: 'var(--fg-muted)', border: 'none',
    },
    destructive: {
      background: 'transparent', color: 'var(--severity-critical)',
      border: '1px solid color-mix(in srgb, var(--severity-critical) 40%, transparent)',
    },
  };
  return <button onClick={onClick} style={{ ...base, ...variants[variant], ...style }} {...rest}>{children}</button>;
};

const IconBtn = ({ children, label, onClick, badge, badgeColor }) => (
  <button onClick={onClick} aria-label={label} style={{
    height: 26, minWidth: 26, padding: badge ? '0 8px' : 0,
    background: 'var(--bg-elevated)', color: 'var(--fg-muted)',
    border: '1px solid var(--border-default)', borderRadius: 4,
    fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center',
  }}>
    {children}
    {badge != null && <span style={{ color: badgeColor || 'var(--status-highlighted)' }}>{badge}</span>}
  </button>
);

const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
    borderRadius: 10, boxShadow: 'var(--shadow-ambient)',
    overflow: 'hidden',
    ...style,
  }}>{children}</div>
);

const SectionHeader = ({ children, count, action }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
    background: 'color-mix(in srgb, var(--bg-elevated) 60%, transparent)',
  }}>
    <span className="t-eyebrow" style={{ color: 'var(--fg-muted)' }}>{children}</span>
    {count != null && <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
      padding: '1px 6px', borderRadius: 999,
      background: 'var(--bg-canvas)',
      border: '1px solid var(--border-subtle)',
    }}>{count}</span>}
    <div style={{ flex: 1 }} />
    {action}
  </div>
);

const Kbd = ({ children }) => (
  <span style={{
    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
    padding: '1px 5px', background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)', borderRadius: 3,
    color: 'var(--fg-muted)',
  }}>{children}</span>
);

const LocalhostPill = () => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 7,
    height: 24, padding: '0 9px', borderRadius: 4,
    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
    color: 'var(--status-done)',
    border: '1px solid color-mix(in srgb, var(--status-done) 30%, transparent)',
    background: 'color-mix(in srgb, var(--status-done) 6%, transparent)',
    boxShadow: 'var(--shadow-ambient)',
  }}>
    <span style={{ position: 'relative', width: 7, height: 7, flex: 'none' }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--status-done)',
        boxShadow: '0 0 8px color-mix(in srgb, var(--status-done) 70%, transparent)',
      }} />
      <span style={{
        position: 'absolute', inset: -3, borderRadius: '50%',
        background: 'color-mix(in srgb, var(--status-done) 40%, transparent)',
        animation: 'aideck-pulse 2.4s ease-out infinite',
      }} />
    </span>
    127.0.0.1:7777
  </span>
);

const Wordmark = ({ size = 16 }) => (
  <span style={{
    fontFamily: 'var(--font-sans)', fontSize: size, fontWeight: 600,
    letterSpacing: '-0.025em', color: 'var(--fg-default)',
    display: 'inline-flex', alignItems: 'center', gap: 7,
  }}>
    aiDeck
    <span style={{
      position: 'relative', width: size * 0.38, height: size * 0.38,
      background: 'var(--status-active)', flex: 'none',
      boxShadow: '0 0 12px color-mix(in srgb, var(--status-active) 70%, transparent)',
    }} />
  </span>
);

Object.assign(window, {
  STATUS, SEVERITY, VERIFIER,
  StatusGlyph, StatusChip, TagChip, HighlightBadge, VerifierBadge,
  Btn, IconBtn, Card, SectionHeader, Kbd, LocalhostPill, Wordmark,
});
