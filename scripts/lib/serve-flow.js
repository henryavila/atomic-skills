/**
 * Serve a generated flow.html over loopback HTTP.
 * Preview only — L1 flow.json stays the SoT. Never file://.
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, normalize, resolve, sep } from 'node:path';

/**
 * @param {string} htmlPath
 * @returns {string} absolute path
 */
export function assertHtmlExists(htmlPath) {
  const abs = resolve(htmlPath);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    const err = new Error(`File not found: ${abs}`);
    err.code = 'ENOENT';
    throw err;
  }
  return abs;
}

/**
 * @param {string} root
 * @param {string} urlPath
 * @returns {string|null}
 */
export function safeJoin(root, urlPath) {
  const raw = String(urlPath || '/').split('?')[0];
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const rel = decoded.replace(/^\/+/, '');
  const candidate = normalize(join(root, rel));
  const rootAbs = resolve(root);
  const rootPrefix = rootAbs.endsWith(sep) ? rootAbs : rootAbs + sep;
  if (candidate !== rootAbs && !candidate.startsWith(rootPrefix)) return null;
  return candidate;
}

/**
 * @param {string} htmlPath
 * @param {{ host?: string, port?: number }} [opts]
 * @returns {Promise<{ url: string, port: number, host: string, htmlPath: string, close: () => Promise<void> }>}
 */
export async function serveFlowHtml(htmlPath, opts = {}) {
  const host = opts.host ?? '127.0.0.1';
  const port = opts.port ?? 0;
  const abs = assertHtmlExists(htmlPath);
  const root = dirname(abs);
  const name = basename(abs);

  const server = createServer((req, res) => {
    const pathname = String(req.url || '/').split('?')[0];
    const target = pathname === '/' || pathname === '' ? abs : safeJoin(root, pathname);
    if (!target || !existsSync(target) || !statSync(target).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const body = readFileSync(target);
    const type = target.endsWith('.html')
      ? 'text/html; charset=utf-8'
      : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolveListen());
  });

  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : port;
  const url = `http://${host}:${actualPort}/${name}`;

  return {
    url,
    port: actualPort,
    host,
    htmlPath: abs,
    close: () =>
      new Promise((resolveClose, reject) => {
        server.close((err) => (err ? reject(err) : resolveClose()));
      }),
  };
}
