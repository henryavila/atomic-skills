/* global React, window, plan, StatusGlyph, StatusChip, HighlightBadge, TagChip, Btn */
const { useState: useStatePlan } = React;

const PhaseCard = ({ phase, onOpen, parallel, textures, compact }) => {
  const t = textures || {};
  const isActive = phase.status === 'active';
  const isDone = phase.status === 'done';
  const classes = ['phase-card'];
  if (isActive && t.textureActive) classes.push('has-texture-active');
  if (phase.hasCriticalDrift && t.textureDrift) classes.push('has-texture-drift');
  const accent =
    isActive ? 'var(--status-active)' :
    isDone   ? 'var(--status-done)'   :
    'transparent';

  return (
    <button onClick={onOpen} className={classes.join(' ')} style={{
      all: 'unset', cursor: 'pointer', display: 'block',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 8, padding: compact ? '8px 12px 10px' : '12px 14px 14px',
      boxShadow: isActive ? 'var(--shadow-glow-active)' : 'var(--shadow-ambient)',
      position: 'relative', overflow: 'hidden',
      opacity: isDone ? 0.62 : 1,
      transition: 'background 160ms var(--ease-out), border-color 160ms var(--ease-out), transform 160ms var(--ease-out), box-shadow 160ms var(--ease-out), opacity 160ms var(--ease-out)',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--bg-elevated)';
      e.currentTarget.style.borderColor = 'var(--border-bright)';
      e.currentTarget.style.transform = 'translateY(-1px)';
      if (isDone) e.currentTarget.style.opacity = '0.95';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'var(--bg-surface)';
      e.currentTarget.style.borderColor = 'var(--border-default)';
      e.currentTarget.style.transform = 'translateY(0)';
      if (isDone) e.currentTarget.style.opacity = '0.62';
    }}>
      {/* left accent rail */}
      {accent !== 'transparent' && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 2, background: accent,
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isActive
          ? <span style={{
              position: 'relative', width: 16, height: 16,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'var(--status-active)', opacity: 0.25,
                animation: 'aideck-pulse 2s ease-out infinite',
              }} />
              <StatusGlyph status={phase.status} size={13} />
            </span>
          : <StatusGlyph status={phase.status} size={13} />
        }
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
          color: isActive ? 'var(--status-active)' : isDone ? 'var(--status-done)' : 'var(--fg-muted)',
          letterSpacing: '0.04em', whiteSpace: 'nowrap', flex: 'none',
        }}>{phase.id}</span>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600,
          color: 'var(--fg-default)', flex: 1, letterSpacing: '-0.01em',
        }}>{phase.title}</span>
        {!isDone && phase.highlights?.map((h, i) =>
          <HighlightBadge key={i} severity={h.severity} count={h.count} />
        )}
      </div>

      {!compact && (
        <React.Fragment>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, marginLeft: 22, alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isDone ? 'var(--status-done)' : 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
              {phase.tasks.done}<span style={{ color: 'var(--fg-subtle)' }}>/{phase.tasks.total}</span> tasks
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isDone ? 'var(--status-done)' : (phase.gates.met < phase.gates.total ? 'var(--status-blocked)' : 'var(--status-done)'), whiteSpace: 'nowrap' }}>
              {phase.gates.met}<span style={{ color: 'var(--fg-subtle)' }}>/{phase.gates.total}</span> gates
            </span>
            {isDone && phase.durationDays != null && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
                {phase.durationDays}d duration
              </span>
            )}
            {!isDone && phase.audience && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
              audience: {phase.audience}
            </span>}
            {phase.gateType === 'ui-gate' && <TagChip kind="uigate">ui-gate</TagChip>}
          </div>

          {/* mini progress bar — solid green when done, segmented when active */}
          <div style={{
            display: 'flex', height: 3, marginTop: 12, marginLeft: 22,
            marginRight: 4, gap: 1,
            borderRadius: 2, overflow: 'hidden',
          }}>
            {isDone ? (
              <div style={{ flex: 1, background: 'var(--status-done)' }} />
            ) : (
              <React.Fragment>
                {phase.tasks.done > 0 && <div style={{
                  flex: phase.tasks.done,
                  background: 'var(--status-done)',
                  opacity: 0.85,
                }} />}
                {isActive && <div style={{
                  flex: 1,
                  background: 'var(--status-active)',
                  backgroundImage: 'linear-gradient(90deg, var(--status-active), color-mix(in srgb, var(--status-active) 60%, white))',
                  boxShadow: '0 0 8px color-mix(in srgb, var(--status-active) 70%, transparent)',
                }} />}
                {(phase.tasks.total - phase.tasks.done - (isActive ? 1 : 0)) > 0 && <div style={{
                  flex: phase.tasks.total - phase.tasks.done - (isActive ? 1 : 0),
                  background: 'var(--border-default)',
                }} />}
              </React.Fragment>
            )}
          </div>

          {isDone ? (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
              marginTop: 10, marginLeft: 22,
            }}>
              completed <span style={{ color: 'var(--status-done)' }}>{phase.completedAt}</span>
              <span style={{ color: 'var(--fg-faint)', margin: '0 8px' }}>·</span>
              <span style={{ color: 'var(--fg-muted)' }}>{phase.exit}</span>
            </div>
          ) : phase.next ? (
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)',
              marginTop: 10, marginLeft: 22,
            }}>
              Next: <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{phase.next}</span>
            </div>
          ) : null}
        </React.Fragment>
      )}
    </button>
  );
};

const TrackHeader = ({ track }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 0', marginTop: 12,
  }}>
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
      color: 'var(--fg-muted)', letterSpacing: '0.08em',
      whiteSpace: 'nowrap', flex: 'none',
    }}>TRACK {track.id} — {track.title.toUpperCase()}</span>
    <div style={{ flex: 1, minWidth: 0, height: 1, background: 'var(--border-subtle)' }} />
  </div>
);

// Group consecutive phases by parallelWith. A phase with peers becomes a
// parallel group containing all mutually-parallel members; others render solo.
const groupParallels = (phases) => {
  const out = [];
  const seen = new Set();
  for (const p of phases) {
    if (seen.has(p.id)) continue;
    const peers = Array.isArray(p.parallelWith) ? p.parallelWith : [];
    if (peers.length > 0) {
      const group = [p, ...peers
        .map(id => phases.find(x => x.id === id))
        .filter(Boolean)
        .filter(x => !seen.has(x.id))];
      group.forEach(x => seen.add(x.id));
      out.push({ kind: 'parallel', phases: group });
    } else {
      seen.add(p.id);
      out.push({ kind: 'solo', phases: [p] });
    }
  }
  return out;
};

const CompletedSection = ({ phases, onOpen, textures }) => {
  const [expanded, setExpanded] = useStatePlan(true);
  if (phases.length === 0) return null;
  const slugFor = (p) =>
    p.id === 'F-1' || p.id === 'F-2' ? 'v3-fneg1-repo-bootstrap' : null;
  return (
    <div style={{ marginTop: 14 }}>
      <div role="button" tabIndex={0}
        onClick={() => setExpanded(v => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v); } }}
        style={{
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 12px',
        background: 'transparent',
        borderRadius: 6,
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          color: 'var(--fg-muted)', letterSpacing: '0.08em', whiteSpace: 'nowrap',
        }}>{expanded ? '▾' : '▸'} COMPLETED · {phases.length}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {phases.map(p => <span key={p.id} style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
            color: 'var(--status-done)', padding: '1px 6px', borderRadius: 999,
            background: 'color-mix(in srgb, var(--status-done) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--status-done) 25%, transparent)',
            whiteSpace: 'nowrap',
          }}>✓ {p.id}</span>)}
        </div>
        <div style={{ flex: 1, minWidth: 0, height: 1, background: 'var(--border-subtle)' }} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', whiteSpace: 'nowrap',
        }}>{phases.reduce((s, p) => s + (p.durationDays || 0), 0)}d total</span>
      </div>
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {phases.map(p => (
            <PhaseCard key={p.id} phase={p} compact={true} textures={textures}
              onOpen={() => onOpen(slugFor(p))} />
          ))}
        </div>
      )}
    </div>
  );
};

const ParallelGroup = ({ phases, onOpen, textures }) => (
  <div style={{ position: 'relative', paddingLeft: 16 }}>
    {/* vertical rail */}
    <div style={{
      position: 'absolute', left: 4, top: 28, bottom: 4,
      width: 2, background: 'var(--status-emerged)', borderRadius: 1,
    }} />
    {/* group label */}
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 6, marginLeft: -16,
      paddingLeft: 16, position: 'relative',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
        color: 'var(--status-emerged)', letterSpacing: '0.08em',
        whiteSpace: 'nowrap', flex: 'none',
        background: 'var(--bg-canvas)', paddingLeft: 0, paddingRight: 6,
      }}>∥ PARALLEL · {phases.length} PHASES</span>
      <div style={{
        flex: 1, minWidth: 0, height: 1,
        background: 'color-mix(in srgb, var(--status-emerged) 30%, transparent)',
      }} />
    </div>
    {/* phases stacked */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {phases.map(p => (
        <PhaseCard key={p.id} phase={p} textures={textures}
          onOpen={() => onOpen(p.id === 'F0' ? 'v3-f0-foundation-repair' : null)} />
      ))}
    </div>
  </div>
);

const PlanView = ({ onOpenInitiative, textures }) => {
  const [showPrinciples, setShowPrinciples] = useStatePlan(false);
  const [showGlossary, setShowGlossary] = useStatePlan(false);
  const [showNarrative, setShowNarrative] = useStatePlan(false);

  // group phases by track, handle parallelism
  const byTrack = plan.tracks.map(t => ({
    track: t,
    phases: plan.phases.filter(p => p.track === t.id),
  }));

  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto', padding: '20px 24px 60px',
    }}>
      {/* Plan header */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginBottom: 6 }}>
              PLAN · {plan.version}
            </div>
            <h1 style={{
              margin: 0, fontFamily: 'var(--font-sans)', fontSize: 32, fontWeight: 600,
              color: 'var(--fg-default)', letterSpacing: '-0.025em', lineHeight: 1.1,
            }}>{plan.title}</h1>
          </div>
          <StatusChip status={plan.status} />
        </div>
        {/* metadata strip — B8 */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0, marginTop: 14,
          padding: '10px 14px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          boxShadow: 'var(--shadow-ambient)',
          fontFamily: 'var(--font-mono)', fontSize: 11,
        }}>
          {[
            { label: 'started',  value: plan.started, color: 'var(--fg-default)' },
            { label: 'branch',   value: plan.branch,  color: 'var(--fg-default)' },
            { label: 'current',  value: plan.currentPhase, color: 'var(--status-active)' },
            { label: 'phases',   value: `${plan.phases.length}`, color: 'var(--fg-default)' },
            { label: 'principles', value: `${plan.principles.length}`, color: 'var(--fg-default)', clickable: () => setShowPrinciples(v => !v) },
            { label: 'glossary', value: `${plan.glossary.length}`, color: 'var(--fg-default)', clickable: () => setShowGlossary(v => !v) },
            { label: 'refs',     value: '3', color: 'var(--fg-default)' },
          ].map((m, i, arr) => (
            <React.Fragment key={m.label}>
              <button onClick={m.clickable} style={{
                all: 'unset', cursor: m.clickable ? 'pointer' : 'default',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '2px 12px', whiteSpace: 'nowrap',
                flex: 'none', flexShrink: 0,
              }}>
                <span style={{ color: 'var(--fg-subtle)' }}>{m.label}</span>
                <span style={{ color: m.color, fontWeight: 500 }}>{m.value}</span>
              </button>
              {i < arr.length - 1 && <span style={{
                width: 1, height: 12, background: 'var(--border-default)', flex: 'none',
              }} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Btn variant="secondary" size="sm" onClick={() => setShowNarrative(v => !v)}>
          {showNarrative ? '▾' : '▸'} Open narrative
        </Btn>
        <Btn variant="ghost" size="sm">References</Btn>
        <Btn variant="ghost" size="sm">⌬ Dependency graph</Btn>
      </div>

      {showNarrative && (
        <div style={{
          marginTop: 12, padding: '14px 16px',
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 13,
          lineHeight: 1.6, color: 'var(--fg-default)', textWrap: 'pretty',
        }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>Why this redesign</h3>
          <p style={{ margin: 0, color: 'var(--fg-muted)' }}>
            v2 acumulou dívida em três frentes: dados duplicados em legado, painel admin lento, fluxo público
            sem i18n. v3 reescreve em fases ordenadas — F0 sanitiza dados, F1/F2 reconstroem superfície, F3-F5
            adicionam fluxos de planejamento e curadoria, F6-F8 migram e desligam o velho.
          </p>
        </div>
      )}

      {/* Collapsible meta — only renders if user clicked principles/glossary toggle in strip */}
      {showPrinciples && (
        <div style={{
          padding: '14px 16px', marginTop: 10,
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8,
          boxShadow: 'var(--shadow-ambient)',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
        }}>
          {plan.principles.map(p => (
            <div key={p.id}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', letterSpacing: '0.04em' }}>{p.id}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--fg-default)', marginTop: 2 }}>{p.title}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', marginTop: 2, lineHeight: 1.45 }}>{p.body}</div>
            </div>
          ))}
        </div>
      )}
      {showGlossary && (
        <div style={{
          padding: '14px 16px', marginTop: 10,
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8,
          boxShadow: 'var(--shadow-ambient)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        }}>
          {plan.glossary.map(g => (
            <div key={g.term} style={{ display: 'flex', gap: 8, fontFamily: 'var(--font-sans)', fontSize: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-active)', minWidth: 80 }}>{g.term}</span>
              <span style={{ color: 'var(--fg-muted)' }}>{g.definition}</span>
            </div>
          ))}
        </div>
      )}

      {/* Completed (collapsed by default) */}
      {(function() {
        const allDone = plan.phases.filter(function(p) { return p.status === 'done'; });
        if (allDone.length === 0) return null;
        if (textures && textures.groupCompleted) {
          return <CompletedSection phases={allDone} onOpen={onOpenInitiative} textures={textures} />;
        }
        return null;
      })()}

      {/* Phase tree by track */}
      <div style={{ marginTop: 8 }}>
        {byTrack
          .filter(function(item) {
            if (!(textures && textures.groupCompleted)) return item.phases.length > 0;
            return item.phases.some(function(p) { return p.status !== 'done'; });
          })
          .map(function(item) {
            const track = item.track;
            const phases = item.phases;
            const visiblePhases = (textures && textures.groupCompleted)
              ? phases.filter(function(p) { return p.status !== 'done'; })
              : phases;
            const groups = groupParallels(visiblePhases);
            return (
              <div key={track.id}>
                <TrackHeader track={track} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groups.map((g, i) => {
                    const firstPhase = g.phases[0];
                    const slugFor = (p) =>
                      p.id === 'F0'  ? 'v3-f0-foundation-repair' :
                      p.id === 'F-1' ? 'v3-fneg1-repo-bootstrap' :
                      p.id === 'F-2' ? 'v3-fneg1-repo-bootstrap' :
                      null;
                    return g.kind === 'parallel'
                      ? <ParallelGroup key={i} phases={g.phases} onOpen={onOpenInitiative} textures={textures} />
                      : <PhaseCard key={firstPhase.id} phase={firstPhase} textures={textures}
                          onOpen={() => onOpenInitiative(slugFor(firstPhase))} />;
                  })}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

window.PlanView = PlanView;
