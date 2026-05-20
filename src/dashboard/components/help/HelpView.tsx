// Faithful port of HelpView.jsx — skill directory with filter pills,
// search input, 2-col card grid, expandable detail panel. Skills are
// hardcoded from meta/skills.yaml since aideck does not yet expose them
// over REST.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

interface Skill {
  id: string
  title: string
  summary?: string
  active?: boolean
  incomplete?: boolean
  when?: string[]
  whenNot?: string[]
  examples?: string[]
  related?: string[]
}

const SKILLS: Skill[] = [
  {
    id: 'project-status',
    title: 'project-status',
    summary:
      'Per-initiative canonical state tracking. Maintains .atomic-skills/ tree with stack + tasks + parked + emerged per initiative. Plan + Initiative + Task 3-level model.',
    active: true,
    when: [
      'Starting, resuming, pushing/popping stack frames',
      'Parking lateral findings or surfacing emerged items',
      'Viewing status across sessions and worktrees',
    ],
    whenNot: [
      'Tracking issues across multiple unrelated projects (use Linear/GitHub Issues)',
      'Ephemeral one-off tasks',
    ],
    examples: [
      '/atomic-skills:project-status',
      '/atomic-skills:project-status push "Investigate matcher regression"',
      '/atomic-skills:project-status done T-002',
      '/atomic-skills:project-status phase-done',
    ],
    related: ['project-plan', 'fix', 'review-plan-internal'],
  },
  {
    id: 'project-plan',
    title: 'project-plan',
    summary:
      'Turn loose ideas into a structured multi-phase Plan with phases, tasks, exit gates, and references. Outputs canonical project-status state.',
    active: true,
    when: ['Bootstrapping a new initiative', 'Adopting an existing plan document into the canonical state'],
    examples: ['/atomic-skills:project-plan', '/atomic-skills:project-plan adopt docs/my-plan.md'],
    related: ['project-status'],
  },
  {
    id: 'fix',
    title: 'fix',
    summary: 'Root cause diagnosis + TDD fix. Use when you find a bug or unexpected behavior.',
    active: true,
    when: ['A test or behavior fails unexpectedly', 'You can isolate a reproducer'],
    whenNot: ['Feature work', 'Refactors without a failing case'],
    examples: ['/atomic-skills:fix'],
    related: ['hunt'],
  },
  {
    id: 'hunt',
    title: 'hunt',
    summary: 'Write adversarial tests for existing code to find hidden bugs.',
    active: true,
    when: ['Code lacks tests', 'You suspect untested edge cases'],
    examples: ['/atomic-skills:hunt'],
    related: ['fix'],
  },
  {
    id: 'review-plan-internal',
    title: 'review-plan-internal',
    summary: 'Adversarial review of an implementation plan for gaps and risks.',
    active: true,
    when: ['Finishing a plan and you want a second look', 'Before committing to a multi-day implementation'],
    examples: ['/atomic-skills:review-plan-internal'],
    related: ['review-plan-with-codex', 'review-code-with-codex'],
  },
  {
    id: 'review-plan-with-codex',
    title: 'review-plan-with-codex',
    summary:
      'Cross-model adversarial review of a plan/spec via OpenAI Codex CLI in two-pass sealed envelope.',
    active: true,
    when: ['Finishing a plan and wanting a second opinion from a different model family'],
    examples: ['/atomic-skills:review-plan-with-codex'],
    related: ['review-plan-internal', 'review-code-with-codex'],
  },
  {
    id: 'review-code-with-codex',
    title: 'review-code-with-codex',
    summary:
      'Cross-model adversarial review of code changes (diff/branch) via OpenAI Codex CLI in two-pass sealed envelope.',
    active: true,
    when: ['Before merging significant changes', 'To catch bugs that same-model review missed'],
    examples: ['/atomic-skills:review-code-with-codex'],
    related: ['review-plan-with-codex'],
  },
  {
    id: 'prompt',
    title: 'prompt',
    summary: 'Generate an optimized, self-contained prompt from a task description.',
    active: true,
    when: ['You need a precise prompt with exact file paths and guardrails'],
    examples: ['/atomic-skills:prompt'],
  },
  {
    id: 'parallel-dispatch',
    title: 'parallel-dispatch',
    summary:
      'Dispatch a user-provided list of independent tasks to N parallel sessions with verified scope isolation.',
    active: true,
    when: ['You have a consolidated task list', 'Tasks can be verified disjoint by pairwise grep'],
    related: ['parallel-dispatch-audit'],
  },
  {
    id: 'parallel-dispatch-audit',
    title: 'parallel-dispatch-audit',
    summary:
      "Audit the output of a parallel-dispatch batch. Verifies deliverables on disk, applies cosmetic fixes, reports pending decisions.",
    active: true,
    when: ['After parallel-dispatch agents complete'],
    related: ['parallel-dispatch'],
  },
  {
    id: 'save-and-push',
    title: 'save-and-push',
    summary: 'Review conversation, save learnings to memory, commit and push work.',
    active: true,
    when: ['End of session', 'After landing a meaningful chunk'],
  },
  {
    id: 'init-memory',
    title: 'init-memory',
    summary: 'Initialize persistent memory structure for cross-session context.',
    active: true,
    when: ['First time using memory in a repo'],
  },
]

const slashCommand = (id: string) => `/atomic-skills:${id}`

const matchesQuery = (skill: Skill, q: string): boolean => {
  if (!q) return true
  const needle = q.toLowerCase()
  const haystacks = [skill.id, skill.title, skill.summary ?? '', ...(skill.when ?? []), ...(skill.whenNot ?? [])]
  return haystacks.some((s) => s.toLowerCase().includes(needle))
}

function useCopyButton() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copy = useCallback((text: string, key: string) => {
    const finish = () => {
      setCopiedKey(key)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopiedKey(null), 1400)
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(finish).catch(finish)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta)
      finish()
    }
  }, [])
  return [copiedKey, copy] as const
}

function ActiveDot({ active, size = 7 }: { active?: boolean; size?: number }) {
  return (
    <span style={{ position: 'relative', width: size, height: size, flex: 'none', display: 'inline-block' }}>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: active ? 'var(--status-done)' : 'var(--fg-faint)',
          boxShadow: active ? '0 0 6px color-mix(in srgb, var(--status-done) 70%, transparent)' : 'none',
        }}
      />
    </span>
  )
}

function Pill({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 26,
        padding: '0 11px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        background: active ? 'var(--bg-elevated)' : 'transparent',
        color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
        border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-default)'}`,
        borderRadius: 999,
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 120ms var(--ease-out)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
      {count != null && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: active ? 'var(--fg-muted)' : 'var(--fg-subtle)',
            padding: '1px 5px',
            borderRadius: 999,
            background: active ? 'var(--bg-sunken)' : 'transparent',
            border: `1px solid ${active ? 'var(--border-default)' : 'var(--border-subtle)'}`,
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function CommandRow({
  command,
  copyKey,
  copiedKey,
  onCopy,
  dense = false,
}: {
  command: string
  copyKey: string
  copiedKey: string | null
  onCopy: (text: string, key: string) => void
  dense?: boolean
}) {
  const isCopied = copiedKey === copyKey
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        border: `1px solid ${
          isCopied ? 'color-mix(in srgb, var(--status-done) 35%, var(--border-default))' : 'var(--border-default)'
        }`,
        borderRadius: 6,
        overflow: 'hidden',
        background: 'var(--bg-sunken)',
        transition: 'border-color 200ms var(--ease-out)',
      }}
    >
      <code
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: dense ? 11 : 12,
          padding: dense ? '5px 9px' : '7px 11px',
          color: 'var(--fg-default)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          userSelect: 'all',
        }}
      >
        {command}
      </code>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onCopy(command, copyKey)
        }}
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
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 150ms var(--ease-out)',
        }}
      >
        {isCopied ? '✓' : '⎘'}
      </button>
    </div>
  )
}

function SkillCard({
  skill,
  selected,
  onSelect,
  onCopy,
  copiedKey,
}: {
  skill: Skill
  selected: boolean
  onSelect: (id: string) => void
  onCopy: (text: string, key: string) => void
  copiedKey: string | null
}) {
  const [hover, setHover] = useState(false)
  const accentBorder = selected
    ? 'color-mix(in srgb, var(--status-active) 55%, var(--border-default))'
    : skill.active
      ? 'color-mix(in srgb, var(--status-active) 20%, var(--border-default))'
      : 'var(--border-default)'
  const baseBg = skill.active
    ? 'var(--bg-surface)'
    : 'color-mix(in srgb, var(--bg-surface) 65%, var(--bg-canvas))'
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(skill.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(skill.id)
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover || selected ? 'var(--bg-elevated)' : baseBg,
        border: `1px solid ${accentBorder}`,
        borderLeft: selected ? '3px solid var(--status-active)' : `1px solid ${accentBorder}`,
        borderRadius: 8,
        padding: `13px 14px 14px ${selected ? 13 : 15}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        cursor: 'pointer',
        opacity: skill.active ? 1 : 0.78,
        transition: 'background 120ms var(--ease-out), border-color 120ms var(--ease-out), opacity 120ms var(--ease-out)',
        position: 'relative',
        boxShadow: selected
          ? '0 0 0 1px color-mix(in srgb, var(--status-active) 30%, transparent), var(--shadow-sm)'
          : 'var(--shadow-ambient)',
        minHeight: 158,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ActiveDot active={skill.active} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--fg-default)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.005em',
          }}
        >
          {skill.title}
        </span>
        <span className="t-eyebrow" style={{ color: skill.active ? 'var(--status-done)' : 'var(--fg-subtle)', fontSize: 9 }}>
          {skill.active ? 'IN REPO' : 'AVAILABLE'}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--fg-muted)',
          lineHeight: 1.45,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {skill.summary ?? <span style={{ color: 'var(--fg-faint)' }}>(no description)</span>}
      </p>
      {skill.when && skill.when.length > 0 && (
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            color: 'var(--fg-subtle)',
            marginTop: 'auto',
            paddingTop: 8,
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <span className="t-eyebrow" style={{ fontSize: 9 }}>WHEN</span>
          <span style={{ color: 'var(--fg-muted)', lineHeight: 1.4 }}>
            {skill.when[0]}
            {skill.when.length > 1 && (
              <span style={{ color: 'var(--fg-subtle)' }}> · +{skill.when.length - 1} more</span>
            )}
          </span>
        </div>
      )}
      <CommandRow command={slashCommand(skill.id)} copyKey={`card:${skill.id}`} copiedKey={copiedKey} onCopy={onCopy} dense />
    </div>
  )
}

function Section({ eyebrow, count, children }: { eyebrow: string; count?: number; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="t-eyebrow" style={{ color: 'var(--fg-muted)', whiteSpace: 'nowrap', flex: 'none' }}>
          {eyebrow}
        </span>
        {count != null && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fg-subtle)',
              padding: '1px 6px',
              borderRadius: 999,
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {count}
          </span>
        )}
        <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
      </div>
      {children}
    </section>
  )
}

function BulletList({ items, marker, markerColor }: { items: string[]; marker: string; markerColor: string }) {
  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
      }}
    >
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--fg-default)',
            lineHeight: 1.5,
          }}
        >
          <span
            aria-hidden
            style={{
              flex: 'none',
              marginTop: 1,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: markerColor,
              lineHeight: 1.5,
              width: 14,
              textAlign: 'center',
            }}
          >
            {marker}
          </span>
          <span style={{ flex: 1 }}>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function SkillDetail({
  skill,
  onSelect,
  onClose,
  onCopy,
  copiedKey,
  byId,
}: {
  skill: Skill
  onSelect: (id: string) => void
  onClose: () => void
  onCopy: (text: string, key: string) => void
  copiedKey: string | null
  byId: Record<string, Skill>
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
  }, [skill.id])
  const related = (skill.related ?? []).map((id) => byId[id]).filter(Boolean) as Skill[]
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderLeft: '3px solid var(--status-active)',
        borderRadius: 10,
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: '16px 20px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'color-mix(in srgb, var(--bg-elevated) 35%, var(--bg-surface))',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ActiveDot active={skill.active} size={9} />
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--fg-default)',
              letterSpacing: '-0.015em',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {skill.title}
          </h2>
          <span
            className="t-eyebrow"
            style={{
              color: skill.active ? 'var(--status-done)' : 'var(--fg-subtle)',
              fontSize: 10,
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            {skill.active ? 'IN REPO' : 'AVAILABLE'}
          </span>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close detail view"
            title="Close (Esc)"
            style={{
              all: 'unset',
              cursor: 'pointer',
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)',
            }}
          >
            ×
          </button>
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            lineHeight: 1.55,
            color: 'var(--fg-default)',
            maxWidth: '60ch',
          }}
        >
          {skill.summary ?? <span style={{ color: 'var(--fg-faint)' }}>(no description)</span>}
        </p>
      </header>
      <div
        style={{
          padding: '18px 20px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          overflowY: 'auto',
          minHeight: 0,
          flex: 1,
        }}
      >
        <Section eyebrow="INVOCATION">
          <CommandRow command={slashCommand(skill.id)} copyKey={`detail:${skill.id}`} copiedKey={copiedKey} onCopy={onCopy} />
        </Section>
        {skill.when && skill.when.length > 0 && (
          <Section eyebrow="WHEN TO USE" count={skill.when.length}>
            <BulletList items={skill.when} marker="+" markerColor="var(--status-done)" />
          </Section>
        )}
        {skill.whenNot && skill.whenNot.length > 0 && (
          <Section eyebrow="WHEN NOT TO USE" count={skill.whenNot.length}>
            <BulletList items={skill.whenNot} marker="−" markerColor="var(--severity-warn)" />
          </Section>
        )}
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
        {related.length > 0 && (
          <Section eyebrow="RELATED SKILLS" count={related.length}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {related.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  title={r.summary ?? ''}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    height: 28,
                    padding: '0 11px 0 9px',
                    background: 'var(--bg-elevated)',
                    color: 'var(--fg-default)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 999,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 120ms var(--ease-out)',
                  }}
                >
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
  )
}

function SearchInput({
  value,
  onChange,
  resultCount,
  totalCount,
}: {
  value: string
  onChange: (v: string) => void
  resultCount: number
  totalCount: number
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        ref.current?.focus()
        ref.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--fg-subtle)',
          fontSize: 13,
          pointerEvents: 'none',
        }}
      >
        ⌕
      </span>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search skills by name, purpose, or when-to-use…"
        aria-label="Search skills"
        style={{
          width: '100%',
          height: 36,
          padding: '0 86px 0 32px',
          background: 'var(--bg-sunken)',
          color: 'var(--fg-default)',
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          outline: 'none',
          boxShadow: 'var(--shadow-ambient)',
          transition: 'border-color 120ms var(--ease-out)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          pointerEvents: 'none',
        }}
      >
        {value ? (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: resultCount === 0 ? 'var(--severity-warn)' : 'var(--fg-subtle)',
            }}
          >
            {resultCount}/{totalCount}
          </span>
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 500,
              padding: '2px 5px',
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-default)',
              borderRadius: 3,
              color: 'var(--fg-muted)',
              lineHeight: 1,
            }}
          >
            /
          </span>
        )}
      </div>
    </div>
  )
}

export function HelpView() {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'all' | 'installed' | 'available'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copiedKey, copy] = useCopyButton()

  const byId = useMemo(() => Object.fromEntries(SKILLS.map((s) => [s.id, s])), [])

  const filtered = useMemo(() => {
    return SKILLS.filter((s) => {
      if (scope === 'installed' && !s.active) return false
      if (scope === 'available' && s.active) return false
      return matchesQuery(s, query)
    })
  }, [query, scope])

  const counts = {
    all: SKILLS.length,
    installed: SKILLS.filter((s) => s.active).length,
    available: SKILLS.filter((s) => !s.active).length,
  }

  const selected = selectedId ? byId[selectedId] : null

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 80px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <div className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginBottom: 6 }}>
          SKILLS DIRECTORY · {SKILLS.length} ATOMIC SKILLS
        </div>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 30, fontWeight: 600, color: 'var(--fg-default)', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
          Skills available in this project
        </h1>
        <p style={{ margin: '10px 0 0', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--fg-muted)', lineHeight: 1.55, maxWidth: 720 }}>
          Each skill is a structured prompt you can invoke as <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>/atomic-skills:&lt;id&gt;</code> in any
          AI IDE. Click a card for full documentation and copy the slash command.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <SearchInput value={query} onChange={setQuery} resultCount={filtered.length} totalCount={SKILLS.length} />
        <div style={{ display: 'flex', gap: 6 }}>
          <Pill active={scope === 'all'} onClick={() => setScope('all')} count={counts.all}>
            all
          </Pill>
          <Pill active={scope === 'installed'} onClick={() => setScope('installed')} count={counts.installed}>
            installed
          </Pill>
          <Pill active={scope === 'available'} onClick={() => setScope('available')} count={counts.available}>
            available
          </Pill>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            border: '1px dashed var(--border-default)',
            borderRadius: 10,
            padding: '40px 24px',
            background: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 12,
            maxWidth: 560,
            margin: '0 auto',
          }}
        >
          <h2 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 600, color: 'var(--fg-default)' }}>
            No skills match your filter
          </h2>
          <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.55 }}>
            Try clearing the search box or switching scope to "all".
          </p>
        </div>
      ) : selected ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((s) => (
              <SkillCard
                key={s.id}
                skill={s}
                selected={selected.id === s.id}
                onSelect={setSelectedId}
                onCopy={copy}
                copiedKey={copiedKey}
              />
            ))}
          </div>
          <SkillDetail
            skill={selected}
            onSelect={setSelectedId}
            onClose={() => setSelectedId(null)}
            onCopy={copy}
            copiedKey={copiedKey}
            byId={byId}
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map((s) => (
            <SkillCard key={s.id} skill={s} selected={false} onSelect={setSelectedId} onCopy={copy} copiedKey={copiedKey} />
          ))}
        </div>
      )}
    </div>
  )
}
