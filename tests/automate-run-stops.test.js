import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {serveFlowHtml} from '../scripts/lib/serve-flow.js';
import * as runner from '../scripts/automate-run.js';
function fixture(){const root=mkdtempSync(join(tmpdir(),'automate-stops-'));mkdirSync(join(root,'flow'));writeFileSync(join(root,'flow/flow.html'),'<html>Preview</html>');const plan=join(root,'plan.md');writeFileSync(plan,`---\nslug: fixture\nexecutionMode: automate\nphases:\n - id: F0\n   status: done\n   deliveryAuditGate:\n     status: passed\n     verdict: CLOSED\n     reportPath: audit.md\n---\n# Plan intent\n`);writeFileSync(join(root,'audit.md'),'Phase audit residual H1\n');writeFileSync(join(root,'flow/flow.json'),'{}');mkdirSync(join(root,'architecture'));writeFileSync(join(root,'architecture/decisions.json'),'{}');return{root,plan,html:join(root,'flow/flow.html')};}
const clean={status:0,stdout:JSON.stringify({verdict:'PASSED',findings:[],intentVsDelivered:[{status:'matched'}]}),stderr:''};
async function confirm(origin){const response=await fetch(origin+'/final');const html=await response.text();const token=html.match(/name="token" value="([^"]+)"/)[1];return fetch(origin+'/api/stop-confirm',{method:'POST',headers:{origin,cookie:response.headers.get('set-cookie').split(';')[0]},body:new URLSearchParams({token})});}
for(const [reason,result] of [['travei',{status:0,stdout:JSON.stringify({verdict:'OPEN',findings:[{severity:'major',title:'broken'}]}),stderr:''}],['não avanço',{status:1,stdout:'',stderr:'review unavailable'}],['mudança grande',{status:0,stdout:JSON.stringify({verdict:'OPEN',findings:[{stampedBlockMix:true,title:'mix'}]}),stderr:''}]]){
 test(`${reason} opens the same HTTP origin, confirmation is logged, resumed stages do not reinstall phase stops`,async()=>{
  const f=fixture();const server=await serveFlowHtml(f.html,{planPath:f.plan});const origin=new URL(server.url).origin;let broken=true;let fixes=0;let opens=[];let prs=0;let stages=[];
  const deps={preview:()=>server.url,open:url=>opens.push(url),review:({stage})=>{stages.push(stage);return broken?result:clean;},fix:()=>{fixes++;return{ok:true};},createPr:()=>{prs++;return{url:'https://github.test/pr/1',state:'OPEN'};}};
  try{
   assert.equal(typeof runner.runPlanEndWorkflow,'function');const stopped=await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps});assert.equal(stopped.action,'stop');assert.equal(stopped.reason,reason);assert.ok(opens.every(url=>new URL(url).origin===origin));assert.equal(prs,0);
   assert.equal((await confirm(origin)).status,200);const log=readFileSync(join(f.root,'decisions/operator-stops.jsonl'),'utf8');assert.match(log,/Operator confirmed/);assert.doesNotMatch(readFileSync(f.plan,'utf8'),/userValidatedAt/);
   broken=false;const completed=await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps});assert.equal(completed.action,'pr-open');assert.equal(prs,1);assert.ok(stages.includes('plan')&&stages.includes('audit'));assert.equal(completed.pr.state,'OPEN');assert.equal(existsSync(join(f.root,'archive')),false);
   const again=await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps});assert.equal(again.action,'pr-open');assert.equal(prs,1);assert.equal(opens.filter(url=>url.includes('stop=')).length,1);
  }finally{await server.close();rmSync(f.root,{recursive:true,force:true});}
 });
}
test('plan reviews run before delivery audit, include phase residuals, and invalid JSON cannot become clean',async()=>{
 const f=fixture();const server=await serveFlowHtml(f.html,{planPath:f.plan});try{let briefs=[];const deps={preview:()=>server.url,open:()=>{},review:input=>{briefs.push(input);return input.stage==='audit'?{status:0,stdout:'{garbage',stderr:''}:clean;},fix:()=>({ok:true}),createPr:()=>{throw Error('must not create PR');}};
 const result=await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps});assert.equal(result.reason,'não avanço');assert.deepEqual(briefs.map(b=>b.stage),['plan','audit']);assert.match(briefs[1].brief,/H1/);
 }finally{await server.close();rmSync(f.root,{recursive:true,force:true});}
});
