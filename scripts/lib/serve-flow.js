/**
 * Serve a generated flow.html over loopback HTTP.
 * Preview only — L1 flow.json stays the SoT. Never file://.
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, writeFileSync, renameSync, readdirSync, realpathSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { readFinalPlan, finalAuditsPassed, recordButtonValidation } from '../../src/plan-end-review.js';
import { readPresentedDecisions } from '../../src/decision-log.js';
import { basename, dirname, join, normalize, resolve, sep } from 'node:path';

/**
 * @param {string} htmlPath
 * @returns {string} absolute path
 */
export function assertPreviewBasename(htmlPath) {
  const abs = resolve(htmlPath);
  if (basename(abs).toLowerCase() !== 'flow.html') {
    const err = new Error(
      `Preview refuses ${basename(abs)}; L2 must be flow.html (map.html is abolished)`,
    );
    err.code = 'EINVAL';
    throw err;
  }
  return abs;
}

export function assertHtmlExists(htmlPath) {
  const abs = resolve(htmlPath);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    const err = new Error(`File not found: ${abs}`);
    err.code = 'ENOENT';
    throw err;
  }
  assertPreviewBasename(abs);
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

  const tokens = new Set();
  const server = createServer(async (req, res) => {
    if (opts.planPath && String(req.url).split('?')[0].startsWith('/api/')) {
      const origin = `http://${host}:${server.address().port}`;
      if (req.method !== 'POST') {res.writeHead(405);res.end('POST required');return;}
      if (req.headers.origin !== origin || req.headers.host !== new URL(origin).host) {res.writeHead(403);res.end('Invalid origin');return;}
      let body='';
      try {for await (const chunk of req) {body+=chunk;if(body.length>8192) throw new Error('request exceeds size cap');}}
      catch {res.writeHead(413);res.end('Too large');return;}
      const token=new URLSearchParams(body).get('token');
      if (!tokens.has(token) || !String(req.headers.cookie || '').split(';').some(c=>c.trim()===`final-page=${token}`)) {res.writeHead(403);res.end('Invalid button token');return;}
      try {
        const path=String(req.url).split('?')[0];
        if(path==='/api/validate') {
          if(!finalAuditsPassed(opts.planPath)) {res.writeHead(409);res.end('Waiting for phase delivery audits');return;}
          const at=recordButtonValidation(opts.planPath);tokens.delete(token);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({userValidatedAt:at}));return;
        }
        if(path==='/api/stop-confirm') {
          const runtimePath=join(dirname(opts.planPath),'automate-run-state.json');
          const state=JSON.parse(readFileSync(runtimePath,'utf8'));
          if(!state.pendingStop) {res.writeHead(409);res.end('No pending stop');return;}
          const stop=state.pendingStop;
          const logPath=join(dirname(opts.planPath),'decisions','operator-stops.jsonl');
          // The durable state and append-only confirmation log share the stop id;
          // resume trusts this server-written record, never a session timestamp.
          const row={id:stop.id,category:'routing',decision:'resume',why:stop.reason,evidencePath:'/final',impact:'resume from saved stage',at:new Date().toISOString(),said:stop.reason,saw:'Operator confirmed on the HTTP page'};
          const previous=existsSync(logPath)?readFileSync(logPath,'utf8'):'';
          const {mkdirSync}=await import('node:fs');mkdirSync(dirname(logPath),{recursive:true});
          if(!previous.split('\n').some(line=>{try{return JSON.parse(line).id===stop.id;}catch{return false;}})) writeFileSync(logPath,JSON.stringify(row)+'\n',{flag:'a'});
          state.confirmedStops=[...new Set([...(state.confirmedStops||[]),stop.id])];state.pendingStop=null;
          writeFileSync(runtimePath+'.tmp',JSON.stringify(state,null,2)+'\n');renameSync(runtimePath+'.tmp',runtimePath);
          tokens.delete(token);res.writeHead(200);res.end('Confirmed; resume the saved run');return;
        }
        res.writeHead(404);res.end('Not found');return;
      }catch(e){res.writeHead(409);res.end(e.message);return;}
    }
    if(opts.planPath && String(req.url).split('?')[0]==='/final') {
      try {
        const token=randomBytes(24).toString('hex');tokens.add(token);if(tokens.size>256) tokens.delete(tokens.values().next().value);
        const body=renderFinalPage(opts.planPath,token);
        res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','set-cookie':`final-page=${token}; HttpOnly; SameSite=Strict; Path=/`, 'content-security-policy':"default-src 'self'; style-src 'unsafe-inline'; frame-src 'self'; form-action 'self'; base-uri 'none'"});res.end(body);return;
      }catch(e){res.writeHead(409);res.end(e.message);return;}
    }
    const pathname = String(req.url || '/').split('?')[0];
    const target = pathname === '/' || pathname === '' ? abs : safeJoin(root, pathname);
    if (!target || !existsSync(target) || !statSync(target).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    // Never serve files through a symlink outside the preview directory.
    if (!realpathSync(target).startsWith(realpathSync(root) + sep)) {res.writeHead(404);res.end('Not found');return;}
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

function escapeHtml(value) {return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function readJson(path) {try{return JSON.parse(readFileSync(path,'utf8'));}catch{return null;}}
function renderFinalPage(planPath,token) {
  const {fm}=readFinalPlan(planPath);const dir=dirname(planPath);
  const architecture=readJson(join(dir,'architecture/decisions.json'));
  const ui=readJson(join(dir,'ui/ui.json'));
  const runtime=readJson(join(dir,'automate-run-state.json'));
  const decisionsDir=join(dir,'decisions');
  const decisions=existsSync(decisionsDir)?readdirSync(decisionsDir).filter(n=>n.endsWith('.jsonl')).flatMap(n=>readPresentedDecisions(readFileSync(join(decisionsDir,n),'utf8'))):[];
  const passed=finalAuditsPassed(planPath);
  const form=(action,label,enabled)=>`<form method="post" action="${action}"><input type="hidden" name="token" value="${token}"><button ${enabled?'':'disabled'}>${label}</button></form>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(fm.title||fm.slug)} — Delivery</title><style>body{font:16px system-ui;max-width:1100px;margin:3rem auto;padding:1rem;color:#18222b}section{margin:2rem 0}pre{white-space:pre-wrap}article{padding:1rem;border-bottom:1px solid #ddd}.views{display:grid;grid-template-columns:1fr 1fr;gap:1rem}iframe{width:100%;height:400px;border:1px solid #ccc}button{padding:1rem;font:inherit}button:not(:disabled){background:#165a38;color:white}@media(max-width:650px){.views{display:block}}</style><h1>${escapeHtml(fm.title||fm.slug)} delivery</h1><section><h2>Stamped architecture</h2><pre>${escapeHtml(JSON.stringify(architecture,null,2))}</pre></section><section><h2>Prototype and delivered work</h2><div class="views"><article><h3>Prototype</h3><pre>${escapeHtml(JSON.stringify(ui,null,2))}</pre><iframe title="Ratified flow preview" src="/flow.html" sandbox></iframe></article><article><h3>Delivered</h3><pre>${escapeHtml(JSON.stringify(fm.planEndReview?.intentVsDelivered||[],null,2))}</pre><pre>${escapeHtml(JSON.stringify(runtime?.pr||{},null,2))}</pre></article></div></section><section><h2>Said and saw</h2>${decisions.map(d=>`<article><p><strong>Said:</strong> ${escapeHtml(d.said)}</p><p><strong>Saw:</strong> ${escapeHtml(d.saw)}</p></article>`).join('')}</section><section><h2>Left outside</h2><p>${escapeHtml(fm.businessIntent?.outOfScope||fm.outOfScope||'')}</p><pre>${escapeHtml(JSON.stringify(runtime?.residualFindings||[],null,2))}</pre></section><section><h2>Phase delivery audits</h2><pre>${escapeHtml(JSON.stringify((fm.phases||[]).map(p=>({id:p.id,audit:p.deliveryAuditGate})),null,2))}</pre>${form('/api/validate','I validated the delivery',passed)}</section>${runtime?.pendingStop?`<section><h2>${escapeHtml(runtime.pendingStop.reason)}</h2><pre>${escapeHtml(JSON.stringify(runtime.pendingStop.findings,null,2))}</pre>${form('/api/stop-confirm','Confirm and resume',true)}</section>`:''}</html>`;
}
