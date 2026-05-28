import type { MiddlewareHandler } from 'hono'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

function isAllowedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return LOCAL_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

export function corsMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header('origin')
    if (c.req.method === 'OPTIONS') {
      if (!origin || isAllowedOrigin(origin)) {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(origin)
        })
      }
      return c.json(
        {
          code: 'invalid_input',
          message: `Origin ${origin} not allowed`,
          suggestion: 'aiDeck only accepts requests from localhost / 127.0.0.1'
        },
        403,
        corsHeaders(origin, true)
      )
    }
    if (origin && !isAllowedOrigin(origin)) {
      return c.json(
        {
          code: 'invalid_input',
          message: `Origin ${origin} not allowed`,
          suggestion: 'aiDeck only accepts requests from localhost / 127.0.0.1'
        },
        403
      )
    }
    await next()
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      c.res.headers.set(k, v)
    }
  }
}

function corsHeaders(origin: string | undefined, denied = false): Record<string, string> {
  const out: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Last-Event-ID',
    'Access-Control-Max-Age': '600'
  }
  if (!denied && origin && isAllowedOrigin(origin)) {
    out['Access-Control-Allow-Origin'] = origin
    out['Vary'] = 'Origin'
  }
  return out
}
