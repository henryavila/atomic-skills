/* global React, window, StatusGlyph, VerifierBadge, TagChip, Card, SectionHeader, AnnotationBadge */

const { useState: useStateT, useEffect: useEffectT } = React;

// ── BlockedByChip — clickable chip; signals cross-init visually ───────────
const BlockedByChip = ({ block, onJumpTask }) => {
  const isCross = !!block.crossInitiative;
  const isDone = block.status === 'done';
  const color =
    isDone ? 'var(--status-done)' :
    isCross ? 'var(--status-emerged)' :
              'var(--status-blocked)';

  return (
    <button onClick={(e) => { e.stopPropagation(); onJumpTask && onJumpTask(block); }}
      title={isCross
        ? `Cross-initiative dependency — navigates to ${block.initiative}#task-${block.taskId}`
        : `Jump to ${block.taskId} in this initiative`}
      style={{
        all: 'unset', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 20, padding: '0 8px', borderRadius: 4,
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
        color, background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 38%, transparent)`,
        whiteSpace: 'nowrap',
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = `color-mix(in srgb, ${color} 18%, transparent)`}
      onMouseLeave={(e) => e.currentTarget.style.background = `color-mix(in srgb, ${color} 10%, transparent)`}
    >
      {isDone ? '✓' : '⊘'}
      <span>{block.taskId}</span>
      {isCross && (
        <React.Fragment>
          <span style={{ color: 'var(--fg-faint)', fontSize: 9 }}>↗</span>
          <span style={{
            color: 'color-mix(in srgb, ' + color + ' 80%, var(--fg-default))',
            fontSize: 10, fontWeight: 400,
            maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{block.initiative}</span>
        </React.Fragment>
      )}
    </button>
  );
};

// ── CrossTaskRefChip — bidirectional cross-initiative link ───────────────
const CrossTaskRefChip = ({ xref, onJump }) => (
  <button onClick={(e) => { e.stopPropagation(); onJump && onJump(xref); }}
    title={`Cross-initiative ref: ${xref.relation} → ${xref.toInitiative}#task-${xref.toTaskId}`}
    style={{
      all: 'unset', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', height: 22, borderRadius: 4,
      fontFamily: 'var(--font-mono)', fontSize: 11,
      color: 'var(--status-emerged)',
      background: 'color-mix(in srgb, var(--status-emerged) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--status-emerged) 35%, transparent)',
      whiteSpace: 'nowrap',
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--status-emerged) 16%, transparent)'}
    onMouseLeave={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--status-emerged) 8%, transparent)'}
  >
    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {xref.relation}
    </span>
    <span style={{ color: 'var(--fg-faint)' }}>↗</span>
    <span style={{ color: 'var(--fg-default)' }}>{xref.toInitiative}</span>
    <span style={{ color: 'var(--fg-faint)' }}>#</span>
    <span style={{ color: 'var(--status-emerged)', fontWeight: 500 }}>{xref.toTaskId}</span>
    {xref.toTaskTitle && (
      <span style={{
        color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)',
        maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
      }}>— {xref.toTaskTitle}</span>
    )}
  </button>
);

// ── OutputChip ─────────────────────────────────────────────────────────────
const OUTPUT_KIND = {
  command:   { color: 'var(--status-active)',    label: 'cmd' },
  script:    { color: 'var(--status-active)',    label: 'script' },
  migration: { color: 'var(--status-emerged)',   label: 'migration' },
  file:      { color: 'var(--fg-muted)',         label: 'file' },
  log:       { color: 'var(--fg-subtle)',        label: 'log' },
  tag:       { color: 'var(--status-done)',      label: 'tag' },
  snapshot:  { color: 'var(--status-parked)',    label: 'snapshot' },
  workflow:  { color: 'var(--status-emerged)',   label: 'workflow' },
};

const OutputChip = ({ output }) => {
  const k = OUTPUT_KIND[output.kind] || { color: 'var(--fg-muted)', label: output.kind };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px',
      background: 'var(--bg-canvas)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 4,
      fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      <span style={{
        fontSize: 9, fontWeight: 600, letterSpacing: '0.05em',
        padding: '1px 6px', borderRadius: 2,
        color: k.color,
        background: `color-mix(in srgb, ${k.color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${k.color} 30%, transparent)`,
        textTransform: 'uppercase',
      }}>{k.label}</span>
      <span style={{ color: 'var(--fg-default)', wordBreak: 'break-all' }}>{output.value}</span>
    </div>
  );
};

// ── TaskRow ──────────────────────────────────────────────────────────────
const TaskRow = ({ task, expanded, onToggle, hashTarget, isLast,
                   onJumpToBlocker, onJumpToCrossRef, onOpenAnnotation }) => {
  const here = task.here;
  const isBlocked = task.status === 'blocked';
  const isDone = task.status === 'done';

  return (
    <div
      id={`task-${task.id}`}
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
        background: hashTarget
          ? 'color-mix(in srgb, var(--status-active) 9%, transparent)'
          : here
            ? 'color-mix(in srgb, var(--status-active) 4%, transparent)'
            : 'transparent',
        position: 'relative',
        scrollMarginTop: 80,
        transition: 'background 200ms',
      }}>
      {hashTarget && (
        <div aria-hidden style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 2, background: 'var(--status-active)',
        }} />
      )}

      {/* Header row */}
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px',
        cursor: 'pointer',
      }}>
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label={expanded ? 'Collapse' : 'Expand'} style={{
          all: 'unset', cursor: 'pointer',
          color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)',
          fontSize: 11, width: 14, textAlign: 'center', flex: 'none',
        }}>{expanded ? '▾' : '▸'}</button>

        <StatusGlyph status={task.status} size={13} />

        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
          color: isDone ? 'var(--status-done)' :
                 isBlocked ? 'var(--status-blocked)' :
                 here ? 'var(--status-active)' :
                 'var(--fg-muted)',
          width: 46, flex: 'none',
        }}>{task.id}</span>

        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 13.5,
          color: isDone ? 'var(--fg-muted)' : 'var(--fg-default)',
          flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textDecoration: isDone ? 'line-through' : 'none',
          textDecorationColor: 'color-mix(in srgb, var(--status-done) 40%, transparent)',
        }}>{task.title}</span>

        {/* tags */}
        {task.tags && task.tags.slice(0, 3).map((tag, i) => (
          <TagChip key={i} kind={
            tag === 'critical' ? 'critical' :
            tag === 'matcher' || tag === 'gap-legacy' ? 'legacy' :
            'neutral'
          }>{tag}</TagChip>
        ))}

        {/* annotation badge */}
        {task.annotations > 0 && (
          <AnnotationBadge count={task.annotations}
            onClick={() => onOpenAnnotation && onOpenAnnotation(task.id)} />
        )}

        {here && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
            color: 'var(--status-active)', letterSpacing: '0.1em',
            padding: '2px 7px', borderRadius: 999,
            background: 'color-mix(in srgb, var(--status-active) 14%, transparent)',
            border: '1px solid color-mix(in srgb, var(--status-active) 40%, transparent)',
            whiteSpace: 'nowrap',
          }}>◉ HERE</span>
        )}

        {hashTarget && !here && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
            color: 'var(--status-active)', letterSpacing: '0.08em',
            padding: '2px 7px', borderRadius: 999,
            background: 'color-mix(in srgb, var(--status-active) 14%, transparent)',
            border: '1px solid color-mix(in srgb, var(--status-active) 38%, transparent)',
            whiteSpace: 'nowrap',
          }}>FROM URL</span>
        )}

        {task.updated && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10.5,
            color: 'var(--fg-subtle)', flex: 'none',
          }}>{task.updated}</span>
        )}
      </div>

      {/* Blocked-by summary always-visible if any */}
      {isBlocked && task.blockedBy && task.blockedBy.length > 0 && !expanded && (
        <div style={{
          padding: '0 14px 10px 60px',
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          fontFamily: 'var(--font-mono)', fontSize: 11,
        }}>
          <span style={{ color: 'var(--status-blocked)', fontWeight: 500 }}>blocked by</span>
          {task.blockedBy.map((b, i) => (
            <BlockedByChip key={i} block={b} onJumpTask={onJumpToBlocker} />
          ))}
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div style={{
          padding: '4px 18px 14px 60px',
          background: 'var(--bg-sunken)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {task.description && (
            <p style={{
              margin: '12px 0 0',
              fontFamily: 'var(--font-sans)', fontSize: 12.5,
              color: 'var(--fg-default)', lineHeight: 1.6,
              textWrap: 'pretty',
            }}>{task.description}</p>
          )}

          {/* Blocked-by full chain in expanded view */}
          {isBlocked && task.blockedBy && task.blockedBy.length > 0 && (
            <div>
              <div className="t-eyebrow" style={{
                color: 'var(--status-blocked)', marginBottom: 6,
              }}>BLOCKED BY · {task.blockedBy.length}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {task.blockedBy.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BlockedByChip block={b} onJumpTask={onJumpToBlocker} />
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: 12,
                      color: 'var(--fg-muted)',
                    }}>{b.title}</span>
                    {b.crossInitiative && (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                        color: 'var(--status-emerged)', letterSpacing: '0.05em',
                        padding: '1px 6px', borderRadius: 3,
                        background: 'color-mix(in srgb, var(--status-emerged) 10%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--status-emerged) 30%, transparent)',
                      }}>CROSS-INITIATIVE</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cross-task refs (outbound) */}
          {task.crossTaskRefs && task.crossTaskRefs.length > 0 && (
            <div>
              <div className="t-eyebrow" style={{
                color: 'var(--status-emerged)', marginBottom: 6,
              }}>CROSS-TASK REFS · {task.crossTaskRefs.length}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {task.crossTaskRefs.map((r, i) => (
                  <CrossTaskRefChip key={i} xref={r} onJump={onJumpToCrossRef} />
                ))}
              </div>
            </div>
          )}

          {/* Outputs */}
          {task.outputs && task.outputs.length > 0 && (
            <div>
              <div className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginBottom: 6 }}>
                OUTPUTS · {task.outputs.length}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 6,
              }}>
                {task.outputs.map((o, i) => <OutputChip key={i} output={o} />)}
              </div>
            </div>
          )}

          {/* Verifier preview */}
          {task.verifier && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              }}>
                <span className="t-eyebrow" style={{ color: 'var(--fg-subtle)' }}>VERIFIER</span>
                <VerifierBadge kind={task.verifier.kind} />
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11.5,
                padding: '8px 10px',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
                color: 'var(--fg-default)',
                wordBreak: 'break-all', lineHeight: 1.5,
              }}>
                <span style={{ color: 'var(--fg-faint)', marginRight: 6, userSelect: 'none' }}>$</span>
                {task.verifier.command}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── TaskList — Card with header + expansion state preserved across renders ─
const TaskList = ({ tasks, hashTask, expanded, setExpanded,
                    onJumpToBlocker, onJumpToCrossRef, onOpenAnnotation }) => {
  // Auto-expand task that's the hash target
  useEffectT(() => {
    if (!hashTask) return;
    setExpanded(s => s[hashTask] ? s : ({ ...s, [hashTask]: true }));
    const el = document.getElementById(`task-${hashTask}`);
    if (!el) return;
    setTimeout(() => {
      let sc = el.parentElement;
      while (sc && sc !== document.body) {
        const ov = getComputedStyle(sc).overflowY;
        if (ov === 'auto' || ov === 'scroll') break;
        sc = sc.parentElement;
      }
      if (sc && sc !== document.body) {
        sc.scrollTo({ top: el.offsetTop - 90, behavior: 'smooth' });
      }
    }, 80);
  }, [hashTask, setExpanded]);

  const counts = {
    done:    tasks.filter(t => t.status === 'done').length,
    active:  tasks.filter(t => t.status === 'active').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    pending: tasks.filter(t => t.status === 'pending').length,
  };

  return (
    <Card>
      <SectionHeader count={tasks.length} action={
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
        }}>
          <span><span style={{ color: 'var(--status-done)', fontWeight: 500 }}>{counts.done}</span> done</span>
          {counts.active > 0 && <span><span style={{ color: 'var(--status-active)', fontWeight: 500 }}>{counts.active}</span> active</span>}
          {counts.blocked > 0 && <span><span style={{ color: 'var(--status-blocked)', fontWeight: 500 }}>{counts.blocked}</span> blocked</span>}
          {counts.pending > 0 && <span><span style={{ color: 'var(--fg-muted)', fontWeight: 500 }}>{counts.pending}</span> pending</span>}
        </span>
      }>Tasks</SectionHeader>
      {tasks.map((t, idx) => (
        <TaskRow key={t.id} task={t}
          expanded={!!expanded[t.id]}
          hashTarget={hashTask === t.id}
          isLast={idx === tasks.length - 1}
          onToggle={() => setExpanded(s => ({ ...s, [t.id]: !s[t.id] }))}
          onJumpToBlocker={onJumpToBlocker}
          onJumpToCrossRef={onJumpToCrossRef}
          onOpenAnnotation={onOpenAnnotation} />
      ))}
    </Card>
  );
};

Object.assign(window, { TaskList, TaskRow, BlockedByChip, CrossTaskRefChip, OutputChip });
