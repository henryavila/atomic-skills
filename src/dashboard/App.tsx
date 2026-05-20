import { Route, Routes } from 'react-router'
import { LayoutShell } from './components/layout/LayoutShell'
import { HomePage } from './pages/HomePage'
import { PlanPage } from './pages/PlanPage'
import { InitiativePage } from './pages/InitiativePage'
import { HelpPage } from './pages/HelpPage'

export function App() {
  return (
    <LayoutShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/plans/:slug" element={<PlanPage />} />
        <Route path="/initiatives/:slug" element={<InitiativePage />} />
        <Route path="/help" element={<HelpPage />} />
      </Routes>
    </LayoutShell>
  )
}
