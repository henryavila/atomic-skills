/* global React, window, StatusGlyph, VerifierBadge, Card, SectionHeader, Btn, AnnotationBadge */

const { useState: useStateGate } = React;

// ── ExitGateRow ───────────────────────────────────────────────────────────
const ExitGateRow = ({ gate, isLast, onRequestRun, onOpenAnnotation, requested }) => {
  const [expanded, setExpanded] = useStateGate(false);
  const met = gate.status === 'met';
  const deferred = gate.status === 'deferred';
  const lr = gate.lastRun;

  // Visual state for the gate row body itself
  const statusColor =
    met      ? 'var(--status-done)'    :
    deferred ? 'var(--status-parked)'  :
               'var(--status-pending)';

  return (
    <div style={{
      borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
      }}>
        <StatusGlyph status={met ? 'done' : deferred ? 'parked' : 'pending'} size={13} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
          color: statusColor, width: 64, flex: 'none',
        }}>{gate.id}</span>

        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--fg-default)',
          flex: 1, minWidth: 0, lineHeight: 1.4,
        }}>{gate.description}</span>

        {gate.annotations > 0 && (
          <AnnotationBadge count={gate.annotations}
            onClick={() => onOpenAnnotation && onOpenAnnotation(gate.id)} />
        )}

        <VerifierBadge kind={gate.verifier.kind} />

        {!met && !deferred && (
          requested ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
              color: 'var(--status-emerged)', letterSpacing: '0.05em',
              padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
              background: 'color-mix(in srgb, var(--status-emerged) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--status-emerged) 35%, transparent)',
            }}>
              <span style={{ fontSize: 11 }}>⇥</span>
              queued · intent written
            </span>
          ) : (
            <button onClick={() => onRequestRun(gate)} style={{
              all: 'unset', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 24, padding: '0 9px',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--accent-link)',
              background: 'var(--bg-canvas)',
              border: '1px solid color-mix(in srgb, var(--accent-link) 35%, transparent)',
              borderRadius: 4, whiteSpace: 'nowrap',
              transition: 'background 120ms, border-color 120ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-link) 10%, transparent)';
              e.currentTarget.style.borderColor = 'var(--accent-link)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-canvas)';
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-link) 35%, transparent)';
            }}>
              <span>▷</span>
              request run
            </button>
          )
        )}

        <button onClick={() => setExpanded(v => !v)} style={{
          all: 'unset', cursor: 'pointer',
          color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)',
          fontSize: 13, padding: '0 4px', width: 18,
          textAlign: 'center',
        }}>{expanded ? '▾' : '▸'}</button>
      </div>

      {/* Last-run / evidence / reason summary line */}
      {(lr || gate.evidence || gate.deferredReason) && (
        <div style={{
          padding: '0 14px 8px 86px',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--fg-subtle)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          {lr && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '1px 7px', borderRadius: 3, whiteSpace: 'nowrap',
              background: lr.status === 'pass'
                ? 'color-mix(in srgb, var(--status-done) 10%, transparent)'
                : 'color-mix(in srgb, var(--severity-warn) 10%, transparent)',
              border: `1px solid ${lr.status === 'pass'
                ? 'color-mix(in srgb, var(--status-done) 25%, transparent)'
                : 'color-mix(in srgb, var(--severity-warn) 30%, transparent)'}`,
              color: lr.status === 'pass' ? 'var(--status-done)' : 'var(--severity-warn)',
            }}>
              {lr.status === 'pass' ? '✓' : '✗'} last run · exit {lr.exit} · {lr.when}
            </span>
          )}
          {lr && lr.output && (
            <span style={{ color: 'var(--fg-muted)' }}>
              → <span style={{ color: 'var(--fg-default)' }}>{lr.output}</span>
            </span>
          )}
          {met && gate.evidence && (
            <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--fg-muted)' }}>
              evidence: <span style={{ color: 'var(--fg-default)' }}>{gate.evidence}</span>
            </span>
          )}
          {deferred && gate.deferredReason && (
            <span style={{
              fontFamily: 'var(--font-sans)', color: 'var(--fg-muted)',
              flex: 1, minWidth: 0, lineHeight: 1.5,
            }}>
              <span style={{ color: 'var(--status-parked)', fontFamily: 'var(--font-mono)' }}>⌂ deferred:</span>
              {' '}{gate.deferredReason}
            </span>
          )}
        </div>
      )}

      {/* Expanded: full verifier command */}
      {expanded && (
        <div style={{
          margin: '0 14px 12px 86px',
          padding: 12,
          background: 'var(--bg-sunken)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
            color: 'var(--fg-subtle)', letterSpacing: '0.08em',
          }}>
            <span>VERIFIER · {gate.verifier.kind.toUpperCase()}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: 'var(--fg-default)',
            padding: '8px 10px',
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 4,
            lineHeight: 1.5,
            wordBreak: 'break-all',
          }}>
            <span style={{ color: 'var(--fg-faint)', marginRight: 6, userSelect: 'none' }}>$</span>
            {gate.verifier.command}
          </div>
          {!met && !deferred && (
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 11.5,
              color: 'var(--fg-subtle)', lineHeight: 1.5,
            }}>
              "Request run" records an intent in <code style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 4px',
                background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)',
                borderRadius: 3, color: 'var(--fg-default)',
              }}>.atomic-skills/inbox/</code> — the consumer skill executes it and writes the result back. aiDeck never runs shell directly.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── ExitGatesCard ─────────────────────────────────────────────────────────
const ExitGatesCard = ({ gates, onOpenAnnotation }) => {
  const [requested, setRequested] = useStateGate({});
  const onRequestRun = (g) => {
    setRequested(s => ({ ...s, [g.id]: true }));
    setTimeout(() => setRequested(s => { const n = { ...s }; delete n[g.id]; return n; }), 3600);
  };

  const met      = gates.filter(g => g.status === 'met').length;
  const deferred = gates.filter(g => g.status === 'deferred').length;
  const pending  = gates.length - met - deferred;
  const allMet = met === gates.length;

  return (
    <Card>
      <SectionHeader count={gates.length} action={
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-mono)', fontSize: 11,
        }}>
          <span style={{ color: allMet ? 'var(--status-done)' : 'var(--status-blocked)', fontWeight: 500 }}>
            {met}<span style={{ color: 'var(--fg-subtle)' }}>/{gates.length}</span> met
          </span>
          {pending > 0 && (
            <React.Fragment>
              <span style={{ width: 1, height: 10, background: 'var(--border-default)' }} />
              <span style={{ color: 'var(--fg-muted)' }}>
                {pending} pending
              </span>
            </React.Fragment>
          )}
          {deferred > 0 && (
            <React.Fragment>
              <span style={{ width: 1, height: 10, background: 'var(--border-default)' }} />
              <span style={{ color: 'var(--status-parked)' }}>
                {deferred} deferred
              </span>
            </React.Fragment>
          )}
        </span>
      }>Exit gates</SectionHeader>
      {gates.map((g, idx) => (
        <ExitGateRow key={g.id} gate={g} isLast={idx === gates.length - 1}
          requested={!!requested[g.id]}
          onRequestRun={onRequestRun}
          onOpenAnnotation={onOpenAnnotation} />
      ))}
    </Card>
  );
};

window.ExitGatesCard = ExitGatesCard;
