import { useNavigate, useParams } from 'react-router'
import { InitiativeHero } from '../components/initiative/InitiativeHero'
import {
  EmergedPanel,
  ExitGatesCard,
  ParkedPanel,
  ReferencesPanel,
  StackPanel,
} from '../components/initiative/Panels'
import { TaskList } from '../components/initiative/TaskList'
import { adaptInitiativeForUI } from '../lib/adapters'
import { useInitiative, usePlan, useProjectState } from '../lib/hooks'

export function InitiativePage() {
  const navigate = useNavigate()
  const { slug, projectId } = useParams<{ slug: string; projectId?: string }>()
  const { data: init, isLoading, error } = useInitiative(slug, projectId)
  const { data: planData } = usePlan(init?.parentPlan, projectId)
  const { data: state } = useProjectState()

  if (isLoading) return <Frame>Loading initiative…</Frame>
  if (error)
    return (
      <Frame>
        <p style={{ color: 'var(--severity-critical)' }}>Cannot load initiative: {String(error)}</p>
      </Frame>
    )
  if (!init) return <Frame>Initiative not found.</Frame>

  // Plan + initiatives are needed to compute phaseIndex/phaseTotal correctly.
  const plan = planData ?? state?.plans.find((p) => p.slug === init.parentPlan)
  const ui = adaptInitiativeForUI(init, plan)

  const isDone = ui.status === 'done'

  return (
    <Frame>
      <InitiativeHero
        initiative={ui}
        onJumpToTask={(taskId) => {
          const el = document.getElementById(`task-${taskId}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      />

      {ui.exitGates.length > 0 && <ExitGatesCard gates={ui.exitGates} />}

      {!isDone && ui.stack.length > 0 && <StackPanel stack={ui.stack} />}

      {ui.tasks.length > 0 && <TaskList tasks={ui.tasks} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <ParkedPanel items={ui.parked} />
        <EmergedPanel items={ui.emerged} />
      </div>

      {ui.references.length > 0 && <ReferencesPanel refs={ui.references} />}

      {ui.parentPlan && (
        <p style={{ marginTop: 6, fontSize: 13 }}>
          <button
            onClick={() => navigate(`/plans/${ui.parentPlan!.slug}`)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              color: 'var(--accent-link)',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              textDecorationColor: 'color-mix(in srgb, var(--accent-link) 35%, transparent)',
            }}
          >
            ← back to plan
          </button>
        </p>
      )}
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '20px 24px 80px',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {children}
    </div>
  )
}
