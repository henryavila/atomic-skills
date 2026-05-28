import { readFile } from 'node:fs/promises'
import type { ErrorResponse } from '../../schemas/common.js'
import {
  type Result,
  err,
  parseAcknowledgement,
  parseAnnotation,
  parseDecision,
  parseHighlight,
  parseIntentApplication,
  parseIntentRecord,
  parseResolution,
  parseVerifierResult
} from '../../schemas/validators/index.js'

export interface JsonlParseResult<T> {
  items: T[]
  errors: Array<{ line: number; error: ErrorResponse }>
}

export type LineValidator<T> = (raw: unknown) => Result<T, ErrorResponse>

export async function parseJsonlFile<T>(
  path: string,
  validate: LineValidator<T>,
  logSink: (msg: string) => void = (msg) => process.stderr.write(`${msg}\n`)
): Promise<JsonlParseResult<T>> {
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (cause) {
    const error = {
      code: 'io_error' as const,
      message: `failed to read file: ${path}`,
      details: { cause: String(cause) }
    }
    logSink(`[aideck] line:0 path:${path} ${error.message}`)
    return { items: [], errors: [{ line: 0, error }] }
  }
  return parseJsonlString(raw, validate, path, logSink)
}

export function parseJsonlString<T>(
  raw: string,
  validate: LineValidator<T>,
  pathHint = '<inline>',
  logSink: (msg: string) => void = (msg) => process.stderr.write(`${msg}\n`)
): JsonlParseResult<T> {
  const items: T[] = []
  const errors: JsonlParseResult<T>['errors'] = []

  const lines = raw.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') continue

    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch (cause) {
      const e: ErrorResponse = {
        code: 'invalid_input',
        message: `JSON parse error at line ${i + 1}: ${cause instanceof Error ? cause.message : String(cause)}`,
        suggestion: 'Each JSONL line must be valid JSON terminated by a newline'
      }
      logSink(`[aideck] line:${i + 1} path:${pathHint} ${e.message}`)
      errors.push({ line: i + 1, error: e })
      continue
    }

    const res = validate(parsed)
    if (!res.ok) {
      logSink(`[aideck] line:${i + 1} path:${pathHint} ${res.error.message}`)
      errors.push({ line: i + 1, error: res.error })
      continue
    }
    items.push(res.value)
  }

  return { items, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inbox heterogeneous parser — discriminates by `kind`.
// ─────────────────────────────────────────────────────────────────────────────

export type InboxLine =
  | { kind: 'annotation'; value: ReturnType<typeof parseAnnotation> extends Result<infer T, unknown> ? T : never }
  | { kind: 'highlight'; value: ReturnType<typeof parseHighlight> extends Result<infer T, unknown> ? T : never }
  | { kind: 'decision'; value: ReturnType<typeof parseDecision> extends Result<infer T, unknown> ? T : never }
  | { kind: 'resolution'; value: ReturnType<typeof parseResolution> extends Result<infer T, unknown> ? T : never }
  | { kind: 'acknowledgement'; value: ReturnType<typeof parseAcknowledgement> extends Result<infer T, unknown> ? T : never }
  | { kind: 'intent'; value: ReturnType<typeof parseIntentRecord> extends Result<infer T, unknown> ? T : never }
  | { kind: 'intent_application'; value: ReturnType<typeof parseIntentApplication> extends Result<infer T, unknown> ? T : never }
  | { kind: 'verifier_result'; value: ReturnType<typeof parseVerifierResult> extends Result<infer T, unknown> ? T : never }

type InboxKind = InboxLine['kind']

const INBOX_KINDS: readonly InboxKind[] = [
  'annotation',
  'highlight',
  'decision',
  'resolution',
  'acknowledgement',
  'intent',
  'intent_application',
  'verifier_result'
]

function isInboxKind(v: unknown): v is InboxKind {
  return typeof v === 'string' && (INBOX_KINDS as readonly string[]).includes(v)
}

export function parseInboxLine(raw: unknown): Result<InboxLine, ErrorResponse> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return err({
      code: 'invalid_input',
      message: 'inbox line must be a JSON object',
      suggestion: 'Each inbox line is a JSON object with a `kind` discriminator'
    })
  }
  const kindRaw = (raw as { kind?: unknown }).kind
  if (!isInboxKind(kindRaw)) {
    let repr: string
    try {
      repr = JSON.stringify(kindRaw) ?? String(kindRaw)
    } catch {
      repr = `<${typeof kindRaw}>`
    }
    return err({
      code: 'invalid_input',
      message: `inbox line missing or invalid \`kind\` (got ${repr})`,
      suggestion: `kind must be one of: ${INBOX_KINDS.join(', ')}`
    })
  }
  const kind: InboxKind = kindRaw

  // annotation/highlight/decision records don't have a `kind` discriminator
  // field in their canonical shape — strip it before delegating to the strict validator.
  const withoutKind = (() => {
    const obj = raw as Record<string, unknown>
    const { kind: _k, ...rest } = obj
    return rest
  })()

  switch (kind) {
    case 'annotation': {
      const r = parseAnnotation(withoutKind)
      return r.ok ? { ok: true, value: { kind, value: r.value } } : r
    }
    case 'highlight': {
      const r = parseHighlight(withoutKind)
      return r.ok ? { ok: true, value: { kind, value: r.value } } : r
    }
    case 'decision': {
      const r = parseDecision(withoutKind)
      return r.ok ? { ok: true, value: { kind, value: r.value } } : r
    }
    case 'resolution': {
      const r = parseResolution(raw)
      return r.ok ? { ok: true, value: { kind, value: r.value } } : r
    }
    case 'acknowledgement': {
      const r = parseAcknowledgement(raw)
      return r.ok ? { ok: true, value: { kind, value: r.value } } : r
    }
    case 'intent': {
      const r = parseIntentRecord(raw)
      return r.ok ? { ok: true, value: { kind, value: r.value } } : r
    }
    case 'intent_application': {
      const r = parseIntentApplication(raw)
      return r.ok ? { ok: true, value: { kind, value: r.value } } : r
    }
    case 'verifier_result': {
      const r = parseVerifierResult(raw)
      return r.ok ? { ok: true, value: { kind, value: r.value } } : r
    }
  }
}
