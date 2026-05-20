/* global React, window */

const DemoBanner = ({ visible }) => {
  if (!visible) return null;
  return (
    <div style={{
      background: 'linear-gradient(180deg, color-mix(in srgb, var(--status-blocked) 10%, var(--bg-canvas)), var(--bg-canvas))',
      borderBottom: '1px solid color-mix(in srgb, var(--status-blocked) 25%, var(--border-default))',
      color: 'var(--fg-default)',
      fontFamily: 'var(--font-mono)', fontSize: 11,
      padding: '5px 18px',
      display: 'flex', alignItems: 'center', gap: 10,
      flex: 'none', whiteSpace: 'nowrap', overflow: 'hidden',
      position: 'relative',
    }}>
      <span style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, var(--status-blocked), transparent)',
        opacity: 0.5,
      }} />
      <span style={{
        color: 'var(--status-blocked)', fontWeight: 600,
        letterSpacing: '0.08em', fontSize: 10, flex: 'none',
      }}>⚠ DEMO MODE</span>
      <span style={{ width: 1, height: 10, background: 'var(--border-default)', flex: 'none' }} />
      <span style={{
        color: 'var(--fg-muted)',
        overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
      }}>
        Seeded fixtures, not your data. <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>Ctrl+C</code> to quit.
      </span>
    </div>
  );
};

window.DemoBanner = DemoBanner;
