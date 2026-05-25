interface Props {
  approveCount: number
  rejectCount: number
  strongCount: number
  totalShown: number
  submitted: boolean
  submitting: boolean
  error?: string
  disableApproveAll: boolean
  onApproveAllStrong: () => void
  onSubmit: () => void
}

export function ActionBar({
  approveCount,
  rejectCount,
  strongCount,
  totalShown,
  submitted,
  submitting,
  error,
  disableApproveAll,
  onApproveAllStrong,
  onSubmit,
}: Props) {
  const totalDecided = approveCount + rejectCount

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 5,
        marginTop: 28,
        marginLeft: -24,
        marginRight: -24,
        marginBottom: -80,
        padding: '12px 24px',
        background: 'color-mix(in srgb, var(--bg-canvas) 92%, transparent)',
        borderTop: '1px solid var(--border-default)',
        boxShadow: '0 -8px 24px -12px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {submitted ? (
        <div style={{ flex: 1, fontSize: 13, color: 'var(--status-done)' }}>
          ✓ {approveCount} approved, {rejectCount} rejected. Return to Claude and run{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>discover --commit</code>.
        </div>
      ) : (
        <>
          {error && (
            <div style={{ fontSize: 12, color: 'var(--severity-critical)' }}>Failed to submit: {error}</div>
          )}
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-subtle)',
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            <span style={{ color: 'var(--fg-default)' }}>{totalShown}</span> shown ·{' '}
            <span style={{ color: 'var(--status-done)' }}>{approveCount}</span> approved ·{' '}
            <span style={{ color: 'var(--status-done)' }}>{strongCount}</span> strong
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onApproveAllStrong}
            disabled={disableApproveAll || submitting}
            style={{
              all: 'unset',
              cursor: disableApproveAll || submitting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 14px',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--fg-default)',
              background: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              opacity: disableApproveAll ? 0.5 : 1,
            }}
          >
            <span style={{ color: 'var(--status-done)', fontFamily: 'var(--font-mono)' }}>✓✓</span>
            Approve all strong
          </button>
          <button
            onClick={onSubmit}
            disabled={totalDecided === 0 || submitting}
            style={{
              all: 'unset',
              cursor: totalDecided === 0 || submitting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              height: 32,
              padding: '0 16px',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              color: totalDecided === 0 ? 'var(--fg-faint)' : 'var(--fg-on-accent)',
              background:
                totalDecided === 0
                  ? 'var(--bg-elevated)'
                  : 'linear-gradient(180deg, color-mix(in srgb, var(--status-done) 100%, white 6%), var(--status-done))',
              border: totalDecided === 0 ? '1px solid var(--border-default)' : 'none',
              boxShadow:
                totalDecided === 0
                  ? 'none'
                  : '0 1px 0 rgba(255,255,255,0.18) inset, 0 1px 2px rgba(0,0,0,0.35), 0 0 0 1px color-mix(in srgb, var(--status-done) 60%, transparent), 0 0 24px -8px color-mix(in srgb, var(--status-done) 70%, transparent)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>▶</span>
            {submitting ? 'Sending…' : `Commit ${totalDecided} approved`}
          </button>
        </>
      )}
    </div>
  )
}
