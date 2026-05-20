import type { CSSProperties, ReactNode } from 'react'
import { STATUS_TOKENS } from './tokens'

interface Props {
  status: string
  children?: ReactNode
}

export function StatusChip({ status, children }: Props) {
  const s = STATUS_TOKENS[status] ?? STATUS_TOKENS.pending!
  const style: CSSProperties = {
    color: s.color,
    background: s.bg,
    border: `1px solid color-mix(in srgb, ${s.color} 30%, transparent)`,
  }
  return (
    <span
      className="inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full px-2 font-mono text-[11px] font-medium"
      style={style}
    >
      <span className="text-[12px]">{s.glyph}</span>
      {children ?? status}
    </span>
  )
}

export function StatusGlyph({ status, size = 14 }: { status: string; size?: number }) {
  const s = STATUS_TOKENS[status] ?? STATUS_TOKENS.pending!
  return (
    <span
      className="inline-flex justify-center font-mono leading-none"
      style={{ color: s.color, width: size + 4, fontSize: size }}
      aria-label={status}
    >
      {s.glyph}
    </span>
  )
}
