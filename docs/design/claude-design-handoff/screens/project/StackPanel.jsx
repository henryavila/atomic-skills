/* global React, window, Card, SectionHeader */

// ── StackPanel ────────────────────────────────────────────────────────────
// A "where attention currently is" hierarchy. Top of the stack = HERE.
// Each frame is typed: task / validation / investigation / discussion.

const FRAME_KIND = {
  task:          { glyph: '◉', color: 'var(--status-active)',  label: 'task' },
  validation:    { glyph: '✓✓',color: 'var(--verifier-test)',   label: 'validation' },
  investigation: { glyph: '⌬', color: 'var(--status-emerged)', label: 'investigation' },
  discussion:    { glyph: '⌬',  color: 'var(--accent-link)',    label: 'discussion' },
  // Note: discussion uses the same glyph distinct from investigation in
  // color — the type label below the row carries the disambiguation.
};

const StackFrame = ({ frame, isLast, isHere }) => {
  const kind = FRAME_KIND[frame.kind] || FRAME_KIND.task;
  // Indent grows with depth; tree-line drawn explicitly to look like a real
  // stack dump rather than a generic list.
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      position: 'relative',
      paddingLeft: frame.depth * 22,
    }}>
      {/* Tree branch art */}
      {frame.depth > 0 && (
        <span style={{
          position: 'absolute', left: frame.depth * 22 - 16, top: 0, bottom: isLast ? '50%' : 0,
          width: 12,
          borderLeft: '1px solid var(--border-default)',
        }} />
      )}
      {frame.depth > 0 && (
        <span style={{
          position: 'absolute', left: frame.depth * 22 - 16, top: '50%',
          width: 14, height: 1,
          background: 'var(--border-default)',
        }} />
      )}

      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, flex: 'none',
        position: 'relative',
      }}>
        {isHere && (
          <span style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'var(--status-active)', opacity: 0.22,
            animation: 'aideck-pulse 2s ease-out infinite',
          }} />
        )}
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: isHere ? 'var(--status-active)' : kind.color,
          fontWeight: 600,
          position: 'relative',
        }}>{isHere ? '◉' : kind.glyph}</span>
      </span>

      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
        }}>
          {frame.id && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
              color: isHere ? 'var(--status-active)' : kind.color,
            }}>{frame.id}</span>
          )}
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 13,
            color: isHere ? 'var(--fg-default)' : 'var(--fg-muted)',
            fontWeight: isHere ? 500 : 400,
            flex: 1, minWidth: 0, lineHeight: 1.4,
          }}>{frame.title}</span>
          {isHere && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
              color: 'var(--status-active)', letterSpacing: '0.12em',
              padding: '2px 7px', borderRadius: 999,
              background: 'color-mix(in srgb, var(--status-active) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--status-active) 40%, transparent)',
            }}>◉ HERE</span>
          )}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 3,
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--fg-subtle)',
        }}>
          <span style={{ color: kind.color, fontWeight: 500 }}>{kind.label}</span>
          <span style={{ color: 'var(--fg-faint)' }}>·</span>
          <span>opened {frame.openedAt}</span>
        </div>
      </div>
    </div>
  );
};

const StackPanel = ({ stack }) => {
  if (!stack || stack.length === 0) {
    return (
      <Card>
        <SectionHeader>Stack · attention</SectionHeader>
        <div style={{
          padding: '14px 16px',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--fg-subtle)',
        }}>
          (no active stack — nothing in flight)
        </div>
      </Card>
    );
  }

  const maxDepth = Math.max(...stack.map(s => s.depth)) + 1;
  return (
    <Card>
      <SectionHeader action={
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
        }}>
          depth <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{maxDepth}</span>
          {' · '}top is <span style={{ color: 'var(--status-active)', fontWeight: 500 }}>HERE</span>
        </span>
      }>Stack · attention</SectionHeader>
      <div style={{
        padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {stack.map((f, i) => (
          <StackFrame key={i} frame={f}
            isLast={i === stack.length - 1}
            isHere={f.here || i === stack.length - 1} />
        ))}
      </div>
    </Card>
  );
};

window.StackPanel = StackPanel;
