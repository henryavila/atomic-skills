import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync,chmodSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {flowDocumentSha} from '../scripts/find-missing-flow.js';
import {serveFlowHtml} from '../scripts/lib/serve-flow.js';
import * as runner from '../scripts/automate-run.js';
import {validationSnapshot} from '../src/plan-end-review.js';
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
  ['-c','user.name=fixture','-c','user.email=fixture@test','add','source.js','plan.md','audit.md','flow','architecture'],
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
   if (changed) {writeFileSync(join(f.root,'source.js'), 'export const version = 2;\n');commitProduct(f.root);}
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
   fix:()=>{repairs++;writeFileSync(join(f.root,'source.js'),`export const version = ${repairs+1};\n`);commitProduct(f.root);return {ok:true};},
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

function commitProduct(root) {
 for (const args of [['add','source.js'],['-c','user.name=fixture','-c','user.email=fixture@test','commit','-m','repair source']]) {
  const result = spawnSync('git',args,{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
 }
}


for (const kind of ['null-row','array-row','unknown-status','null-finding']) {
 test(`malformed audit ${kind} returns controlled stop on the same origin`, async () => {
  const f = fixture();
  const server = await serveFlowHtml(f.html,{planPath:f.plan});
  const report = JSON.parse(clean.stdout);
  if (kind === 'null-finding') report.findings = [null];
  else report.intentVsDelivered = [{status:'matched'},kind === 'null-row' ? null : kind === 'array-row' ? [] : {status:'unknown'}];
  try {
   const result = await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps:{
    preview:()=>server.url,open:()=>{},review:({stage})=>stage === 'plan' ? clean : {...clean,stdout:JSON.stringify(report)},
    createPr:()=>{throw Error('must not publish');},
   }});
   assert.equal(result.reason,'não avanço');
   assert.equal(new URL(result.url).origin,new URL(server.url).origin);
   assert.equal(JSON.parse(readFileSync(join(f.root,'automate-run-state.json'),'utf8')).pendingStop.reason,'não avanço');
  } finally {await server.close();rmSync(f.root,{recursive:true,force:true});}
 });
}

for (const input of ['missing-architecture','malformed-architecture','malformed-flow','missing-ui-screen']) {
 test(`runtime ${input} construction failure uses the controlled stop`, async () => {
  const f = fixture();
  if (input === 'missing-architecture') rmSync(join(f.root,'architecture/decisions.json'));
  if (input === 'malformed-architecture') writeFileSync(join(f.root,'architecture/decisions.json'),'{bad');
  if (input === 'malformed-flow') writeFileSync(join(f.root,'flow/flow.json'),'{bad');
  if (input === 'missing-ui-screen') {
   mkdirSync(join(f.root,'ui'));writeFileSync(join(f.root,'ui/ui.json'),JSON.stringify({screens:[{path:'ui/not-created.html'}]}));
  }
  const server = await serveFlowHtml(f.html,{planPath:f.plan});
  try {
   const result = await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps:{
    preview:()=>server.url,open:()=>{},review:()=>clean,createPr:()=>{throw Error('must not publish');},
   }});
   assert.equal(result.reason,'não avanço');
   assert.equal(new URL(result.url).origin,new URL(server.url).origin);
   assert.equal((await fetch(server.url)).status,200);
   assert.equal(JSON.parse(readFileSync(join(f.root,'automate-run-state.json'),'utf8')).pendingStop.reason,'não avanço');
  } finally {await server.close();rmSync(f.root,{recursive:true,force:true});}
 });
}

test('third successful plan round then audit source repair stops without a fourth review or report overwrite', async () => {
 const f = trackedFixture();
 const server = await serveFlowHtml(f.html,{planPath:f.plan});
 const stages = [];
 let thirdReport;
 try {
  const result = await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps:{
   preview:()=>server.url,open:()=>{},
   review:({stage,round})=>{
    stages.push(`${stage}:${round}`);
    if (stage === 'audit') thirdReport = readFileSync(join(f.root,'automate-plan-review-3.json'),'utf8');
    return stage === 'plan' && round === 3 ? clean : {
     ...clean,stdout:JSON.stringify({verdict:'OPEN',findings:[{severity:'major',title:'Requires source repair'}]}),
    };
   },
   fix:()=>{writeFileSync(join(f.root,'source.js'),`export const version = ${stages.length+1};\n`);commitProduct(f.root);return {ok:true};},
   createPr:()=>{throw Error('must not publish');},
  }});
  assert.equal(result.reason,'travei');
  assert.deepEqual(stages,['plan:1','plan:2','plan:3','audit:1']);
  assert.equal(readFileSync(join(f.root,'automate-plan-review-3.json'),'utf8'),thirdReport);
  assert.equal(existsSync(join(f.root,'automate-plan-review-4.json')),false);
  assert.equal((await confirm(new URL(server.url).origin)).status,200);
  const resumed = await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps:{
   preview:()=>server.url,open:()=>{},review:()=>{throw Error('must not run a fourth review');},
  }});
  assert.equal(resumed.reason,'travei');
  assert.equal(readFileSync(join(f.root,'automate-plan-review-3.json'),'utf8'),thirdReport);
 } finally {await server.close();rmSync(f.root,{recursive:true,force:true});}
});

test('PR retry refuses dirty product before review and uploads the reviewed committed bytes after recovery', async () => {
 const f = trackedFixture();
 const side = mkdtempSync(join(tmpdir(),'publish-remote-'));
 const remote = join(side,'remote.git');
 const gh = executable(join(side,'gh'), `
 const fs = require('node:fs');
 fs.appendFileSync(${JSON.stringify(join(side,'calls'))},process.argv.slice(2).join(' ')+'\\n');
 if (process.argv[3] === 'view') process.exit(1);
 process.stdout.write('https://github.com/example/repo/pull/42\\n');`);
 for (const args of [['init','--bare',remote],['remote','add','origin',remote]]) {
  const result = spawnSync('git',args,{cwd:f.root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 }
 const server = await serveFlowHtml(f.html,{planPath:f.plan});
 const stages = [];
 const deps = {preview:()=>server.url,open:()=>{},review:({stage})=>{stages.push(stage);return clean;}};
 const run = () => runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',args:{githubBin:gh,prBase:'main'},deps});
 try {
  // Save reviewed PR-stage state through a real failed publication attempt.
  const initial = await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps:{...deps,createPr:()=>{throw Error('PR unavailable');}}});
  assert.equal(initial.reason,'não avanço');
  writeFileSync(join(f.root,'source.js'),'export const version = 2;\n');
  assert.equal((await confirm(new URL(server.url).origin)).status,200);
  const dirty = await run();
  assert.equal(dirty.reason,'não avanço');
  assert.deepEqual(stages,['plan','audit']);
  assert.equal(existsSync(join(side,'calls')),false);
  assert.equal(spawnSync('git',['--git-dir',remote,'show','refs/heads/plan/fixture:source.js'],{encoding:'utf8'}).status,128);
  commitProduct(f.root);
  assert.equal((await confirm(new URL(server.url).origin)).status,200);
  let current = await run();
  if (current.action === 'stop') {assert.equal((await confirm(new URL(server.url).origin)).status,200);current = await run();}
  assert.equal(current.action,'pr-open');
  assert.deepEqual(stages,['plan','audit','plan','audit']);
  const uploaded = spawnSync('git',['--git-dir',remote,'show','refs/heads/plan/fixture:source.js'],{encoding:'utf8'});
  assert.equal(uploaded.status,0,uploaded.stderr);
  assert.equal(uploaded.stdout,readFileSync(join(f.root,'source.js'),'utf8'));
 } finally {await server.close();rmSync(f.root,{recursive:true,force:true});rmSync(side,{recursive:true,force:true});}
});

for (const mutation of ['staged','untracked','renamed','during-review','during-review-fix']) {
 test(`uncommitted ${mutation} product cannot publish`, async () => {
  const f = trackedFixture();
  const server = await serveFlowHtml(f.html,{planPath:f.plan});
  let reviews = 0, prs = 0, fixes = 0;
  if (mutation === 'staged') {writeFileSync(join(f.root,'source.js'),'changed\n');spawnSync('git',['add','source.js'],{cwd:f.root});}
  if (mutation === 'untracked') writeFileSync(join(f.root,'new-source.js'),'new source\n');
  if (mutation === 'renamed') spawnSync('git',['mv','source.js','automate-source.js'],{cwd:f.root});
  try {
   const result = await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps:{
    preview:()=>server.url,open:()=>{},review:()=>{
     reviews++;
     if (mutation.startsWith('during-review')) writeFileSync(join(f.root,'source.js'),'changed during review\n');
     return mutation === 'during-review-fix' ? {...clean,stdout:JSON.stringify({verdict:'OPEN',findings:[{severity:'major',title:'Needs repair'}]})} : clean;
    },
    fix:()=>{fixes++;return {ok:true};},
    createPr:()=>{prs++;return {url:'https://github.test/pr/1',state:'OPEN'};},
   }});
   assert.equal(result.reason,'não avanço');
   assert.equal(prs,0);
   assert.equal(fixes,0);
   if (!mutation.startsWith('during-review')) assert.equal(reviews,0);
  } finally {await server.close();rmSync(f.root,{recursive:true,force:true});}
 });
}

for (const provider of ['grok','claude','codex']) {
 test(`${provider} native structured subprocess transport supplies the final report and supported argv`, async () => {
  const f = fixture();
  const side = mkdtempSync(join(tmpdir(),'native-review-'));
  const report = JSON.parse(clean.stdout);
  // Public final fields match the actual Grok --json-schema envelope captured
  // in authority.out.json; thought content is deliberately never part of a fixture.
  const grokEnvelope = {text:JSON.stringify(report),structuredOutput:report,stopReason:'end_turn',sessionId:'fixture',requestId:'fixture',usage:{inputTokens:1,outputTokens:1},num_turns:1,total_cost_usd:0};
  const stdout = provider === 'grok' ? JSON.stringify(grokEnvelope) : provider === 'claude' ? JSON.stringify({type:'result',subtype:'success',is_error:false,structured_output:report,result:JSON.stringify(report)}) : [
   {type:'thread.started',thread_id:'fixture'},{type:'turn.started'},
   {type:'item.completed',item:{id:'message',type:'agent_message',text:JSON.stringify(report)}},
   {type:'turn.completed',usage:{input_tokens:1,output_tokens:1}},
  ].map(row=>JSON.stringify(row)).join('\n')+'\n';
  const cli = executable(join(side,'native'), `
  const fs = require('node:fs');
  fs.appendFileSync(${JSON.stringify(join(side,'argv'))},JSON.stringify(process.argv.slice(2))+'\\n');
  process.stdin.resume();process.stdin.on('end',()=>process.stdout.write(${JSON.stringify(stdout)}));`);
  const local = executable(join(side,'local'), `process.stdin.resume();process.stdin.on('end',()=>process.stdout.write(${JSON.stringify(clean.stdout)}));`);
  const server = await serveFlowHtml(f.html,{planPath:f.plan});
  try {
   const result = await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,host:provider==='codex'?'grok':'codex',cli:provider,args:{hostBin:local,reviewBin:cli},deps:{
    preview:()=>server.url,open:()=>{},createPr:()=>({url:'https://github.test/pr/1',state:'OPEN'}),
   }});
   assert.equal(result.action,'pr-open');
   const argv = JSON.parse(readFileSync(join(side,'argv'),'utf8').trim().split('\n')[0]);
   if (provider === 'codex') {assert.ok(argv.includes('--json'));assert.ok(argv.includes('--output-schema'));assert.ok(existsSync(argv[argv.indexOf('--output-schema')+1]));}
   else {assert.ok(argv.includes('--json-schema'));assert.equal(argv[argv.indexOf('--output-format')+1],'json');assert.equal(JSON.parse(argv[argv.indexOf('--json-schema')+1]).type,'object');}
   const saved = JSON.parse(readFileSync(join(f.root,'automate-plan-review-1.json'),'utf8'));
   assert.equal(saved.exit,0);assert.equal(saved.external.status,0);
   assert.equal(saved.external.stdout,stdout);
  } finally {await server.close();rmSync(f.root,{recursive:true,force:true});rmSync(side,{recursive:true,force:true});}
 });
}

for (const [label,stdout] of [
 ['grok-text',JSON.stringify({text:clean.stdout,stopReason:'end_turn'})],
 ['claude-result',JSON.stringify({type:'result',subtype:'success',is_error:false,result:clean.stdout})],
]) {
 test(`known final ${label} fallback transport is accepted`,async()=>{
  const f=fixture();const server=await serveFlowHtml(f.html,{planPath:f.plan});
  try {
   const result=await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps:{preview:()=>server.url,open:()=>{},review:()=>({...clean,stdout}),createPr:()=>({url:'https://github.test/pr/1',state:'OPEN'})}});
   assert.equal(result.action,'pr-open');
  }finally{await server.close();rmSync(f.root,{recursive:true,force:true});}
 });
}

for (const [label,stdout] of [
 ['progress-text','Working...\n'+clean.stdout],
 ['truncated-grok',JSON.stringify({structuredOutput:JSON.parse(clean.stdout),stopReason:'max_tokens'})],
 ['claude-error',JSON.stringify({type:'result',subtype:'error_during_execution',is_error:true,result:clean.stdout})],
 ['claude-nonfinal',JSON.stringify({type:'assistant',result:clean.stdout})],
 ['codex-nonfinal',JSON.stringify({type:'item.completed',item:{type:'agent_message',text:clean.stdout}})+'\n'],
 ['codex-failed',[{type:'item.completed',item:{type:'agent_message',text:clean.stdout}},{type:'turn.failed',error:{message:'failed'}}].map(x=>JSON.stringify(x)).join('\n')],
 ['malformed-report',JSON.stringify({structuredOutput:{verdict:'PASSED'},stopReason:'end_turn'})],
]) {
 test(`rejects ${label} transport through the controlled stop`,async()=>{
  const f=fixture();const server=await serveFlowHtml(f.html,{planPath:f.plan});let prs=0;
  try {
   const result=await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,cli:'grok',deps:{preview:()=>server.url,open:()=>{},review:()=>({...clean,stdout}),createPr:()=>{prs++;return {url:'https://github.test/pr/1',state:'OPEN'};}}});
   assert.equal(result.reason,'não avanço');assert.equal(prs,0);
  }finally{await server.close();rmSync(f.root,{recursive:true,force:true});}
 });
}


test('provider process evidence preserves public final output and omits private reasoning fields', async () => {
 const f=fixture();const side=mkdtempSync(join(tmpdir(),'public-review-'));
 const report=JSON.parse(clean.stdout);
 const native=executable(join(side,'native'),`process.stdin.resume();process.stdin.on('end',()=>process.stdout.write(${JSON.stringify(JSON.stringify({stopReason:'end_turn',structuredOutput:report,text:clean.stdout,thought:'PRIVATE_PROVIDER_THOUGHT_MARKER'}))}));`);
 const local=executable(join(side,'local'),`process.stdin.resume();process.stdin.on('end',()=>process.stdout.write(${JSON.stringify(clean.stdout)}));`);
 const server=await serveFlowHtml(f.html,{planPath:f.plan});
 try {
  const result=await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,host:'codex',cli:'grok',args:{hostBin:local,reviewBin:native},deps:{preview:()=>server.url,open:()=>{},createPr:()=>({url:'https://github.test/pr/1',state:'OPEN'})}});
  assert.equal(result.action,'pr-open');
  const saved=readFileSync(join(f.root,'automate-plan-review-1.json'),'utf8');
  assert.doesNotMatch(saved,/PRIVATE_PROVIDER_THOUGHT_MARKER/);
  const processEvidence=JSON.parse(saved).external;
  assert.equal(processEvidence.status,0);assert.equal(JSON.parse(processEvidence.stdout).text,clean.stdout);
 }finally{await server.close();rmSync(f.root,{recursive:true,force:true});rmSync(side,{recursive:true,force:true});}
});

test('failed native review retains process exit and public stdout in its controlled stop',async()=>{
 const f=fixture();const side=mkdtempSync(join(tmpdir(),'failed-native-review-'));
 const local=executable(join(side,'local'),`process.stdin.resume();process.stdin.on('end',()=>process.stdout.write(${JSON.stringify(clean.stdout)}));`);
 const native=executable(join(side,'native'),`process.stdin.resume();process.stdin.on('end',()=>{process.stdout.write('PUBLIC_FAILURE_OUTPUT');process.stderr.write('PUBLIC_FAILURE_STDERR');process.exitCode=7;});`);
 const server=await serveFlowHtml(f.html,{planPath:f.plan});
 try {
  const result=await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,host:'codex',cli:'grok',args:{hostBin:local,reviewBin:native},deps:{preview:()=>server.url,open:()=>{},createPr:()=>{throw Error('must not publish');}}});
  assert.equal(result.reason,'não avanço');
  const stop=JSON.parse(readFileSync(join(f.root,'automate-run-state.json'),'utf8')).pendingStop;
  assert.equal(stop.findings[0].processEvidence.external.status,7);
  assert.equal(stop.findings[0].processEvidence.external.stdout,'PUBLIC_FAILURE_OUTPUT');
  assert.equal(stop.findings[0].processEvidence.external.stderr,'PUBLIC_FAILURE_STDERR');
 }finally{await server.close();rmSync(f.root,{recursive:true,force:true});rmSync(side,{recursive:true,force:true});}
});

// Captured public final fields from the real Grok --json-schema component
// review (grok-4.6-build). Its scoped-review schema differs from this runner,
// so transport must decode successfully before the report contract rejects it.
const capturedGrokPublicFinal = {
  "stopReason": "end_turn",
  "structuredOutput": {
    "verdict": "needs_changes",
    "findings": [
      {
        "severity": "critical",
        "file": "src/plan-end-review.js",
        "line": 496,
        "claim": "productSnapshot excludes operational plan/runtime files (automate-* and final-validation*) from tracked product identity, so review/validation snapshots stay independent of those artifacts.",
        "impact": "When a plan is not under `.atomic-skills/` and those files are tracked in a subdirectory, writing `final-validation.json` or `automate-plan-end-review.json` changes `productSnapshot`, which is mixed into every `validationSnapshot`. `planEndReviewCurrent` and `readUserValidationEvidence` then fail closed: a just-written review receipt or HTTP-button proof cannot match `reviewInputSnapshot` / `proof.snapshot`, so finalize stays blocked.",
        "recommendation": "Skip operational files by basename or path segment (e.g. `(?:^|/)(?:automate-|final-validation)`), not only at the git-relative root. Keep them out of `productSnapshot` the same way `reviewInputs` already omits them from the plan-dir file list.",
        "confidence": "high",
        "reproduction": "Place a plan outside `.atomic-skills/`, `git add` `dirname(plan)/final-validation.json` (or `automate-plan-end-review.json`), compute `validationSnapshot` before write, write the file, recompute. Digests differ because line 496 `/^(?:automate-|final-validation)/` does not match nested relatives, so `planEndReviewCurrent` / `readUserValidationEvidence` return false/null."
      },
      {
        "severity": "major",
        "file": "src/plan-end-review.js",
        "line": 423,
        "claim": "Default `validationSnapshot` (the HMAC-bound identity) normalizes `userValidatedAt` out of the hashed plan text so stamping validation cannot change the snapshot being signed.",
        "impact": "Only a single `userValidatedAt:.*` line is stripped, and only from raw text. Quoted/folded YAML, a value on the following line, or a YAML Date round-trip that rewrites the key still remain in `planInput`. After the HTTP button writes `userValidatedAt`, `proof.snapshot !== validationSnapshot(planPath)` and `readUserValidationEvidence` returns null.",
        "recommendation": "Hash the same normalized structure used for `reviewInputs` (parsed frontmatter with `userValidatedAt` deleted, plus body), or strip the field from parsed YAML rather than a one-line regex on the raw file.",
        "confidence": "medium",
        "reproduction": "Use frontmatter `userValidatedAt: |\n  2026-01-01T00:00:00.000Z` (or a parser that rewrites the key). Sign with `validationSnapshot(planPath)` then persist the field. Line 423 leaves the continuation/rewritten form in `planInput`; verification at line 466 fails."
      },
      {
        "severity": "major",
        "file": "scripts/assert-automate-gate.js",
        "line": 1158,
        "claim": "Finalize passes the operator `userValidatedAt` through `userValidationOk` together with disk-authenticated evidence; evidence minting requires `proof.at !== fm.userValidatedAt` to be false.",
        "impact": "The gate stringifies `fm.userValidatedAt` for `userValidationOk`, but `readUserValidationEvidence` compares `proof.at` to the raw parsed value. If YAML yields a Date, `proof.at !== fm.userValidatedAt` is always true (string vs Date), minting returns null, and `String(date)` is not an ISO timestamp so `userValidationOk` is false even if HMAC proof is valid.",
        "recommendation": "Canonicalize `userValidatedAt` to the same ISO string in `readFinalPlan` / evidence minting and in the finalize gate; compare that string on both sides.",
        "confidence": "low",
        "reproduction": "Unquoted ISO-8601 in frontmatter parsed as Date: `readUserValidationEvidence` line 466 rejects; `String(fm.userValidatedAt)` at 1158 is a JS Date string; `userValidationOk` 337–339 returns false. Confirm against the actual `parseYaml` types in this commit."
      }
    ]
  }
};

test('actual Grok final envelope is decoded before its different report contract is rejected',async()=>{
 const f=fixture();const side=mkdtempSync(join(tmpdir(),'captured-grok-'));
 const local=executable(join(side,'local'),`process.stdin.resume();process.stdin.on('end',()=>process.stdout.write(${JSON.stringify(clean.stdout)}));`);
 const native=executable(join(side,'native'),`process.stdin.resume();process.stdin.on('end',()=>process.stdout.write(${JSON.stringify(JSON.stringify(capturedGrokPublicFinal))}));`);
 const server=await serveFlowHtml(f.html,{planPath:f.plan});
 try {
  const result=await runner.runPlanEndWorkflow({plan:f.plan,root:f.root,host:'codex',cli:'grok',args:{hostBin:local,reviewBin:native},deps:{preview:()=>server.url,open:()=>{},createPr:()=>{throw Error('must not publish');}}});
  assert.equal(result.reason,'não avanço');
  const finding=JSON.parse(readFileSync(join(f.root,'automate-run-state.json'),'utf8')).pendingStop.findings[0];
  assert.equal(finding.title,'review output missing verdict or findings');
  assert.deepEqual(JSON.parse(finding.processEvidence.external.stdout),capturedGrokPublicFinal);
  assert.equal(finding.processEvidence.external.status,0);
 }finally{await server.close();rmSync(f.root,{recursive:true,force:true});rmSync(side,{recursive:true,force:true});}
});
