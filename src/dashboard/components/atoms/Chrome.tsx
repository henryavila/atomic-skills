import type { CSSProperties, ReactNode } from 'react'

/**
 * Brand wordmark with a small animated accent dot. Used in the top chrome.
 * Size is the type size in px; the dot scales proportionally.
 */
export function Wordmark({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-medium tracking-tight text-fg-default"
      style={{ fontSize: size, letterSpacing: '-0.025em' }}
    >
      atomic-skills
      <span
        className="relative inline-block flex-none"
        style={{
          width: size * 0.38,
          height: size * 0.38,
          background: 'var(--status-active)',
          boxShadow: '0 0 12px color-mix(in srgb, var(--status-active) 70%, transparent)',
        }}
      />
    </span>
  )
}

/**
 * Pill rendering the `127.0.0.1:7777` indicator. Reinforces brand principle
 * #2 — "Localhost-only, zero telemetry". Includes a pulsing green dot so
 * the user can tell the dashboard is live-connected.
 */
export function LocalhostPill({ port = 7777 }: { port?: number }) {
  const style: CSSProperties = {
    color: 'var(--status-done)',
    border: '1px solid color-mix(in srgb, var(--status-done) 30%, transparent)',
    background: 'color-mix(in srgb, var(--status-done) 6%, transparent)',
  }
  return (
    <span
      className="inline-flex h-6 items-center gap-2 rounded px-2 font-mono text-[11px] font-medium"
      style={style}
    >
      <span className="relative h-[7px] w-[7px] flex-none">
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'var(--status-done)',
            boxShadow: '0 0 8px color-mix(in srgb, var(--status-done) 70%, transparent)',
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            inset: -3,
            background: 'color-mix(in srgb, var(--status-done) 40%, transparent)',
            animation: 'atomic-pulse 2.4s ease-out infinite',
          }}
        />
      </span>
      127.0.0.1:{port}
    </span>
  )
}

/**
 * Card surface used for grouping content. Subtle border + elevated bg.
 * Pass `as` to render a different element (defaults to `<div>`).
 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-[10px] border border-border-default bg-bg-surface ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * Eyebrow + count + optional action — used on section banners inside cards.
 */
export function SectionHeader({
  children,
  count,
  action,
}: {
  children: ReactNode
  count?: number
  action?: ReactNode
}) {
  return (
    <div
      className="flex items-center gap-2.5 border-b border-border-subtle px-4 py-2.5"
      style={{ background: 'color-mix(in srgb, var(--bg-elevated) 60%, transparent)' }}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-fg-muted">
        {children}
      </span>
      {count != null && (
        <span className="inline-flex items-center rounded-full border border-border-subtle bg-bg-canvas px-1.5 py-px font-mono text-[11px] text-fg-subtle">
          {count}
        </span>
      )}
      <div className="flex-1" />
      {action}
    </div>
  )
}

/**
 * Keyboard-shortcut hint, e.g. `<Kbd>⌘K</Kbd>`.
 */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[3px] border border-border-default bg-bg-elevated px-1 py-[1px] font-mono text-[10px] font-medium text-fg-muted">
      {children}
    </span>
  )
}
