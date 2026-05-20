/* global React, window, StatusChip, Btn, PhaseCard, ParallelGroup, ReferencesModal, DepGraphOverlay */

const { useState: useStateP, useEffect: useEffectP, useMemo: useMemoP } = React;

// Group consecutive phases by parallelWith.
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

// ── Inline section: principles ─────────────────────────────────────────────

const PrinciplesPanel = ({ principles }) => (
  <div style={{
    padding: '14px 16px', marginTop: 10,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    borderRadius: 8,
    boxShadow: 'var(--shadow-ambient)',
  }}>
    <div className="t-eyebrow" style={{ color: 'var(--fg-muted)', marginBottom: 10 }}>
      PRINCIPLES · {principles.length}
    </div>
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: 12,
    }}>
      {principles.map(p => (
        <div key={p.id}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--fg-subtle)', letterSpacing: '0.04em',
              minWidth: 24,
            }}>{p.id}</span>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
              color: 'var(--fg-default)',
            }}>{p.title}</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)',
            marginTop: 4, marginLeft: 32, lineHeight: 1.5,
          }}>{p.body}</div>
        </div>
      ))}
    </div>
  </div>
);

const GlossaryPanel = ({ glossary }) => (
  <div style={{
    padding: '14px 16px', marginTop: 10,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    borderRadius: 8,
    boxShadow: 'var(--shadow-ambient)',
  }}>
    <div className="t-eyebrow" style={{ color: 'var(--fg-muted)', marginBottom: 10 }}>
      GLOSSARY · {glossary.length}
    </div>
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '8px 16px',
    }}>
      {glossary.map(g => (
        <div key={g.term} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: 'var(--status-active)', minWidth: 92, flex: 'none',
            fontWeight: 500,
          }}>{g.term}</span>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 12,
            color: 'var(--fg-muted)', lineHeight: 1.5,
          }}>{g.definition}</span>
        </div>
      ))}
    </div>
  </div>
);

// ── Narrative panel — capped height + show more ───────────────────────────

const NarrativePanel = ({ markdown, expanded, onToggleExpanded }) => {
  // Rendering minimal markdown: headings, paragraphs, ordered/unordered lists,
  // and emphasis. We aren't pulling in a real parser — the brief just needs the
  // shape to read correctly.
  const blocks = useMemoP(() => {
    const lines = markdown.split('\n');
    const out = [];
    let buf = [];
    const flushPara = () => {
      if (buf.length) {
        out.push({ kind: 'p', text: buf.join(' ') });
        buf = [];
      }
    };
    for (const line of lines) {
      if (/^##\s+/.test(line))      { flushPara(); out.push({ kind: 'h2', text: line.replace(/^##\s+/, '') }); }
      else if (/^#\s+/.test(line))  { flushPara(); out.push({ kind: 'h1', text: line.replace(/^#\s+/, '') }); }
      else if (/^\d+\.\s+/.test(line)) { flushPara(); out.push({ kind: 'ol-item', text: line.replace(/^\d+\.\s+/, '') }); }
      else if (/^-\s+/.test(line))  { flushPara(); out.push({ kind: 'ul-item', text: line.replace(/^-\s+/, '') }); }
      else if (line.trim() === '')  { flushPara(); }
      else                          { buf.push(line); }
    }
    flushPara();
    return out;
  }, [markdown]);

  // Inline markdown: **bold**, `code`.
  const renderInline = (text) => {
    const parts = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let lastIdx = 0;
    let m;
    let i = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
      const t = m[0];
      if (t.startsWith('**')) parts.push(<strong key={i++}>{t.slice(2, -2)}</strong>);
      else parts.push(<code key={i++} style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.92em',
        padding: '1px 5px',
        background: 'var(--bg-canvas)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 3,
        color: 'var(--fg-default)',
      }}>{t.slice(1, -1)}</code>);
      lastIdx = m.index + t.length;
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx));
    return parts;
  };

  return (
    <div style={{
      marginTop: 12,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 8,
      boxShadow: 'var(--shadow-ambient)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        maxHeight: expanded ? 'none' : 320,
        overflowY: expanded ? 'visible' : 'auto',
        padding: '16px 20px',
        position: 'relative',
      }}>
        {blocks.map((b, i) => {
          if (b.kind === 'h2') return (
            <h3 key={i} style={{
              margin: i === 0 ? '0 0 8px' : '20px 0 8px',
              fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600,
              color: 'var(--fg-default)', letterSpacing: '-0.01em',
            }}>{b.text}</h3>
          );
          if (b.kind === 'h1') return (
            <h2 key={i} style={{
              margin: i === 0 ? '0 0 10px' : '24px 0 10px',
              fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 600,
              color: 'var(--fg-default)',
            }}>{b.text}</h2>
          );
          if (b.kind === 'ol-item') return (
            <div key={i} style={{
              display: 'flex', gap: 10, fontFamily: 'var(--font-sans)', fontSize: 13,
              color: 'var(--fg-muted)', lineHeight: 1.6, margin: '4px 0 4px 8px',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', color: 'var(--status-active)',
                flex: 'none', minWidth: 18,
              }}>{i + 1}.</span>
              <span style={{ textWrap: 'pretty' }}>{renderInline(b.text)}</span>
            </div>
          );
          if (b.kind === 'ul-item') return (
            <div key={i} style={{
              display: 'flex', gap: 10, fontFamily: 'var(--font-sans)', fontSize: 13,
              color: 'var(--fg-muted)', lineHeight: 1.6, margin: '3px 0 3px 8px',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', color: 'var(--fg-subtle)',
                flex: 'none',
              }}>·</span>
              <span style={{ textWrap: 'pretty' }}>{renderInline(b.text)}</span>
            </div>
          );
          return (
            <p key={i} style={{
              margin: '8px 0',
              fontFamily: 'var(--font-sans)', fontSize: 13.5,
              color: 'var(--fg-muted)', lineHeight: 1.65,
              textWrap: 'pretty',
            }}>{renderInline(b.text)}</p>
          );
        })}
        {/* Fade overlay when collapsed */}
        {!expanded && (
          <div aria-hidden style={{
            position: 'sticky', bottom: -16, left: 0, right: 0, height: 56,
            marginTop: -56,
            background: 'linear-gradient(to bottom, transparent, var(--bg-surface) 75%)',
            pointerEvents: 'none',
          }} />
        )}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 16px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'color-mix(in srgb, var(--bg-elevated) 50%, transparent)',
      }}>
        <button onClick={onToggleExpanded} style={{
          all: 'unset', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', fontSize: 12,
          color: 'var(--accent-link)',
        }}>{expanded ? '▴ show less' : '▾ show more (full narrative)'}</button>
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
        }}>{markdown.length.toLocaleString()} chars · {markdown.split('\n').length} lines</span>
      </div>
    </div>
  );
};

// ── Header: hero + meta strip ─────────────────────────────────────────────

const PlanHero = ({ plan, refsCount, onTogglePrinciples, onToggleGlossary, onToggleRefs }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginBottom: 6 }}>
          PLAN · {plan.version} · {plan.slug}
        </div>
        <h1 style={{
          margin: 0, fontFamily: 'var(--font-sans)', fontSize: 30, fontWeight: 600,
          color: 'var(--fg-default)', letterSpacing: '-0.025em', lineHeight: 1.1,
        }}>{plan.title}</h1>
      </div>
      <StatusChip status={plan.status} />
    </div>
    {/* meta strip */}
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0, marginTop: 14,
      padding: '10px 4px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 8,
      boxShadow: 'var(--shadow-ambient)',
      fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      {[
        { label: 'started',    value: plan.started, color: 'var(--fg-default)' },
        { label: 'branch',     value: plan.branch,  color: 'var(--fg-default)' },
        { label: 'current',    value: plan.currentPhase || '—', color: plan.currentPhase ? 'var(--status-active)' : 'var(--fg-muted)' },
        { label: 'phases',     value: `${plan.phases.length}`, color: 'var(--fg-default)' },
        { label: 'tracks',     value: `${plan.tracks.length}`, color: 'var(--fg-default)' },
        { label: 'principles', value: `${plan.principles.length}`, color: 'var(--fg-default)',  clickable: plan.principles.length > 0 ? onTogglePrinciples : null },
        { label: 'glossary',   value: `${plan.glossary.length}`,   color: 'var(--fg-default)',  clickable: plan.glossary.length > 0 ? onToggleGlossary : null },
        { label: 'refs',       value: `${refsCount}`,              color: 'var(--fg-default)',  clickable: refsCount > 0 ? onToggleRefs : null },
      ].map((m, i, arr) => (
        <React.Fragment key={m.label}>
          <button onClick={m.clickable || undefined} style={{
            all: 'unset', cursor: m.clickable ? 'pointer' : 'default',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 14px', whiteSpace: 'nowrap',
            flex: 'none', borderRadius: 4,
            transition: 'background 120ms',
          }}
          onMouseEnter={(e) => { if (m.clickable) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <span style={{ color: 'var(--fg-subtle)' }}>{m.label}</span>
            <span style={{ color: m.color, fontWeight: 500 }}>{m.value}</span>
            {m.clickable && <span style={{ color: 'var(--fg-faint)', fontSize: 9 }}>▸</span>}
          </button>
          {i < arr.length - 1 && (
            <span style={{ width: 1, height: 14, background: 'var(--border-default)', flex: 'none' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
);

// ── Active-phase callout (the unmistakable highlight) ─────────────────────

const ActivePhaseCallout = ({ phase, onOpen }) => {
  if (!phase) return null;
  return (
    <div className="has-texture-active" style={{
      marginTop: 16,
      padding: '14px 16px',
      background: 'color-mix(in srgb, var(--status-active) 7%, var(--bg-surface))',
      border: '1px solid color-mix(in srgb, var(--status-active) 35%, transparent)',
      borderRadius: 8,
      position: 'relative', overflow: 'hidden',
      boxShadow: 'var(--shadow-glow-active)',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: 'var(--status-active)',
        zIndex: 1,
      }} />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginLeft: 8,
        position: 'relative',
      }}>
        <div style={{
          position: 'relative', width: 22, height: 22,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flex: 'none',
        }}>
          <span style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'var(--status-active)', opacity: 0.25,
            animation: 'aideck-pulse 2s ease-out infinite',
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 14,
            color: 'var(--status-active)', fontWeight: 700,
          }}>◉</span>
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          color: 'var(--status-active)', letterSpacing: '0.1em',
        }}>YOU ARE HERE</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
          color: 'var(--status-active)',
        }}>{phase.id}</span>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600,
          color: 'var(--fg-default)', flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{phase.title}</span>
        <button onClick={() => onOpen(phase)} style={{
          all: 'unset', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
          color: 'var(--accent-link)',
          padding: '4px 10px',
          border: '1px solid color-mix(in srgb, var(--accent-link) 35%, transparent)',
          borderRadius: 4,
          background: 'var(--bg-canvas)',
          whiteSpace: 'nowrap',
        }}>Open →</button>
      </div>
      {phase.next && (
        <div style={{
          marginLeft: 8, marginTop: 8, position: 'relative',
          fontFamily: 'var(--font-sans)', fontSize: 13,
          color: 'var(--fg-muted)',
        }}>
          <span style={{ color: 'var(--fg-subtle)' }}>next action:</span>{' '}
          <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{phase.next}</span>
        </div>
      )}
    </div>
  );
};

// ── Data-inconsistency banner ─────────────────────────────────────────────

const InconsistencyBanner = ({ phases }) => {
  if (!phases.length) return null;
  return (
    <div style={{
      marginTop: 14,
      padding: '10px 14px',
      background: 'color-mix(in srgb, var(--severity-warn) 9%, var(--bg-surface))',
      border: '1px solid color-mix(in srgb, var(--severity-warn) 40%, transparent)',
      borderRadius: 8,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 14,
        color: 'var(--severity-warn)', flex: 'none', marginTop: 1,
      }}>⚠</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          color: 'var(--severity-warn)', letterSpacing: '0.08em', marginBottom: 4,
        }}>DATA INCONSISTENCY</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)', lineHeight: 1.5 }}>
          Plan has <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--severity-warn)' }}>parallelismAllowed: false</code>
          {' '}but {phases.length === 1 ? 'phase' : 'phases'}{' '}
          {phases.map((p, i) => (
            <React.Fragment key={p.id}>
              {i > 0 && (i === phases.length - 1 ? ' and ' : ', ')}
              <code style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--fg-default)', fontWeight: 600,
              }}>{p.id}</code>
            </React.Fragment>
          ))}
          {' '}
          declare <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>parallelWith</code> peers.
          {' '}
          <span style={{ color: 'var(--fg-muted)' }}>
            Treating as solo phases for rendering — fix the plan file to silence this.
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Track header ──────────────────────────────────────────────────────────

const TrackHeader = ({ track }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '6px 0', marginTop: 14,
  }}>
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
      color: 'var(--fg-muted)', letterSpacing: '0.08em',
      whiteSpace: 'nowrap', flex: 'none',
    }}>TRACK {track.id} — {track.title.toUpperCase()}</span>
    <div style={{ flex: 1, minWidth: 0, height: 1, background: 'var(--border-subtle)' }} />
  </div>
);

// ── Completed legacy section (collapsed by default) ───────────────────────

const LegacySection = ({ phases }) => {
  const [open, setOpen] = useStateP(false);
  if (!phases || phases.length === 0) return null;
  const totalDays = phases.reduce((s, p) => s + (p.durationDays || 0), 0);
  return (
    <div style={{ marginTop: 16 }}>
      <div role="button" tabIndex={0} onClick={() => setOpen(v => !v)} style={{
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 6,
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          color: 'var(--fg-muted)', letterSpacing: '0.08em',
        }}>{open ? '▾' : '▸'} COMPLETED LEGACY · {phases.length}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {phases.map(p => (
            <span key={p.id} style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
              color: 'var(--status-done)', padding: '1px 6px', borderRadius: 999,
              background: 'color-mix(in srgb, var(--status-done) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--status-done) 25%, transparent)',
            }}>✓ {p.id}</span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, height: 1, background: 'var(--border-subtle)' }} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
        }}>{totalDays}d total · pre-F0</span>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {phases.map(p => (
            <PhaseCard key={p.id} phase={p} density="tight" />
          ))}
        </div>
      )}
    </div>
  );
};

// ── PlanView ──────────────────────────────────────────────────────────────

const PlanView = ({ plan, hashPhase, onOpenInitiative, onClearHash, tweaks }) => {
  const t = tweaks || {};
  const density = t.density || 'baseline';
  const activeEmphasis = t.activeEmphasis || 'edge-scan';
  const parallelVariant = t.parallelVariant || 'container';
  const showActiveCallout = t.activeCallout !== false;

  const [showPrinciples, setShowPrinciples] = useStateP(false);
  const [showGlossary, setShowGlossary]   = useStateP(false);
  const [showNarrative, setShowNarrative] = useStateP(false);
  const [narrativeExpanded, setNarrativeExpanded] = useStateP(false);
  const [showRefs, setShowRefs] = useStateP(false);
  const [showGraph, setShowGraph] = useStateP(false);

  // Scroll the URL-hashed phase into view once mounted / when it changes.
  useEffectP(() => {
    if (!hashPhase) return;
    const el = document.getElementById(`phase-${hashPhase}`);
    if (el) {
      // Defer to let layout settle so scrollMarginTop applies.
      setTimeout(() => {
        // Our scroll container is <main>, not <window>. Walk up to find it.
        let sc = el.parentElement;
        while (sc && sc !== document.body) {
          const ov = getComputedStyle(sc).overflowY;
          if (ov === 'auto' || ov === 'scroll') break;
          sc = sc.parentElement;
        }
        if (!sc || sc === document.body) {
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
        } else {
          const top = el.offsetTop - 80;
          sc.scrollTo({ top, behavior: 'smooth' });
        }
      }, 60);
    }
  }, [hashPhase]);

  // Inconsistent: parallelismAllowed=false but some phase has parallelWith
  const inconsistentPhases = useMemoP(() => {
    if (plan.parallelismAllowed === false) {
      return plan.phases.filter(p => Array.isArray(p.parallelWith) && p.parallelWith.length > 0);
    }
    return [];
  }, [plan]);

  // If inconsistent, strip parallelWith for rendering so they don't visually pair.
  const renderablePhases = useMemoP(() => {
    if (inconsistentPhases.length === 0) return plan.phases;
    return plan.phases.map(p => ({ ...p, parallelWith: undefined }));
  }, [plan, inconsistentPhases]);

  const activePhase = plan.phases.find(p => p.status === 'active');

  // Group by track preserving phase order; only show tracks that have visible phases.
  const trackBuckets = useMemoP(() => {
    return plan.tracks
      .map(track => ({ track, phases: renderablePhases.filter(p => p.track === track.id) }))
      .filter(b => b.phases.length > 0);
  }, [plan, renderablePhases]);

  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto', padding: '20px 24px 80px',
      width: '100%', boxSizing: 'border-box',
    }}>
      <PlanHero plan={plan}
        refsCount={plan.refs ? plan.refs.length : 0}
        onTogglePrinciples={() => setShowPrinciples(v => !v)}
        onToggleGlossary={() => setShowGlossary(v => !v)}
        onToggleRefs={() => setShowRefs(true)} />

      {/* Inconsistency banner */}
      {inconsistentPhases.length > 0 && <InconsistencyBanner phases={inconsistentPhases} />}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <Btn variant={showNarrative ? 'secondary' : 'ghost'} size="sm"
             onClick={() => setShowNarrative(v => !v)}>
          {showNarrative ? '▾' : '▸'} {showNarrative ? 'Close' : 'Open'} narrative
        </Btn>
        <Btn variant="ghost" size="sm" onClick={() => setShowRefs(true)}>
          References <span style={{
            color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)',
            fontSize: 10, marginLeft: 4,
          }}>{plan.refs?.length || 0}</span>
        </Btn>
        <Btn variant="ghost" size="sm" onClick={() => setShowGraph(true)}>
          ⌬ Dependency graph
        </Btn>
        <div style={{ flex: 1 }} />
        {plan.principles.length > 0 && (
          <Btn variant={showPrinciples ? 'secondary' : 'ghost'} size="sm"
               onClick={() => setShowPrinciples(v => !v)}>
            {showPrinciples ? '▾' : '▸'} Principles
          </Btn>
        )}
        {plan.glossary.length > 0 && (
          <Btn variant={showGlossary ? 'secondary' : 'ghost'} size="sm"
               onClick={() => setShowGlossary(v => !v)}>
            {showGlossary ? '▾' : '▸'} Glossary
          </Btn>
        )}
      </div>

      {showNarrative && (
        <NarrativePanel markdown={plan.narrative}
          expanded={narrativeExpanded}
          onToggleExpanded={() => setNarrativeExpanded(v => !v)} />
      )}
      {showPrinciples && <PrinciplesPanel principles={plan.principles} />}
      {showGlossary && <GlossaryPanel glossary={plan.glossary} />}

      {/* Active phase callout */}
      {showActiveCallout && activePhase && (
        <ActivePhaseCallout phase={activePhase} onOpen={onOpenInitiative} />
      )}

      {/* Track-grouped phase tree */}
      <div style={{ marginTop: 6 }}>
        {trackBuckets.map(({ track, phases }) => {
          const groups = groupParallels(phases);
          return (
            <div key={track.id}>
              <TrackHeader track={track} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groups.map((g, i) => {
                  if (g.kind === 'parallel') {
                    return <ParallelGroup key={`p-${i}`} phases={g.phases}
                      onOpen={onOpenInitiative}
                      density={density} activeEmphasis={activeEmphasis}
                      variant={parallelVariant}
                      hashId={hashPhase} />;
                  }
                  const ph = g.phases[0];
                  return <PhaseCard key={ph.id} phase={ph}
                    onOpen={onOpenInitiative}
                    density={density} activeEmphasis={activeEmphasis}
                    hashTarget={hashPhase === ph.id} />;
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legacy (collapsed) */}
      <LegacySection phases={plan.legacyPhases || []} />

      {/* Modals — only mount when open (lazy) */}
      <ReferencesModal open={showRefs} refs={plan.refs || []}
        onClose={() => setShowRefs(false)} />
      <DepGraphOverlay open={showGraph} plan={plan}
        onClose={() => setShowGraph(false)}
        onOpenPhase={(p) => { setShowGraph(false); onOpenInitiative(p); }} />

      {/* Hash-target clear button */}
      {hashPhase && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button onClick={onClearHash} style={{
            all: 'unset', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--fg-subtle)',
            padding: '4px 10px', borderRadius: 4,
            border: '1px solid var(--border-subtle)',
          }}>clear #phase-{hashPhase} hash</button>
        </div>
      )}
    </div>
  );
};

window.PlanView = PlanView;
