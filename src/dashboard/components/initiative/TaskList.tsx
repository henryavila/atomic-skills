import { useState } from 'react'
import { Card, SectionHeader, StatusGlyph, TagChip, VerifierBadge } from '../atoms'
import type { UITask } from '../../lib/adapters'

interface Props {
  tasks: UITask[]
}

export function TaskList({ tasks }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const seed: Record<string, boolean> = {}
    const here = tasks.find((t) => t.here)
    if (here) seed[here.id] = true
    return seed
  })

  const counts = {
    done: tasks.filter((t) => t.status === 'done').length,
    active: tasks.filter((t) => t.status === 'active').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
    pending: tasks.filter((t) => t.status === 'pending').length,
  }
  return (
    <Card>
      <SectionHeader
        count={tasks.length}
        action={
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-subtle)',
            }}
          >
            <span>
              <span style={{ color: 'var(--status-done)', fontWeight: 500 }}>{counts.done}</span> done
            </span>
            {counts.active > 0 && (
              <span>
                <span style={{ color: 'var(--status-active)', fontWeight: 500 }}>{counts.active}</span> active
              </span>
            )}
            {counts.blocked > 0 && (
              <span>
                <span style={{ color: 'var(--status-blocked)', fontWeight: 500 }}>{counts.blocked}</span> blocked
              </span>
            )}
            {counts.pending > 0 && (
              <span>
                <span style={{ color: 'var(--fg-muted)', fontWeight: 500 }}>{counts.pending}</span> pending
              </span>
            )}
          </span>
        }
      >
        Tasks
      </SectionHeader>
      {tasks.map((t, idx) => (
        <TaskRow
          key={t.id}
          task={t}
          expanded={Boolean(expanded[t.id])}
          isLast={idx === tasks.length - 1}
          onToggle={() => setExpanded((s) => ({ ...s, [t.id]: !s[t.id] }))}
        />
      ))}
    </Card>
  )
}

function TaskRow({
  task,
  expanded,
  isLast,
  onToggle,
}: {
  task: UITask
  expanded: boolean
  isLast: boolean
  onToggle: () => void
}) {
  const here = task.here
  const isBlocked = task.status === 'blocked'
  const isDone = task.status === 'done'

  return (
    <div
      id={`task-${task.id}`}
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
        background: here ? 'color-mix(in srgb, var(--status-active) 4%, transparent)' : 'transparent',
        position: 'relative',
        scrollMarginTop: 80,
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 14px',
          cursor: 'pointer',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          style={{
            all: 'unset',
            cursor: 'pointer',
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            width: 14,
            textAlign: 'center',
            flex: 'none',
          }}
        >
          {expanded ? '▾' : '▸'}
        </button>
        <StatusGlyph status={task.status} size={13} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 500,
            color: isDone
              ? 'var(--status-done)'
              : isBlocked
                ? 'var(--status-blocked)'
                : here
                  ? 'var(--status-active)'
                  : 'var(--fg-muted)',
            width: 60,
            flex: 'none',
          }}
        >
          {task.id}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13.5,
            color: isDone ? 'var(--fg-muted)' : 'var(--fg-default)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: isDone ? 'line-through' : 'none',
            textDecorationColor: 'color-mix(in srgb, var(--status-done) 40%, transparent)',
          }}
        >
          {task.title}
        </span>
        {task.tags?.slice(0, 3).map((tag, i) => (
          <TagChip
            key={i}
            kind={tag === 'critical' ? 'critical' : tag === 'legacy' ? 'legacy' : 'neutral'}
          >
            {tag}
          </TagChip>
        ))}
        {here && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--status-active)',
              letterSpacing: '0.1em',
              padding: '2px 7px',
              borderRadius: 999,
              background: 'color-mix(in srgb, var(--status-active) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--status-active) 40%, transparent)',
              whiteSpace: 'nowrap',
            }}
          >
            ◉ HERE
          </span>
        )}
        {task.updated && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-subtle)', flex: 'none' }}>
            {task.updated}
          </span>
        )}
      </div>

      {isBlocked && task.blockedBy && task.blockedBy.length > 0 && !expanded && (
        <div
          style={{
            padding: '0 14px 10px 60px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}
        >
          <span style={{ color: 'var(--status-blocked)', fontWeight: 500 }}>blocked by</span>
          {task.blockedBy.map((b, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 20,
                padding: '0 8px',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--status-blocked)',
                background: 'color-mix(in srgb, var(--status-blocked) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--status-blocked) 38%, transparent)',
                whiteSpace: 'nowrap',
              }}
            >
              ⊘ {b.taskId}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div
          style={{
            padding: '4px 18px 14px 60px',
            background: 'var(--bg-sunken)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {task.description && (
            <p
              style={{
                margin: '12px 0 0',
                fontFamily: 'var(--font-sans)',
                fontSize: 12.5,
                color: 'var(--fg-default)',
                lineHeight: 1.6,
              }}
            >
              {task.description}
            </p>
          )}

          {task.outputs && task.outputs.length > 0 && (
            <div>
              <div className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginBottom: 6 }}>
                OUTPUTS · {task.outputs.length}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 6 }}>
                {task.outputs.map((o, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 4,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        padding: '1px 6px',
                        borderRadius: 2,
                        color: 'var(--fg-muted)',
                        background: 'color-mix(in srgb, var(--fg-muted) 14%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--fg-muted) 30%, transparent)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {o.kind}
                    </span>
                    <span style={{ color: 'var(--fg-default)', wordBreak: 'break-all' }}>{o.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {task.verifier && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="t-eyebrow" style={{ color: 'var(--fg-subtle)' }}>
                  VERIFIER
                </span>
                <VerifierBadge kind={task.verifier.kind} />
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11.5,
                  padding: '8px 10px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  color: 'var(--fg-default)',
                  wordBreak: 'break-all',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: 'var(--fg-faint)', marginRight: 6, userSelect: 'none' }}>$</span>
                {task.verifier.command}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
