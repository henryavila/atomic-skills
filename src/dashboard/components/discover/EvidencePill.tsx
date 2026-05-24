import type { DiscoverEvidence } from '../../lib/types'

const ICONS: Record<string, string> = {
  'git-branch': '⑂',
  'github-pr-open': '⊙',
  'github-issue-open-mine': '◉',
  'doc-plan': '▤',
  'doc-spec': '▤',
  'doc-adr': '▤',
  'memory-local-entry': '◈',
  'memory-local-orphan': '◇',
  'commit-group': '⊕',
  'memory-claude-auto': '◎',
  'claude-mem-obs': '◎',
  'roadmap-section': '▸',
  'github-pr-merged-recent': '✓',
}

interface Props {
  evidence: DiscoverEvidence
}

export function EvidencePill({ evidence }: Props) {
  const icon = ICONS[evidence.sourceType] ?? '•'
  return (
    <span
      title={evidence.evidenceQuote}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 11,
        background: 'var(--bg-inset)',
        color: 'var(--fg-muted)',
        cursor: 'default',
        whiteSpace: 'nowrap',
      }}
    >
      <span>{icon}</span>
      <span>{evidence.sourceId}</span>
    </span>
  )
}
