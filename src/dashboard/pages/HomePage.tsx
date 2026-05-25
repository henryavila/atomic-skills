import { useNavigate } from 'react-router'
import { useProjectState, useProjects, useProjectScopedState } from '../lib/hooks'
import { adaptStateForHome } from '../lib/adapters'
import type { RegisteredProject } from '../lib/api'
import type { ProjectStatusState } from '../lib/types'
import { ConsumerBand, EmptyState, HomeHeader } from '../components/home/HomeComponents'

function ProjectBand({ project, onOpen }: { project: RegisteredProject; onOpen: (path: string) => void }) {
  const { data, isLoading, error } = useProjectScopedState(project.projectId)
  if (isLoading) return null
  if (error || !data) return null
  const consumers = adaptStateForHome(data)
  if (consumers.length === 0) return null

  const scopedOpen = (path: string) => onOpen(`/${project.projectId}${path}`)

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        className="t-eyebrow"
        style={{ color: 'var(--fg-muted)', marginBottom: 8, fontSize: 11, letterSpacing: '0.05em' }}
      >
        {project.projectId}
      </div>
      {consumers.map((c) => (
        <ConsumerBand key={`${project.projectId}-${c.id}`} consumer={c} onOpen={scopedOpen} />
      ))}
    </div>
  )
}

function MultiProjectHome({ projects, onOpen }: { projects: RegisteredProject[]; onOpen: (path: string) => void }) {
  return (
    <>
      {projects.map((p) => (
        <ProjectBand key={p.projectId} project={p} onOpen={onOpen} />
      ))}
    </>
  )
}

function SingleProjectHome({ data, onOpen }: { data: ProjectStatusState; onOpen: (path: string) => void }) {
  const consumers = adaptStateForHome(data)
  if (consumers.length === 0) return <EmptyState />
  return (
    <div style={{ marginTop: 12 }}>
      {consumers.map((c) => (
        <ConsumerBand key={c.id} consumer={c} onOpen={onOpen} />
      ))}
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { data: projects, error: projectsError } = useProjects()
  const { data: singleState, isLoading: stateLoading, error: stateError } = useProjectState()

  const hasMultiProject = !projectsError && projects && projects.length > 0
  const isLoading = stateLoading && !hasMultiProject

  if (isLoading) {
    return <Frame><p className="text-fg-muted">Loading project state…</p></Frame>
  }

  if (stateError && !hasMultiProject) {
    const msg = stateError.message ?? ''
    const isApiError = msg.startsWith('HTTP ')
    return (
      <Frame>
        <div
          style={{
            padding: '16px 18px',
            background: 'color-mix(in srgb, var(--severity-critical) 6%, var(--bg-surface))',
            border: '1px solid color-mix(in srgb, var(--severity-critical) 35%, transparent)',
            borderRadius: 8,
          }}
        >
          <div
            className="t-eyebrow"
            style={{ color: 'var(--severity-critical)', marginBottom: 6 }}
          >
            {isApiError ? 'STATE ERROR' : 'CANNOT REACH AIDECK'}
          </div>
          {isApiError ? (
            <pre style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg}</pre>
          ) : (
            <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 13 }}>
              The dashboard expects an aideck server on{' '}
              <code className="font-mono" style={{ color: 'var(--fg-default)' }}>127.0.0.1:7777</code>. Run{' '}
              <code className="font-mono" style={{ color: 'var(--fg-default)' }}>npx atomic-skills serve</code> from the
              target repo.
            </p>
          )}
        </div>
      </Frame>
    )
  }

  const consumerCount = hasMultiProject
    ? projects.length
    : singleState ? adaptStateForHome(singleState).length : 0

  return (
    <Frame>
      <HomeHeader consumerCount={consumerCount} />
      {hasMultiProject ? (
        <div style={{ marginTop: 12 }}>
          <MultiProjectHome projects={projects} onOpen={navigate} />
        </div>
      ) : singleState ? (
        <SingleProjectHome data={singleState} onOpen={navigate} />
      ) : (
        <EmptyState />
      )}
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 80px' }}>{children}</div>
}
