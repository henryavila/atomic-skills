import { readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { Hono } from 'hono'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8'
}

export interface SpaDeps {
  /** Absolute path to a built SPA bundle (consumer-side, e.g.
   *  `atomic-skills/dist/dashboard`). */
  staticDir: string
}

export function createSpaRouter(deps: SpaDeps): Hono {
  const app = new Hono()
  const indexHtmlPath = join(deps.staticDir, 'index.html')

  app.get('*', async (c) => {
    const path = c.req.path
    if (path.startsWith('/api/') || path.startsWith('/sse')) {
      return c.json(
        { schemaVersion: '0.1', error: { code: 'path_not_found', message: `no route for ${path}` } },
        404
      )
    }

    // Try a static asset under the client dir; fall back to index.html for SPA routes.
    const asset = resolve(join(deps.staticDir, path === '/' ? 'index.html' : path))
    if (!asset.startsWith(resolve(deps.staticDir))) {
      // path traversal — refuse
      return c.text('not found', 404)
    }
    const tryAsset = path === '/' ? indexHtmlPath : asset
    try {
      const body = await readFile(tryAsset)
      const mime = MIME[extname(tryAsset)] ?? 'application/octet-stream'
      return new Response(body, { status: 200, headers: { 'content-type': mime } })
    } catch {
      try {
        const body = await readFile(indexHtmlPath)
        return new Response(body, { status: 200, headers: { 'content-type': MIME['.html'] } })
      } catch {
        return c.text(
          `static bundle missing index.html at ${indexHtmlPath} — check --static-dir`,
          404
        )
      }
    }
  })

  return app
}
