/* global React, window, StatusGlyph, StatusChip, HighlightBadge, TagChip, Btn, IconBtn, Card, Kbd */

/* ─────────────────────────────────────────────────────────────────────
   HomeView
   ─────────────────────────────────────────────────────────────────────
   The entry hub after `aideck serve` / `aideck demo`. Surfaces:
     • which consumers are detected and their health
     • for each consumer, plans + standalone initiatives
     • pending bidirectional traffic
     • setup guidance when zero consumers detected (cold-start)
     • parse-failure surface when a consumer is errored

   Layout strategy: each consumer is a band. Inside the band, plans
   render as wider summary cards (header content), and standalone
   initiatives compact below in a denser strip. Errored consumers
   replace their content with an inline error block, but the band
   itself still occupies its slot so the rest of the page reads.
   ───────────────────────────────────────────────────────────────────── */

const { useState: useStateHome } = React;

// ── small utilities ──────────────────────────────────────────────────

const Dot = ({ color }) => (
  <span style={{
    width: 7, height: 7, borderRadius: 999, background: color, flex: 'none',
    boxShadow: `0 0 6px color-mix(in srgb, ${color} 70%, transparent)`,
  }} />
);

const PulseDot = ({ color }) => (
  <span style={{ position: 'relative', width: 7, height: 7, flex: 'none' }}>
    <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, boxShadow: `0 0 8px color-mix(in srgb, ${color} 70%, transparent)` }} />
    <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', background: `color-mix(in srgb, ${color} 40%, transparent)`, animation: 'aideck-pulse 2.4s ease-out infinite' }} />
  </span>
);

const HealthBadge = ({ health }) => {
  const map = {
    active:  { label: 'active',  color: 'var(--status-done)',    pulse: true  },
    empty:   { label: 'no data', color: 'var(--fg-subtle)',      pulse: false },
    errored: { label: 'errored', color: 'var(--severity-critical)', pulse: false },
    idle:    { label: 'idle',    color: 'var(--fg-muted)',       pulse: false },
  };
  const s = map[health] || map.idle;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 20, padding: '0 9px 0 8px', borderRadius: 999,
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
      letterSpacing: '0.06em',
      color: s.color,
      background: `color-mix(in srgb, ${s.color} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${s.color} 28%, transparent)`,
    }}>
      {s.pulse ? <PulseDot color={s.color} /> : <Dot color={s.color} />}
      {s.label}
    </span>
  );
};

// Tiny inline progress bar (used in plan summary)
const MiniProgress = ({ done, total, active = false }) => {
  const pendingCount = Math.max(0, total - done - (active ? 1 : 0));
  return (
    <div style={{ display: 'flex', height: 3, gap: 1, borderRadius: 2, overflow: 'hidden', minWidth: 80 }}>
      {done > 0 && <div style={{ flex: done, background: 'var(--status-done)', opacity: 0.9 }} />}
      {active && <div style={{ flex: 1, background: 'var(--status-active)', boxShadow: '0 0 8px color-mix(in srgb, var(--status-active) 70%, transparent)' }} />}
      {pendingCount > 0 && <div style={{ flex: pendingCount, background: 'var(--border-default)' }} />}
    </div>
  );
};

// Phase pip-strip (compact phase summary)
const PhasePips = ({ phases }) => {
  const pips = [];
  for (let i = 0; i < phases.done;    i++) pips.push({ k: 'd', i });
  for (let i = 0; i < phases.active;  i++) pips.push({ k: 'a', i });
  for (let i = 0; i < phases.pending; i++) pips.push({ k: 'p', i });
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }} aria-label={`${phases.done} done · ${phases.active} active · ${phases.pending} pending`}>
      {pips.map((p, idx) => {
        const color = p.k === 'd' ? 'var(--status-done)'
                    : p.k === 'a' ? 'var(--status-active)'
                    :              'color-mix(in srgb, var(--fg-faint) 70%, transparent)';
        const isActive = p.k === 'a';
        return (
          <span key={idx} style={{
            display: 'inline-block', width: isActive ? 14 : 8, height: 4,
            background: color, borderRadius: 1,
            boxShadow: isActive ? '0 0 6px color-mix(in srgb, var(--status-active) 80%, transparent)' : 'none',
          }} />
        );
      })}
    </div>
  );
};

// ── Plan summary ─────────────────────────────────────────────────────

const PlanRow = ({ plan, onOpen }) => {
  const isActive = plan.status === 'active';
  const isBlocked = plan.status === 'blocked';
  return (
    <button onClick={() => onOpen(`/plans/${plan.slug}`)} style={{
      all: 'unset', cursor: 'pointer',
      display: 'block', width: '100%',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderLeft: `3px solid ${isActive ? 'var(--status-active)' : isBlocked ? 'var(--status-blocked)' : 'var(--border-default)'}`,
      borderRadius: 8,
      padding: '12px 14px',
      boxShadow: 'var(--shadow-ambient)',
      transition: 'background 120ms, border-color 120ms, transform 120ms',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.borderLeftColor = isActive ? 'var(--status-active)' : isBlocked ? 'var(--status-blocked)' : 'var(--border-bright)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.borderLeftColor = isActive ? 'var(--status-active)' : isBlocked ? 'var(--status-blocked)' : 'var(--border-default)'; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* slug / path */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)', letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}>/plans/{plan.slug}</span>
            <span style={{ color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>·</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{plan.version}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{
              margin: 0,
              fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 600,
              color: 'var(--fg-default)', letterSpacing: '-0.015em', textWrap: 'pretty',
            }}>{plan.title}</h3>
          </div>
        </div>

        {/* right rail: status + highlights */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
          {plan.criticalHighlights > 0 && <HighlightBadge severity="critical" count={plan.criticalHighlights} />}
          {plan.openHighlights - (plan.criticalHighlights || 0) > 0 && (
            <HighlightBadge severity="warn" count={plan.openHighlights - (plan.criticalHighlights || 0)} />
          )}
          <StatusChip status={plan.status === 'blocked' ? 'blocked' : plan.status === 'done' ? 'done' : 'active'} />
        </div>
      </div>

      {/* meta strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0, marginTop: 12,
        fontFamily: 'var(--font-mono)', fontSize: 11,
      }}>
        {[
          { label: 'current', value: plan.currentPhase, color: 'var(--status-active)' },
          { label: 'tasks',   value: <span><span style={{ color: 'var(--fg-default)' }}>{plan.tasks.done}</span><span style={{ color: 'var(--fg-subtle)' }}>/{plan.tasks.total}</span></span> },
          { label: 'phases',  value: <PhasePips phases={plan.phases} /> },
          { label: 'branch',  value: plan.branch, color: 'var(--fg-default)' },
        ].map((m, i, arr) => (
          <React.Fragment key={i}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', whiteSpace: 'nowrap', flex: 'none' }}>
              <span style={{ color: 'var(--fg-subtle)' }}>{m.label}</span>
              <span style={{ color: m.color || 'var(--fg-default)', fontWeight: 500 }}>{m.value}</span>
            </span>
            {i < arr.length - 1 && <span style={{ width: 1, height: 12, background: 'var(--border-default)', flex: 'none' }} />}
          </React.Fragment>
        ))}
        <div style={{ flex: 1 }} />
        {plan.unreadAnnotations > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 8px', borderRadius: 999,
            color: 'var(--status-emerged)',
            background: 'var(--status-emerged-bg)',
            border: '1px solid color-mix(in srgb, var(--status-emerged) 30%, transparent)',
            fontSize: 11, fontWeight: 500,
          }}>
            ◗ {plan.unreadAnnotations} unread
          </span>
        )}
      </div>

      {/* progress + next */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <MiniProgress done={plan.tasks.done} total={plan.tasks.total} active={isActive} />
        </div>
        {plan.next && (
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: '60%', flex: 'none',
          }}>
            Next: <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{plan.next}</span>
          </div>
        )}
      </div>
    </button>
  );
};

// ── Standalone initiative pill ───────────────────────────────────────

const InitiativeRow = ({ i, onOpen }) => {
  const isDone = i.status === 'done';
  return (
    <button onClick={() => onOpen(`/initiatives/${i.slug}`)} style={{
      all: 'unset', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 12px',
      background: 'transparent',
      border: '1px solid var(--border-subtle)',
      borderRadius: 6,
      fontFamily: 'var(--font-sans)', fontSize: 13,
      transition: 'background 120ms, border-color 120ms',
      opacity: isDone ? 0.6 : 1,
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
      <StatusGlyph status={i.status} size={12} />
      <span style={{ color: 'var(--fg-default)', fontWeight: 500, flex: 'none' }}>{i.title}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
        {i.tasks.done}<span style={{ color: 'var(--fg-faint)' }}>/{i.tasks.total}</span>
      </span>
      <div style={{ flex: 1 }} />
      {i.next && (
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg-muted)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280,
        }}>{i.next}</span>
      )}
      {i.unreadAnnotations > 0 && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
          color: 'var(--status-emerged)', padding: '1px 6px', borderRadius: 999,
          background: 'var(--status-emerged-bg)',
          border: '1px solid color-mix(in srgb, var(--status-emerged) 30%, transparent)',
          whiteSpace: 'nowrap',
        }}>◗ {i.unreadAnnotations}</span>
      )}
      {i.openHighlights > 0 && <HighlightBadge severity="warn" count={i.openHighlights} />}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-faint)' }}>↗</span>
    </button>
  );
};

// ── Consumer band ────────────────────────────────────────────────────

const ConsumerHeader = ({ consumer, totalItems }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '6px 4px 10px',
  }}>
    {/* glyph block */}
    <div style={{
      width: 28, height: 28,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 6,
      fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
      color: 'var(--fg-muted)',
      flex: 'none',
      boxShadow: 'var(--shadow-ambient)',
    }} aria-hidden="true">⌬</div>

    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
      <h2 style={{
        margin: 0,
        fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600,
        color: 'var(--fg-default)', letterSpacing: '-0.01em',
      }}>{consumer.name}</h2>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
        whiteSpace: 'nowrap',
      }}>{consumer.path}</span>
    </div>

    <HealthBadge health={consumer.health} />

    <div style={{ flex: 1 }} />

    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
      whiteSpace: 'nowrap',
    }}>last write {consumer.lastWrite}</span>

    {totalItems > 0 && (
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
        color: 'var(--fg-muted)',
        padding: '2px 8px', borderRadius: 999,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        whiteSpace: 'nowrap',
      }}>{totalItems} {totalItems === 1 ? 'entry' : 'entries'}</span>
    )}
  </div>
);

const ConsumerErroredBlock = ({ consumer }) => (
  <div style={{
    border: '1px solid color-mix(in srgb, var(--severity-critical) 35%, transparent)',
    background: 'color-mix(in srgb, var(--severity-critical) 6%, var(--bg-surface))',
    borderRadius: 8,
    overflow: 'hidden',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      borderBottom: '1px solid color-mix(in srgb, var(--severity-critical) 22%, transparent)',
      background: 'color-mix(in srgb, var(--severity-critical) 10%, transparent)',
    }}>
      <span style={{ color: 'var(--severity-critical)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>⊘</span>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--fg-default)' }}>
        {consumer.errors.length} {consumer.errors.length === 1 ? 'file failed' : 'files failed'} to parse
      </span>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)' }}>
        — the rest of aiDeck still works
      </span>
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" size="sm">$_ aideck doctor {consumer.name}</Btn>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {consumer.errors.map((err, i) => (
        <div key={i} style={{
          padding: '10px 14px',
          borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px',
          fontFamily: 'var(--font-mono)', fontSize: 12,
        }}>
          <span style={{ color: 'var(--fg-subtle)' }}>file</span>
          <span style={{ color: 'var(--fg-default)' }}>
            {err.file}
            <span style={{ color: 'var(--severity-critical)' }}>:{err.line}</span>
          </span>
          <span style={{ color: 'var(--fg-subtle)' }}>error</span>
          <span style={{ color: 'var(--severity-critical)' }}>{err.kind} — {err.message}</span>
          <span style={{ color: 'var(--fg-subtle)' }}>suggest</span>
          <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>{err.suggestion}</span>
        </div>
      ))}
    </div>
  </div>
);

const ConsumerBand = ({ consumer, onOpenPlan, onOpenInitiative }) => {
  const total = (consumer.plans?.length || 0) + (consumer.initiatives?.length || 0);
  return (
    <section aria-labelledby={`consumer-${consumer.id}`} style={{ marginTop: 24 }}>
      <ConsumerHeader consumer={consumer} totalItems={total} />

      {consumer.health === 'errored' ? (
        <ConsumerErroredBlock consumer={consumer} />
      ) : total === 0 ? (
        <div style={{
          padding: '14px 16px',
          background: 'var(--bg-surface)',
          border: '1px dashed var(--border-default)',
          borderRadius: 8,
          fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-subtle)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-faint)' }}>(empty)</span>
          <span>Consumer detected, no plans or initiatives written yet.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(consumer.plans || []).map(p => <PlanRow key={p.slug} plan={p} onOpen={onOpenPlan} />)}
          {(consumer.initiatives || []).length > 0 && (
            <div style={{ marginTop: consumer.plans?.length ? 6 : 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 8, padding: '0 2px',
              }}>
                <span className="t-eyebrow" style={{ color: 'var(--fg-muted)' }}>
                  Standalone initiatives · {consumer.initiatives.length}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {consumer.initiatives.map(i => <InitiativeRow key={i.slug} i={i} onOpen={onOpenInitiative} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

// ── Page header (Home + Demo share base; Demo adds entry points) ─────

const HomeHeader = ({ scenario, demo, consumers, highlights, annotationsUnread }) => {
  const activeConsumers = consumers.filter(c => c.health === 'active').length;
  const erroredConsumers = consumers.filter(c => c.health === 'errored').length;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{demo ? 'DEMO HOME' : 'HOME'}</span>
            <span style={{ color: 'var(--fg-faint)' }}>·</span>
            <span style={{ color: 'var(--fg-faint)' }}>~/code/{demo ? 'aideck-demo' : 'sda-v2'}</span>
          </div>
          <h1 style={{
            margin: 0, fontFamily: 'var(--font-sans)', fontSize: 32, fontWeight: 600,
            color: 'var(--fg-default)', letterSpacing: '-0.025em', lineHeight: 1.1,
          }}>
            {demo
              ? <>You're looking at a <span style={{ color: 'var(--status-blocked)' }}>seeded</span> aiDeck.</>
              : consumers.length === 0
                ? <>aiDeck is running. No consumers yet.</>
                : <>Your work, projected from <span style={{ color: 'var(--status-active)' }}>{consumers.length}</span> {consumers.length === 1 ? 'consumer' : 'consumers'}.</>
            }
          </h1>
          <p style={{
            margin: '10px 0 0', fontFamily: 'var(--font-sans)', fontSize: 14,
            color: 'var(--fg-muted)', lineHeight: 1.55, maxWidth: 720, textWrap: 'pretty',
          }}>
            {demo
              ? <>Everything below is fixture data, written by <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>aideck demo</code> into a tempdir. Quit with <Kbd>Ctrl</Kbd> <Kbd>C</Kbd> to clean. Use the entry points below to sample the product in 3 clicks.</>
              : consumers.length === 0
                ? <>aiDeck is a projection layer. It needs at least one consumer — an AI skill that writes structured project data — to show you anything. Pick a path below.</>
                : <>aiDeck never owns state — it projects from <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>.atomic-skills/</code>. Click any plan or initiative to zoom in.</>
            }
          </p>
        </div>
      </div>

      {/* metadata strip — only when consumers exist */}
      {consumers.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0,
          marginTop: 18,
          padding: '10px 14px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          boxShadow: 'var(--shadow-ambient)',
          fontFamily: 'var(--font-mono)', fontSize: 11,
        }}>
          {[
            { label: 'consumers', value: <span><span style={{ color: 'var(--status-done)' }}>{activeConsumers}</span><span style={{ color: 'var(--fg-subtle)' }}>/{consumers.length}</span> active</span> },
            erroredConsumers > 0 ? { label: 'errored', value: <span style={{ color: 'var(--severity-critical)' }}>{erroredConsumers}</span> } : null,
            { label: 'highlights', value: highlights.total === 0
              ? <span style={{ color: 'var(--fg-default)' }}>0</span>
              : <span><span style={{ color: highlights.critical > 0 ? 'var(--severity-critical)' : 'var(--status-highlighted)' }}>{highlights.total}</span><span style={{ color: 'var(--fg-subtle)' }}> open</span></span>
            },
            { label: 'unread', value: annotationsUnread === 0
              ? <span style={{ color: 'var(--fg-default)' }}>0</span>
              : <span style={{ color: 'var(--status-emerged)' }}>◗ {annotationsUnread}</span>
            },
            { label: 'runtime', value: <span style={{ color: 'var(--status-done)' }}>127.0.0.1:7777</span> },
            { label: 'mcp', value: <span style={{ color: 'var(--fg-default)' }}>ready</span> },
          ].filter(Boolean).map((m, i, arr) => (
            <React.Fragment key={m.label}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 14px', whiteSpace: 'nowrap', flex: 'none' }}>
                <span style={{ color: 'var(--fg-subtle)' }}>{m.label}</span>
                <span style={{ fontWeight: 500 }}>{m.value}</span>
              </span>
              {i < arr.length - 1 && <span style={{ width: 1, height: 12, background: 'var(--border-default)', flex: 'none' }} />}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Demo entry points (only on /demo) ────────────────────────────────

const DemoEntryPoints = ({ onNav }) => (
  <div style={{
    marginTop: 18,
    padding: '14px 16px 16px',
    background: 'color-mix(in srgb, var(--status-blocked) 5%, var(--bg-surface))',
    border: '1px solid color-mix(in srgb, var(--status-blocked) 22%, var(--border-default))',
    borderRadius: 8,
    boxShadow: 'var(--shadow-ambient)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span className="t-eyebrow" style={{ color: 'var(--status-blocked)' }}>EVALUATOR FAST-PATH</span>
      <div style={{ flex: 1, height: 1, background: 'color-mix(in srgb, var(--status-blocked) 22%, transparent)' }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>5 min · 3 clicks</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
      {[
        { label: 'View demo plan', sub: 'SDA v2 — 9 phases · 82 tasks',          to: '/plans/v3-redesign',                  kbd: '1' },
        { label: 'View demo initiative', sub: 'F0 — Foundation Repair · active', to: '/initiatives/v3-f0-foundation-repair', kbd: '2' },
        { label: 'Browse skills directory', sub: '9 atomic-skills available',    to: '/help',                                kbd: '3' },
        { label: 'MCP setup', sub: 'Wire Claude Code · Cursor · Cline',           to: '/help#mcp',                            kbd: '4' },
      ].map((e) => (
        <button key={e.label} onClick={() => onNav(e.to)} style={{
          all: 'unset', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          transition: 'background 120ms, border-color 120ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border-bright)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}>
          <Kbd>{e.kbd}</Kbd>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--fg-default)' }}>{e.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>{e.sub}</div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg-faint)' }}>↗</span>
        </button>
      ))}
    </div>
  </div>
);

// ── Empty-state — no consumers detected ──────────────────────────────

const EmptyState = ({ discovered, onNav }) => (
  <div style={{ marginTop: 18 }}>
    <div style={{
      padding: '24px 24px 22px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      boxShadow: 'var(--shadow-ambient)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* subtle texture corner */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, right: 0, width: 240, height: 240,
        background: 'var(--texture-grid)', backgroundSize: 'var(--texture-grid-size)',
        opacity: 0.4, pointerEvents: 'none',
        maskImage: 'radial-gradient(circle at top right, black, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(circle at top right, black, transparent 70%)',
      }} />
      <div style={{ position: 'relative' }}>
        <div className="t-eyebrow" style={{ color: 'var(--fg-muted)', marginBottom: 8 }}>NEXT STEP — INSTALL A CONSUMER</div>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 600, color: 'var(--fg-default)', letterSpacing: '-0.015em' }}>
          aiDeck found <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-done)' }}>{discovered.skills}</span> atomic-skills available, none configured here yet.
        </h2>
        <p style={{ margin: '8px 0 0', maxWidth: 680, color: 'var(--fg-muted)', fontSize: 13, lineHeight: 1.55, textWrap: 'pretty' }}>
          A consumer is any AI skill that writes structured project data to <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>.atomic-skills/&lt;consumer&gt;/</code> in your repo. Pick the fastest path:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
          {/* Path 1 */}
          <div style={{
            padding: '14px 16px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--status-active)', fontWeight: 600, letterSpacing: '0.06em' }}>PATH 1 · RECOMMENDED</span>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--fg-default)', marginBottom: 8 }}>Install atomic-skills</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-default)',
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '10px 12px',
              lineHeight: 1.7,
            }}>
              <span style={{ color: 'var(--fg-subtle)' }}>$</span> npm i -g @henryavila/atomic-skills<br />
              <span style={{ color: 'var(--fg-subtle)' }}>$</span> atomic-skills setup<br />
              <span style={{ color: 'var(--fg-subtle)' }}>$</span> aideck serve
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
              Includes <code style={{ fontFamily: 'var(--font-mono)' }}>project-status</code>, <code style={{ fontFamily: 'var(--font-mono)' }}>review</code>, <code style={{ fontFamily: 'var(--font-mono)' }}>hunt</code>, and {discovered.skills - 3} more. Reload this tab when done.
            </p>
          </div>

          {/* Path 2 */}
          <div style={{
            padding: '14px 16px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--status-emerged)', fontWeight: 600, letterSpacing: '0.06em' }}>PATH 2</span>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--fg-default)', marginBottom: 8 }}>Build your own consumer</div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
              The data format is a YAML + Markdown schema. Anything that writes valid files into a <code style={{ fontFamily: 'var(--font-mono)' }}>.atomic-skills/</code> subfolder shows up here.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn variant="secondary" size="sm" onClick={() => onNav('/help#integration')}>docs/integration-spec.md ↗</Btn>
              <Btn variant="ghost" size="sm" onClick={() => onNav('/help#mcp')}>docs/mcp-tools.md ↗</Btn>
            </div>
          </div>

          {/* Path 3 */}
          <div style={{
            gridColumn: 'span 2',
            padding: '12px 14px',
            background: 'transparent',
            border: '1px dashed var(--border-default)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--status-blocked)', fontWeight: 600, letterSpacing: '0.06em', flex: 'none' }}>PATH 3 · JUST LOOKING</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)', flex: 1 }}>
              Restart with <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>aideck demo</code> to see what the dashboard looks like populated.
            </span>
            <Btn variant="ghost" size="sm" onClick={() => onNav('/demo')}>Open demo ↗</Btn>
          </div>
        </div>
      </div>
    </div>

    {/* Tiny diagnostic block — addresses dev trust */}
    <div style={{
      marginTop: 14,
      padding: '10px 14px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 6,
      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14,
    }}>
      <span><span style={{ color: 'var(--fg-faint)' }}>aideck</span> <span style={{ color: 'var(--status-done)' }}>v0.1.0</span></span>
      <span style={{ width: 1, height: 10, background: 'var(--border-default)' }} />
      <span>watching <span style={{ color: 'var(--fg-default)' }}>~/code/&lt;cwd&gt;/.atomic-skills/</span></span>
      <span style={{ width: 1, height: 10, background: 'var(--border-default)' }} />
      <span>{discovered.skills} skills discovered, {discovered.configured} configured</span>
      <span style={{ width: 1, height: 10, background: 'var(--border-default)' }} />
      <span>mcp clients: <span style={{ color: discovered.mcpClients > 0 ? 'var(--status-done)' : 'var(--fg-default)' }}>{discovered.mcpClients}</span></span>
    </div>
  </div>
);

// ── Main HomeView ────────────────────────────────────────────────────

const HomeView = ({ scenarioKey, demo, onNav }) => {
  const sc = window.scenarios[scenarioKey] || window.scenarios.typical;
  const highlights = window.rollupHighlights(sc.consumers);
  const annotationsUnread = window.rollupAnnotations(sc.consumers);

  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto', padding: '24px 24px 80px',
    }}>
      <HomeHeader
        scenario={scenarioKey}
        demo={demo}
        consumers={sc.consumers}
        highlights={highlights}
        annotationsUnread={annotationsUnread}
      />

      {demo && <DemoEntryPoints onNav={onNav} />}

      {sc.consumers.length === 0
        ? <EmptyState discovered={sc.discovered} onNav={onNav} />
        : <div style={{ marginTop: 12 }}>
            {sc.consumers.map(c => (
              <ConsumerBand
                key={c.id}
                consumer={c}
                onOpenPlan={onNav}
                onOpenInitiative={onNav}
              />
            ))}
          </div>
      }
    </div>
  );
};

Object.assign(window, { HomeView });
