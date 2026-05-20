export function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6 text-sm leading-relaxed">
      <h1 className="text-2xl font-medium">atomic-skills · dashboard</h1>
      <p className="mt-2 text-fg-muted">
        Read-only projection of <code className="font-mono">.atomic-skills/</code>. Files are canonical; this view
        gets out of the way.
      </p>

      <h2 className="mt-8 text-lg font-medium">Status vocabulary</h2>
      <ul className="mt-2 space-y-1">
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-status-done" /> done
        </li>
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-status-active" /> active
        </li>
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-status-pending" /> pending
        </li>
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-status-blocked" /> blocked
        </li>
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-status-parked" /> parked
        </li>
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-status-emerged" /> emerged
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-medium">Architecture</h2>
      <p className="mt-2 text-fg-muted">
        <code className="font-mono">.atomic-skills/</code> writers (the project-status skill) own canonical state.
        aiDeck watches the directory and serves the React bundle you are looking at. Updates propagate in &lt;200ms via
        SSE.
      </p>

      <p className="mt-8 text-xs text-fg-subtle">v0.1 · localhost only · zero telemetry</p>
    </div>
  )
}
