import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { Wordmark, LocalhostPill } from '../atoms'
import { useProjectState } from '../../lib/hooks'

interface Props {
  children: ReactNode
}

export function LayoutShell({ children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-canvas">
      <TopChrome />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

function TopChrome() {
  // "plans" nav targets the first active plan when state is loaded; falls
  // back to home (/) before state arrives or when no plans exist. This was
  // hardcoded to /plans/v3-redesign (the demo slug) until Codex F-003.
  const { data: state } = useProjectState()
  const firstPlanSlug = state?.plans[0]?.slug
  const plansTarget = firstPlanSlug ? `/plans/${firstPlanSlug}` : '/'

  return (
    <header className="border-b border-border-default bg-bg-surface">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-6 px-6">
        <Wordmark />
        <nav className="flex items-center gap-5 text-[13px]">
          <NavLink to="/" end className={navClass}>
            home
          </NavLink>
          <NavLink to={plansTarget} className={planNavClass(Boolean(firstPlanSlug))}>
            plans
          </NavLink>
          <NavLink to="/help" className={navClass}>
            help
          </NavLink>
        </nav>
        <div className="ml-auto">
          <LocalhostPill />
        </div>
      </div>
    </header>
  )
}

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'text-accent-primary'
    : 'text-fg-muted transition-colors hover:text-fg-default'
}

function planNavClass(enabled: boolean) {
  return ({ isActive }: { isActive: boolean }): string => {
    if (!enabled) return 'text-fg-faint cursor-default pointer-events-none'
    return isActive
      ? 'text-accent-primary'
      : 'text-fg-muted transition-colors hover:text-fg-default'
  }
}
