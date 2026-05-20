import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { IconBtn, Kbd, LocalhostPill, Wordmark } from '../atoms'
import { useProjectState } from '../../lib/hooks'

interface Props {
  children: ReactNode
}

export function LayoutShell({ children }: Props) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg-canvas)' }}>
      <SkipLink />
      <TopChrome />
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        <main
          id="content"
          tabIndex={-1}
          style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--bg-canvas)',
          }}
        >
          {children}
        </main>
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

function TopChrome() {
  const { data: state } = useProjectState()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const firstPlanSlug = state?.plans[0]?.slug
  const plansTarget = firstPlanSlug ? `/plans/${firstPlanSlug}` : '/'
  const hasPlans = Boolean(firstPlanSlug)

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
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
          style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', flex: 'none' }}
          aria-label="atomic-skills home"
        >
          <Wordmark size={18} />
        </a>

        <span style={{ width: 1, height: 20, background: 'var(--border-default)', flex: 'none' }} />

        <nav style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <NavLink to="/" end style={navStyle}>
            home
          </NavLink>
          {hasPlans ? (
            <NavLink to={plansTarget} style={navStyle}>
              plans
            </NavLink>
          ) : (
            <span style={{ ...baseNav, color: 'var(--fg-faint)', cursor: 'default' }}>plans</span>
          )}
          <NavLink to="/help" style={navStyle}>
            help
          </NavLink>
        </nav>

        <div style={{ flex: 1 }} />

        <LocalhostPill />

        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn label="Help" onClick={() => navigate('/help')}>
            ?
          </IconBtn>
          <IconBtn label="Menu" onClick={() => setMenuOpen((o) => !o)}>
            ≡
          </IconBtn>
        </div>
      </header>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'transparent' }}
          />
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
            <div
              style={{
                padding: '6px 10px 8px',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: 4,
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>
                atomic-skills · dashboard
              </div>
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
  padding: '4px 8px',
  borderRadius: 4,
  transition: 'background 120ms, color 120ms',
}

function navStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    ...baseNav,
    color: isActive ? 'var(--accent-primary)' : 'var(--fg-muted)',
    background: isActive ? 'var(--bg-elevated)' : 'transparent',
  }
}
