import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'tertiary' | 'destructive'
type Size = 'sm' | 'md'

interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: Variant
  size?: Size
  children: ReactNode
  style?: CSSProperties
}

export function Btn({ variant = 'secondary', size = 'md', children, style, ...rest }: BtnProps) {
  const h = size === 'sm' ? 24 : 32
  const fs = size === 'sm' ? 12 : 13
  const base: CSSProperties = {
    height: h,
    padding: size === 'sm' ? '0 10px' : '0 14px',
    fontFamily: 'var(--font-sans)',
    fontSize: fs,
    fontWeight: 500,
    borderRadius: 6,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background 120ms, border-color 120ms',
    whiteSpace: 'nowrap',
    flex: 'none',
  }
  const variants: Record<Variant, CSSProperties> = {
    primary: {
      background:
        'linear-gradient(180deg, color-mix(in srgb, var(--status-active) 100%, white 5%), var(--status-active))',
      color: 'var(--fg-on-accent)',
      border: 'none',
      fontWeight: 600,
      boxShadow:
        '0 1px 0 rgba(255,255,255,0.15) inset, 0 1px 2px rgba(0,0,0,0.3), 0 0 0 1px color-mix(in srgb, var(--status-active) 60%, transparent)',
    },
    secondary: {
      background: 'var(--bg-elevated)',
      color: 'var(--fg-default)',
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-ambient)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--fg-muted)',
      border: '1px solid var(--border-subtle)',
    },
    tertiary: {
      background: 'transparent',
      color: 'var(--fg-muted)',
      border: 'none',
    },
    destructive: {
      background: 'transparent',
      color: 'var(--severity-critical)',
      border: '1px solid color-mix(in srgb, var(--severity-critical) 40%, transparent)',
    },
  }
  return (
    <button {...rest} style={{ ...base, ...variants[variant], ...(style ?? {}) }}>
      {children}
    </button>
  )
}

interface IconBtnProps {
  children: ReactNode
  label: string
  onClick?: () => void
  badge?: number | null
  badgeColor?: string
  title?: string
}

export function IconBtn({ children, label, onClick, badge, badgeColor, title }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      style={{
        all: 'unset',
        cursor: 'pointer',
        height: 26,
        minWidth: 26,
        padding: badge != null ? '0 8px' : 0,
        background: 'var(--bg-elevated)',
        color: 'var(--fg-muted)',
        border: '1px solid var(--border-default)',
        borderRadius: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: 'center',
      }}
    >
      {children}
      {badge != null && badge > 0 && (
        <span style={{ color: badgeColor ?? 'var(--status-highlighted)' }}>{badge}</span>
      )}
    </button>
  )
}
