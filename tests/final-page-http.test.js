import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { serveFlowHtml } from '../scripts/lib/serve-flow.js';
import * as gate from '../src/plan-end-review.js';

function fixture() {
 const root=mkdtempSync(join(tmpdir(),'final-http-')); mkdirSync(join(root,'flow'));
 writeFileSync(join(root,'flow/flow.html'),'<html>flow preview</html>');
 const planDir=join(root,'projects/test/fixture');mkdirSync(planDir,{recursive:true});const plan=join(planDir,'plan.md');
 const write=(passed=true,at='')=>writeFileSync(plan,`---\nslug: fixture\nexecutionMode: automate\n${at?`userValidatedAt: ${JSON.stringify(at)}\n`:''}phases:\n  - id: F0\n    deliveryAuditGate:\n      status: ${passed?'passed':'pending'}\n      verdict: CLOSED\n      reportPath: audit.md\nplanEndReview:\n  mode: external-both\n  reviewFile: audit.md\n  verifiedAt: '2026-10-02T12:00:00Z'\n  legs:\n    - provider: grok\n      status: succeeded\n      familyDifferent: true\n  intentVsDelivered:\n    - status: matched\n---\n# Delivered application\n`);
 writeFileSync(join(planDir,'audit.md'),'Actual delivered evidence\n'); write();
 return {root,plan,write,html:join(root,'flow/flow.html')};
}
async function page(server) {const origin=new URL(server.url).origin;const res=await fetch(`${origin}/final`);return {origin,text:await res.text(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
async function click(p,path='/api/validate',token=p.text.match(/name="token" value="([^"]+)"/)?.[1]) {return fetch(p.origin+path,{method:'POST',headers:{origin:p.origin,cookie:p.cookie||'','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:token||''})});}
test('real HTTP final button stays off until every audit passed, preserves flow, validates provenance and freshness',async()=>{
 const f=fixture(); const server=await serveFlowHtml(f.html,{planPath:f.plan});
 try {
 assert.match(server.url,/^http:\/\//);assert.match(await (await fetch(server.url)).text(),/flow preview/);
 f.write(false);let p=await page(server);assert.match(p.text,/<button[^>]*disabled/);assert.equal((await click(p)).status,409);
 f.write();p=await page(server);assert.doesNotMatch(p.text,/<button[^>]*disabled/);assert.equal((await click(p)).status,200);
 const at=readFileSync(f.plan,'utf8').match(/userValidatedAt: "([^"]+)"/)[1];
 assert.equal(gate.userValidationOk({automateActive:true,userValidatedAt:at}),false);
 const evidence=gate.readUserValidationEvidence(f.plan);
 assert.equal(gate.userValidationOk({automateActive:true,userValidatedAt:at,userValidationEvidence:evidence}),true);
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
 const server=await serveFlowHtml(f.html,{planPath:plan});try{const p=await page(server);const response=await click(p);assert.equal(response.status,200,await response.text());assert.ok(gate.readUserValidationEvidence(plan));}finally{await server.close();rmSync(f.root,{recursive:true,force:true});}
});
