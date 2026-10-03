import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { serveFlowHtml } from '../scripts/lib/serve-flow.js';
import * as gate from '../src/plan-end-review.js';

const signingHome=mkdtempSync(join(tmpdir(),'final-signing-home-'));
const previousSigningHome=process.env.HOME, previousSigningProfile=process.env.USERPROFILE;
process.env.HOME=signingHome;process.env.USERPROFILE=signingHome;
after(()=>{if(previousSigningHome===undefined) delete process.env.HOME;else process.env.HOME=previousSigningHome;if(previousSigningProfile===undefined) delete process.env.USERPROFILE;else process.env.USERPROFILE=previousSigningProfile;rmSync(signingHome,{recursive:true,force:true});});

function fixture() {
 const root=mkdtempSync(join(tmpdir(),'final-http-')); mkdirSync(join(root,'flow'));
 writeFileSync(join(root,'flow/flow.html'),'<html>flow preview</html>');
 const planDir=join(root,'projects/test/fixture');mkdirSync(planDir,{recursive:true});const plan=join(planDir,'plan.md');
 const write=(passed=true,at='')=>writeFileSync(plan,`---\nslug: fixture\nexecutionMode: automate\n${at?`userValidatedAt: ${JSON.stringify(at)}\n`:''}phases:\n  - id: F0\n    deliveryAuditGate:\n      status: ${passed?'passed':'pending'}\n      verdict: CLOSED\n      reportPath: audit.md\nplanEndReview:\n  mode: external-both\n  reviewFile: audit.md\n  verifiedAt: '2026-10-02T12:00:00Z'\n  legs:\n    - provider: grok\n      status: succeeded\n      familyDifferent: true\n  intentVsDelivered:\n    - status: matched\n---\n# Delivered application\n`);
 writeFileSync(join(planDir,'audit.md'),'Actual delivered evidence\n'); write();
 bindReview(plan);
 return {root,plan,write,html:join(root,'flow/flow.html')};
}
function bindReview(plan) {
 const text = readFileSync(plan, 'utf8').replace(/^  reviewInputSnapshot:.*\n/gm, '');
 writeFileSync(plan, text);
 const snapshot = gate.validationSnapshot(plan, {reviewInputs:true});
 writeFileSync(plan, text.replace('planEndReview:\n', `planEndReview:\n  reviewInputSnapshot: ${snapshot}\n`));
}
async function page(server) {const origin=new URL(server.url).origin;const res=await fetch(`${origin}/final`);return {origin,text:await res.text(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
async function click(p,path='/api/validate',token=p.text.match(/name="token" value="([^"]+)"/)?.[1]) {return fetch(p.origin+path,{method:'POST',headers:{origin:p.origin,cookie:p.cookie||'','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:token||''})});}
for (const failure of ['missing-screen','malformed-ui','missing-passed-audit']) {
 test(`pending stop remains confirmable with ${failure} evidence`, async () => {
  const f=fixture();const dir=join(f.root,'projects/test/fixture');
  const runtimePath=join(dir,'automate-run-state.json');
  const state={schemaVersion:1,stage:'plan',round:1,pendingStop:{id:'saved-stop',reason:'não avanço',stage:'plan',findings:[{title:'Evidence unavailable'}]}};
  writeFileSync(runtimePath,JSON.stringify(state));
  if(failure==='missing-passed-audit') rmSync(join(dir,'audit.md'));
  else {mkdirSync(join(dir,'ui'));writeFileSync(join(dir,'ui/ui.json'),failure==='malformed-ui'?'{bad':JSON.stringify({screens:[{path:'ui/missing.html'}]}));}
  const server=await serveFlowHtml(f.html,{planPath:f.plan});
  try {
   const response=await fetch(new URL('/final?stop=saved-stop',server.url));
   const p={origin:new URL(server.url).origin,text:await response.text(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
   assert.equal(response.status,200,p.text);
   assert.match(p.text,/Evidence unavailable/);assert.match(p.text,/Confirm and resume/);
   assert.match(p.text,/<button[^>]*disabled[^>]*>I validated the delivery/);
   assert.equal((await click(p)).status,409);
   assert.equal((await click(p,'/api/stop-confirm','forged')).status,403);
   assert.equal((await click({...p,cookie:''},'/api/stop-confirm')).status,403);
   assert.equal((await fetch(p.origin+'/api/stop-confirm',{method:'POST',headers:{origin:'https://foreign.test',cookie:p.cookie},body:new URLSearchParams({token:p.text.match(/name="token" value="([^"]+)"/)[1]})})).status,403);
   assert.equal((await click(p,'/api/stop-confirm')).status,200);
   const saved=JSON.parse(readFileSync(runtimePath,'utf8'));
   assert.equal(saved.pendingStop,null);assert.deepEqual(saved.confirmedStops,['saved-stop']);
   assert.match(readFileSync(join(dir,'decisions/operator-stops.jsonl'),'utf8'),/saved-stop/);
   assert.doesNotMatch(readFileSync(f.plan,'utf8'),/userValidatedAt/);
   assert.equal(gate.readUserValidationEvidence(f.plan),null);
   assert.equal((await click(p,'/api/stop-confirm')).status,403);
  } finally {await server.close();rmSync(f.root,{recursive:true,force:true});}
 });
}
for (const mutation of ['stop-id','stop-findings','runtime-stage','runtime-replacement']) {
 test(`stop-only token rejects changed ${mutation}`,async()=>{
  const f=fixture();const dir=join(f.root,'projects/test/fixture');const path=join(dir,'automate-run-state.json');
  const state={schemaVersion:1,stage:'plan',round:1,pendingStop:{id:'saved-stop',reason:'não avanço',stage:'plan',findings:[{title:'Original evidence'}]}};
  writeFileSync(path,JSON.stringify(state));rmSync(join(dir,'audit.md'));
  const s=await serveFlowHtml(f.html,{planPath:f.plan});
  try {
   const p=await page(s);
   if(mutation==='stop-id') state.pendingStop.id='replacement-stop';
   if(mutation==='stop-findings') state.pendingStop.findings=[{title:'Changed evidence'}];
   if(mutation==='runtime-stage') state.stage='audit';
   if(mutation==='runtime-replacement') {const {renameSync}=await import('node:fs');writeFileSync(path+'.replacement',JSON.stringify(state));renameSync(path+'.replacement',path);}
   else writeFileSync(path,JSON.stringify(state));
   assert.equal((await click(p,'/api/stop-confirm')).status,409);
   assert.deepEqual(JSON.parse(readFileSync(path,'utf8')),state);
   assert.equal((await click(await page(s),'/api/stop-confirm')).status,200);
  } finally {await s.close();rmSync(f.root,{recursive:true,force:true});}
 });
}
test('real initialized submodule source edits invalidate HTTP validation and remain controllably stopped',async()=>{
 const f=fixture();const source=mkdtempSync(join(tmpdir(),'final-http-submodule-'));
 const git=(cwd,args)=>{const r=spawnSync('git',['-c','user.name=fixture','-c','user.email=fixture@test',...args],{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
 let server;
 try {
  git(source,['init']);writeFileSync(join(source,'source.js'),'version 1\n');git(source,['add','source.js']);git(source,['commit','-m','submodule fixture']);
  git(f.root,['init']);git(f.root,['-c','protocol.file.allow=always','submodule','add',source,'vendor']);git(f.root,['commit','-am','initialized submodule fixture']);
  bindReview(f.plan);server=await serveFlowHtml(f.html,{planPath:f.plan});
  const p=await page(server);const validated=await click(p);assert.equal(validated.status,200,await validated.text());
  assert.ok(gate.readUserValidationEvidence(f.plan));
  const moduleFile=join(f.root,'vendor/source.js');writeFileSync(moduleFile,'version 2\n');assert.equal(gate.readUserValidationEvidence(f.plan),null);
  writeFileSync(moduleFile,'version 3\n');assert.equal(gate.readUserValidationEvidence(f.plan),null);
  const dir=join(f.root,'projects/test/fixture');writeFileSync(join(dir,'automate-run-state.json'),JSON.stringify({stage:'plan',pendingStop:{id:'dirty-module-stop',reason:'não avanço',findings:[{title:'Submodule source requires a commit'}]}}));
  const stopped=await page(server);assert.match(stopped.text,/Submodule vendor must be clean and initialized/);assert.match(stopped.text,/Confirm and resume/);
  assert.equal((await click(stopped)).status,409);assert.equal((await click(stopped,'/api/stop-confirm')).status,200);
 } finally {if(server) await server.close();rmSync(f.root,{recursive:true,force:true});rmSync(source,{recursive:true,force:true});}
});
test('operational stop confirmations preserve the reviewed input identity', () => {
 const f = fixture();
 try {
  const before = gate.validationSnapshot(f.plan, {reviewInputs:true});
  const dir = join(f.root, 'projects/test/fixture/decisions');
  mkdirSync(dir);
  writeFileSync(join(dir,'operator-stops.jsonl'), JSON.stringify({id:'retry-pr',decision:'resume'})+'\n');
  assert.equal(gate.validationSnapshot(f.plan, {reviewInputs:true}), before);
  assert.notEqual(gate.validationSnapshot(f.plan), before);
 } finally {rmSync(f.root,{recursive:true,force:true});}
});
test('real HTTP final button stays off until every audit passed, preserves flow, validates provenance and freshness',async()=>{
 const f=fixture(); const server=await serveFlowHtml(f.html,{planPath:f.plan});
 try {
 assert.match(server.url,/^http:\/\//);assert.match(await (await fetch(server.url)).text(),/flow preview/);
 f.write(false);let p=await page(server);assert.match(p.text,/<button[^>]*disabled/);assert.equal((await click(p)).status,409);
 f.write();bindReview(f.plan);p=await page(server);assert.doesNotMatch(p.text,/<button[^>]*disabled/);assert.equal((await click(p)).status,200);
 const at=readFileSync(f.plan,'utf8').match(/userValidatedAt: "([^"]+)"/)[1];
 assert.equal(gate.userValidationOk({automateActive:true,userValidatedAt:at}),false);
 const evidence=gate.readUserValidationEvidence(f.plan);
 assert.equal(gate.userValidationOk({automateActive:true,userValidatedAt:at,userValidationEvidence:evidence}),true);
 assert.throws(() => {evidence.at = '2026-10-02T13:00:00Z';}, TypeError);
 assert.equal(gate.userValidationOk({automateActive:true,userValidatedAt:'2026-10-02T13:00:00Z',userValidationEvidence:evidence}),false);
 const run=()=>spawnSync(process.execPath,['scripts/assert-automate-gate.js','--state-root',f.root,'--plan','fixture','--gate','finalize','--skip-cursor','--skip-last-assert'],{encoding:'utf8'});
 assert.equal(run().status,0,run().stdout+run().stderr);
 f.write(true,'2026-10-02T13:00:00Z');assert.equal(run().status,1);
 f.write(false,at);assert.equal(gate.readUserValidationEvidence(f.plan),null);
 }finally{await server.close();rmSync(f.root,{recursive:true,force:true});}
});
test('button refuses forged token and foreign origin and does not write on GET',async()=>{
 const f=fixture();const server=await serveFlowHtml(f.html,{planPath:f.plan});try{const p=await page(server);
 assert.equal((await click(p,'/api/validate','forged')).status,403);
 assert.equal((await fetch(p.origin+'/api/validate',{method:'POST',headers:{origin:'https://foreign.test'}})).status,403);
 await fetch(p.origin+'/api/validate');assert.doesNotMatch(readFileSync(f.plan,'utf8'),/userValidatedAt/);
 }finally{await server.close();rmSync(f.root,{recursive:true,force:true});}
});
test('missing or empty phases fail closed',async()=>{const f=fixture();writeFileSync(f.plan,'---\nslug: fixture\nphases: []\n---\n');const s=await serveFlowHtml(f.html,{planPath:f.plan});try{const p=await page(s);assert.match(p.text,/<button[^>]*disabled/);assert.equal((await click(p)).status,409);}finally{await s.close();rmSync(f.root,{recursive:true,force:true});}});
test('button works with real nested state and repo-relative audit reports outside the plan directory',async()=>{
 const f=fixture();const state=join(f.root,'.atomic-skills');const dir=join(state,'projects/test/fixture');mkdirSync(dir,{recursive:true});mkdirSync(join(state,'reviews'),{recursive:true});
 const plan=join(dir,'plan.md');writeFileSync(join(state,'reviews/audit.md'),'Real audit evidence\n');
 writeFileSync(plan,readFileSync(f.plan,'utf8').replace('reportPath: audit.md','reportPath: .atomic-skills/reviews/audit.md'));
 bindReview(plan);
 const server=await serveFlowHtml(f.html,{planPath:plan});try{const p=await page(server);const response=await click(p);assert.equal(response.status,200,await response.text());assert.ok(gate.readUserValidationEvidence(plan));}finally{await server.close();rmSync(f.root,{recursive:true,force:true});}
});
test('durable CLI upgrades flow-only preview, reuses final origin and removes its server on down',async()=>{
 const f=fixture();const home=join(f.root,'home');mkdirSync(home);const env={...process.env,HOME:home};const script='scripts/serve-flow.js';
 const run=args=>spawnSync(process.execPath,[script,...args],{env,encoding:'utf8',timeout:15000});
 let url;
 try {
  const flow=run(['--up',f.html]);assert.equal(flow.status,0,flow.stderr);
  const final=run(['--up',f.html,'--plan',f.plan]);assert.equal(final.status,0,final.stderr);url=final.stdout.trim();
  assert.equal((await fetch(new URL('/final',url))).status,200);
  const again=run(['--up',f.html,'--plan',f.plan]);assert.equal(again.stdout.trim(),url);
 }finally{run(['--down',f.html]);if(url) await assert.rejects(fetch(url));rmSync(f.root,{recursive:true,force:true});}
});
test('stale page cannot validate changed audit or prototype, and readable page shows actual admitted screen beside delivery',async()=>{
 const f=fixture();const dir=join(f.root,'projects/test/fixture');mkdirSync(join(dir,'ui'));mkdirSync(join(dir,'architecture'));writeFileSync(join(dir,'ui/screen.html'),'<html>Actual prototype screen</html>');writeFileSync(join(dir,'ui/ui.json'),JSON.stringify({screens:[{path:'ui/screen.html'}]}));writeFileSync(join(dir,'architecture/decisions.json'),JSON.stringify({chosen:'whole',sketches:[{id:'whole',outside:['Deferred export']}]}));
 const s=await serveFlowHtml(f.html,{planPath:f.plan});try{let p=await page(s);assert.match(p.text,/<main/);assert.match(p.text,/Deferred export/);assert.match(p.text,/\/final-assets\/ui\/screen.html/);assert.match(await(await fetch(p.origin+'/final-assets/ui/screen.html')).text(),/Actual prototype screen/);
 writeFileSync(join(dir,'audit.md'),'Changed audit\n');assert.equal((await click(p)).status,409);assert.doesNotMatch(readFileSync(f.plan,'utf8'),/userValidatedAt/);
 bindReview(f.plan);p=await page(s);assert.equal((await click(p)).status,200);assert.ok(gate.readUserValidationEvidence(f.plan));writeFileSync(join(dir,'ui/screen.html'),'<html>Changed prototype</html>');assert.equal(gate.readUserValidationEvidence(f.plan),null);
 }finally{await s.close();rmSync(f.root,{recursive:true,force:true});}
});
test('durable sidecar review supports final gate without rewriting ratified plan substance',async()=>{
 const f=fixture();const dir=join(f.root,'projects/test/fixture');const receipt=gate.readFinalPlan(f.plan).fm.planEndReview;
 writeFileSync(f.plan,readFileSync(f.plan,'utf8').replace(/planEndReview:\n[\s\S]*?\n---/,'---'));writeFileSync(join(dir,'automate-plan-end-review.json'),JSON.stringify(receipt));
 const s=await serveFlowHtml(f.html,{planPath:f.plan});try{const p=await page(s);assert.equal((await click(p)).status,200);const r=spawnSync(process.execPath,['scripts/assert-automate-gate.js','--state-root',f.root,'--plan','fixture','--gate','finalize','--skip-cursor','--skip-last-assert'],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);}finally{await s.close();rmSync(f.root,{recursive:true,force:true});}
});
test('pending audit with a not-yet-created report still renders a disabled final button',async()=>{const f=fixture();f.write(false);writeFileSync(f.plan,readFileSync(f.plan,'utf8').replace('reportPath: audit.md','reportPath: not-created.md'));const s=await serveFlowHtml(f.html,{planPath:f.plan});try{const p=await page(s);assert.match(p.text,/<button[^>]*disabled/);assert.equal((await click(p)).status,409);}finally{await s.close();rmSync(f.root,{recursive:true,force:true});}});
test('final report includes the findings retained in phase audit reports',async()=>{const f=fixture();const dir=join(f.root,'projects/test/fixture');writeFileSync(join(dir,'automate-run-state.json'),JSON.stringify({phaseResiduals:[{phaseId:'F0',reportPath:'audit.md',report:'Accepted residual H1'}]}));const s=await serveFlowHtml(f.html,{planPath:f.plan});try{const p=await page(s);assert.match(p.text,/Accepted residual H1/);}finally{await s.close();rmSync(f.root,{recursive:true,force:true});}});
test('refreshing after source mutation cannot validate against stale reviews', async () => {
 const f = fixture();
 spawnSync('git', ['init'], {cwd:f.root, encoding:'utf8'});
 writeFileSync(join(f.root, 'source.js'), 'export const version=1;\n');
 spawnSync('git', ['add', 'source.js'], {cwd:f.root, encoding:'utf8'});
 bindReview(f.plan);
 const s = await serveFlowHtml(f.html, {planPath:f.plan});
 try {
  const old = await page(s);
  writeFileSync(join(f.root, 'source.js'), 'export const version=2;\n');
  assert.equal((await click(old)).status, 409);
  const refreshed = await page(s);
  assert.match(refreshed.text, /<button[^>]*disabled/);
  assert.equal((await click(refreshed)).status, 409);
  assert.equal(gate.readUserValidationEvidence(f.plan), null);
  assert.doesNotMatch(readFileSync(f.plan, 'utf8'), /userValidatedAt/);
  bindReview(f.plan);
  const current = await page(s);
  assert.equal((await click(current)).status, 200);
  assert.ok(gate.readUserValidationEvidence(f.plan));
  const finalize = () => spawnSync(process.execPath, ['scripts/assert-automate-gate.js',
   '--state-root',f.root,'--plan','fixture','--gate','finalize','--skip-cursor','--skip-last-assert'], {encoding:'utf8'});
  assert.equal(finalize().status, 0);
  writeFileSync(join(f.root, 'source.js'), 'export const version=3;\n');
  assert.equal(gate.readUserValidationEvidence(f.plan), null);
  assert.equal(finalize().status, 1);
 } finally {await s.close(); rmSync(f.root, {recursive:true, force:true});}
});

test('missing review input binding fails closed on the authentic HTTP button', async () => {
 const f = fixture();
 writeFileSync(f.plan, readFileSync(f.plan, 'utf8').replace(/^  reviewInputSnapshot:.*\n/gm, ''));
 const s = await serveFlowHtml(f.html, {planPath:f.plan});
 try {
  const p = await page(s);
  assert.match(p.text, /<button[^>]*disabled/);
  assert.equal((await click(p)).status, 409);
  assert.equal(gate.readUserValidationEvidence(f.plan), null);
 } finally {await s.close(); rmSync(f.root, {recursive:true, force:true});}
});
test('schema-valid references show an admitted delivered HTML screen and HTTP application link',async()=>{
 const f=fixture();const dir=join(f.root,'projects/test/fixture');writeFileSync(join(dir,'built.html'),'<html>Built application</html>');
 const {default:Ajv}=await import('ajv/dist/2020.js');const {stringify}=await import('yaml');const common=JSON.parse(readFileSync(new URL('../meta/schemas/common.schema.json',import.meta.url),'utf8'));const schema=JSON.parse(readFileSync(new URL('../meta/schemas/plan.schema.json',import.meta.url),'utf8'));
 const fm={schemaVersion:'0.1',slug:'fixture',title:'Fixture',version:'1.0',status:'active',started:'2026-10-02T12:00:00Z',lastUpdated:'2026-10-02T12:00:00Z',currentPhase:'F0',parallelismAllowed:false,phases:[{id:'F0',slug:'fixture-f0',title:'Delivery',goal:'Show delivery',dependsOn:[],subPhaseCount:0,exitGate:{summary:'Delivery shown',criteria:[]},status:'pending'}],references:[{kind:'file',path:'built.html',label:'Delivered screen'},{kind:'url',path:'https://app.test/',label:'Delivered application'}]};
 const validate=new Ajv({strict:false}).addSchema(common).compile(schema);assert.equal(validate(fm),true,JSON.stringify(validate.errors));writeFileSync(f.plan,'---\n'+stringify(fm)+'---\n');const s=await serveFlowHtml(f.html,{planPath:f.plan});try{const p=await page(s);assert.match(p.text,/\/final-assets\/built.html/);assert.match(p.text,/href="https:\/\/app.test\/"/);assert.match(await(await fetch(p.origin+'/final-assets/built.html')).text(),/Built application/);}finally{await s.close();rmSync(f.root,{recursive:true,force:true});}
});


test('genuine validation survives documented PR tracking and archive metadata but rejects delivered references', async () => {
 const f = fixture();
 const server = await serveFlowHtml(f.html, {planPath:f.plan});
 try {
  assert.equal((await click(await page(server))).status, 200);
  const before = gate.validationSnapshot(f.plan, {reviewInputs:true});
  const {stringify} = await import('yaml');
  const update = mutation => {
   const {text, fm} = gate.readFinalPlan(f.plan);
   mutation(fm);
   writeFileSync(f.plan, '---\n' + stringify(fm) + '---\n' + text.replace(/^---\n[\s\S]*?\n---\n/, ''));
  };
  update(fm => {
   fm.references = [{kind:'url',path:'https://github.com/example/repo/pull/42',label:'PR #42'}];
   fm.status = 'archived';
   fm.lastUpdated = '2026-10-03T12:00:00Z';
  });
  assert.equal(gate.validationSnapshot(f.plan, {reviewInputs:true}), before);
  assert.equal(gate.planEndReviewCurrent(f.plan), true);
  assert.ok(gate.readUserValidationEvidence(f.plan));
  const result = spawnSync(process.execPath, ['scripts/assert-automate-gate.js', '--state-root',f.root,
   '--plan','fixture','--gate','finalize','--skip-cursor','--skip-last-assert'], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  update(fm => fm.references.push({kind:'url',path:'https://app.test/new',label:'Delivered application'}));
  assert.equal(gate.planEndReviewCurrent(f.plan), false);
  assert.equal(gate.readUserValidationEvidence(f.plan), null);
 } finally {await server.close();rmSync(f.root,{recursive:true,force:true});}
});

for (const field of ['"userValidatedAt": "2026-10-02T12:00:00Z"', 'userValidatedAt: |-\n  2026-10-02T12:00:00Z']) {
 test(`button replaces ${field.split(':')[0]} structurally and preserves body examples`, async () => {
  const f = fixture();
  const body = '\n```yaml\nuserValidatedAt: body-example\n```\n';
  writeFileSync(f.plan, readFileSync(f.plan,'utf8').replace('slug: fixture',field + '\nslug: fixture') + body);
  bindReview(f.plan);
  const server = await serveFlowHtml(f.html, {planPath:f.plan});
  try {
   const response = await click(await page(server));
   assert.equal(response.status, 200, await response.text());
   const {fm,text} = gate.readFinalPlan(f.plan);
   assert.match(fm.userValidatedAt, /^\d{4}-\d{2}-\d{2}T/);
   assert.ok(text.endsWith(body));
   assert.equal(gate.planEndReviewCurrent(f.plan), true);
   assert.ok(gate.readUserValidationEvidence(f.plan));
  } finally {await server.close();rmSync(f.root,{recursive:true,force:true});}
 });
}

test('nested tracked owned artifacts do not invalidate their own proof and automate-prefixed source is hashed', async () => {
 const f = fixture();
 const dir = join(f.root,'projects/test/fixture');
 const receipt = gate.readFinalPlan(f.plan).fm.planEndReview;
 spawnSync('git',['init'],{cwd:f.root});
 for (const name of ['automate-plan-end-review.json','automate-run-state.json','final-validation.json']) {
  writeFileSync(join(dir,name),'{}');
  spawnSync('git',['add',join('projects/test/fixture',name)],{cwd:f.root});
 }
 writeFileSync(join(f.root,'automate-feature.js'),'export const version=1;\n');
 spawnSync('git',['add','automate-feature.js'],{cwd:f.root});
 receipt.reviewInputSnapshot = gate.validationSnapshot(f.plan,{reviewInputs:true});
 writeFileSync(join(dir,'automate-plan-end-review.json'),JSON.stringify(receipt));
 const server = await serveFlowHtml(f.html,{planPath:f.plan});
 try {
  assert.equal((await click(await page(server))).status,200);
  assert.ok(gate.readUserValidationEvidence(f.plan));
  writeFileSync(join(f.root,'automate-feature.js'),'export const version=2;\n');
  assert.equal(gate.planEndReviewCurrent(f.plan),false);
  assert.equal(gate.readUserValidationEvidence(f.plan),null);
 } finally {await server.close();rmSync(f.root,{recursive:true,force:true});}
});

test('current program sidecar recovers a legacy stale inline receipt for genuine HTTP validation', async () => {
 const f = fixture();
 const receipt = {...gate.readFinalPlan(f.plan).fm.planEndReview};
 writeFileSync(f.plan,readFileSync(f.plan,'utf8').replace(/  reviewInputSnapshot:.*\n/,'  reviewInputSnapshot: stale-inline\n'));
 receipt.reviewInputSnapshot = gate.validationSnapshot(f.plan,{reviewInputs:true});
 writeFileSync(join(f.root,'projects/test/fixture/automate-plan-end-review.json'),JSON.stringify(receipt));
 const server = await serveFlowHtml(f.html,{planPath:f.plan});
 try {
  assert.equal((await click(await page(server))).status,200);
  assert.equal(gate.readFinalPlan(f.plan).fm.planEndReview.reviewInputSnapshot,receipt.reviewInputSnapshot);
  assert.ok(gate.readUserValidationEvidence(f.plan));
  receipt.reviewInputSnapshot = 'stale-sidecar';
  writeFileSync(join(f.root,'projects/test/fixture/automate-plan-end-review.json'),JSON.stringify(receipt));
  assert.equal(gate.planEndReviewCurrent(f.plan),false);
 } finally {await server.close();rmSync(f.root,{recursive:true,force:true});}
});
