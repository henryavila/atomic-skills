import { Route, Routes, NavLink } from 'react-router'
import { HomePage } from './pages/HomePage'
import { PlanPage } from './pages/PlanPage'
import { InitiativePage } from './pages/InitiativePage'
import { HelpPage } from './pages/HelpPage'

export function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border-default bg-bg-surface px-6 py-3 text-sm">
        <nav className="flex items-center gap-6">
          <span className="font-mono text-fg-default">atomic-skills</span>
          <NavLink to="/" end className={navClass}>
            home
          </NavLink>
          <NavLink to="/plans/v3-redesign" className={navClass}>
            plans
          </NavLink>
          <NavLink to="/help" className={navClass}>
            help
          </NavLink>
          <span className="ml-auto text-xs text-fg-subtle">127.0.0.1</span>
        </nav>
      </header>
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/plans/:slug" element={<PlanPage />} />
          <Route path="/initiatives/:slug" element={<InitiativePage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </main>
    </div>
  )
}

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'text-accent-primary'
    : 'text-fg-muted transition-colors hover:text-fg-default'
}
