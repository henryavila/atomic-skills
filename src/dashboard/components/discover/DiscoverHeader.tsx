import { useState } from 'react'
import type { DiscoverRun } from '../../lib/types'
import { BUCKETS, SOURCE_LAYERS } from './constants'

interface Props {
  run: DiscoverRun
  activeBuckets: Set<string>
  onToggleBucket: (bucket: string) => void
}

function BucketChip({
  bucketKey,
  count,
  active,
  onToggle,
}: {
  bucketKey: string
  count: number
  active: boolean
  onToggle: () => void
}) {
  const b = BUCKETS[bucketKey]
  if (!b) return null
  return (
    <button
      onClick={onToggle}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 26,
        padding: '0 11px',
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        fontWeight: 500,
        color: active ? b.color : 'var(--fg-subtle)',
        background: active ? `color-mix(in srgb, ${b.color} 12%, var(--bg-surface))` : 'var(--bg-surface)',
        border: `1px solid ${active ? `color-mix(in srgb, ${b.color} 40%, transparent)` : 'var(--border-default)'}`,
        borderRadius: 999,
        transition: 'background 120ms, border-color 120ms, color 120ms',
        opacity: active ? 1 : 0.7,
        whiteSpace: 'nowrap',
        flex: 'none',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: active ? 1 : 0.6 }}>{b.glyph}</span>
      <span>{b.label}</span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 600,
          padding: '0 5px',
          borderRadius: 3,
          minWidth: 16,
          textAlign: 'center',
          background: active ? `color-mix(in srgb, ${b.color} 22%, transparent)` : 'var(--bg-elevated)',
          color: active ? b.color : 'var(--fg-muted)',
        }}
      >
        {count}
      </span>
    </button>
  )
}

function SourcesScanned({
  sources,
  scanConfig,
  runId,
}: {
  sources: DiscoverRun['sourcesSummary']
  scanConfig: DiscoverRun['scanConfig']
  runId: string
}) {
  const [open, setOpen] = useState(false)
  const totalSignals = sources.reduce((a, s) => a + s.signalCount, 0)

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        boxShadow: 'var(--shadow-ambient)',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '10px 14px',
          boxSizing: 'border-box',
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', display: 'inline-block', width: 10 }}>
          {open ? '▾' : '▸'}
        </span>
        <span className="t-eyebrow" style={{ color: 'var(--fg-muted)' }}>
          SOURCES SCANNED
        </span>
        <span style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {sources.map((s) => {
            const L = SOURCE_LAYERS[s.layer] || { glyph: '·', color: 'var(--fg-muted)' }
            return (
              <span
                key={s.layer}
                title={`${s.layer} · ${s.signalCount} signal${s.signalCount !== 1 ? 's' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: L.color,
                }}
              >
                <span style={{ fontSize: 12 }}>{L.glyph}</span>
                <span style={{ color: 'var(--fg-muted)' }}>{s.signalCount}</span>
              </span>
            )
          })}
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fg-subtle)',
            whiteSpace: 'nowrap',
            flex: 'none',
          }}
        >
          {totalSignals} signal{totalSignals !== 1 ? 's' : ''} · {sources.length} layer{sources.length !== 1 ? 's' : ''}
        </span>
      </button>
      {open && (
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: '12px 14px',
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(sources.length, 5)}, 1fr)`,
            gap: 10,
          }}
        >
          {sources.map((s) => {
            const L = SOURCE_LAYERS[s.layer] || { glyph: '·', color: 'var(--fg-muted)' }
            return (
              <div
                key={s.layer}
                style={{
                  padding: '10px 12px',
                  background: 'var(--bg-sunken)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ color: L.color, fontFamily: 'var(--font-mono)', fontSize: 14 }}>{L.glyph}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--fg-default)',
                      textTransform: 'lowercase',
                    }}
                  >
                    {s.layer}
                  </span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: L.color, fontWeight: 600 }}>
                    {s.signalCount}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                  {s.label}
                </div>
              </div>
            )
          })}
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              paddingTop: 10,
              borderTop: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-subtle)',
              flexWrap: 'wrap',
            }}
          >
            <span>
              <span style={{ color: 'var(--fg-faint)' }}>run</span>{' '}
              <span style={{ color: 'var(--fg-default)' }}>{runId}</span>
            </span>
            <span style={{ width: 1, height: 10, background: 'var(--border-default)' }} />
            <span>
              <span style={{ color: 'var(--fg-faint)' }}>repo</span>{' '}
              <span style={{ color: 'var(--fg-default)' }}>{scanConfig.repoPath}</span>
            </span>
            <span style={{ width: 1, height: 10, background: 'var(--border-default)' }} />
            <span>
              <span style={{ color: 'var(--fg-faint)' }}>scope</span> [{scanConfig.scope.join(', ')}]
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function DiscoverHeader({ run, activeBuckets, onToggleBucket }: Props) {
  const ts = new Date(run.generatedAt)
  const tsLabel = `${ts.toISOString().slice(0, 10)} · ${ts.toISOString().slice(11, 16)}Z`
  const totalCandidates = Object.values(run.counts).reduce((a, b) => a + b, 0)
  const repoName = run.scanConfig.repoPath?.split('/').filter(Boolean).pop() ?? ''

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: 820 }}>
          <div
            className="t-eyebrow"
            style={{
              color: 'var(--status-emerged)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>⇥ PROPOSAL</span>
            <span style={{ color: 'var(--fg-faint)' }}>·</span>
            <span style={{ color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>aideck discover</span>
            <span style={{ color: 'var(--fg-faint)' }}>·</span>
            <span
              style={{
                color: 'var(--fg-subtle)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'none',
                letterSpacing: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {run.runId}
            </span>
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 30,
              fontWeight: 600,
              color: 'var(--fg-default)',
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            Discover
            {repoName && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 15,
                  fontWeight: 500,
                  color: 'var(--fg-subtle)',
                  marginLeft: 12,
                  letterSpacing: 0,
                  verticalAlign: 'middle',
                }}
              >
                {repoName}
              </span>
            )}
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              fontFamily: 'var(--font-sans)',
              fontSize: 13.5,
              color: 'var(--fg-muted)',
              lineHeight: 1.55,
              maxWidth: 760,
            }}
          >
            We scanned your repo for work-in-flight that isn't tracked yet — branches, PRs, issues, plans, memory entries.
            Approve the candidates that match, reject the noise, then commit.
          </p>
        </div>
      </div>

      {/* Metadata strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 0,
          marginTop: 16,
          padding: '8px 14px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          boxShadow: 'var(--shadow-ambient)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
        }}
      >
        {[
          ...(run.scanConfig.repoPath
            ? [
                {
                  label: 'repo',
                  value: (
                    <span style={{ color: 'var(--fg-default)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {run.scanConfig.repoPath}
                    </span>
                  ),
                },
              ]
            : []),
          {
            label: 'generated',
            value: (
              <span style={{ color: 'var(--fg-default)', whiteSpace: 'nowrap' }}>{tsLabel}</span>
            ),
          },
          {
            label: 'scope',
            value: (
              <span style={{ color: 'var(--fg-default)', whiteSpace: 'nowrap' }}>
                {run.sourcesSummary.length} layers
              </span>
            ),
          },
          {
            label: 'total',
            value: (
              <span style={{ color: 'var(--status-emerged)', whiteSpace: 'nowrap' }}>
                {totalCandidates} candidates
              </span>
            ),
          },
          {
            label: 'drafts to',
            value: (
              <span style={{ color: 'var(--fg-default)', whiteSpace: 'nowrap' }}>
                .atomic-skills/bootstrap-drafts/
              </span>
            ),
          },
        ].map((m, i, arr) => (
          <span key={m.label} style={{ display: 'contents' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '2px 14px',
                whiteSpace: 'nowrap',
                flex: 'none',
              }}
            >
              <span style={{ color: 'var(--fg-subtle)' }}>{m.label}</span>
              {m.value}
            </span>
            {i < arr.length - 1 && (
              <span style={{ width: 1, height: 12, background: 'var(--border-default)', flex: 'none' }} />
            )}
          </span>
        ))}
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <span className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginRight: 4 }}>
          FILTER
        </span>
        {(['strong', 'worth-reviewing', 'historical', 'already-tracked'] as const).map((k) => (
          <BucketChip
            key={k}
            bucketKey={k}
            count={
              k === 'strong'
                ? run.counts.strong
                : k === 'worth-reviewing'
                  ? run.counts.worthReviewing
                  : k === 'historical'
                    ? run.counts.historical
                    : run.counts.alreadyTracked
            }
            active={activeBuckets.has(k)}
            onToggle={() => onToggleBucket(k)}
          />
        ))}
        <div style={{ flex: 1 }} />
      </div>

      {/* Sources scanned */}
      <div style={{ marginTop: 12 }}>
        <SourcesScanned sources={run.sourcesSummary} scanConfig={run.scanConfig} runId={run.runId} />
      </div>
    </div>
  )
}
