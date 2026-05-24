import { Route, Routes } from 'react-router'
import { LayoutShell } from './components/layout/LayoutShell'
import { useStateChangeSubscription } from './lib/hooks'
import { HomePage } from './pages/HomePage'
import { PlanPage } from './pages/PlanPage'
import { InitiativePage } from './pages/InitiativePage'
import { DiscoverPage } from './pages/DiscoverPage'
import { HelpPage } from './pages/HelpPage'

export function App() {
  // Single SSE subscription for the whole app — invalidates Query cache on
  // every aideck `state-change` event so every page reflects writes within
  // ~200ms of disk change.
  useStateChangeSubscription()

  return (
    <LayoutShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/plans/:slug" element={<PlanPage />} />
        <Route path="/initiatives/:slug" element={<InitiativePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/help" element={<HelpPage />} />
      </Routes>
    </LayoutShell>
  )
}
