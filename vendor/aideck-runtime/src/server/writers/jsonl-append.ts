/**
 * Atomic JSONL append with per-file serialization for safety beyond PIPE_BUF.
 *
 * POSIX guarantees atomic write(2) under PIPE_BUF (4096) with O_APPEND. For
 * larger payloads or concurrent writers within the same process, we serialize
 * via a per-path promise chain. Hard cap at MAX_LINE_BYTES to avoid silently
 * accepting payloads beyond the kernel atomicity ceiling on other filesystems.
 */
import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const MAX_LINE_BYTES = 64 * 1024

export class JsonlLineTooLargeError extends Error {
  constructor(public readonly bytes: number) {
    super(`appendJsonlLine: serialized line is ${bytes} bytes; max ${MAX_LINE_BYTES}`)
    this.name = 'JsonlLineTooLargeError'
  }
}

const writeChain = new Map<string, Promise<void>>()

export async function appendJsonlLine(path: string, payload: object): Promise<void> {
  const serialized = JSON.stringify(payload)
  if (serialized === undefined) {
    throw new TypeError('appendJsonlLine: payload is not JSON-serializable')
  }
  const bytes = Buffer.byteLength(serialized, 'utf8') + 1
  if (bytes > MAX_LINE_BYTES) {
    throw new JsonlLineTooLargeError(bytes)
  }

  const prev = writeChain.get(path) ?? Promise.resolve()
  const next = prev.then(async () => {
    await mkdir(dirname(path), { recursive: true })
    await appendFile(path, `${serialized}\n`, { flag: 'a' })
  })
  // Mark this write as in-flight; clear when complete (success or failure).
  writeChain.set(path, next.catch(() => {}))
  return next
}
