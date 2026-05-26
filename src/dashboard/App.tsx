import { Route, Routes } from 'react-router'
import { LayoutShell } from './components/layout/LayoutShell'
import { useStateChangeSubscription } from './lib/hooks'
import { HomePage } from './pages/HomePage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { PlanPage } from './pages/PlanPage'
import { InitiativePage } from './pages/InitiativePage'
import { DiscoverPage } from './pages/DiscoverPage'
import { HelpPage } from './pages/HelpPage'

export function App() {
  useStateChangeSubscription()

  return (
    <LayoutShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        {/* Project-scoped routes */}
        <Route path="/:projectId/plans/:slug" element={<PlanPage />} />
        <Route path="/:projectId/initiatives/:slug" element={<InitiativePage />} />
        {/* Legacy routes (backward-compat: no projectId prefix) */}
        <Route path="/plans/:slug" element={<PlanPage />} />
        <Route path="/initiatives/:slug" element={<InitiativePage />} />
        <Route path="/:projectId/discover" element={<DiscoverPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/help" element={<HelpPage />} />
      </Routes>
    </LayoutShell>
  )
}
