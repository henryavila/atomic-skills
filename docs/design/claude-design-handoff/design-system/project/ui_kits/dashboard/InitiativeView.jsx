/* global React, window, initiative, initiativeDone, StatusGlyph, StatusChip, TagChip, HighlightBadge, VerifierBadge, Btn, Card, SectionHeader */
const { useState: useStateInit } = React;

const TaskRow = ({ task, expanded, onToggle }) => {
  const here = task.here;
  const blocked = task.status === 'blocked';
  return (
    <div style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: here ? 'color-mix(in srgb, var(--status-active) 6%, transparent)' : 'transparent',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
      }}>
        <StatusGlyph status={task.status} size={13} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', width: 44 }}>{task.id}</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)', flex: 1 }}>
          {task.title}
          {task.tags?.map((t, i) => (
            <span key={i} style={{ marginLeft: 6 }}>
              <TagChip kind={t === 'critical' ? 'critical' : 'legacy'}>{t}</TagChip>
            </span>
          ))}
          {task.highlights > 0 && (
            <span style={{ marginLeft: 6 }}>
              <HighlightBadge severity="warn" count={task.highlights} />
            </span>
          )}
        </span>
        {task.updated && <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
        }}>{task.updated}</span>}
        {here && <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          color: 'var(--status-active)', letterSpacing: '0.08em',
        }}>HERE</span>}
        {(task.description || task.outputs) && (
          <button onClick={onToggle} style={{
            all: 'unset', cursor: 'pointer',
            color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)',
            fontSize: 13, padding: '0 4px',
          }}>{expanded ? '▾' : '▸'}</button>
        )}
      </div>
      {blocked && task.blockedBy && (
        <div style={{
          padding: '0 14px 8px 60px',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--status-blocked)',
        }}>
          blocked by: {task.blockedBy.join(', ')}
        </div>
      )}
      {expanded && task.description && (
        <div style={{
          padding: '4px 14px 14px 60px',
          background: 'var(--bg-sunken)',
          borderTop: '1px solid var(--border-subtle)',
          fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.55,
        }}>
          <div style={{ marginBottom: 10, paddingTop: 10 }}>{task.description}</div>
          {task.outputs && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="t-eyebrow" style={{ marginBottom: 4, color: 'var(--fg-subtle)' }}>outputs</div>
              {task.outputs.map((o, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)', borderRadius: 4,
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
                    padding: '1px 5px', borderRadius: 2,
                    color: 'var(--status-emerged)',
                    background: 'color-mix(in srgb, var(--status-emerged) 15%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--status-emerged) 30%, transparent)',
                    textTransform: 'uppercase',
                  }}>{o.kind}</span>
                  <span style={{ color: 'var(--fg-default)' }}>{o.path || o.command}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InitiativeView = ({ onBack, textures, slug }) => {
  const [expanded, setExpanded] = useStateInit({ 'T-002': true });
  const [gatesOpen, setGatesOpen] = useStateInit(false);
  const i = slug === 'v3-fneg1-repo-bootstrap' ? initiativeDone : initiative;
  const isDone = i.status === 'done';
  const accent = isDone ? 'var(--status-done)' : 'var(--status-active)';

  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto', padding: '20px 24px 60px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 18, marginBottom: 14 }}>
          {/* big mono ID */}
          <div style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: '8px 18px 10px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            boxShadow: isDone
              ? '0 0 0 1px color-mix(in srgb, var(--status-done) 25%, transparent), 0 0 16px -8px color-mix(in srgb, var(--status-done) 40%, transparent), var(--shadow-ambient)'
              : 'var(--shadow-glow-active)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
              background: accent,
            }} />
            <div className="t-eyebrow" style={{ color: accent, marginBottom: 4 }}>
              {isDone ? 'PHASE · COMPLETED' : 'PHASE'}
            </div>
            <div className="t-display-mono" style={{
              fontSize: 44, color: accent,
            }}>{i.phaseId}</div>
            {/* step indicator dots */}
            <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
              {Array.from({ length: 9 }).map((_, idx) => {
                const phaseLabel = `F${idx}`;
                const isCur = phaseLabel === i.phaseId;
                return <span key={idx} style={{
                  width: isCur ? 8 : 4, height: 4, borderRadius: 1,
                  background: isCur ? accent : 'var(--border-default)',
                  transition: 'all 200ms var(--ease-out)',
                }} />;
              })}
            </div>
          </div>
          {/* Title block */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
            <div className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginBottom: 6 }}>
              INITIATIVE · {i.parentPlan}
            </div>
            <h1 style={{
              margin: 0, fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 600,
              color: 'var(--fg-default)', letterSpacing: '-0.025em', lineHeight: 1.15,
            }}>{i.title.replace(/^F\d+\s*—\s*/, '')}</h1>
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 8,
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
            }}>
              <StatusChip status={i.status} />
              <span style={{ whiteSpace: 'nowrap' }}>started {i.started}</span>
              {isDone && (
                <React.Fragment>
                  <span style={{ width: 1, height: 10, background: 'var(--border-default)', flex: 'none' }} />
                  <span style={{ whiteSpace: 'nowrap' }}>
                    completed <span style={{ color: 'var(--status-done)' }}>{i.completedAt}</span>
                  </span>
                  <span style={{ width: 1, height: 10, background: 'var(--border-default)', flex: 'none' }} />
                  <span style={{ whiteSpace: 'nowrap' }}>
                    duration <span style={{ color: 'var(--fg-default)' }}>{i.durationDays}d</span>
                  </span>
                </React.Fragment>
              )}
              <span style={{ width: 1, height: 10, background: 'var(--border-default)', flex: 'none' }} />
              <span style={{ whiteSpace: 'nowrap' }}>branch <span style={{ color: 'var(--fg-default)' }}>{i.branch}</span></span>
              {i.tag && (
                <React.Fragment>
                  <span style={{ width: 1, height: 10, background: 'var(--border-default)', flex: 'none' }} />
                  <span style={{ whiteSpace: 'nowrap' }}>tag <span style={{ color: 'var(--status-done)' }}>{i.tag}</span></span>
                </React.Fragment>
              )}
            </div>
          </div>
        </div>

        <p style={{
          margin: '0', fontFamily: 'var(--font-sans)', fontSize: 15,
          color: 'var(--fg-default)', lineHeight: 1.55, textWrap: 'pretty',
        }}>
          {i.goal}
        </p>
        <div style={{
          marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)',
        }}>
          <span style={{ color: 'var(--fg-subtle)' }}>scope · </span>
          {i.scope.map((p, idx) => (
            <span key={p}>
              <span style={{ color: 'var(--fg-default)' }}>{p}</span>
              {idx < i.scope.length - 1 ? <span style={{ color: 'var(--fg-faint)' }}> + </span> : ''}
            </span>
          ))}
        </div>
        <div style={{
          marginTop: 6, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)',
        }}>
          {isDone
            ? <span>Completed <span style={{ color: 'var(--status-done)', fontWeight: 500 }}>{i.completedAt}</span> after <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{i.durationDays} days</span>. All exit gates met. No further action required.</span>
            : <span>Next: <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{i.nextAction}</span></span>}
        </div>
      </div>

      {/* Exit gates — collapsed summary when done */}
      <Card>
        <SectionHeader count={i.exitGates.length} action={
          isDone
            ? <button onClick={() => setGatesOpen(o => !o)} style={{
                all: 'unset', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--status-done)',
              }}>
                <span>✓ {i.exitGates.filter(g => g.status === 'met').length} / {i.exitGates.length} met</span>
                <span style={{ color: 'var(--fg-subtle)' }}>{gatesOpen ? '▾' : '▸'}</span>
              </button>
            : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--status-blocked)' }}>
                0 / {i.exitGates.length} met
              </span>
        }>Exit gates</SectionHeader>
        {(!isDone || gatesOpen) && i.exitGates.map((g, idx) => (
          <div key={g.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
            borderBottom: idx < i.exitGates.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            opacity: isDone ? 0.85 : 1,
          }}>
            <StatusGlyph status={g.status === 'met' ? 'done' : g.status} size={13} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', width: 56 }}>{g.id}</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)', flex: 1 }}>{g.description}</span>
            {g.metAt && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>met {g.metAt}</span>}
            <VerifierBadge kind={g.verifier.kind} />
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
              maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{g.verifier.command}</span>
          </div>
        ))}
      </Card>

      {/* Outputs — only for done */}
      {isDone && i.outputs && i.outputs.length > 0 && (
        <Card style={{ borderColor: 'color-mix(in srgb, var(--status-done) 20%, var(--border-default))' }}>
          <SectionHeader count={i.outputs.length}>Outputs · what shipped</SectionHeader>
          {i.outputs.map((o, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              borderBottom: idx < i.outputs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '2px 7px', borderRadius: 3, whiteSpace: 'nowrap',
                color: o.kind === 'tag' ? 'var(--status-done)' : 'var(--status-emerged)',
                background: o.kind === 'tag'
                  ? 'color-mix(in srgb, var(--status-done) 15%, transparent)'
                  : 'color-mix(in srgb, var(--status-emerged) 15%, transparent)',
                border: `1px solid color-mix(in srgb, ${o.kind === 'tag' ? 'var(--status-done)' : 'var(--status-emerged)'} 30%, transparent)`,
              }}>{o.kind}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg-default)', whiteSpace: 'nowrap' }}>{o.value}</span>
              {o.meta && <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)', textAlign: 'right' }}>{o.meta}</span>}
            </div>
          ))}
        </Card>
      )}

      {/* Decisions — only for done */}
      {isDone && i.decisions && i.decisions.length > 0 && (
        <Card>
          <SectionHeader count={i.decisions.length}>Decisions made</SectionHeader>
          {i.decisions.map((d, idx) => (
            <div key={d.id} style={{
              padding: '12px 16px',
              borderBottom: idx < i.decisions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{d.id}</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--fg-default)', flex: 1 }}>{d.title}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{d.resolvedAt}</span>
              </div>
              <p style={{
                margin: '6px 0 0', paddingLeft: 12, borderLeft: '2px solid var(--border-strong)',
                fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.55,
              }}>{d.body}</p>
            </div>
          ))}
        </Card>
      )}

      {/* Stack — only when active */}
      {!isDone && (
        <Card>
          <SectionHeader>Stack · depth 1</SectionHeader>
          <div style={{ padding: '8px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-default)' }}>
            └─ {i.phaseId} kickoff <span style={{ color: 'var(--fg-subtle)' }}>(task)</span>{' '}
            <span style={{ color: 'var(--status-active)', marginLeft: 8 }}>◉ HERE</span>
          </div>
        </Card>
      )}

      {/* Tasks */}
      <Card>
        <SectionHeader count={i.tasks.length} action={
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>
            {i.tasks.filter(t => t.status === 'done').length} done · {i.tasks.filter(t => t.status === 'active').length} active · {i.tasks.filter(t => t.status === 'blocked').length} blocked
          </span>
        }>Tasks</SectionHeader>
        {i.tasks.map((t, idx) => (
          <TaskRow key={t.id} task={t}
            expanded={!!expanded[t.id]}
            onToggle={() => setExpanded(s => ({ ...s, [t.id]: !s[t.id] }))} />
        ))}
      </Card>

      {/* Parked / Emerged */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <SectionHeader count={i.parked.length}>Parked</SectionHeader>
          <div style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>
            (empty)
          </div>
        </Card>
        <Card>
          <SectionHeader count={i.emerged.length}>Emerged</SectionHeader>
          {i.emerged.map((e, idx) => (
            <div key={idx} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusGlyph status="emerged" size={13} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)', flex: 1 }}>{e.title}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>surfaced {e.surfacedAt}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* References / Cross-refs */}
      <Card>
        <SectionHeader count={i.references.length + i.crossTaskRefs.length}>References & cross-refs</SectionHeader>
        <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {i.references.map((r, idx) => (
            <div key={idx} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-link)' }}>
              → {r.path}{r.section ? ` § ${r.section}` : ''}
              {r.gitignored && <span style={{ marginLeft: 8 }}><TagChip>gitignored</TagChip></span>}
            </div>
          ))}
          {i.crossTaskRefs.map((c, idx) => (
            <div key={idx} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>
              ↗ <span style={{ color: 'var(--fg-default)' }}>{c.fromTaskId}</span> {c.relation.replace('_', ' ')}{' '}
              <a href="#" style={{ color: 'var(--accent-link)', textDecoration: 'none' }}>{c.toInitiativeSlug}</a>{' '}
              <span style={{ color: 'var(--fg-default)' }}>{c.toTaskId}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Narrative body */}
      <Card>
        <SectionHeader>Narrative body</SectionHeader>
        <div style={{
          padding: '14px 18px', fontFamily: 'var(--font-sans)', fontSize: 13,
          color: 'var(--fg-default)', lineHeight: 1.65, textWrap: 'pretty',
        }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>Why</h3>
          <p style={{ margin: 0, color: 'var(--fg-muted)' }}>
            O retrabalho começa por dados. Se a base estiver suja, qualquer telinha bonita vai mostrar lixo bonito.
          </p>
          {!isDone && (
            <React.Fragment>
              <h3 style={{ margin: '14px 0 6px', fontSize: 16 }}>Decisions</h3>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--fg-muted)' }}>
                <li>Manter o pipeline em bash (sem ETL pesado) — auditável.</li>
                <li>Tag <code className="t-code-inline">core-v2</code> é o ponto de não retorno.</li>
              </ul>
            </React.Fragment>
          )}
        </div>
      </Card>

      {isDone && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'var(--bg-surface)',
          border: '1px dashed var(--border-default)',
          borderRadius: 10,
          fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)',
          gap: 12,
        }}>
          <span>This initiative is closed. Reopening writes a <code className="t-code-inline">reopen</code> intent to the inbox — no file is touched directly.</span>
          <Btn variant="ghost" size="sm">Request reopen</Btn>
        </div>
      )}
    </div>
  );
};

window.InitiativeView = InitiativeView;
