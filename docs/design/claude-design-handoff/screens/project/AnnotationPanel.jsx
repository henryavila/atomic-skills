/* global React, window, annotations, HighlightBadge */
const { useState: useStateAnn, useRef: useRefAnn } = React;

// ── AuthorChip ────────────────────────────────────────────────────────────
const AuthorChip = ({ author }) => {
  const isAi = author === 'ai';
  const color = isAi ? 'var(--status-emerged)' : 'var(--status-active)';
  const bg    = isAi ? 'var(--status-emerged-bg)' : 'var(--status-active-bg)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      height: 18, padding: '0 7px', borderRadius: 999,
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
      color, background: bg,
      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 9 }}>{isAi ? '⌬' : '◉'}</span>
      {author}
    </span>
  );
};

// ── Composer ──────────────────────────────────────────────────────────────
// Used for both replying to an existing annotation and creating a new one.
const Composer = ({
  placeholder = 'Reply…',
  initialAuthor = 'human',
  allowAuthorToggle = true,
  size = 'inline',           // 'inline' | 'panel'
  submitLabel = 'Reply',
  onSubmit, onCancel,
}) => {
  const [text, setText] = useStateAnn('');
  const [author, setAuthor] = useStateAnn(initialAuthor);
  const taRef = useRefAnn(null);

  React.useEffect(() => {
    // Autofocus when the composer mounts (matches the "click Reply → start typing" UX)
    if (taRef.current && size === 'inline') taRef.current.focus();
  }, [size]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit && onSubmit({ author, body: trimmed });
    setText('');
  };

  const handleKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel && onCancel();
    }
  };

  return (
    <div style={{
      background: size === 'panel' ? 'var(--bg-surface)' : 'var(--bg-canvas)',
      border: '1px solid var(--border-default)',
      borderRadius: 6,
      padding: size === 'panel' ? '10px 12px' : '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Author toggle (only when relevant) */}
      {allowAuthorToggle && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--fg-subtle)', letterSpacing: '0.04em',
          }}>as</span>
          {['human', 'ai'].map(a => {
            const sel = author === a;
            const color = a === 'ai' ? 'var(--status-emerged)' : 'var(--status-active)';
            return (
              <button key={a} onClick={() => setAuthor(a)} style={{
                all: 'unset', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 999,
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                color: sel ? color : 'var(--fg-muted)',
                background: sel ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
                border: `1px solid ${sel ? `color-mix(in srgb, ${color} 35%, transparent)` : 'var(--border-subtle)'}`,
              }}>
                <span style={{ fontSize: 9 }}>{a === 'ai' ? '⌬' : '◉'}</span>{a}
              </button>
            );
          })}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        rows={size === 'panel' ? 3 : 2}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'transparent',
          border: 'none', outline: 'none', resize: 'vertical',
          color: 'var(--fg-default)',
          fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5,
          minHeight: 44,
        }}
      />

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        borderTop: '1px solid var(--border-subtle)', paddingTop: 8,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--fg-subtle)',
        }}>⌘↵ submit · esc cancel</span>
        <div style={{ flex: 1 }} />
        {onCancel && (
          <button onClick={onCancel} style={{
            all: 'unset', cursor: 'pointer',
            height: 22, padding: '0 10px',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--fg-muted)',
          }}>cancel</button>
        )}
        <button onClick={handleSubmit}
                disabled={!text.trim()}
                style={{
          all: 'unset', cursor: text.trim() ? 'pointer' : 'not-allowed',
          height: 22, padding: '0 12px',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
          color: text.trim() ? 'var(--fg-on-accent)' : 'var(--fg-faint)',
          background: text.trim() ? 'var(--status-active)' : 'var(--bg-elevated)',
          border: `1px solid ${text.trim() ? 'color-mix(in srgb, var(--status-active) 60%, transparent)' : 'var(--border-subtle)'}`,
          borderRadius: 4,
        }}>{submitLabel}</button>
      </div>
    </div>
  );
};

// ── Reply (read-only entry in a thread) ───────────────────────────────────
const ReplyEntry = ({ reply }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', gap: 6,
    padding: '8px 10px',
    background: 'var(--bg-canvas)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 6,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <AuthorChip author={reply.author} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
      }}>{reply.createdAt}</span>
    </div>
    <div style={{
      fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--fg-default)',
      lineHeight: 1.55, textWrap: 'pretty',
    }}>{reply.body}</div>
  </div>
);

// ── AnnotationEntry ───────────────────────────────────────────────────────
const AnnotationEntry = ({ a, onAddReply, onToggleResolved }) => {
  const [replying, setReplying] = useStateAnn(false);
  const [threadOpen, setThreadOpen] = useStateAnn(true);
  const resolved = !!a.resolved;
  const replyCount = (a.replies || []).length;

  return (
    <div style={{
      padding: '14px 14px',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', gap: 10,
      opacity: resolved ? 0.55 : 1,
      transition: 'opacity 140ms var(--ease-out)',
    }}>
      {/* Target path */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
        lineHeight: 1.4,
        display: 'flex', alignItems: 'center', gap: 6,
        flexWrap: 'wrap',
      }}>
        <span style={{ color: 'var(--fg-faint)' }}>►</span>
        <span style={{ color: 'var(--accent-link)' }}>{a.target.slug}</span>
        <span style={{ color: 'var(--fg-faint)' }}>/</span>
        <span style={{ color: 'var(--fg-muted)' }}>{a.target.path}</span>
      </div>

      {/* Author + time + severity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <AuthorChip author={a.author} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
          whiteSpace: 'nowrap',
        }}>{a.createdAt}</span>
        {a.severity && <HighlightBadge severity={a.severity} count={1} />}
        {resolved && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            height: 18, padding: '0 7px', borderRadius: 999,
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
            color: 'var(--status-done)',
            background: 'var(--status-done-bg)',
            border: '1px solid color-mix(in srgb, var(--status-done) 35%, transparent)',
          }}>✓ resolved</span>
        )}
      </div>

      {/* Body */}
      <div style={{
        fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)',
        lineHeight: 1.55, borderLeft: '2px solid var(--border-strong)',
        paddingLeft: 10,
        textDecoration: resolved ? 'line-through' : 'none',
        textDecorationColor: 'var(--fg-faint)',
      }}>{a.body}</div>

      {/* Thread (replies) */}
      {replyCount > 0 && (
        <div style={{ marginLeft: 12 }}>
          <button onClick={() => setThreadOpen(v => !v)} style={{
            all: 'unset', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
            color: 'var(--fg-muted)', letterSpacing: '0.04em',
            padding: '2px 0', marginBottom: threadOpen ? 8 : 0,
          }}>
            <span style={{ color: 'var(--fg-subtle)' }}>{threadOpen ? '▾' : '▸'}</span>
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </button>
          {threadOpen && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              paddingLeft: 10,
              borderLeft: '1px dashed var(--border-subtle)',
            }}>
              {a.replies.map(r => <ReplyEntry key={r.id} reply={r} />)}
            </div>
          )}
        </div>
      )}

      {/* Inline reply composer */}
      {replying && (
        <div style={{ marginLeft: 12 }}>
          <Composer
            placeholder={`Reply to ${a.author}…`}
            onSubmit={(payload) => {
              onAddReply(a.id, payload);
              setReplying(false);
            }}
            onCancel={() => setReplying(false)}
            submitLabel="Reply"
          />
        </div>
      )}

      {/* Actions */}
      {!replying && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => onToggleResolved(a.id)} style={{
            all: 'unset', cursor: 'pointer',
            height: 24, padding: '0 10px',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: resolved ? 'var(--fg-muted)' : 'var(--accent-link)',
            border: `1px solid ${resolved ? 'var(--border-subtle)' : 'var(--border-default)'}`,
            borderRadius: 4,
            transition: 'background 120ms',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            [{resolved ? 'Reopen' : 'Resolve'}]
          </button>
          {!resolved && (
            <button onClick={() => setReplying(true)} style={{
              all: 'unset', cursor: 'pointer',
              height: 24, padding: '0 10px',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--fg-muted)',
              border: '1px solid transparent', borderRadius: 4,
              transition: 'background 120ms, color 120ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--fg-default)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent';      e.currentTarget.style.color = 'var(--fg-muted)'; }}>
              [Reply]
            </button>
          )}
          <button style={{
            all: 'unset', cursor: 'pointer',
            height: 24, padding: '0 8px',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--fg-subtle)',
            border: '1px solid transparent', borderRadius: 4,
          }}
          title="Go to target in the plan"
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--fg-default)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent';      e.currentTarget.style.color = 'var(--fg-subtle)'; }}>
            ↗ go to
          </button>
        </div>
      )}
    </div>
  );
};

// ── AnnotationPanel ───────────────────────────────────────────────────────
const AnnotationPanel = ({ open, onClose }) => {
  const [filter, setFilter] = useStateAnn('all');
  const [composing, setComposing] = useStateAnn(false);
  const [items, setItems] = useStateAnn(annotations);

  const addReply = (annId, payload) => {
    setItems(prev => prev.map(a => {
      if (a.id !== annId) return a;
      const replies = [...(a.replies || []), {
        id: `${annId}-r${(a.replies || []).length + 1}`,
        author: payload.author, body: payload.body, createdAt: 'just now',
      }];
      return { ...a, replies };
    }));
  };

  const toggleResolved = (annId) => {
    setItems(prev => prev.map(a => a.id === annId ? { ...a, resolved: !a.resolved } : a));
  };

  const addNew = (payload) => {
    const newAnn = {
      id: `new-${Date.now()}`,
      target: { slug: 'v3-redesign', path: 'phases.F0' },
      author: payload.author,
      severity: null,
      createdAt: 'just now',
      body: payload.body,
      replies: [],
    };
    setItems(prev => [newAnn, ...prev]);
    setComposing(false);
  };

  const counts = React.useMemo(() => {
    const c = { all: 0, human: 0, ai: 0, resolved: 0 };
    items.forEach(a => {
      c.all++;
      if (a.author === 'human') c.human++;
      if (a.author === 'ai') c.ai++;
      if (a.resolved) c.resolved++;
    });
    return c;
  }, [items]);

  const filtered = items.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'resolved') return a.resolved;
    return a.author === filter && !a.resolved;
  });

  if (!open) return null;
  return (
    <aside style={{
      width: 380, flex: 'none',
      background: 'var(--bg-canvas)',
      borderLeft: '1px solid var(--border-default)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-default)',
      }}>
        <span className="t-eyebrow" style={{ color: 'var(--fg-default)' }}>Annotations</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
          padding: '1px 7px', borderRadius: 999,
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        }}>{counts.all}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setComposing(v => !v)}
                title="New annotation"
                aria-label="New annotation"
                style={{
          all: 'unset', cursor: 'pointer',
          height: 24, padding: '0 10px',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
          color: composing ? 'var(--fg-muted)' : 'var(--status-active)',
          border: `1px solid ${composing ? 'var(--border-subtle)' : 'color-mix(in srgb, var(--status-active) 40%, transparent)'}`,
          background: composing ? 'transparent' : 'color-mix(in srgb, var(--status-active) 10%, transparent)',
          borderRadius: 4,
        }}>{composing ? '× close' : '+ new'}</button>
        <button onClick={onClose} aria-label="Close panel" style={{
          all: 'unset', cursor: 'pointer', color: 'var(--fg-muted)',
          fontFamily: 'var(--font-mono)', fontSize: 18, padding: '0 4px',
        }}>×</button>
      </div>

      {/* Filter chips */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
      }}>
        {[
          { id: 'all',      label: 'all',      n: counts.all,      tint: 'var(--fg-default)' },
          { id: 'human',    label: 'human',    n: counts.human,    tint: 'var(--status-active)' },
          { id: 'ai',       label: 'ai',       n: counts.ai,       tint: 'var(--status-emerged)' },
          { id: 'resolved', label: 'resolved', n: counts.resolved, tint: 'var(--status-done)' },
        ].map(f => {
          const sel = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              all: 'unset', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 22, padding: '0 10px',
              background: sel ? 'var(--bg-elevated)' : 'transparent',
              color: sel ? f.tint : 'var(--fg-muted)',
              border: `1px solid ${sel ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
              borderRadius: 999,
              fontFamily: 'var(--font-sans)', fontSize: 11,
            }}>
              {f.label}
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                color: sel ? f.tint : 'var(--fg-subtle)',
              }}>{f.n}</span>
            </button>
          );
        })}
      </div>

      {/* New-annotation composer */}
      {composing && (
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'color-mix(in srgb, var(--status-active) 4%, var(--bg-canvas))',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
            color: 'var(--fg-subtle)', letterSpacing: '0.06em', marginBottom: 6,
          }}>NEW ANNOTATION · attaching to <span style={{ color: 'var(--accent-link)' }}>v3-redesign/phases.F0</span></div>
          <Composer
            size="panel"
            placeholder="What do you want flagged? Be specific — include a path or ID if you can."
            initialAuthor="human"
            submitLabel="Post"
            onSubmit={addNew}
            onCancel={() => setComposing(false)}
          />
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '36px 20px', textAlign: 'center',
            fontFamily: 'var(--font-sans)', fontSize: 12,
            color: 'var(--fg-subtle)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 6 }}>(empty)</div>
            No annotations match this filter.
          </div>
        ) : (
          filtered.map(a => (
            <AnnotationEntry key={a.id} a={a}
              onAddReply={addReply}
              onToggleResolved={toggleResolved} />
          ))
        )}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--fg-subtle)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color: 'var(--fg-faint)' }}>⌐</span>
        annotations are bidirectional · MCP writes from agents land here too
      </div>
    </aside>
  );
};

window.AnnotationPanel = AnnotationPanel;
