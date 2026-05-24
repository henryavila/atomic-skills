interface Props {
  approveCount: number
  rejectCount: number
  totalPending: number
  submitted: boolean
  submitting: boolean
  error?: string
  onApproveAllStrong: () => void
  onSubmit: () => void
}

export function ActionBar({ approveCount, rejectCount, totalPending, submitted, submitting, error, onApproveAllStrong, onSubmit }: Props) {
  const totalDecided = approveCount + rejectCount

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 24px',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        zIndex: 100,
      }}
    >
      {submitted ? (
        <div style={{ flex: 1, fontSize: 13, color: 'var(--accent-emerald)' }}>
          ✓ {approveCount} approved, {rejectCount} rejected. Return to Claude and run <code className="font-mono">discover --commit</code>.
        </div>
      ) : (
        <>
          {error && (
            <div style={{ flex: 1, fontSize: 12, color: 'var(--severity-critical)' }}>
              Failed to submit: {error}
            </div>
          )}
          <div style={{ flex: error ? 0 : 1, fontSize: 12, color: 'var(--fg-muted)' }}>
            {totalDecided > 0
              ? `${approveCount} to approve, ${rejectCount} to reject, ${totalPending} pending`
              : `${totalPending} candidates pending`}
          </div>
          <button
            onClick={onApproveAllStrong}
            disabled={submitting}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--fg-default)',
              fontSize: 13,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Approve all strong
          </button>
          <button
            onClick={onSubmit}
            disabled={totalDecided === 0 || submitting}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: totalDecided > 0 ? 'var(--accent-emerald)' : 'var(--bg-inset)',
              color: totalDecided > 0 ? '#fff' : 'var(--fg-muted)',
              fontSize: 13,
              fontWeight: 600,
              cursor: totalDecided > 0 && !submitting ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Sending…' : `Submit ${totalDecided} decisions`}
          </button>
        </>
      )}
    </div>
  )
}
