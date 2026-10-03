/**
 * Serve a generated flow.html over loopback HTTP.
 * Preview only — L1 flow.json stays the SoT. Never file://.
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync, renameSync, readdirSync, realpathSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';
import { readFinalPlan, finalAuditsPassed, validationKeyPath, validationSnapshot, productSnapshot } from '../../src/plan-end-review.js';
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

  const tokens = new Map();
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
        if(tokens.get(token)!==validationSnapshot(opts.planPath)) {res.writeHead(409);res.end('Presentation changed; refresh the final page');return;}
        if(path==='/api/validate') {
          if(!finalAuditsPassed(opts.planPath)) {res.writeHead(409);res.end('Waiting for phase delivery audits');return;}
          const at=recordButtonValidation(opts.planPath,tokens.get(token));tokens.delete(token);res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(`<main><h1>Delivery validated</h1><p>Recorded ${at}. The pull request remains open. You can now continue to finalize.</p><a href="/final">Return to delivery</a></main>`);return;
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
    if(opts.planPath && String(req.url).split('?')[0].startsWith('/final-assets/')) {
      const dir=dirname(opts.planPath);const target=safeJoin(dir,String(req.url).slice('/final-assets'.length));
      const ui=readJson(join(dir,'ui/ui.json'));const {fm}=readFinalPlan(opts.planPath);
      const allowed=[...(ui?.screens||[]).map(screen=>screen.path),...(fm.references||[]).filter(ref=>ref.kind==='file' && /\.html$/i.test(ref.path) && /delivered|built|entreg|constru/i.test(ref.label||'')).map(ref=>ref.path)].filter(Boolean).map(path=>resolve(dir,path));
      if(!target || !allowed.includes(target) || !existsSync(target) || !realpathSync(target).startsWith(realpathSync(dir)+sep)) {res.writeHead(404);res.end('Not found');return;}
      res.writeHead(200,{'content-type':target.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream','cache-control':'no-store'});res.end(readFileSync(target));return;
    }
    if(opts.planPath && String(req.url).split('?')[0]==='/final') {
      try {
        const token=randomBytes(24).toString('hex');tokens.set(token,validationSnapshot(opts.planPath));if(tokens.size>256) tokens.delete(tokens.keys().next().value);
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
  const asset=path=>'/final-assets/'+String(path).split('/').map(encodeURIComponent).join('/');
  const frame=(path,title)=>`<iframe title="${escapeHtml(title)}" src="${escapeHtml(asset(path))}" sandbox="allow-scripts"></iframe>`;
  const chosen=architecture?.sketches?.find(sketch=>sketch.id===architecture.chosen);
  const outside=[...(chosen?.outside||[]),fm.businessIntent?.outOfScope||fm.outOfScope||''].filter(Boolean);
  const screens=ui?.screens||[];
  const rows=fm.planEndReview?.intentVsDelivered||[];
  const deliveredRefs=(fm.references||[]).filter(ref=>/delivered|built|entreg|constru/i.test(ref.label||''));
  const deliveredFile=deliveredRefs.find(ref=>ref.kind==='file' && /\.html$/i.test(ref.path));
  const delivered=deliveredFile?frame(deliveredFile.path,deliveredFile.label): '<p>Delivered evidence appears below. No local delivered screen is recorded.</p>';
  const deliveredUrl=deliveredRefs.find(ref=>ref.kind==='url')?.path;
  const urlLink=typeof deliveredUrl==='string' && /^https?:\/\//.test(deliveredUrl)?`<a href="${escapeHtml(deliveredUrl)}">Open delivered application</a>`:'';
  const product=productSnapshot(planPath);
  const pr=runtime?.pr;
  const prLink=pr&&/^https?:\/\//.test(pr.url||'')?`<p><a href="${escapeHtml(pr.url)}">Review pull request</a> · ${escapeHtml(pr.state)}</p>`:'';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(fm.title||fm.slug)} — Delivery</title><style>body{font:16px system-ui;max-width:1100px;margin:3rem auto;padding:1rem;color:#18222b}section{margin:2rem 0}pre{white-space:pre-wrap}article{padding:1rem;border-bottom:1px solid #ddd}.views{display:grid;grid-template-columns:1fr 1fr;gap:1rem}iframe{width:100%;height:400px;border:1px solid #ccc}button{padding:1rem;font:inherit}button:not(:disabled){background:#165a38;color:white}td,th{text-align:left;padding:.6rem;border-bottom:1px solid #ddd}@media(max-width:650px){.views{display:block}}</style><main><h1>${escapeHtml(fm.title||fm.slug)} delivery</h1>${prLink}${product?`<p>Delivered source: <code>${escapeHtml(product.digest.slice(0,16))}</code></p>`:''}<section><h2>Stamped architecture</h2>${architecture?`<p>Chosen: <strong>${escapeHtml(architecture.chosen)}</strong></p><p>${escapeHtml(chosen?.mix||chosen?.mixLine||chosen?.mistura||'')}</p><p>Ratified: ${escapeHtml(architecture.ratifiedAt||'not recorded')}</p>`:'<p>No architecture card recorded here.</p>'}</section><section><h2>Prototype and delivered work</h2><div class="views"><article><h3>Prototype</h3>${screens.length?screens.map(screen=>frame(screen.path,screen.title||screen.path)).join(''):`<p>${escapeHtml(ui?.none?ui.reason||'No screen applies to this plan.':'No prototype screen is recorded.')}</p>`}</article><article><h3>Delivered</h3>${delivered}${urlLink}<table><thead><tr><th>Intent</th><th>Delivery</th><th>Evidence</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escapeHtml(row.label||row.id||row.intentId)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.note||row.deliveredId||'')}</td></tr>`).join('')}</tbody></table></article></div></section><section><h2>Said and saw</h2>${decisions.map(d=>`<article><p><strong>Said:</strong> ${escapeHtml(d.said)}</p><p><strong>Saw:</strong> ${escapeHtml(d.saw)}</p></article>`).join('')||'<p>No presented decisions yet.</p>'}</section><section><h2>Left outside</h2><ul>${outside.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>${(runtime?.phaseResiduals||[]).map(row=>`<details><summary>${escapeHtml(row.phaseId||'Phase')} retained findings</summary><pre>${escapeHtml(row.report||JSON.stringify(row.findings||row.remainingFindings||[],null,2))}</pre></details>`).join('')}${(runtime?.residualFindings||[]).map(f=>`<article><strong>${escapeHtml(f.severity||'Residual')}</strong>: ${escapeHtml(f.title||f.summary)}<p>${escapeHtml(f.body||f.note||'')}</p></article>`).join('')}</section><section><h2>Phase delivery audits</h2><ul>${(fm.phases||[]).map(p=>`<li>${escapeHtml(p.id)}: ${escapeHtml(p.deliveryAuditGate?.status||'waiting')}</li>`).join('')}</ul><p>${passed?'Review the prototype, delivery evidence, and remaining findings, then validate below.':'Waiting for every phase delivery audit to pass. Refresh this page after the audits complete.'}</p>${form('/api/validate','I validated the delivery',passed)}</section>${runtime?.pendingStop?`<section><h2>${escapeHtml(runtime.pendingStop.reason)}</h2><pre>${escapeHtml(JSON.stringify(runtime.pendingStop.findings,null,2))}</pre>${form('/api/stop-confirm','Confirm and resume',true)}</section>`:''}<section><h2>Ratified flow</h2><iframe title="Ratified flow preview" src="/flow.html" sandbox="allow-scripts"></iframe></section></main></html>`;
}

/** Called exclusively by the authenticated HTTP button route. */
function recordButtonValidation(planPath, expectedSnapshot) {
  if (!finalAuditsPassed(planPath)) throw new Error('phase delivery audits are not passed');
  if(expectedSnapshot && expectedSnapshot!==validationSnapshot(planPath)) throw new Error('Presentation changed; refresh the final page');
  validationSnapshot(planPath); // Fail before writing the timestamp if evidence is unavailable.
  const keyPath = validationKeyPath(planPath);
  mkdirSync(dirname(keyPath), {recursive:true, mode:0o700});
  if (!existsSync(keyPath)) {try {writeFileSync(keyPath, randomBytes(32), {flag:'wx',mode:0o600});} catch(e) {if(e.code !== 'EEXIST') throw e;}}
  const {text} = readFinalPlan(planPath);
  const at = new Date().toISOString();
  const without = text.replace(/^userValidatedAt:.*\r?\n/gm, '');
  const updated = without.replace(/^---\r?\n/, `---\nuserValidatedAt: "${at}"\n`);
  const temp = `${planPath}.button-${process.pid}`;
  writeFileSync(temp, updated); renameSync(temp, planPath);
  const proof = {at, planPath: realpathSync(planPath), snapshot: validationSnapshot(planPath), source:'http-button'};
  const signature = createHmac('sha256',readFileSync(keyPath)).update(JSON.stringify(proof)).digest('hex');
  const receiptPath = join(dirname(planPath), 'final-validation.json');
  writeFileSync(`${receiptPath}.tmp`, JSON.stringify({proof, signature})+'\n');
  renameSync(`${receiptPath}.tmp`, receiptPath);
  return at;
}
