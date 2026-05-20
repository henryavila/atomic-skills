/* global React, window, StatusGlyph, Card, SectionHeader, TagChip */

const { useMemo: useMemoSP } = React;

// ── ParkedPanel ───────────────────────────────────────────────────────────
const ParkedPanel = ({ items }) => (
  <Card>
    <SectionHeader count={items.length} action={
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
        letterSpacing: '0.08em',
      }}>deliberately paused</span>
    }>Parked</SectionHeader>
    {items.length === 0 ? (
      <div style={{
        padding: '20px 16px',
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--fg-subtle)',
        textAlign: 'center',
        background: 'repeating-linear-gradient(135deg, transparent, transparent 6px, color-mix(in srgb, var(--border-subtle) 50%, transparent) 6px, color-mix(in srgb, var(--border-subtle) 50%, transparent) 7px)',
      }}>
        no parked items in this initiative
      </div>
    ) : (
      items.map((p, idx) => (
        <div key={p.id} style={{
          padding: '10px 14px',
          borderBottom: idx < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusGlyph status="parked" size={12} />
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
            }}>{p.id}</span>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)',
              flex: 1, minWidth: 0, lineHeight: 1.35,
            }}>{p.title}</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
              flex: 'none',
            }}>parked {p.parkedAt}</span>
          </div>
          {p.reason && (
            <div style={{
              marginLeft: 28,
              paddingLeft: 10,
              borderLeft: '2px solid color-mix(in srgb, var(--status-parked) 30%, transparent)',
              fontFamily: 'var(--font-sans)', fontSize: 12,
              color: 'var(--fg-muted)', lineHeight: 1.45,
            }}>{p.reason}</div>
          )}
        </div>
      ))
    )}
  </Card>
);

// ── EmergedPanel ──────────────────────────────────────────────────────────
const EmergedPanel = ({ items }) => (
  <Card>
    <SectionHeader count={items.length} action={
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
        letterSpacing: '0.08em',
      }}>candidates for new initiatives</span>
    }>Emerged</SectionHeader>
    {items.length === 0 ? (
      <div style={{
        padding: '20px 16px',
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--fg-subtle)',
        textAlign: 'center',
        background: 'repeating-linear-gradient(135deg, transparent, transparent 6px, color-mix(in srgb, var(--border-subtle) 50%, transparent) 6px, color-mix(in srgb, var(--border-subtle) 50%, transparent) 7px)',
      }}>
        no emerged items in this initiative
      </div>
    ) : (
      items.map((e, idx) => (
        <div key={e.id} style={{
          padding: '10px 14px',
          borderBottom: idx < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <StatusGlyph status="emerged" size={12} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
          }}>{e.id}</span>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)',
            flex: 1, minWidth: 0, lineHeight: 1.35,
          }}>{e.title}</span>
          {e.candidateFor && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
              color: 'var(--status-emerged)',
              padding: '1px 6px', borderRadius: 3,
              background: 'color-mix(in srgb, var(--status-emerged) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--status-emerged) 30%, transparent)',
            }}>→ {e.candidateFor}</span>
          )}
          {e.promoted && <TagChip kind="parallel">promoted</TagChip>}
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
          }}>surfaced {e.surfacedAt}</span>
        </div>
      ))
    )}
  </Card>
);

// ── ReferencesPanel ───────────────────────────────────────────────────────
const REF_KIND_LABEL = {
  prd: 'PRD', runbook: 'RUNBOOK', adr: 'ADR', spec: 'SPEC',
  doc: 'DOC', repo: 'REPO', dump: 'DUMP', fixture: 'FIXTURE',
  schema: 'SCHEMA', log: 'LOG', note: 'NOTE', cred: 'CRED',
  snapshot: 'SNAPSHOT', section: 'SECTION', file: 'FILE',
  workflow: 'WORKFLOW',
};

const ReferencesPanel = ({ refs }) => {
  const groups = useMemoSP(() => {
    const inProject = refs.filter(r => r.state === 'in-project');
    const external  = refs.filter(r => r.state === 'external');
    const gitignored = refs.filter(r => r.state === 'gitignored');
    return { inProject, external, gitignored };
  }, [refs]);

  const RefRow = ({ r, state }) => {
    const stateColor =
      state === 'external'   ? 'var(--status-emerged)' :
      state === 'gitignored' ? 'var(--severity-warn)'  :
                               'var(--fg-subtle)';
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 14px',
        fontFamily: 'var(--font-mono)', fontSize: 11.5,
        borderBottom: '1px solid color-mix(in srgb, var(--border-subtle) 50%, transparent)',
      }}>
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: '0.05em',
          padding: '1px 6px', borderRadius: 2, minWidth: 56, textAlign: 'center',
          color: 'var(--fg-subtle)',
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
        }}>{REF_KIND_LABEL[r.kind] || r.kind.toUpperCase()}</span>
        <a href="#" onClick={(e) => e.preventDefault()} style={{
          color: 'var(--accent-link)', textDecoration: 'none',
          flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {r.path}
          {r.section && <span style={{ color: 'var(--fg-muted)' }}> § {r.section}</span>}
        </a>
        {state !== 'in-project' && (
          <span style={{
            fontSize: 9, fontWeight: 500, letterSpacing: '0.05em',
            color: stateColor, padding: '1px 6px', borderRadius: 2,
            background: `color-mix(in srgb, ${stateColor} 10%, transparent)`,
            border: `1px solid color-mix(in srgb, ${stateColor} 30%, transparent)`,
            whiteSpace: 'nowrap', textTransform: 'uppercase',
          }}>{state}</span>
        )}
      </div>
    );
  };

  return (
    <Card>
      <SectionHeader count={refs.length}>References</SectionHeader>
      {refs.length === 0 ? (
        <div style={{
          padding: '20px 16px',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--fg-subtle)', textAlign: 'center',
        }}>(no references)</div>
      ) : (
        <React.Fragment>
          {groups.inProject.map((r, i) => <RefRow key={`p${i}`} r={r} state="in-project" />)}
          {groups.external.map((r, i) => <RefRow key={`e${i}`} r={r} state="external" />)}
          {groups.gitignored.map((r, i) => <RefRow key={`g${i}`} r={r} state="gitignored" />)}
        </React.Fragment>
      )}
    </Card>
  );
};

// ── OutputsPanel (for done initiatives) ───────────────────────────────────
const OutputsPanel = ({ outputs }) => {
  if (!outputs || outputs.length === 0) return null;
  return (
    <Card style={{
      borderColor: 'color-mix(in srgb, var(--status-done) 30%, var(--border-default))',
    }}>
      <SectionHeader count={outputs.length} action={
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--status-done)', letterSpacing: '0.08em' }}>
          ✓ what shipped
        </span>
      }>Outputs</SectionHeader>
      {outputs.map((o, idx) => (
        <div key={idx} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 14px',
          borderBottom: idx < outputs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '2px 7px', borderRadius: 3, whiteSpace: 'nowrap',
            color: o.kind === 'tag' ? 'var(--status-done)' : 'var(--status-emerged)',
            background: o.kind === 'tag'
              ? 'color-mix(in srgb, var(--status-done) 14%, transparent)'
              : 'color-mix(in srgb, var(--status-emerged) 14%, transparent)',
            border: `1px solid color-mix(in srgb, ${o.kind === 'tag' ? 'var(--status-done)' : 'var(--status-emerged)'} 30%, transparent)`,
          }}>{o.kind}</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg-default)',
            whiteSpace: 'nowrap',
          }}>{o.value}</span>
          {o.meta && <span style={{
            flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--fg-subtle)', textAlign: 'right',
          }}>{o.meta}</span>}
        </div>
      ))}
    </Card>
  );
};

// ── NarrativeBody — full markdown render, no height cap ───────────────────
const NarrativeBody = ({ markdown }) => {
  const blocks = useMemoSP(() => {
    if (!markdown) return [];
    const lines = markdown.split('\n');
    const out = [];
    let buf = [];
    const flush = () => { if (buf.length) { out.push({ kind: 'p', text: buf.join(' ') }); buf = []; } };
    for (const line of lines) {
      if (/^###\s+/.test(line))      { flush(); out.push({ kind: 'h3', text: line.replace(/^###\s+/, '') }); }
      else if (/^##\s+/.test(line))  { flush(); out.push({ kind: 'h2', text: line.replace(/^##\s+/, '') }); }
      else if (/^#\s+/.test(line))   { flush(); out.push({ kind: 'h1', text: line.replace(/^#\s+/, '') }); }
      else if (/^\d+\.\s+/.test(line)) { flush(); out.push({ kind: 'ol-item', text: line.replace(/^\d+\.\s+/, '') }); }
      else if (/^-\s+/.test(line))   { flush(); out.push({ kind: 'ul-item', text: line.replace(/^-\s+/, '') }); }
      else if (line.trim() === '')   { flush(); }
      else                            { buf.push(line); }
    }
    flush();
    return out;
  }, [markdown]);

  const renderInline = (text) => {
    const parts = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let lastIdx = 0; let m; let i = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
      const tk = m[0];
      if (tk.startsWith('**')) parts.push(<strong key={i++} style={{ color: 'var(--fg-default)' }}>{tk.slice(2, -2)}</strong>);
      else parts.push(<code key={i++} style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.92em',
        padding: '1px 5px',
        background: 'var(--bg-canvas)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 3,
        color: 'var(--fg-default)',
      }}>{tk.slice(1, -1)}</code>);
      lastIdx = m.index + tk.length;
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx));
    return parts;
  };

  if (!markdown) return null;

  return (
    <Card>
      <SectionHeader action={
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
        }}>{markdown.split('\n').length} lines · written during execution</span>
      }>Narrative body</SectionHeader>
      <div style={{ padding: '18px 22px' }}>
        {blocks.map((b, i) => {
          if (b.kind === 'h1') return <h2 key={i} style={{
            margin: i === 0 ? '0 0 10px' : '28px 0 10px',
            fontFamily: 'var(--font-sans)', fontSize: 19, fontWeight: 600,
            color: 'var(--fg-default)', letterSpacing: '-0.015em',
          }}>{b.text}</h2>;
          if (b.kind === 'h2') return <h3 key={i} style={{
            margin: i === 0 ? '0 0 8px' : '22px 0 8px',
            fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 600,
            color: 'var(--fg-default)', letterSpacing: '-0.01em',
          }}>{b.text}</h3>;
          if (b.kind === 'h3') return <h4 key={i} style={{
            margin: i === 0 ? '0 0 6px' : '16px 0 6px',
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
            color: 'var(--fg-muted)', textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>{b.text}</h4>;
          if (b.kind === 'ol-item') return <div key={i} style={{
            display: 'flex', gap: 10, margin: '6px 0 6px 8px',
            fontFamily: 'var(--font-sans)', fontSize: 13.5,
            color: 'var(--fg-muted)', lineHeight: 1.65,
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)', color: 'var(--status-active)',
              flex: 'none', minWidth: 20,
            }}>{i + 1}.</span>
            <span style={{ textWrap: 'pretty' }}>{renderInline(b.text)}</span>
          </div>;
          if (b.kind === 'ul-item') return <div key={i} style={{
            display: 'flex', gap: 10, margin: '4px 0 4px 8px',
            fontFamily: 'var(--font-sans)', fontSize: 13.5,
            color: 'var(--fg-muted)', lineHeight: 1.65,
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)', color: 'var(--fg-subtle)',
              flex: 'none', minWidth: 12,
            }}>·</span>
            <span style={{ textWrap: 'pretty' }}>{renderInline(b.text)}</span>
          </div>;
          return <p key={i} style={{
            margin: '8px 0',
            fontFamily: 'var(--font-sans)', fontSize: 13.5,
            color: 'var(--fg-muted)', lineHeight: 1.7,
            textWrap: 'pretty',
          }}>{renderInline(b.text)}</p>;
        })}
      </div>
    </Card>
  );
};

Object.assign(window, { ParkedPanel, EmergedPanel, ReferencesPanel, OutputsPanel, NarrativeBody });
