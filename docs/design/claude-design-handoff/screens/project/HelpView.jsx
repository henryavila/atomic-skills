/* global React, window, skills, StatusGlyph */
const { useState, useMemo, useRef, useEffect, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────
// Local helpers
// ─────────────────────────────────────────────────────────────────────

const slashCommand = (id) => `/atomic-skills:${id}`;

const matchesQuery = (skill, q) => {
  if (!q) return true;
  const needle = q.toLowerCase();
  const haystacks = [
    skill.id,
    skill.title,
    skill.summary || '',
    ...(skill.when || []),
    ...(skill.whenNot || []),
  ];
  return haystacks.some(s => s.toLowerCase().includes(needle));
};

const useCopyButton = () => {
  const [copiedKey, setCopiedKey] = useState(null);
  const timerRef = useRef(null);
  const copy = useCallback((text, key) => {
    const finish = () => {
      setCopiedKey(key);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiedKey(null), 1400);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(finish).catch(finish);
    } else {
      // Fallback for non-secure contexts (file://, http preview iframes).
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
      finish();
    }
  }, []);
  return [copiedKey, copy];
};

// ─────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────

// Tiny status-dot — green = active in this repo, dim = available only.
const ActiveDot = ({ active, size = 7 }) => (
  <span style={{
    position: 'relative', width: size, height: size, flex: 'none',
    display: 'inline-block',
  }}>
    <span style={{
      position: 'absolute', inset: 0, borderRadius: '50%',
      background: active ? 'var(--status-done)' : 'var(--fg-faint)',
      boxShadow: active
        ? '0 0 6px color-mix(in srgb, var(--status-done) 70%, transparent)'
        : 'none',
    }} />
  </span>
);

// Pill button — used for filter scope and related-skill chips.
const Pill = ({ active, onClick, children, count, ...rest }) => (
  <button
    onClick={onClick}
    {...rest}
    style={{
      height: 26, padding: '0 11px',
      display: 'inline-flex', alignItems: 'center', gap: 7,
      background: active ? 'var(--bg-elevated)' : 'transparent',
      color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
      border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-default)'}`,
      borderRadius: 999,
      fontFamily: 'var(--font-sans)', fontSize: 12,
      fontWeight: active ? 600 : 500,
      cursor: 'pointer',
      transition: 'all 120ms var(--ease-out)',
      whiteSpace: 'nowrap',
    }}>
    {children}
    {count != null && (
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: active ? 'var(--fg-muted)' : 'var(--fg-subtle)',
        padding: '1px 5px', borderRadius: 999,
        background: active ? 'var(--bg-sunken)' : 'transparent',
        border: `1px solid ${active ? 'var(--border-default)' : 'var(--border-subtle)'}`,
      }}>{count}</span>
    )}
  </button>
);

// Copy-command surface (mono code + clipboard button).
const CommandRow = ({ command, copyKey, copiedKey, onCopy, dense = false }) => {
  const isCopied = copiedKey === copyKey;
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 0,
      border: `1px solid ${isCopied ? 'color-mix(in srgb, var(--status-done) 35%, var(--border-default))' : 'var(--border-default)'}`,
      borderRadius: 6, overflow: 'hidden',
      background: 'var(--bg-sunken)',
      transition: 'border-color 200ms var(--ease-out)',
    }}>
      <code style={{
        flex: 1, minWidth: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: dense ? 11 : 12,
        padding: dense ? '5px 9px' : '7px 11px',
        color: 'var(--fg-default)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        userSelect: 'all',
      }}>{command}</code>
      <button
        onClick={(e) => { e.stopPropagation(); onCopy(command, copyKey); }}
        aria-label={isCopied ? 'Copied' : 'Copy command'}
        title={isCopied ? 'Copied' : 'Copy command'}
        style={{
          flex: 'none',
          width: dense ? 30 : 36,
          background: isCopied
            ? 'color-mix(in srgb, var(--status-done) 16%, var(--bg-elevated))'
            : 'var(--bg-elevated)',
          color: isCopied ? 'var(--status-done)' : 'var(--fg-muted)',
          border: 'none',
          borderLeft: '1px solid var(--border-default)',
          fontFamily: 'var(--font-mono)',
          fontSize: dense ? 12 : 13,
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 150ms var(--ease-out)',
        }}>
        {isCopied ? '✓' : '⎘'}
      </button>
    </div>
  );
};

// "metadata incomplete" warning chip
const IncompleteChip = () => (
  <span title="This skill's metadata is incomplete — only name + purpose are populated."
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, height: 18,
      padding: '0 7px', borderRadius: 999,
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
      color: 'var(--severity-warn)',
      background: 'color-mix(in srgb, var(--severity-warn) 12%, transparent)',
      border: '1px solid color-mix(in srgb, var(--severity-warn) 35%, transparent)',
    }}>⚠ metadata incomplete</span>
);

// ─────────────────────────────────────────────────────────────────────
// Skill card (grid + compact-list mode)
// ─────────────────────────────────────────────────────────────────────

const SkillCard = ({
  skill, selected, compact, onSelect, onCopy, copiedKey,
}) => {
  const [hover, setHover] = useState(false);
  const ref = useRef(null);

  // When the card becomes selected in compact mode, ensure it's visible
  // inside the list scroll container (without affecting the page scroll).
  useEffect(() => {
    if (!selected || !compact || !ref.current) return;
    const el = ref.current;
    const container = el.closest('[data-skill-list]');
    if (!container) return;
    const elBox = el.getBoundingClientRect();
    const cBox = container.getBoundingClientRect();
    if (elBox.top < cBox.top) container.scrollTop -= (cBox.top - elBox.top) + 8;
    else if (elBox.bottom > cBox.bottom) container.scrollTop += (elBox.bottom - cBox.bottom) + 8;
  }, [selected, compact]);

  const accentBorder = selected
    ? 'color-mix(in srgb, var(--status-active) 55%, var(--border-default))'
    : skill.active
      ? 'color-mix(in srgb, var(--status-active) 20%, var(--border-default))'
      : 'var(--border-default)';

  const baseBg = skill.active ? 'var(--bg-surface)' : 'color-mix(in srgb, var(--bg-surface) 65%, var(--bg-canvas))';
  const hoverBg = 'var(--bg-elevated)';

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${skill.title} — ${skill.summary || ''}`}
      onClick={() => onSelect(skill.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(skill.id); }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover || selected ? hoverBg : baseBg,
        border: `1px solid ${accentBorder}`,
        borderLeft: selected ? '3px solid var(--status-active)' : `1px solid ${accentBorder}`,
        paddingLeft: selected ? (compact ? 11 : 13) : (compact ? 13 : 15),
        borderRadius: 8,
        padding: compact
          ? `9px 12px 9px ${selected ? 11 : 13}px`
          : `13px 14px 14px ${selected ? 13 : 15}px`,
        display: 'flex', flexDirection: 'column', gap: compact ? 4 : 9,
        cursor: 'pointer',
        opacity: skill.active ? 1 : 0.78,
        transition: 'background 120ms var(--ease-out), border-color 120ms var(--ease-out), opacity 120ms var(--ease-out)',
        position: 'relative',
        boxShadow: selected
          ? '0 0 0 1px color-mix(in srgb, var(--status-active) 30%, transparent), var(--shadow-sm)'
          : 'var(--shadow-ambient)',
        outline: 'none',
        minHeight: compact ? 0 : 158,
      }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--bg-canvas), 0 0 0 4px var(--accent-focus)'; }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = selected
          ? '0 0 0 1px color-mix(in srgb, var(--status-active) 30%, transparent), var(--shadow-sm)'
          : 'var(--shadow-ambient)';
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ActiveDot active={skill.active} />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: compact ? 12.5 : 14,
          fontWeight: 600,
          color: 'var(--fg-default)',
          flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '-0.005em',
        }}>{skill.title}</span>
        {!compact && skill.active && (
          <span className="t-eyebrow" style={{ color: 'var(--status-done)', fontSize: 9 }}>IN REPO</span>
        )}
        {!compact && !skill.active && (
          <span className="t-eyebrow" style={{ color: 'var(--fg-subtle)', fontSize: 9 }}>AVAILABLE</span>
        )}
      </div>

      {/* Purpose */}
      <p style={{
        margin: 0,
        fontFamily: 'var(--font-sans)',
        fontSize: compact ? 11.5 : 13,
        color: 'var(--fg-muted)',
        lineHeight: 1.45,
        // 2-line clamp in compact, 2-line clamp in grid (purpose, not when)
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>{skill.summary || <span style={{ color: 'var(--fg-faint)' }}>(no description)</span>}</p>

      {!compact && (
        <>
          {/* When-to-use sample (first situation) */}
          {skill.when && skill.when.length > 0 && (
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 11,
              color: 'var(--fg-subtle)',
              marginTop: 'auto',
              paddingTop: 8,
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              <span className="t-eyebrow" style={{ fontSize: 9 }}>WHEN</span>
              <span style={{ color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                {skill.when[0]}{skill.when.length > 1 && (
                  <span style={{ color: 'var(--fg-subtle)' }}> · +{skill.when.length - 1} more</span>
                )}
              </span>
            </div>
          )}
          {skill.incomplete && (
            <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
              <IncompleteChip />
            </div>
          )}

          {/* Command + copy */}
          <CommandRow
            command={slashCommand(skill.id)}
            copyKey={`card:${skill.id}`}
            copiedKey={copiedKey}
            onCopy={onCopy}
            dense
          />
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Skill detail panel
// ─────────────────────────────────────────────────────────────────────

const Section = ({ eyebrow, count, children }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="t-eyebrow" style={{ color: 'var(--fg-muted)', whiteSpace: 'nowrap', flex: 'none' }}>{eyebrow}</span>
      {count != null && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
          padding: '1px 6px', borderRadius: 999,
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
        }}>{count}</span>
      )}
      <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
    {children}
  </section>
);

const BulletList = ({ items, marker, markerColor }) => (
  <ul style={{
    margin: 0, padding: 0, listStyle: 'none',
    display: 'flex', flexDirection: 'column', gap: 7,
  }}>
    {items.map((item, i) => (
      <li key={i} style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        fontFamily: 'var(--font-sans)', fontSize: 13,
        color: 'var(--fg-default)', lineHeight: 1.5,
      }}>
        <span aria-hidden style={{
          flex: 'none', marginTop: 1,
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: markerColor, lineHeight: 1.5,
          width: 14, textAlign: 'center',
        }}>{marker}</span>
        <span style={{ flex: 1 }}>{item}</span>
      </li>
    ))}
  </ul>
);

const SkillDetail = ({
  skill, onSelect, onClose, onCopy, copiedKey, allSkillsById,
}) => {
  // Focus close button when detail opens (keyboard-friendly close).
  const closeRef = useRef(null);
  useEffect(() => {
    if (closeRef.current) closeRef.current.focus();
  }, [skill.id]);

  if (!skill) return null;
  const related = (skill.related || []).map(id => allSkillsById[id]).filter(Boolean);

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderLeft: '3px solid var(--status-active)',
      borderRadius: 10,
      boxShadow: 'var(--shadow-md)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
      animation: 'aideck-fade-in 200ms var(--ease-out)',
    }}>
      {/* Header */}
      <header style={{
        padding: '16px 20px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'color-mix(in srgb, var(--bg-elevated) 35%, var(--bg-surface))',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ActiveDot active={skill.active} size={9} />
          <h2 style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 22, fontWeight: 600,
            color: 'var(--fg-default)',
            letterSpacing: '-0.015em',
            flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{skill.title}</h2>
          <span className="t-eyebrow" style={{
            color: skill.active ? 'var(--status-done)' : 'var(--fg-subtle)',
            fontSize: 10,
            whiteSpace: 'nowrap', flex: 'none',
          }}>{skill.active ? 'IN REPO' : 'AVAILABLE'}</span>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close detail view (Esc)"
            title="Close (Esc)"
            style={{
              all: 'unset', cursor: 'pointer',
              width: 28, height: 28, display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              borderRadius: 6,
              color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 14,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg-default)'; e.currentTarget.style.borderColor = 'var(--border-bright)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
          >×</button>
        </div>
        <p style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: 14, lineHeight: 1.55,
          color: 'var(--fg-default)',
          maxWidth: '60ch',
        }}>{skill.summary || <span style={{ color: 'var(--fg-faint)' }}>(no description)</span>}</p>
        {skill.incomplete && (
          <div style={{ marginTop: 2 }}>
            <IncompleteChip />
          </div>
        )}
      </header>

      {/* Scrollable body */}
      <div style={{
        padding: '18px 20px 22px',
        display: 'flex', flexDirection: 'column', gap: 22,
        overflowY: 'auto', minHeight: 0, flex: 1,
      }}>
        {/* Primary command */}
        <Section eyebrow="INVOCATION">
          <CommandRow
            command={slashCommand(skill.id)}
            copyKey={`detail:${skill.id}`}
            copiedKey={copiedKey}
            onCopy={onCopy}
          />
        </Section>

        {/* Incomplete-skill placeholder for the rest of the page */}
        {skill.incomplete && (!skill.when && !skill.whenNot && !skill.examples) && (
          <div style={{
            border: '1px dashed color-mix(in srgb, var(--severity-warn) 35%, var(--border-default))',
            borderRadius: 8,
            padding: '14px 16px',
            background: 'color-mix(in srgb, var(--severity-warn) 5%, transparent)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div className="t-eyebrow" style={{ color: 'var(--severity-warn)' }}>METADATA INCOMPLETE</div>
            <p style={{
              margin: 0, fontFamily: 'var(--font-sans)', fontSize: 13,
              color: 'var(--fg-muted)', lineHeight: 1.5,
            }}>
              This skill is registered but has not published its <code style={{ fontFamily: 'var(--font-mono)' }}>when</code>, <code style={{ fontFamily: 'var(--font-mono)' }}>when-not</code>, or <code style={{ fontFamily: 'var(--font-mono)' }}>examples</code> sections. The slash command above still works. Ask the maintainer to fill <code style={{ fontFamily: 'var(--font-mono)' }}>.atomic-skills/{skill.id}/SKILL.md</code>.
            </p>
          </div>
        )}

        {/* When */}
        {skill.when && skill.when.length > 0 && (
          <Section eyebrow="WHEN TO USE" count={skill.when.length}>
            <BulletList items={skill.when} marker="+" markerColor="var(--status-done)" />
          </Section>
        )}

        {/* When NOT */}
        {skill.whenNot && skill.whenNot.length > 0 && (
          <Section eyebrow="WHEN NOT TO USE" count={skill.whenNot.length}>
            <BulletList items={skill.whenNot} marker="−" markerColor="var(--severity-warn)" />
          </Section>
        )}

        {/* Examples */}
        {skill.examples && skill.examples.length > 0 && (
          <Section eyebrow="EXAMPLES" count={skill.examples.length}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {skill.examples.map((cmd, i) => (
                <CommandRow
                  key={i}
                  command={cmd}
                  copyKey={`detail:${skill.id}:ex:${i}`}
                  copiedKey={copiedKey}
                  onCopy={onCopy}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <Section eyebrow="RELATED SKILLS" count={related.length}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6,
            }}>
              {related.map(r => (
                <button
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  title={r.summary || ''}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    height: 28, padding: '0 11px 0 9px',
                    background: 'var(--bg-elevated)',
                    color: 'var(--fg-default)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 999,
                    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 120ms var(--ease-out)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--status-active) 50%, var(--border-default))';
                    e.currentTarget.style.background = 'color-mix(in srgb, var(--status-active) 8%, var(--bg-elevated))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                  }}>
                  <ActiveDot active={r.active} size={6} />
                  {r.title}
                  <span style={{ color: 'var(--fg-subtle)', fontSize: 11 }}>↗</span>
                </button>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Search input
// ─────────────────────────────────────────────────────────────────────

const SearchInput = ({ value, onChange, resultCount, totalCount }) => {
  const ref = useRef(null);
  // Cmd/Ctrl-F focus shortcut + "/" shortcut
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div style={{
      position: 'relative', flex: 1, minWidth: 240,
    }}>
      <span aria-hidden style={{
        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--fg-subtle)', fontSize: 13, pointerEvents: 'none',
      }}>⌕</span>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search skills by name, purpose, or when-to-use…"
        aria-label="Search skills"
        style={{
          width: '100%',
          height: 36, padding: '0 86px 0 32px',
          background: 'var(--bg-sunken)',
          color: 'var(--fg-default)',
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          fontFamily: 'var(--font-sans)', fontSize: 13,
          outline: 'none',
          boxShadow: 'var(--shadow-ambient)',
          transition: 'border-color 120ms var(--ease-out)',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
      />
      <div style={{
        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none',
      }}>
        {value ? (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: resultCount === 0 ? 'var(--severity-warn)' : 'var(--fg-subtle)',
          }}>{resultCount}/{totalCount}</span>
        ) : (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
            padding: '2px 5px', background: 'var(--bg-canvas)',
            border: '1px solid var(--border-default)', borderRadius: 3,
            color: 'var(--fg-muted)', lineHeight: 1, pointerEvents: 'none',
          }}>/</span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Empty state (zero skills detected)
// ─────────────────────────────────────────────────────────────────────

const EmptyState = ({ reason }) => (
  <div style={{
    border: '1px dashed var(--border-default)',
    borderRadius: 10,
    padding: '40px 24px',
    background: 'var(--bg-surface)',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
    maxWidth: 560, margin: '0 auto',
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--fg-subtle)',
    }}>?</div>
    <div>
      <h2 style={{
        margin: '0 0 4px',
        fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 600,
        color: 'var(--fg-default)',
      }}>{reason === 'none-installed' ? 'No skills detected' : 'No skills match your filter'}</h2>
      <p style={{
        margin: 0, fontFamily: 'var(--font-sans)', fontSize: 13,
        color: 'var(--fg-muted)', lineHeight: 1.55, maxWidth: '52ch',
      }}>
        {reason === 'none-installed'
          ? 'aiDeck found no entries in ~/.claude/skills/ or .atomic-skills/. Install the skill ecosystem with the setup guide, then refresh.'
          : 'Try clearing the search box, switching the scope filter to "all", or removing other constraints.'}
      </p>
    </div>
    {reason === 'none-installed' && (
      <a href="https://github.com/henryavila/aideck#setup" target="_blank" rel="noreferrer"
         style={{
           display: 'inline-flex', alignItems: 'center', gap: 6,
           height: 30, padding: '0 12px',
           background: 'var(--bg-elevated)',
           color: 'var(--accent-link)',
           border: '1px solid var(--border-default)',
           borderRadius: 6,
           fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
           textDecoration: 'none',
         }}>
        Setup guide <span style={{ fontSize: 11 }}>↗</span>
      </a>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// HelpView — main composition
// ─────────────────────────────────────────────────────────────────────

const HelpView = ({ density = 'comfortable', simulateEmpty = false }) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [copiedKey, copy] = useCopyButton();

  // Empty-state simulator (Tweaks toggle).
  const sourceSkills = simulateEmpty ? [] : skills;

  const skillsById = useMemo(
    () => Object.fromEntries(sourceSkills.map(s => [s.id, s])),
    [sourceSkills],
  );

  const counts = useMemo(() => ({
    all:        sourceSkills.length,
    repo:       sourceSkills.filter(s => s.active).length,
    available:  sourceSkills.filter(s => !s.active).length,
  }), [sourceSkills]);

  const filtered = useMemo(() => {
    const t0 = performance.now();
    const result = sourceSkills.filter(s => {
      if (scope === 'repo' && !s.active) return false;
      if (scope === 'available' && s.active) return false;
      return matchesQuery(s, query);
    });
    // Cheap perf signal; the spec demands <50ms — at 12 skills, this is sub-ms.
    if (window.__aideckLogFilter) {
      console.log('[help] filter', { q: query, scope, n: result.length, ms: (performance.now() - t0).toFixed(2) });
    }
    return result;
  }, [sourceSkills, query, scope]);

  const selected = selectedId ? skillsById[selectedId] : null;
  // If selected was filtered out, keep showing it; otherwise clear.
  const selectedFilteredOut = selected && !filtered.some(s => s.id === selected.id);

  // Esc closes detail; Enter on body if focus on no card has no effect.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  // Arrow-key navigation between visible cards (when not typing in search).
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (filtered.length === 0) return;
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const idx = selected ? filtered.findIndex(s => s.id === selected.id) : -1;
      let next = idx;
      if (selected) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = Math.min(filtered.length - 1, idx + 1);
        else next = Math.max(0, idx - 1);
        if (next !== idx) {
          e.preventDefault();
          setSelectedId(filtered[next].id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, selected]);

  const compactMode = !!selected;
  const isComfy = density === 'comfortable';

  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto',
      padding: isComfy ? '28px 28px 60px' : '20px 22px 48px',
      display: 'flex', flexDirection: 'column', gap: isComfy ? 20 : 14,
      minHeight: 0,
    }}>
      {/* Page header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="t-eyebrow" style={{ color: 'var(--fg-subtle)' }}>
          ATOMIC-SKILLS · DIRECTORY
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 32, fontWeight: 600,
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
            color: 'var(--fg-default)',
          }}>Skills</h1>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: 'var(--fg-muted)', marginBottom: 4,
          }}>
            <span style={{ color: 'var(--status-done)' }}>{counts.repo}</span>
            <span style={{ color: 'var(--fg-faint)' }}> in repo · </span>
            <span style={{ color: 'var(--fg-default)' }}>{counts.available}</span>
            <span style={{ color: 'var(--fg-faint)' }}> available</span>
          </span>
        </div>
        <p style={{
          margin: '2px 0 0',
          fontFamily: 'var(--font-sans)', fontSize: 14,
          color: 'var(--fg-muted)', maxWidth: '64ch', lineHeight: 1.55,
        }}>
          The full ecosystem. <strong style={{ color: 'var(--fg-default)', fontWeight: 600 }}>In&nbsp;repo</strong> skills have a directory under <code className="t-code-inline">.atomic-skills/</code> and are emitting data here. <strong style={{ color: 'var(--fg-default)', fontWeight: 600 }}>Available</strong> skills are registered globally but unused in this project. Copy any invocation to your editor.
        </p>
      </div>

      {/* Controls row */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        position: 'sticky', top: 0, zIndex: 5,
        background: 'linear-gradient(180deg, var(--bg-canvas) 70%, color-mix(in srgb, var(--bg-canvas) 70%, transparent))',
        paddingBottom: 6,
      }}>
        <SearchInput
          value={query}
          onChange={setQuery}
          resultCount={filtered.length}
          totalCount={sourceSkills.length}
        />
        <div style={{
          display: 'flex', gap: 4,
          padding: 3,
          background: 'var(--bg-sunken)',
          border: '1px solid var(--border-default)',
          borderRadius: 999,
          boxShadow: 'var(--shadow-ambient)',
        }}>
          <Pill active={scope === 'all'}       onClick={() => setScope('all')}       count={counts.all}>All</Pill>
          <Pill active={scope === 'repo'}      onClick={() => setScope('repo')}      count={counts.repo}>In repo</Pill>
          <Pill active={scope === 'available'} onClick={() => setScope('available')} count={counts.available}>Available</Pill>
        </div>
      </div>

      {/* Body */}
      {sourceSkills.length === 0 ? (
        <EmptyState reason="none-installed" />
      ) : filtered.length === 0 ? (
        <EmptyState reason="no-match" />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: compactMode ? 'minmax(260px, 320px) 1fr' : '1fr',
          gap: 16,
          alignItems: 'start',
          minHeight: 0,
        }}>
          {/* Card grid / list */}
          <div
            data-skill-list
            style={{
              display: 'grid',
              gridTemplateColumns: compactMode
                ? '1fr'
                : 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: compactMode ? 7 : 12,
              maxHeight: compactMode ? 'calc(100vh - 240px)' : 'none',
              overflowY: compactMode ? 'auto' : 'visible',
              paddingRight: compactMode ? 6 : 0,
              alignContent: 'start',
            }}>
            {filtered.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                selected={selected && selected.id === skill.id}
                compact={compactMode}
                onSelect={setSelectedId}
                onCopy={copy}
                copiedKey={copiedKey}
              />
            ))}
            {compactMode && selectedFilteredOut && (
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: 11,
                color: 'var(--fg-subtle)',
                padding: '8px 12px',
                borderTop: '1px dashed var(--border-subtle)',
                marginTop: 4,
              }}>
                Selected skill is filtered out — clear filter to see it in the list.
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{
              position: 'sticky', top: 64,
              maxHeight: 'calc(100vh - 100px)',
              display: 'flex',
            }}>
              <SkillDetail
                skill={selected}
                onSelect={setSelectedId}
                onClose={() => setSelectedId(null)}
                onCopy={copy}
                copiedKey={copiedKey}
                allSkillsById={skillsById}
              />
            </div>
          )}
        </div>
      )}

      {/* Footer hint */}
      {sourceSkills.length > 0 && (
        <div style={{
          marginTop: 8,
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          fontFamily: 'var(--font-sans)', fontSize: 11,
          color: 'var(--fg-subtle)',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <kbd style={kbdStyle}>/</kbd> search
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <kbd style={kbdStyle}>↵</kbd> open detail
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> navigate
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <kbd style={kbdStyle}>esc</kbd> close detail
          </span>
          <span style={{ flex: 1 }} />
          <span>Files are canonical · this directory projects from <code className="t-code-inline">.atomic-skills/</code></span>
        </div>
      )}
    </div>
  );
};

const kbdStyle = {
  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
  padding: '1px 5px', background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)', borderRadius: 3,
  color: 'var(--fg-muted)', lineHeight: 1.4,
};

window.HelpView = HelpView;
