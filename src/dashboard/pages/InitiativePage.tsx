import { Link, useParams } from 'react-router'
import { useInitiative } from '../lib/hooks'
import {
  Card,
  GateStatusBadge,
  SectionHeader,
  StatusChip,
  StatusGlyph,
  VerifierBadge,
} from '../components/atoms'
import type { Task, ExitCriterion, StackFrame } from '../lib/types'

export function InitiativePage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: init, isLoading, error } = useInitiative(slug)

  if (isLoading) return <Frame>Loading initiative…</Frame>
  if (error)
    return (
      <Frame>
        <p className="text-severity-critical">Cannot load initiative: {String(error)}</p>
      </Frame>
    )
  if (!init) return <Frame>Initiative not found.</Frame>

  const openTasks = init.tasks.filter((t) => t.status !== 'done')

  return (
    <Frame>
      <header className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
          initiative ·{' '}
          {init.parentPlan && init.phaseId ? `${init.parentPlan}/${init.phaseId}` : 'standalone'}
        </div>
        <h1 className="mt-1 text-2xl font-medium text-fg-default">{init.title}</h1>
        <p className="mt-2 text-sm text-fg-muted">{init.goal}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <StatusChip status={init.status} />
          {init.branch && (
            <span className="font-mono text-[11px] text-fg-subtle">branch {init.branch}</span>
          )}
          {init.nextAction && (
            <span className="text-fg-muted">
              next: <span className="text-fg-default">{init.nextAction}</span>
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <SectionHeader count={init.tasks.length}>Tasks ({openTasks.length} open)</SectionHeader>
          {init.tasks.length === 0 ? (
            <div className="p-4 text-sm text-fg-faint">No tasks yet.</div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {init.tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeader count={init.stack.length}>Stack (depth {init.stack.length})</SectionHeader>
          {init.stack.length === 0 ? (
            <div className="p-4 text-sm text-fg-faint">No active frames.</div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {init.stack.map((f) => (
                <StackRow key={f.id} frame={f} />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeader count={init.parked.length}>Parked</SectionHeader>
          {init.parked.length === 0 ? (
            <div className="p-4 text-sm text-fg-faint">Nothing parked.</div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {init.parked.map((p, i) => (
                <li key={i} className="px-4 py-2 text-sm text-fg-default">
                  <StatusGlyph status="parked" size={12} />{' '}
                  <span className="ml-1">{p.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeader count={init.emerged.length}>Emerged</SectionHeader>
          {init.emerged.length === 0 ? (
            <div className="p-4 text-sm text-fg-faint">Nothing emerged.</div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {init.emerged.map((e, i) => (
                <li key={i} className="px-4 py-2 text-sm text-fg-default">
                  <StatusGlyph status="emerged" size={12} />{' '}
                  <span className="ml-1">
                    {e.title}
                    {e.promoted && <span className="ml-2 text-fg-subtle">— promoted</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {init.exitGates.length > 0 && (
        <div className="mt-6">
          <Card>
            <SectionHeader count={init.exitGates.length}>Exit gates</SectionHeader>
            <ul className="divide-y divide-border-subtle">
              {init.exitGates.map((c) => (
                <ExitCriterionRow key={c.id} criterion={c} />
              ))}
            </ul>
          </Card>
        </div>
      )}

      <p className="mt-6 text-sm">
        {init.parentPlan ? (
          <Link to={`/plans/${init.parentPlan}`} className="text-accent-link hover:underline">
            ← {init.parentPlan}
          </Link>
        ) : (
          <Link to="/" className="text-accent-link hover:underline">
            ← home
          </Link>
        )}
      </p>
    </Frame>
  )
}

function TaskRow({ task }: { task: Task }) {
  return (
    <li className="px-4 py-2">
      <div className="flex items-baseline gap-2">
        <StatusGlyph status={task.status} size={12} />
        <span className="font-mono text-[11px] text-fg-subtle">{task.id}</span>
        <span className="flex-1 truncate text-sm text-fg-default">{task.title}</span>
        {task.verifier && <VerifierBadge kind={task.verifier.kind} />}
      </div>
      {task.blockedBy && task.blockedBy.length > 0 && (
        <div className="mt-1 pl-5 font-mono text-[10px] text-fg-subtle">
          blocked by: {task.blockedBy.join(', ')}
        </div>
      )}
    </li>
  )
}

function StackRow({ frame }: { frame: StackFrame }) {
  return (
    <li className="flex items-baseline gap-2 px-4 py-2 font-mono text-[12px]">
      <span className="text-fg-subtle">#{frame.id}</span>
      <span className="flex-1 truncate text-fg-default">{frame.title}</span>
      <span className="text-fg-faint">{frame.type}</span>
    </li>
  )
}

function ExitCriterionRow({ criterion }: { criterion: ExitCriterion }) {
  return (
    <li className="space-y-1.5 px-4 py-3 text-sm">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] text-fg-subtle">{criterion.id}</span>
        <span className="flex-1 text-fg-default">{criterion.description}</span>
        {criterion.verifier && <VerifierBadge kind={criterion.verifier.kind} />}
        <GateStatusBadge status={criterion.status} />
      </div>
      {criterion.evidence && (
        <div className="pl-4 font-mono text-[11px] text-fg-muted">
          {criterion.evidence.verifierKind} ·{' '}
          {criterion.evidence.passed === true ? 'pass' : criterion.evidence.passed === false ? 'fail' : 'unknown'} ·{' '}
          {criterion.evidence.verifiedAt}
          {criterion.evidence.outputSummary && (
            <div className="mt-0.5 italic text-fg-subtle">
              {criterion.evidence.outputSummary.slice(0, 200)}
            </div>
          )}
        </div>
      )}
      {criterion.deferredReason && (
        <div className="pl-4 text-[11px] text-status-blocked">
          deferred: {criterion.deferredReason}
        </div>
      )}
    </li>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
}
