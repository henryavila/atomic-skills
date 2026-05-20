/* global React, window, ENTITY_TITLES,
   FeedbackAuthorChip, SeverityChip, MarkdownLite, TargetCrumb, LiveDot */
const { useState: useStateFD, useEffect: useEffectFD, useMemo: useMemoFD, useRef: useRefFD } = React;

const RESOLVED_DECORATION = {
  textDecoration: 'line-through',
  textDecorationColor: 'var(--fg-faint)',
};

// ── Filter pill ─────────────────────────────────────────────────────────
const FilterPill = ({ selected, tint, label, n, onClick }) => (
  <button onClick={onClick} style={{
    all: 'unset', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 5,
    height: 22, padding: '0 10px',
    background: selected ? 'var(--bg-elevated)' : 'transparent',
    color: selected ? tint : 'var(--fg-muted)',
    border: `1px solid ${selected ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
    borderRadius: 999,
    fontFamily: 'var(--font-sans)', fontSize: 11,
    transition: 'all 120ms var(--ease-out)',
  }}>
    {label}
    {n != null && <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
      color: selected ? tint : 'var(--fg-subtle)',
    }}>{n}</span>}
  </button>
);

// ── Highlight row (compact) ─────────────────────────────────────────────
const HighlightRow = ({ h, onAcknowledge, onJump, isFresh, density = 'cozy' }) => {
  const ack = !!h.acknowledged;
  const sevColor = h.severity === 'critical' ? 'var(--severity-critical)'
                 : h.severity === 'warn'     ? 'var(--severity-warn)'
                 : 'var(--severity-info)';
  return (
    <div style={{
      position: 'relative',
      padding: density === 'dense' ? '10px 14px' : '12px 14px',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', gap: 8,
      opacity: ack ? 0.55 : 1,
      background: isFresh ? `color-mix(in srgb, ${sevColor} 10%, transparent)` : 'transparent',
      transition: 'background 600ms var(--ease-out), opacity 140ms',
    }}>
      {/* severity stripe down the left edge */}
      <span aria-hidden="true" style={{
        position: 'absolute', left: 0, top: 8, bottom: 8, width: 2,
        background: ack ? 'var(--border-subtle)' : sevColor,
        borderRadius: 2,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <SeverityChip severity={h.severity} strong={!ack} />
        <FeedbackAuthorChip author={h.author} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>{h.createdAt}</span>
        {ack && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            height: 16, padding: '0 7px', borderRadius: 999,
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
            color: 'var(--status-done)',
            background: 'var(--status-done-bg)',
            border: '1px solid color-mix(in srgb, var(--status-done) 35%, transparent)',
            lineHeight: 1,
          }}>✓ acked</span>
        )}
      </div>
      <TargetCrumb target={h.target} onJump={onJump} />
      <div style={{
        fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)',
        lineHeight: 1.5, textWrap: 'pretty',
        ...(ack ? RESOLVED_DECORATION : {}),
      }}>{h.reason}</div>

      {h.acknowledgement && (
        <div style={{
          marginTop: 2, paddingLeft: 10,
          borderLeft: '2px solid var(--status-done)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--status-done)', letterSpacing: '0.06em' }}>ACKNOWLEDGEMENT</span>
            <FeedbackAuthorChip author={h.acknowledgement.author} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{h.acknowledgement.createdAt}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5 }}>{h.acknowledgement.body}</div>
        </div>
      )}

      {!ack && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onAcknowledge(h.id)} style={{
            all: 'unset', cursor: 'pointer',
            height: 22, padding: '0 10px',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
            color: sevColor,
            border: `1px solid color-mix(in srgb, ${sevColor} 45%, transparent)`,
            background: `color-mix(in srgb, ${sevColor} 8%, transparent)`,
            borderRadius: 4,
          }}>[Acknowledge]</button>
          <button onClick={() => onJump(h.target)} style={{
            all: 'unset', cursor: 'pointer',
            height: 22, padding: '0 8px',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--fg-subtle)',
            border: '1px solid transparent', borderRadius: 4,
          }}>↗ go to</button>
        </div>
      )}
    </div>
  );
};

// ── Annotation row (full card) ──────────────────────────────────────────
const AnnotationRow = ({ a, onResolve, onJump, isFresh, density = 'cozy' }) => {
  const resolved = !!a.resolved;
  const [threadOpen, setThreadOpen] = useStateFD(true);
  return (
    <div style={{
      padding: density === 'dense' ? '12px 14px' : '14px 14px',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', gap: 10,
      opacity: resolved ? 0.6 : 1,
      background: isFresh ? 'color-mix(in srgb, var(--status-active) 8%, transparent)' : 'transparent',
      transition: 'background 600ms var(--ease-out), opacity 140ms',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <FeedbackAuthorChip author={a.author} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>{a.createdAt}</span>
        {resolved && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            height: 16, padding: '0 7px', borderRadius: 999,
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
            color: 'var(--status-done)',
            background: 'var(--status-done-bg)',
            border: '1px solid color-mix(in srgb, var(--status-done) 35%, transparent)',
            lineHeight: 1,
          }}>✓ resolved</span>
        )}
      </div>
      <TargetCrumb target={a.target} onJump={onJump} />
      <div style={{
        borderLeft: '2px solid var(--border-strong)', paddingLeft: 10,
        ...(resolved ? { opacity: 0.7 } : {}),
      }}>
        <MarkdownLite src={a.body} dim={resolved} />
      </div>

      {a.replies && a.replies.length > 0 && (
        <div style={{ marginLeft: 12 }}>
          <button onClick={() => setThreadOpen(v => !v)} style={{
            all: 'unset', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
            color: 'var(--fg-muted)', letterSpacing: '0.04em',
            padding: '2px 0', marginBottom: threadOpen ? 8 : 0,
          }}>
            <span style={{ color: 'var(--fg-subtle)' }}>{threadOpen ? '▾' : '▸'}</span>
            {a.replies.length} {a.replies.length === 1 ? 'reply' : 'replies'}
          </button>
          {threadOpen && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              paddingLeft: 10, borderLeft: '1px dashed var(--border-subtle)',
            }}>
              {a.replies.map(r => (
                <div key={r.id} style={{
                  padding: '8px 10px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FeedbackAuthorChip author={r.author} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{r.createdAt}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--fg-default)', lineHeight: 1.55 }}>{r.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {a.resolution && (
        <div style={{
          marginLeft: 12, paddingLeft: 10,
          borderLeft: '2px solid var(--status-done)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--status-done)', letterSpacing: '0.06em' }}>RESOLUTION</span>
            <FeedbackAuthorChip author={a.resolution.author} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{a.resolution.createdAt}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5 }}>{a.resolution.body}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => onResolve(a.id)} style={{
          all: 'unset', cursor: 'pointer',
          height: 22, padding: '0 10px',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
          color: resolved ? 'var(--fg-muted)' : 'var(--accent-link)',
          border: `1px solid ${resolved ? 'var(--border-subtle)' : 'var(--border-default)'}`,
          borderRadius: 4,
        }}>[{resolved ? 'Reopen' : 'Mark resolved'}]</button>
        <button onClick={() => onJump(a.target)} style={{
          all: 'unset', cursor: 'pointer',
          height: 22, padding: '0 8px',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--fg-subtle)',
          border: '1px solid transparent', borderRadius: 4,
        }}>↗ go to</button>
      </div>
    </div>
  );
};

// ── Group header (when grouping by target) ──────────────────────────────
const GroupHeader = ({ targetPath, count, isOrphan, isFiltered, onClearFilter }) => {
  const meta = ENTITY_TITLES[targetPath] || { label: targetPath, kind: 'entity' };
  const kindGlyph = meta.kind === 'phase' ? '◉' : meta.kind === 'task' ? '·' : meta.kind === 'gate' ? '✓' : '►';
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 2,
      padding: '8px 14px',
      background: isOrphan
        ? 'color-mix(in srgb, var(--severity-warn) 10%, var(--bg-surface))'
        : 'var(--bg-surface)',
      borderTop: '1px solid var(--border-default)',
      borderBottom: '1px solid var(--border-default)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: isOrphan ? 'var(--severity-warn)' : 'var(--fg-subtle)',
      }}>{kindGlyph}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
        color: isOrphan ? 'var(--severity-warn)' : 'var(--fg-default)',
        textDecoration: isOrphan ? 'line-through' : 'none',
      }}>{meta.label}</span>
      {isOrphan && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
          color: 'var(--severity-warn)', letterSpacing: '0.06em',
          padding: '1px 6px', borderRadius: 3,
          background: 'color-mix(in srgb, var(--severity-warn) 16%, transparent)',
          border: '1px solid color-mix(in srgb, var(--severity-warn) 40%, transparent)',
        }}>⌧ ORPHAN</span>
      )}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--fg-subtle)',
        padding: '1px 6px', borderRadius: 999,
        background: 'var(--bg-canvas)',
        border: '1px solid var(--border-subtle)',
      }}>{count}</span>
      <div style={{ flex: 1 }} />
      {isFiltered && (
        <button onClick={onClearFilter} style={{
          all: 'unset', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--fg-subtle)',
        }}>× clear filter</button>
      )}
    </div>
  );
};

// ── FeedbackDrawer ──────────────────────────────────────────────────────
const FeedbackDrawer = ({
  open, onClose, items, targetFilter, onClearTargetFilter,
  liveStream, onToggleLive, lastFreshId,
  groupBy = 'target', // 'target' | 'time'
  badgeVariant = 'standard',
  density = 'cozy',
  showResolved = false,
  hideOrphans = false,
}) => {
  const [kindFilter, setKindFilter] = useStateFD('all');  // all | highlights | annotations
  const [sevFilter, setSevFilter]   = useStateFD('any');  // any | critical | warn | info
  const [authorFilter, setAuthorFilter] = useStateFD('any'); // any | human | ai
  const [localItems, setLocalItems] = useStateFD(items);

  // Sync upstream items into local state, preserve user-toggled resolves locally
  useEffectFD(() => {
    setLocalItems(items);
  }, [items]);

  // Keyboard: Esc closes
  useEffectFD(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);

  const filtered = useMemoFD(() => {
    return localItems.filter(it => {
      if (hideOrphans && it.target.orphan) return false;
      if (!showResolved) {
        if (it.kind === 'annotation' && it.resolved) return false;
        if (it.kind === 'highlight' && it.acknowledged) return false;
      }
      if (targetFilter && it.target.path !== targetFilter) return false;
      if (kindFilter === 'highlights' && it.kind !== 'highlight') return false;
      if (kindFilter === 'annotations' && it.kind !== 'annotation') return false;
      if (kindFilter === 'highlights' && sevFilter !== 'any' && it.severity !== sevFilter) return false;
      if (authorFilter !== 'any' && it.author !== authorFilter) return false;
      return true;
    });
  }, [localItems, kindFilter, sevFilter, authorFilter, targetFilter, showResolved, hideOrphans]);

  const counts = useMemoFD(() => {
    const c = { all: 0, highlights: 0, annotations: 0, critical: 0, warn: 0, info: 0, human: 0, ai: 0, resolved: 0 };
    for (const it of localItems) {
      if (hideOrphans && it.target.orphan) continue;
      const isClosed = (it.kind === 'annotation' && it.resolved) || (it.kind === 'highlight' && it.acknowledged);
      if (isClosed && !showResolved) {
        if (isClosed) c.resolved++;
        continue;
      }
      c.all++;
      if (it.kind === 'highlight') c.highlights++;
      if (it.kind === 'annotation') c.annotations++;
      if (it.kind === 'highlight' && it.severity) c[it.severity]++;
      if (it.author === 'human') c.human++;
      if (it.author === 'ai') c.ai++;
      if (isClosed) c.resolved++;
    }
    return c;
  }, [localItems, showResolved, hideOrphans]);

  // SORT
  const sorted = useMemoFD(() => {
    const sevRank = { critical: 3, warn: 2, info: 1 };
    if (groupBy === 'time') {
      return [...filtered].sort((a, b) => (b.createdAtSort || 0) - (a.createdAtSort || 0));
    }
    return [...filtered];
  }, [filtered, groupBy]);

  // GROUP
  const grouped = useMemoFD(() => {
    if (groupBy !== 'target') return null;
    const groups = {};
    const order = [];
    for (const it of sorted) {
      const k = it.target.path;
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(it);
    }
    // Orphans pinned to top so they aren't silently buried.
    order.sort((a, b) => {
      const aO = (ENTITY_TITLES[a] || {}).orphan ? 1 : 0;
      const bO = (ENTITY_TITLES[b] || {}).orphan ? 1 : 0;
      return bO - aO;
    });
    return order.map(k => ({ targetPath: k, items: groups[k] }));
  }, [sorted, groupBy]);

  // ACTIONS
  const onResolve = (id) => {
    setLocalItems(prev => prev.map(it => it.id === id ? {
      ...it,
      resolved: !it.resolved,
      resolution: !it.resolved ? { author: 'human', createdAt: 'just now', body: 'Marked resolved from the drawer.' } : null,
    } : it));
  };
  const onAcknowledge = (id) => {
    setLocalItems(prev => prev.map(it => it.id === id ? {
      ...it,
      acknowledged: !it.acknowledged,
      acknowledgement: !it.acknowledged ? { author: 'human', createdAt: 'just now', body: 'Acknowledged from the drawer.' } : null,
    } : it));
  };
  const onJump = (target) => {
    // In a real app this scrolls/highlights the target. We stub with a toast.
    if (window._flashToast) window._flashToast(`→ ${target.path}`);
  };

  // Cap render at 100 + footer
  const MAX = 100;
  const totalUnderShown = sorted.length;
  const capped = sorted.slice(0, MAX);

  if (!open) return null;

  const headerTitle = targetFilter
    ? <>Feedback <span style={{ color: 'var(--fg-subtle)' }}>· filtered</span></>
    : <>Feedback</>;

  return (
    <aside aria-label="Feedback drawer" style={{
      width: 420, flex: 'none',
      background: 'var(--bg-canvas)',
      borderLeft: '1px solid var(--border-default)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      animation: 'fb-drawer-in 200ms var(--ease-out)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-default)',
        background: 'var(--bg-surface)',
      }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
          letterSpacing: '0.04em',
          color: 'var(--fg-default)', textTransform: 'uppercase',
        }}>{headerTitle}</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
          padding: '1px 7px', borderRadius: 999,
          background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)',
        }}>{counts.all}</span>
        <div style={{ flex: 1 }} />
        <button onClick={onToggleLive} title={liveStream ? 'Pause live updates' : 'Resume live updates'}
          style={{
            all: 'unset', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            height: 22, padding: '0 8px', borderRadius: 999,
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
            color: liveStream ? 'var(--status-done)' : 'var(--fg-muted)',
            border: `1px solid ${liveStream ? 'color-mix(in srgb, var(--status-done) 40%, transparent)' : 'var(--border-subtle)'}`,
            background: liveStream ? 'color-mix(in srgb, var(--status-done) 8%, transparent)' : 'transparent',
          }}>
          <LiveDot live={liveStream} />
          {liveStream ? 'LIVE' : 'PAUSED'}
        </button>
        <button onClick={onClose} aria-label="Close drawer" title="Close (Esc)" style={{
          all: 'unset', cursor: 'pointer', color: 'var(--fg-muted)',
          fontFamily: 'var(--font-mono)', fontSize: 18, padding: '0 4px',
        }}>×</button>
      </div>

      {/* Kind tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '8px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-canvas)',
      }}>
        {[
          { id: 'all',          label: 'all',         n: counts.all,         tint: 'var(--fg-default)' },
          { id: 'highlights',   label: 'highlights',  n: counts.highlights,  tint: 'var(--severity-warn)' },
          { id: 'annotations',  label: 'annotations', n: counts.annotations, tint: 'var(--accent-link)' },
        ].map(t => (
          <FilterPill key={t.id} selected={kindFilter === t.id} tint={t.tint}
            label={t.label} n={t.n} onClick={() => setKindFilter(t.id)} />
        ))}
      </div>

      {/* Subfilter row — author + severity (severity only when highlights) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
        padding: '8px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
          color: 'var(--fg-faint)', letterSpacing: '0.06em',
          marginRight: 4,
        }}>AUTHOR</span>
        {[
          { id: 'any',   label: 'any',   tint: 'var(--fg-default)' },
          { id: 'human', label: 'human', tint: 'var(--status-active)' },
          { id: 'ai',    label: 'ai',    tint: 'var(--status-emerged)' },
        ].map(f => (
          <FilterPill key={f.id} selected={authorFilter === f.id} tint={f.tint}
            label={f.label}
            n={f.id === 'any' ? null : (f.id === 'human' ? counts.human : counts.ai)}
            onClick={() => setAuthorFilter(f.id)} />
        ))}

        {kindFilter === 'highlights' && (
          <React.Fragment>
            <span style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 4px' }} />
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
              color: 'var(--fg-faint)', letterSpacing: '0.06em',
              marginRight: 4,
            }}>SEV</span>
            {[
              { id: 'any',      label: 'any',      tint: 'var(--fg-default)',         n: null },
              { id: 'critical', label: 'critical', tint: 'var(--severity-critical)',  n: counts.critical },
              { id: 'warn',     label: 'warn',     tint: 'var(--severity-warn)',      n: counts.warn },
              { id: 'info',     label: 'info',     tint: 'var(--severity-info)',      n: counts.info },
            ].map(f => (
              <FilterPill key={f.id} selected={sevFilter === f.id} tint={f.tint}
                label={f.label} n={f.n}
                onClick={() => setSevFilter(f.id)} />
            ))}
          </React.Fragment>
        )}
      </div>

      {/* Target-filter banner */}
      {targetFilter && (
        <div style={{
          padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'color-mix(in srgb, var(--accent-link) 8%, transparent)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
            color: 'var(--fg-subtle)', letterSpacing: '0.06em',
          }}>FILTER →</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-link)',
          }}>{(ENTITY_TITLES[targetFilter] || {}).label || targetFilter}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClearTargetFilter} style={{
            all: 'unset', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--fg-muted)',
          }}>× clear</button>
        </div>
      )}

      {/* List */}
      <div style={{
        flex: 1, overflowY: 'auto', position: 'relative',
        scrollbarGutter: 'stable',
      }}>
        {capped.length === 0 ? (
          <div style={{
            padding: '48px 24px', textAlign: 'center',
            color: 'var(--fg-subtle)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', marginBottom: 6 }}>(empty)</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>
              No {kindFilter === 'all' ? 'feedback' : kindFilter} match this filter.
            </div>
          </div>
        ) : groupBy === 'target' ? (
          grouped.map(g => (
            <React.Fragment key={g.targetPath}>
              <GroupHeader
                targetPath={g.targetPath}
                count={g.items.length}
                isOrphan={(ENTITY_TITLES[g.targetPath] || {}).orphan}
                isFiltered={targetFilter === g.targetPath}
                onClearFilter={onClearTargetFilter}
              />
              {g.items.map(it => it.kind === 'highlight' ? (
                <HighlightRow key={it.id} h={it} onAcknowledge={onAcknowledge} onJump={onJump} density={density} isFresh={lastFreshId === it.id} />
              ) : (
                <AnnotationRow key={it.id} a={it} onResolve={onResolve} onJump={onJump} density={density} isFresh={lastFreshId === it.id} />
              ))}
            </React.Fragment>
          ))
        ) : (
          capped.map(it => it.kind === 'highlight' ? (
            <HighlightRow key={it.id} h={it} onAcknowledge={onAcknowledge} onJump={onJump} density={density} isFresh={lastFreshId === it.id} />
          ) : (
            <AnnotationRow key={it.id} a={it} onResolve={onResolve} onJump={onJump} density={density} isFresh={lastFreshId === it.id} />
          ))
        )}

        {totalUnderShown > MAX && (
          <div style={{
            padding: '12px 14px', textAlign: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--fg-subtle)',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            showing {MAX} of {totalUnderShown} · virtualization deferred to v0.2
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--fg-subtle)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <LiveDot live={liveStream} />
        <span>{liveStream ? 'SSE channel open · MCP writes land here' : 'Live updates paused'}</span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          padding: '1px 5px', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)', borderRadius: 3,
          color: 'var(--fg-muted)',
        }}>⌘\</span>
        <span>toggle</span>
      </div>
    </aside>
  );
};

window.FeedbackDrawer = FeedbackDrawer;
