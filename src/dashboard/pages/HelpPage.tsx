import {
  Card,
  GateStatusBadge,
  HighlightBadge,
  Kbd,
  SectionHeader,
  StatusChip,
  VerifierBadge,
} from '../components/atoms'

export function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-6 text-sm leading-relaxed text-fg-default">
      <h1 className="text-2xl font-medium">atomic-skills · dashboard</h1>
      <p className="mt-2 text-fg-muted">
        Read-only projection of <code className="font-mono">.atomic-skills/</code>. Files are
        canonical; this view gets out of the way.
      </p>

      <div className="mt-8 space-y-6">
        <Card>
          <SectionHeader>Status vocabulary</SectionHeader>
          <div className="flex flex-wrap gap-2 p-4">
            {['done', 'active', 'pending', 'blocked', 'paused', 'archived'].map((s) => (
              <StatusChip key={s} status={s} />
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader>Stack-frame vocabulary</SectionHeader>
          <div className="flex flex-wrap gap-2 p-4">
            <StatusChip status="parked" />
            <StatusChip status="emerged" />
            <StatusChip status="highlighted" />
          </div>
          <div className="border-t border-border-subtle px-4 py-3 text-xs text-fg-muted">
            <strong className="text-fg-default">parked</strong> — lateral finding noted but not
            promoted to a task.{' '}
            <strong className="text-fg-default">emerged</strong> — finding worth a follow-up
            initiative.{' '}
            <strong className="text-fg-default">highlighted</strong> — flagged for human review.
          </div>
        </Card>

        <Card>
          <SectionHeader>Exit-gate verifiers</SectionHeader>
          <div className="flex flex-wrap gap-2 p-4">
            <VerifierBadge kind="shell" />
            <VerifierBadge kind="query" />
            <VerifierBadge kind="test" />
            <VerifierBadge kind="manual" />
          </div>
          <div className="border-t border-border-subtle px-4 py-3 text-xs text-fg-muted">
            Each criterion has a verifier kind. <strong className="text-fg-default">shell</strong>{' '}
            and <strong className="text-fg-default">test</strong> auto-run; the others record
            evidence manually.
          </div>
        </Card>

        <Card>
          <SectionHeader>Gate states</SectionHeader>
          <div className="flex flex-wrap gap-2 p-4">
            <GateStatusBadge status="met" />
            <GateStatusBadge status="pending" />
            <GateStatusBadge status="deferred" />
          </div>
        </Card>

        <Card>
          <SectionHeader>Highlight severity</SectionHeader>
          <div className="flex flex-wrap gap-2 p-4">
            <HighlightBadge severity="info" />
            <HighlightBadge severity="warn" />
            <HighlightBadge severity="critical" />
          </div>
        </Card>

        <Card>
          <SectionHeader>Keyboard</SectionHeader>
          <div className="space-y-1.5 p-4 font-mono text-[12px] text-fg-muted">
            <div>
              <Kbd>g</Kbd> <Kbd>h</Kbd> → home
            </div>
            <div>
              <Kbd>g</Kbd> <Kbd>p</Kbd> → plans
            </div>
            <div>
              <Kbd>/</Kbd> → focus search (v0.2)
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader>Architecture</SectionHeader>
          <div className="space-y-2 p-4 text-[13px] text-fg-muted">
            <p>
              The <code className="font-mono text-fg-default">project-status</code> skill writes
              canonical files under{' '}
              <code className="font-mono text-fg-default">.atomic-skills/</code>. aiDeck watches
              the directory and serves this dashboard. Updates propagate in &lt;200ms via SSE.
            </p>
            <p>
              Iron law: files are the source of truth. Closing aiDeck does not lose work; opening
              it back up rebuilds the view from disk.
            </p>
          </div>
        </Card>
      </div>

      <p className="mt-10 text-xs text-fg-subtle">v0.1 · localhost only · zero telemetry</p>
    </div>
  )
}
