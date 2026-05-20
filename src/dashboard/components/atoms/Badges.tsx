import type { CSSProperties, ReactNode } from 'react'
import type { SeverityLevel, VerifierKind } from '../../lib/types'
import { SEVERITY_TOKENS, VERIFIER_TOKENS, GATE_STATUS_TOKENS } from './tokens'

interface HighlightProps {
  severity: SeverityLevel
  count?: number
  label?: string
}

export function HighlightBadge({ severity, count, label }: HighlightProps) {
  const s = SEVERITY_TOKENS[severity]
  const style: CSSProperties = {
    color: s.color,
    background: s.bg,
    border: `1px solid color-mix(in srgb, ${s.color} 35%, transparent)`,
  }
  return (
    <span
      className="inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full px-2 font-mono text-[11px] font-semibold"
      style={style}
    >
      ⚑ {label ?? (count != null ? `${count} ${severity}` : severity)}
    </span>
  )
}

interface VerifierBadgeProps {
  kind: VerifierKind
}

export function VerifierBadge({ kind }: VerifierBadgeProps) {
  const v = VERIFIER_TOKENS[kind]
  const style: CSSProperties = {
    background: `color-mix(in srgb, ${v.color} 16%, var(--bg-surface))`,
    color: v.color,
    border: `1px solid color-mix(in srgb, ${v.color} 35%, transparent)`,
  }
  return (
    <span
      className="inline-flex h-5 min-w-[38px] items-center gap-1 whitespace-nowrap rounded px-1.5 font-mono text-[10px] font-semibold"
      style={style}
    >
      {v.glyph} {kind}
    </span>
  )
}

interface TagChipProps {
  kind?: 'neutral' | 'critical' | 'legacy' | 'uigate' | 'parallel'
  children: ReactNode
}

const TAG_COLORS: Record<NonNullable<TagChipProps['kind']>, string> = {
  neutral: 'var(--fg-subtle)',
  critical: 'var(--severity-critical)',
  legacy: 'var(--status-blocked)',
  uigate: 'var(--status-active)',
  parallel: 'var(--status-emerged)',
}

export function TagChip({ kind = 'neutral', children }: TagChipProps) {
  const c = TAG_COLORS[kind]
  return (
    <span
      className="inline-flex h-[18px] items-center whitespace-nowrap rounded-[4px] px-1.5 font-mono text-[10px] font-medium"
      style={{
        color: c,
        background: 'transparent',
        border: `1px solid color-mix(in srgb, ${c} 45%, transparent)`,
      }}
    >
      {children}
    </span>
  )
}

interface GateStatusBadgeProps {
  status: 'pending' | 'met' | 'deferred'
}

export function GateStatusBadge({ status }: GateStatusBadgeProps) {
  const s = GATE_STATUS_TOKENS[status]
  return (
    <span
      className="inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full px-2 font-mono text-[11px] font-medium"
      style={{
        color: s.color,
        background: s.bg,
        border: `1px solid color-mix(in srgb, ${s.color} 30%, transparent)`,
      }}
    >
      <span className="text-[12px]">{s.glyph}</span>
      {status}
    </span>
  )
}
