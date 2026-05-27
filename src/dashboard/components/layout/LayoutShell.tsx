import { useState, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { IconBtn, Kbd, LocalhostPill, Wordmark } from '../atoms'
import { AnnotationPanel } from '../feedback/AnnotationPanel'
import { FeedbackDrawer } from '../feedback/FeedbackDrawer'
import { useHealth } from '../../lib/hooks'
import { DemoBanner } from './DemoBanner'

interface Props {
  children: ReactNode
  /** Show the seeded-data DemoBanner — driven by ?demo=1 or AS_DEMO env */
  demoMode?: boolean
}

export function LayoutShell({ children, demoMode = false }: Props) {
  const [openDrawer, setOpenDrawer] = useState<null | 'annotations' | 'feedback'>(null)
  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'transparent' }}>
      <SkipLink />
      <DemoBanner visible={demoMode} />
      <TopChrome
        openDrawer={openDrawer}
        onToggleAnnotations={() => setOpenDrawer((d) => (d === 'annotations' ? null : 'annotations'))}
        onToggleFeedback={() => setOpenDrawer((d) => (d === 'feedback' ? null : 'feedback'))}
      />
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        <main
          id="content"
          tabIndex={-1}
          style={{ flex: 1, overflowY: 'auto', background: 'transparent' }}
        >
          {children}
        </main>
        <AnnotationPanel open={openDrawer === 'annotations'} onClose={() => setOpenDrawer(null)} />
        <FeedbackDrawer open={openDrawer === 'feedback'} onClose={() => setOpenDrawer(null)} />
      </div>
    </div>
  )
}

function SkipLink() {
  return (
    <a
      href="#content"
      style={{
        position: 'absolute',
        top: -40,
        left: 12,
        zIndex: 1000,
        padding: '8px 14px',
        background: 'var(--bg-elevated)',
        color: 'var(--fg-default)',
        border: '1px solid var(--accent-focus)',
        borderRadius: 6,
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: 500,
        textDecoration: 'none',
        transition: 'top 120ms var(--ease-out)',
      }}
      onFocus={(e) => {
        e.currentTarget.style.top = '8px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.top = '-40px'
      }}
    >
      Skip to content
    </a>
  )
}

function buildBreadcrumbs(pathname: string, projectDisplayName?: string): Array<{ label: string; to?: string }> {
  const crumbs: Array<{ label: string; to?: string }> = []

  // /projects/:projectId
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  if (projectMatch) {
    crumbs.push({ label: projectDisplayName ?? projectMatch[1], to: `/projects/${projectMatch[1]}` })
    return crumbs
  }

  // /:projectId/plans/:slug or /:projectId/initiatives/:slug
  const scopedMatch = pathname.match(/^\/([^/]+)\/(plans|initiatives)\/([^/]+)/)
  if (scopedMatch) {
    const [, pid, kind, slug] = scopedMatch
    crumbs.push({ label: projectDisplayName ?? pid, to: `/projects/${pid}` })
    crumbs.push({ label: `${kind}/${slug}` })
    return crumbs
  }

  // /plans/:slug or /initiatives/:slug (legacy — no projectId in URL)
  const legacyMatch = pathname.match(/^\/(plans|initiatives)\/([^/]+)/)
  if (legacyMatch) {
    const [, kind, slug] = legacyMatch
    crumbs.push({ label: projectDisplayName ?? '…', to: '/' })
    crumbs.push({ label: `${kind}/${slug}` })
    return crumbs
  }

  // /:projectId/discover
  const discoverScopedMatch = pathname.match(/^\/([^/]+)\/discover$/)
  if (discoverScopedMatch) {
    const [, pid] = discoverScopedMatch
    crumbs.push({ label: projectDisplayName ?? pid, to: `/projects/${pid}` })
    crumbs.push({ label: 'discover' })
    return crumbs
  }

  // /discover (legacy)
  if (pathname === '/discover') {
    crumbs.push({ label: 'discover' })
    return crumbs
  }

  // /help
  if (pathname === '/help') {
    crumbs.push({ label: 'help' })
    return crumbs
  }

  return crumbs
}

function TopChrome({
  openDrawer,
  onToggleAnnotations,
  onToggleFeedback,
}: {
  openDrawer: null | 'annotations' | 'feedback'
  onToggleAnnotations: () => void
  onToggleFeedback: () => void
}) {
  const { data: health } = useHealth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const projectIdFromUrl = location.pathname.match(/^\/(?:projects\/)?([^/]+)/)?.[1]
  const projectDisplayName = projectIdFromUrl && projectIdFromUrl !== 'plans' && projectIdFromUrl !== 'initiatives' && projectIdFromUrl !== 'discover' && projectIdFromUrl !== 'help'
    ? projectIdFromUrl
    : health?.rootDir
      ? health.rootDir.split('/').pop() ?? undefined
      : undefined

  const crumbs = buildBreadcrumbs(location.pathname, projectDisplayName)

  return (
    <>
      <header
        role="banner"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          height: 52,
          padding: '0 18px',
          background: 'var(--bg-canvas)',
          borderBottom: '1px solid var(--border-default)',
          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.025)',
          flex: 'none',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <a
          href="#/"
          onClick={(e) => { e.preventDefault(); navigate('/') }}
          style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', flex: 'none' }}
          aria-label="aiDeck home"
        >
          <Wordmark size={18} />
        </a>
        {crumbs.length > 0 && (
          <>
            <span style={{ width: 1, height: 20, background: 'var(--border-default)', flex: 'none' }} />
            <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {crumbs.map((c, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && <span style={{ color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>›</span>}
                  {c.to && i < crumbs.length - 1 ? (
                    <button
                      onClick={() => navigate(c.to!)}
                      style={{ ...baseNav, color: 'var(--accent-link)', cursor: 'pointer', background: 'none', border: 'none', padding: '4px 6px' }}
                    >{c.label}</button>
                  ) : (
                    <span style={{ ...baseNav, color: 'var(--fg-default)', fontWeight: 500, padding: '4px 6px' }}>
                      {c.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          </>
        )}
        <div style={{ flex: 1 }} />
        <LocalhostPill />
        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn label="Help" onClick={() => navigate('/help')}>
            ?
          </IconBtn>
          <IconBtn
            label={openDrawer === 'feedback' ? 'Close feedback drawer' : 'Open feedback drawer'}
            onClick={onToggleFeedback}
          >
            ⚑
          </IconBtn>
          <IconBtn
            label={openDrawer === 'annotations' ? 'Close annotations' : 'Open annotations'}
            onClick={onToggleAnnotations}
          >
            ◗
          </IconBtn>
          <IconBtn label="Menu" onClick={() => setMenuOpen((o) => !o)}>
            ≡
          </IconBtn>
        </div>
      </header>
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
          <div
            role="menu"
            aria-label="Application menu"
            style={{
              position: 'absolute',
              top: 56,
              right: 18,
              zIndex: 40,
              width: 240,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              boxShadow: 'var(--shadow-md)',
              padding: 6,
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
            }}
          >
            <div style={{ padding: '6px 10px 8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>atomic-skills · dashboard</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-faint)', marginTop: 2 }}>
                localhost · MIT · zero telemetry
              </div>
            </div>
            {[
              { label: 'Home', to: '/', kbd: 'g h' },
              { label: 'Help', to: '/help', kbd: 'g ?' },
            ].map((m) => (
              <button
                key={m.label}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  navigate(m.to)
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-overlay)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 5,
                  color: 'var(--fg-default)',
                  transition: 'background 120ms',
                }}
              >
                <span style={{ flex: 1 }}>{m.label}</span>
                <Kbd>{m.kbd}</Kbd>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}

const baseNav: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  textDecoration: 'none',
  borderRadius: 4,
  transition: 'background 120ms, color 120ms',
}
