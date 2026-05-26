import { useNavigate } from 'react-router'
import { useProjectState, useProjects, useProjectScopedState } from '../lib/hooks'
import { adaptStateForHome } from '../lib/adapters'
import type { RegisteredProject } from '../lib/api'
import type { ProjectStatusState } from '../lib/types'
import { ProjectCard, type ProjectCardData } from '../components/home/ProjectCard'
import { EmptyState } from '../components/home/HomeComponents'

// ── ProjectCardWrapper (loads state for one project) ──────────────────────

function ProjectCardWrapper({
  project, onOpen,
}: {
  project: RegisteredProject; onOpen: (projectId: string) => void
}) {
  const { data, isLoading, error } = useProjectScopedState(project.projectId)
  if (isLoading) return <CardSkeleton name={project.projectId} />
  if (error || !data) return <CardSkeleton name={project.projectId} errored />

  const consumers = adaptStateForHome(data)
  const cardData: ProjectCardData = {
    id: project.projectId,
    name: project.projectId,
    fullPath: project.rootDir,
    branch: data.plans[0]?.branch ?? 'main',
    lastActivity: formatRelativeTime(data.generatedAt),
    health: deriveHealth(data),
    description: undefined,
    consumers,
  }

  return <ProjectCard project={cardData} onClick={() => onOpen(project.projectId)} />
}

// ── MultiProjectHome (ProjectsIndex) ──────────────────────────────────────

function MultiProjectHome({
  projects, onOpen,
}: {
  projects: RegisteredProject[]; onOpen: (projectId: string) => void
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))',
      gap: 14, marginTop: 14,
    }}>
      {projects.map(p => (
        <ProjectCardWrapper key={p.projectId} project={p} onOpen={onOpen} />
      ))}
    </div>
  )
}

// ── SingleProjectHome (legacy fallback) ───────────────────────────────────

function SingleProjectHome({
  data, onOpen,
}: {
  data: ProjectStatusState; onOpen: (path: string) => void
}) {
  const consumers = adaptStateForHome(data)
  if (consumers.length === 0) return <EmptyState />

  const cardData: ProjectCardData = {
    id: 'default',
    name: 'this project',
    fullPath: '~',
    branch: data.plans[0]?.branch ?? 'main',
    lastActivity: formatRelativeTime(data.generatedAt),
    health: deriveHealth(data),
    consumers,
  }

  return (
    <div style={{ marginTop: 14 }}>
      <ProjectCard
        project={cardData}
        onClick={() => {
          const firstPlan = data.plans[0]
          if (firstPlan) onOpen(`/plans/${firstPlan.slug}`)
        }}
      />
    </div>
  )
}

// ── IndexHeader ───────────────────────────────────────────────────────────

function IndexHeader({ projectCount }: { projectCount: number }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="t-eyebrow" style={{
        color: 'var(--fg-subtle)', marginBottom: 8,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>HOME</span>
        <span style={{ color: 'var(--fg-faint)' }}>·</span>
        <span style={{ color: 'var(--fg-faint)' }}>127.0.0.1:7777</span>
      </div>
      <h1 style={{
        margin: 0, fontFamily: 'var(--font-sans)', fontSize: 32, fontWeight: 600,
        color: 'var(--fg-default)', letterSpacing: '-0.025em', lineHeight: 1.1,
      }}>
        {projectCount === 0 ? (
          <>aiDeck is running. No projects yet.</>
        ) : (
          <>
            aiDeck is watching{' '}
            <span style={{ color: 'var(--status-active)' }}>{projectCount}</span>
            {' '}{projectCount === 1 ? 'project' : 'projects'}.
          </>
        )}
      </h1>
      <p style={{
        margin: '10px 0 0', fontFamily: 'var(--font-sans)', fontSize: 14,
        color: 'var(--fg-muted)', lineHeight: 1.55, maxWidth: 720,
      }}>
        {projectCount === 0 ? (
          <>
            aiDeck projects from <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>.atomic-skills/</code> directories.
            Register a project to start watching.
          </>
        ) : (
          <>
            Each card below is a repo on disk with an{' '}
            <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>.atomic-skills/</code>
            {' '}directory. aiDeck projects from those files — it doesn't own state.
            Click a project to open its plans, initiatives, and roadmap.
          </>
        )}
      </p>
    </div>
  )
}

// ── EmptyProjectsState ────────────────────────────────────────────────────

function EmptyProjectsState() {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{
        padding: '24px 24px 22px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        boxShadow: 'var(--shadow-ambient)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div className="t-eyebrow" style={{ color: 'var(--fg-muted)', marginBottom: 8 }}>
          GETTING STARTED
        </div>
        <h2 style={{
          margin: 0, fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 600,
          color: 'var(--fg-default)', letterSpacing: '-0.015em',
        }}>No projects registered yet.</h2>
        <p style={{
          margin: '8px 0 14px', maxWidth: 680, color: 'var(--fg-muted)',
          fontSize: 13, lineHeight: 1.55,
        }}>
          Register a repo that has an{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>.atomic-skills/</code>{' '}
          directory, or run a skill from that repo to auto-register.
        </p>
        <div style={{
          padding: '10px 14px',
          background: 'var(--bg-sunken)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-default)',
        }}>
          npx atomic-skills serve
        </div>
      </div>
    </div>
  )
}

// ── HomePage (main export) ────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate()
  const { data: projects, error: projectsError } = useProjects()
  const { data: singleState, isLoading: stateLoading, error: stateError } = useProjectState()

  const hasMultiProject = !projectsError && projects && projects.length > 0
  const isLoading = stateLoading && !hasMultiProject

  if (isLoading) {
    return <Frame><p style={{ color: 'var(--fg-muted)' }}>Loading project state…</p></Frame>
  }

  if (stateError && !hasMultiProject) {
    const msg = stateError.message ?? ''
    const isApiError = msg.startsWith('HTTP ')
    return (
      <Frame>
        <IndexHeader projectCount={0} />
        <div style={{
          padding: '16px 18px', marginTop: 12,
          background: 'color-mix(in srgb, var(--severity-critical) 6%, var(--bg-surface))',
          border: '1px solid color-mix(in srgb, var(--severity-critical) 35%, transparent)',
          borderRadius: 8,
        }}>
          <div className="t-eyebrow" style={{ color: 'var(--severity-critical)', marginBottom: 6 }}>
            {isApiError ? 'STATE ERROR' : 'CANNOT REACH AIDECK'}
          </div>
          {isApiError ? (
            <pre style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg}</pre>
          ) : (
            <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 13 }}>
              The dashboard expects an aideck server on{' '}
              <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>127.0.0.1:7777</code>. Run{' '}
              <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>npx atomic-skills serve</code>{' '}
              from the target repo.
            </p>
          )}
        </div>
      </Frame>
    )
  }

  const projectCount = hasMultiProject ? projects.length : (singleState ? 1 : 0)

  return (
    <Frame>
      <IndexHeader projectCount={projectCount} />
      {hasMultiProject ? (
        <MultiProjectHome
          projects={projects}
          onOpen={(projectId) => navigate(`/projects/${projectId}`)}
        />
      ) : singleState ? (
        <SingleProjectHome data={singleState} onOpen={navigate} />
      ) : (
        <EmptyProjectsState />
      )}
    </Frame>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function Frame({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 80px' }}>{children}</div>
}

function CardSkeleton({ name, errored }: { name: string; errored?: boolean }) {
  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 8,
      fontFamily: 'var(--font-mono)', fontSize: 13,
      color: errored ? 'var(--severity-critical)' : 'var(--fg-muted)',
    }}>
      {errored ? `⊘ ${name} — failed to load` : `Loading ${name}…`}
    </div>
  )
}

function deriveHealth(state: ProjectStatusState): 'active' | 'idle' | 'errored' | 'empty' {
  if (state.plans.length === 0 && state.initiatives.length === 0) return 'empty'
  const hasActive = state.plans.some(p => p.status === 'active') ||
    state.initiatives.some(i => i.status === 'active')
  return hasActive ? 'active' : 'idle'
}

function formatRelativeTime(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}
