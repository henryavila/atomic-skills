export const SOURCE_TYPES: Record<string, { glyph: string; label: string; color: string }> = {
  'git-branch':              { glyph: '⎇',  label: 'branch',  color: 'var(--status-active)' },
  'github-pr-open':          { glyph: '↻',  label: 'PR',      color: 'var(--status-emerged)' },
  'github-pr-merged-recent': { glyph: '✓',  label: 'PR',      color: 'var(--status-done)' },
  'github-issue-open-mine':  { glyph: '#',  label: 'issue',   color: 'var(--status-highlighted)' },
  'doc-plan':                { glyph: '▤',  label: 'plan',    color: 'var(--status-parked)' },
  'doc-spec':                { glyph: '§',  label: 'spec',    color: 'var(--severity-info)' },
  'doc-adr':                 { glyph: '§',  label: 'ADR',     color: 'var(--severity-info)' },
  'memory-local-entry':      { glyph: '⌬',  label: 'memory',  color: 'var(--verifier-query)' },
  'memory-local-orphan':     { glyph: '⌬',  label: 'memory',  color: 'var(--verifier-query)' },
  'memory-claude-auto':      { glyph: '✦',  label: 'claude',  color: 'var(--verifier-manual)' },
  'claude-mem-obs':          { glyph: '✦',  label: 'claude',  color: 'var(--verifier-manual)' },
  'commit-group':            { glyph: '●●', label: 'commits', color: 'var(--fg-muted)' },
  'roadmap-section':         { glyph: '⌖',  label: 'roadmap', color: 'var(--status-blocked)' },
}

export const BUCKETS: Record<string, { label: string; color: string; glyph: string }> = {
  'strong':          { label: 'Strong',          color: 'var(--status-done)',    glyph: '✓' },
  'worth-reviewing': { label: 'Worth reviewing', color: 'var(--status-blocked)', glyph: '?' },
  'historical':      { label: 'Historical',      color: 'var(--fg-subtle)',      glyph: '⌂' },
  'already-tracked': { label: 'Already tracked', color: 'var(--status-emerged)', glyph: '⇥' },
}

export const SOURCE_LAYERS: Record<string, { glyph: string; color: string }> = {
  git:    { glyph: '⎇', color: 'var(--status-active)' },
  github: { glyph: '↻', color: 'var(--status-emerged)' },
  docs:   { glyph: '▤', color: 'var(--status-parked)' },
  memory: { glyph: '⌬', color: 'var(--verifier-query)' },
  claude: { glyph: '✦', color: 'var(--verifier-manual)' },
}

export const RELATIONSHIP_KINDS: Record<string, { label: string; glyph: string }> = {
  'plan-phase':    { label: 'phase of',      glyph: '↳' },
  'shared-paths':  { label: 'shares paths',  glyph: '⊕' },
  'shared-branch': { label: 'shares branch', glyph: '⎇' },
  'subtopic':      { label: 'subtopic of',   glyph: '↘' },
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000,
  )
}

export function fmtDate(s: string): string {
  const [, m, d] = s.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[+m - 1]} ${+d}`
}

export function fmtRelativeDays(from: string, to: string): string {
  const d = daysBetween(from, to)
  if (d === 0) return 'today'
  if (d === 1) return '1d ago'
  if (d < 30) return `${d}d ago`
  if (d < 365) return `${Math.round(d / 30)}mo ago`
  return `${Math.round(d / 365)}y ago`
}
