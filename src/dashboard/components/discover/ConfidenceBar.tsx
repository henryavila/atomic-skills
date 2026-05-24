const SOURCE_COLORS: Record<string, string> = {
  'git-branch': '#60a5fa',
  'github-pr-open': '#34d399',
  'github-pr-merged-recent': '#6ee7b7',
  'github-issue-open-mine': '#a78bfa',
  'commit-group': '#94a3b8',
  'doc-plan': '#fbbf24',
  'doc-spec': '#f59e0b',
  'doc-adr': '#d97706',
  'roadmap-section': '#fb923c',
  'memory-local-entry': '#f472b6',
  'memory-local-orphan': '#f9a8d4',
  'memory-claude-auto': '#c084fc',
  'claude-mem-obs': '#a855f7',
}

interface Props {
  breakdown: Record<string, number>
  confidence: number
}

export function ConfidenceBar({ breakdown, confidence }: Props) {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: 'var(--bg-inset)',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {entries.map(([type, weight]) => (
          <div
            key={type}
            title={`${type}: ${(weight * 100).toFixed(0)}%`}
            style={{
              width: `${weight * 100}%`,
              height: '100%',
              background: SOURCE_COLORS[type] ?? '#64748b',
            }}
          />
        ))}
      </div>
      <span className="font-mono" style={{ fontSize: 12, color: 'var(--fg-muted)', minWidth: 32, textAlign: 'right' }}>
        {confidence.toFixed(2)}
      </span>
    </div>
  )
}
