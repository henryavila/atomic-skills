// Status / severity / verifier vocabulary — mirrors atoms.jsx in the
// Claude Design handoff. Single source of truth for glyphs + token-CSS-var
// names. Components read these maps; the actual color values live in
// styles/tokens.css.

import type { TaskStatus, InitiativeStatus, SeverityLevel, VerifierKind } from '../../lib/types'

export type StatusKey =
  | TaskStatus
  | InitiativeStatus
  | 'parked'
  | 'emerged'
  | 'highlighted'

export interface StatusToken {
  glyph: string
  color: string
  bg: string
}

export const STATUS_TOKENS: Record<string, StatusToken> = {
  done: { glyph: '✓', color: 'var(--status-done)', bg: 'var(--status-done-bg)' },
  active: { glyph: '◉', color: 'var(--status-active)', bg: 'var(--status-active-bg)' },
  pending: { glyph: '·', color: 'var(--status-pending)', bg: 'var(--status-pending-bg)' },
  blocked: { glyph: '⊘', color: 'var(--status-blocked)', bg: 'var(--status-blocked-bg)' },
  parked: { glyph: '⌂', color: 'var(--status-parked)', bg: 'var(--status-parked-bg)' },
  emerged: { glyph: '⇥', color: 'var(--status-emerged)', bg: 'var(--status-emerged-bg)' },
  highlighted: {
    glyph: '⚑',
    color: 'var(--status-highlighted)',
    bg: 'var(--status-highlighted-bg)',
  },
  paused: { glyph: '⏸', color: 'var(--status-pending)', bg: 'var(--status-pending-bg)' },
  archived: { glyph: '⊟', color: 'var(--fg-subtle)', bg: 'var(--bg-elevated)' },
}

export const SEVERITY_TOKENS: Record<SeverityLevel, StatusToken> = {
  info: { glyph: 'ℹ', color: 'var(--severity-info)', bg: 'var(--severity-info-bg)' },
  warn: { glyph: '!', color: 'var(--severity-warn)', bg: 'var(--severity-warn-bg)' },
  critical: { glyph: '⚠', color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
}

export interface VerifierToken {
  glyph: string
  color: string
}

export const VERIFIER_TOKENS: Record<VerifierKind, VerifierToken> = {
  shell: { glyph: '$_', color: 'var(--verifier-shell)' },
  query: { glyph: 'SQL', color: 'var(--verifier-query)' },
  test: { glyph: '✓✓', color: 'var(--verifier-test)' },
  manual: { glyph: '👁', color: 'var(--verifier-manual)' },
}

// Gate status uses the same value space as task status but is a closed enum
// from the schema — kept separate so type narrowing stays useful.
export const GATE_STATUS_TOKENS = {
  met: STATUS_TOKENS.done!,
  pending: STATUS_TOKENS.pending!,
  deferred: STATUS_TOKENS.blocked!,
}
