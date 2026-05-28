import { createServer } from 'node:net'

export class PortInUseError extends Error {
  constructor(public readonly ports: number[]) {
    const detail = ports.length === 1 ? `port ${ports[0]}` : `ports ${ports[0]}..${ports[ports.length - 1]}`
    super(`${detail} in use`)
    this.name = 'PortInUseError'
  }
}

const DEFAULT_RANGE = Array.from({ length: 11 }, (_, i) => 7777 + i)

export interface ResolvePortOptions {
  requested?: number
  isExplicit?: boolean
  range?: number[]
  hostname?: string
}

export async function isPortFree(port: number, hostname = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => {
      probe.close(() => resolve(false))
    })
    probe.once('listening', () => {
      probe.close(() => resolve(true))
    })
    probe.listen(port, hostname)
  })
}

export async function resolvePort(opts: ResolvePortOptions = {}): Promise<number> {
  const hostname = opts.hostname ?? '127.0.0.1'
  if (opts.isExplicit && opts.requested !== undefined) {
    if (await isPortFree(opts.requested, hostname)) return opts.requested
    throw new PortInUseError([opts.requested])
  }
  const range = opts.range ?? DEFAULT_RANGE
  for (const port of range) {
    if (await isPortFree(port, hostname)) return port
  }
  throw new PortInUseError(range)
}
