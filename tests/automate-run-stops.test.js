import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync,chmodSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {flowDocumentSha} from '../scripts/find-missing-flow.js';
import {serveFlowHtml} from '../scripts/lib/serve-flow.js';
import * as runner from '../scripts/automate-run.js';
function fixture(){const root=mkdtempSync(join(tmpdir(),'automate-stops-'));mkdirSync(join(root,'flow'));writeFileSync(join(root,'flow/flow.html'),'<html>Preview</html>');const plan=join(root,'plan.md');writeFileSync(plan,`---\nslug: fixture\nexecutionMode: automate\nphases:\n - id: F0\n   status: done\n   deliveryAuditGate:\n     status: passed\n     verdict: CLOSED\n     reportPath: audit.md\n---\n# Plan intent\n`);writeFileSync(join(root,'audit.md'),'Phase audit residual H1\n');const graph=JSON.parse(readFileSync(new URL('../docs/design/project-flow/dogfood/minimal-xor.json',import.meta.url),'utf8'));graph.ratifiedGraphSha=flowDocumentSha(graph);writeFileSync(join(root,'flow/flow.json'),JSON.stringify(graph));mkdirSync(join(root,'architecture'));writeFileSync(join(root,'architecture/decisions.json'),'{}');return{root,plan,html:join(root,'flow/flow.html')};}
const clean={status:0,stdout:JSON.stringify({verdict:'PASSED',findings:[],graphCoverage:[{kind:'machine',id:'request',status:'faz'},{kind:'xor',id:'D1',status:'faz'}],intentVsDelivered:[{status:'matched'}]}),stderr:''};
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

test('final audit missing a ratified xor coverage line cannot open the PR',async()=>{
 const f=fixture();const server=await serveFlowHtml(f.html,{planPath:f.plan});try{
 let prs=0;const incomplete={...JSON.parse(clean.stdout),graphCoverage:[{kind:'machine',id:'request',status:'faz'}]};
 const result=await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps:{preview:()=>server.url,open:()=>{},review:({stage})=>stage==='audit'?{status:0,stdout:JSON.stringify(incomplete),stderr:''}:clean,createPr:()=>{prs++;return{url:'https://github.test/pr/1',state:'OPEN'};}}});
 assert.equal(result.action,'stop');assert.equal(result.reason,'não avanço');assert.equal(prs,0);assert.match(JSON.stringify(JSON.parse(readFileSync(join(f.root,'automate-run-state.json'),'utf8')).pendingStop.findings),/xor D1/);
 }finally{await server.close();rmSync(f.root,{recursive:true,force:true});}
});

function trackedFixture() {
 const f = fixture();
 writeFileSync(join(f.root, 'source.js'), 'export const version = 1;\n');
 for (const args of [['init','--initial-branch=plan/fixture'],
  ['-c','user.name=fixture','-c','user.email=fixture@test','add','source.js'],
  ['-c','user.name=fixture','-c','user.email=fixture@test','commit','-m','fixture']]) {
  const result = spawnSync('git', args, {cwd:f.root, encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
 }
 return f;
}

for (const stage of ['audit','pr','complete']) {
 test(`saved ${stage} without reviewed input identity cannot reuse legacy success`, async () => {
  const f = fixture();
  const s = await serveFlowHtml(f.html,{planPath:f.plan});
  writeFileSync(join(f.root,'automate-run-state.json'),JSON.stringify({
   schemaVersion:1,stage,round:1,reviews:[],pr:{url:'https://github.test/pr/old',state:'OPEN'},
  }));
  try {
   const result = await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps:{
    preview:()=>s.url,open:()=>{},review:()=>clean,createPr:()=>({url:'https://github.test/pr/old',state:'OPEN'}),
   }});
   assert.equal(result.action,'stop');
   assert.equal(result.reason,'não avanço');
  } finally {await s.close();rmSync(f.root,{recursive:true,force:true});}
 });
}

for (const changed of [false, true]) {
 test(`PR failure resume ${changed ? 'reruns reviews after source changes' : 'preserves unchanged reviews and idempotent PR'}`, async () => {
  const f = trackedFixture();
  const s = await serveFlowHtml(f.html, {planPath:f.plan});
  let attempts = 0;
  const stages = [];
  const deps = {preview:()=>s.url, open:()=>{}, review:({stage})=>{stages.push(stage);return clean;},
   createPr:()=>{if (++attempts === 1) throw Error('PR temporarily unavailable'); return {url:'https://github.test/pr/1',state:'OPEN'};}};
  const run = () => runner.runPlanEndWorkflow({plan:f.plan, root:f.root, cli:'grok', deps});
  try {
   assert.equal((await run()).reason, 'não avanço');
   assert.deepEqual(stages, ['plan','audit']);
   if (changed) writeFileSync(join(f.root,'source.js'), 'export const version = 2;\n');
   assert.equal((await confirm(new URL(s.url).origin)).status, 200);
   let result = await run();
   if (result.action === 'stop') {
    assert.equal((await confirm(new URL(s.url).origin)).status, 200);
    result = await run();
   }
   assert.equal(result.action, 'pr-open');
   assert.deepEqual(stages, changed ? ['plan','audit','plan','audit'] : ['plan','audit']);
   assert.equal((await run()).action, 'pr-open');
   assert.equal(attempts, 2);
  } finally {await s.close();rmSync(f.root,{recursive:true,force:true});}
 });
}

test('audit source repairs rerun the whole plan and retain the three-round cap', async () => {
 const f = trackedFixture();
 const s = await serveFlowHtml(f.html, {planPath:f.plan});
 const stages = [];
 let repairs = 0;
 try {
  const result = await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps:{
   preview:()=>s.url,open:()=>{},
   review:({stage,round})=>{
    stages.push(`${stage}:${round}`);
    return stage === 'plan' ? clean : {status:0,stderr:'',stdout:JSON.stringify({verdict:'OPEN',findings:[{severity:'major',title:'Audit source defect'}]})};
   },
   fix:()=>{repairs++;writeFileSync(join(f.root,'source.js'),`export const version = ${repairs+1};\n`);return {ok:true};},
   createPr:()=>{throw Error('must not open PR');},
  }});
  assert.equal(result.reason, 'travei');
  assert.equal(repairs, 2);
  assert.deepEqual(stages, ['plan:1','audit:1','plan:2','audit:2','plan:3','audit:3']);
 } finally {await s.close();rmSync(f.root,{recursive:true,force:true});}
});

function executable(path, source) {
 writeFileSync(path, `#!${process.execPath}\n${source}`);
 chmodSync(path, 0o755);
 return path;
}

test('default fixer sends bounded current findings over stdin to a noninteractive writer subprocess', async () => {
 const f = trackedFixture();
 const side = mkdtempSync(join(tmpdir(),'repair-cli-'));
 const capture = join(side,'capture.json');
 const host = executable(join(side,'host'), `
 const fs = require('node:fs');
 let input = '';
 process.stdin.on('data', chunk => input += chunk);
 process.stdin.on('end', () => {
  fs.writeFileSync(${JSON.stringify(capture)}, JSON.stringify({argv:process.argv.slice(2),input}));
  const prompt = JSON.parse(input);
  if (!prompt.operation.startsWith('repair-') || !input.includes('UNIQUE_CURRENT_FAILURE_TO_REPAIR')) process.exit(7);
  fs.writeFileSync('source.js', 'export const version = 2;\\n');
 });`);
 const s = await serveFlowHtml(f.html,{planPath:f.plan});
 let plans = 0;
 try {
  const result = await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,host:'codex',cli:'grok',
   args:{hostBin:host,worktreeParent:join(side,'worktrees')},deps:{preview:()=>s.url,open:()=>{},
    review:({stage})=>stage==='plan' && ++plans===1 ? {status:0,stderr:'',stdout:JSON.stringify({verdict:'OPEN',findings:[{severity:'major',title:'UNIQUE_CURRENT_FAILURE_TO_REPAIR',evidence:'source.js:1'}]})}:clean,
    createPr:()=>({url:'https://github.test/pr/2',state:'OPEN'}),
   }});
  assert.equal(result.action, 'pr-open');
  const received = JSON.parse(readFileSync(capture,'utf8'));
  assert.deepEqual(received.argv,['exec','--sandbox','workspace-write','-']);
  const prompt = JSON.parse(received.input);
  assert.equal(prompt.operation,'repair-whole-plan');
  assert.equal(prompt.findings[0].title,'UNIQUE_CURRENT_FAILURE_TO_REPAIR');
  assert.ok(prompt.requiredVerification.length);
  assert.match(readFileSync(join(f.root,'source.js'),'utf8'), /version = 2/);
 } finally {await s.close();rmSync(f.root,{recursive:true,force:true});rmSync(side,{recursive:true,force:true});}
});

for (const leg of ['local','external']) {
 for (const stage of ['plan','audit']) {
  test(`${leg} OPEN ${stage} verdict with medium findings cannot mint success`, async () => {
   const f = fixture();
   const side = mkdtempSync(join(tmpdir(),'review-cli-'));
   const openResult = {...JSON.parse(clean.stdout),verdict:'OPEN',findings:[{severity:'medium',title:'Coverage gap'}],intentVsDelivered:[{status:'missing'}],graphCoverage:[{kind:'machine',id:'request',status:'não faz'},{kind:'xor',id:'D1',status:'não faz'}]};
   const cli = bad => executable(join(side,bad?'open':'passed'), `
    let input = '';process.stdin.on('data', chunk => input += chunk);
    process.stdin.on('end', () => process.stdout.write(JSON.stringify(
     ${bad ? `JSON.parse(input.slice(input.indexOf('{'))).operation === ${JSON.stringify(stage==='plan'?'review-whole-plan':'audit-delivery')} ? ${JSON.stringify(openResult)} :` : ''}
     ${clean.stdout})));`);
   const host = cli(leg==='local');
   const external = cli(leg==='external');
   const s = await serveFlowHtml(f.html,{planPath:f.plan});
   let repairs = 0, prs = 0;
   try {
    const result = await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,host:'codex',cli:'grok',args:{hostBin:host,reviewBin:external},deps:{
     preview:()=>s.url,open:()=>{},fix:()=>{repairs++;return {ok:true};},createPr:()=>{prs++;return {url:'https://github.test/pr/3',state:'OPEN'};},
    }});
    assert.equal(result.action,'stop');
    assert.equal(result.reason,'travei');
    assert.equal(repairs,2);
    assert.equal(prs,0);
    assert.equal(existsSync(join(f.root,'automate-plan-end-review.json')),false);
   } finally {await s.close();rmSync(f.root,{recursive:true,force:true});rmSync(side,{recursive:true,force:true});}
  });
 }
}
