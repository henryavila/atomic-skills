/* global React, window, skills, Btn */
const { useState: useStateHelp } = React;

const SkillCard = ({ skill }) => (
  <div className="skill-card" style={{
    background: skill.active ? 'var(--bg-surface)' : 'color-mix(in srgb, var(--bg-surface) 65%, var(--bg-canvas))',
    border: `1px solid ${skill.active ? 'color-mix(in srgb, var(--status-active) 25%, var(--border-default))' : 'var(--border-default)'}`,
    borderRadius: 10, padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
    minHeight: 200,
    boxShadow: skill.active
      ? '0 0 0 1px color-mix(in srgb, var(--status-active) 20%, transparent), var(--shadow-sm)'
      : 'var(--shadow-ambient)',
    opacity: skill.active ? 1 : 0.78,
    transition: 'all 160ms var(--ease-out)', cursor: 'pointer',
    position: 'relative', overflow: 'hidden',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.opacity = '1';
    e.currentTarget.style.borderColor = 'var(--border-bright)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.opacity = skill.active ? '1' : '0.78';
    e.currentTarget.style.borderColor = skill.active
      ? 'color-mix(in srgb, var(--status-active) 25%, var(--border-default))'
      : 'var(--border-default)';
  }}>
    {skill.active && (
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, var(--status-active), transparent)',
        opacity: 0.5,
      }} />
    )}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: skill.active ? 'var(--status-active)' : 'var(--fg-faint)',
        boxShadow: skill.active ? '0 0 8px color-mix(in srgb, var(--status-active) 70%, transparent)' : 'none',
        flex: 'none',
      }} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
        color: 'var(--fg-default)', flex: 1,
      }}>{skill.title}</span>
      {skill.active && <span className="t-eyebrow" style={{
        color: 'var(--status-active)', fontSize: 9,
      }}>ACTIVE</span>}
    </div>
    <p style={{
      margin: 0, fontFamily: 'var(--font-sans)', fontSize: 13,
      color: 'var(--fg-muted)', lineHeight: 1.5,
    }}>{skill.summary}</p>
    <div style={{
      fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg-subtle)',
      marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-subtle)',
    }}>
      <span className="t-eyebrow">When</span>
      <div style={{ marginTop: 4, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>{skill.when}</div>
    </div>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <code style={{
        flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11,
        padding: '5px 9px', background: 'var(--bg-sunken)',
        border: '1px solid var(--border-subtle)', borderRadius: 4,
        color: 'var(--fg-default)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>/atomic-skills:{skill.id}</code>
      <button title="Copy slash command" style={{
        height: 26, width: 30, padding: 0, background: 'var(--bg-elevated)',
        color: 'var(--fg-muted)', border: '1px solid var(--border-default)',
        borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 14, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
      }}>⎘</button>
    </div>
  </div>
);

const HelpView = () => {
  const [query, setQuery] = useStateHelp('');
  const [filter, setFilter] = useStateHelp('all');
  const filtered = skills.filter(s => {
    if (query && !s.title.includes(query.toLowerCase()) && !s.summary.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'active' && !s.active) return false;
    return true;
  });

  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto', padding: '20px 24px 60px',
    }}>
      <div className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginBottom: 6 }}>
        ATOMIC-SKILLS DIRECTORY
      </div>
      <h1 style={{
        margin: '0 0 6px', fontFamily: 'var(--font-sans)', fontSize: 32, fontWeight: 600,
        letterSpacing: '-0.025em', lineHeight: 1.1,
      }}>Skills</h1>
      <p style={{
        margin: '0 0 22px', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--fg-muted)',
        maxWidth: 640,
      }}>The full ecosystem. Active skills have data in this repo. Copy any slash command to invoke from your editor.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input type="text" placeholder="Search skills…"
          value={query} onChange={e => setQuery(e.target.value)}
          style={{
            flex: 1, height: 36, padding: '0 14px',
            background: 'var(--bg-sunken)', color: 'var(--fg-default)',
            border: '1px solid var(--border-default)', borderRadius: 6,
            fontFamily: 'var(--font-sans)', fontSize: 13, outline: 'none',
            boxShadow: 'var(--shadow-ambient)',
          }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'active'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              height: 34, padding: '0 14px',
              background: filter === f ? 'var(--bg-elevated)' : 'transparent',
              color: filter === f ? 'var(--fg-default)' : 'var(--fg-muted)',
              border: `1px solid ${filter === f ? 'var(--border-strong)' : 'var(--border-default)'}`,
              borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 12, cursor: 'pointer',
            }}>{f}</button>
          ))}
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
      }}>
        {filtered.map(s => <SkillCard key={s.id} skill={s} />)}
      </div>
    </div>
  );
};

window.HelpView = HelpView;
