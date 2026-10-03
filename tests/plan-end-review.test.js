import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { serveFlowHtml } from '../scripts/lib/serve-flow.js';
import { after, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  readUserValidationEvidence,
  validationSnapshot,
  productSnapshot,
  withButtonValidationTimestamp,
  planEndReviewOk,
  userValidationOk,
  automatePlanEndGatesOk,
  intentVsDeliveredOk,
  SKIP_PLAN_END_REASON_TAXONOMY,
  KNOWN_EXTERNAL_PROVIDERS,
  INTENT_VS_DELIVERED_STATUSES,
  isDurableAutomateActive,
} from '../src/plan-end-review.js';

it('snapshot framing distinguishes optional flow and decision evidence boundaries',()=>{
 const root=mkdtempSync(join(tmpdir(),'plan-end-boundaries-'));const plan=join(root,'plan.md');
 try {
  writeFileSync(plan,'---\nslug: fixture\n---\n');mkdirSync(join(root,'flow'));mkdirSync(join(root,'decisions'));
  const html=join(root,'flow/flow.html');const decision=join(root,'decisions/example.jsonl');
  const body='<html>Ratified flow</html>';const row=JSON.stringify({said:'Original intent',saw:'Original evidence'})+'\n';
  writeFileSync(html,body);writeFileSync(decision,row);
  const before=validationSnapshot(plan,{reviewInputs:true});
  writeFileSync(html,body+decision+row);rmSync(decision);
  assert.notEqual(validationSnapshot(plan,{reviewInputs:true}),before);
 } finally {rmSync(root,{recursive:true,force:true});}
});

it('last CRLF frontmatter timestamp retains one exact closing newline',()=>{
 const at='2026-10-03T12:00:00.000Z';
 assert.equal(withButtonValidationTimestamp('---\r\nuserValidatedAt: old\r\n---\r\nbody',at),`---\r\nuserValidatedAt: "${at}"\r\n---\r\nbody`);
});

it('initialized gitlinks bind clean commit identity and fail closed on every dirty submodule edit', () => {
 const tmp=mkdtempSync(join(tmpdir(),'plan-end-submodule-'));const root=join(tmp,'repo');const source=join(tmp,'module');
 mkdirSync(root);mkdirSync(source);
 const git=(cwd,args)=>{const result=spawnSync('git',['-c','user.name=fixture','-c','user.email=fixture@test',...args],{cwd,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
 try {
  git(source,['init']);writeFileSync(join(source,'source.js'),'version 1\n');git(source,['add','source.js']);git(source,['commit','-m','module fixture']);
  git(root,['init']);const plan=join(root,'plan.md');writeFileSync(plan,'---\nslug: fixture\n---\n');git(root,['add','plan.md']);git(root,['commit','-m','plan fixture']);
  git(root,['-c','protocol.file.allow=always','submodule','add',source,'vendor']);git(root,['commit','-am','add actual initialized submodule']);
  const initial=productSnapshot(plan);assert.equal(productSnapshot(plan).digest,initial.digest);
  const input=validationSnapshot(plan,{reviewInputs:true});
  const module=join(root,'vendor');writeFileSync(join(module,'source.js'),'version 2\n');
  assert.throws(()=>productSnapshot(plan),/Submodule vendor must be clean and initialized/);
  assert.throws(()=>validationSnapshot(plan,{reviewInputs:true}),/Submodule vendor must be clean and initialized/);
  writeFileSync(join(module,'source.js'),'version 3\n');
  assert.throws(()=>productSnapshot(plan),/Submodule vendor must be clean and initialized/);
  git(module,['add','source.js']);git(module,['commit','-m','changed module commit']);
  assert.notEqual(productSnapshot(plan).digest,initial.digest);
  assert.notEqual(validationSnapshot(plan,{reviewInputs:true}),input);
  const checkout=productSnapshot(plan);git(root,['add','vendor']);assert.notEqual(productSnapshot(plan).digest,checkout.digest);
  writeFileSync(join(module,'untracked.js'),'unreviewed source\n');
  assert.throws(()=>productSnapshot(plan),/Submodule vendor must be clean and initialized/);
 } finally {rmSync(tmp,{recursive:true,force:true});}
});

const signingHome=mkdtempSync(join(tmpdir(),'final-signing-home-'));
const previousSigningHome=process.env.HOME, previousSigningProfile=process.env.USERPROFILE;
process.env.HOME=signingHome;process.env.USERPROFILE=signingHome;
after(()=>{if(previousSigningHome===undefined) delete process.env.HOME;else process.env.HOME=previousSigningHome;if(previousSigningProfile===undefined) delete process.env.USERPROFILE;else process.env.USERPROFILE=previousSigningProfile;rmSync(signingHome,{recursive:true,force:true});});

const buttonDir=mkdtempSync(join(tmpdir(),'plan-end-button-'));
const buttonPlan=join(buttonDir,'plan.md');
writeFileSync(buttonPlan,'---\nslug: fixture\nphases:\n - id: F0\n   deliveryAuditGate:\n     status: passed\n---\n');
mkdirSync(join(buttonDir,'flow'));writeFileSync(join(buttonDir,'flow/flow.html'),'<html>Preview</html>');
writeFileSync(join(buttonDir,'audit.json'), JSON.stringify({verdict:'CLOSED', findings:[]}));
writeFileSync(join(buttonDir,'automate-plan-end-review.json'), JSON.stringify({
 mode:'external-both', reviewFile:'audit.json', verifiedAt:'2026-10-02T12:00:00Z',
 legs:[{provider:'grok',status:'succeeded',familyDifferent:true}],
 intentVsDelivered:[{status:'matched'}],
 reviewInputSnapshot:validationSnapshot(buttonPlan,{reviewInputs:true}),
}));
const buttonServer=await serveFlowHtml(join(buttonDir,'flow/flow.html'),{planPath:buttonPlan});
const buttonOrigin=new URL(buttonServer.url).origin;
const buttonPage=await fetch(buttonOrigin+'/final');const buttonToken=(await buttonPage.text()).match(/name="token" value="([^"]+)"/)[1];
assert.equal((await fetch(buttonOrigin+'/api/validate',{method:'POST',headers:{origin:buttonOrigin,cookie:buttonPage.headers.get('set-cookie').split(';')[0]},body:new URLSearchParams({token:buttonToken})})).status,200);
await buttonServer.close();
const buttonAt=JSON.parse(readFileSync(join(buttonDir,'final-validation.json'),'utf8')).proof.at;
const buttonEvidence=readUserValidationEvidence(buttonPlan);
after(()=>rmSync(buttonDir,{recursive:true,force:true}));

/** Minimal valid intent-vs-delivered rows for automate receipts (F2). */
const SAMPLE_INTENT_VS_DELIVERED = [
  {
    id: 'ivd:demo-1',
    label: 'Ship intent-vs-delivered gate',
    status: 'matched',
  },
  {
    id: 'ivd:demo-2',
    label: 'Mode 1 explicit escape',
    status: 'partial',
  },
];

/** Non-skip success path requires full receipt shape (Fix A). */
function shapedOk(overrides = {}) {
  return {
    mode: 'external-both',
    reviewFile: '.atomic-skills/reviews/2026-07-17-demo-plan-end.md',
    verifiedAt: '2026-07-17T12:00:00.000Z',
    legs: [{ provider: 'codex', status: 'succeeded', familyDifferent: true }],
    intentVsDelivered: SAMPLE_INTENT_VS_DELIVERED,
    ...overrides,
  };
}

describe('planEndReviewOk', () => {
  it('is false when receipt is missing', () => {
    assert.equal(planEndReviewOk(null), false);
    assert.equal(planEndReviewOk(undefined), false);
  });

  it('is true when ≥1 family-different external leg has status succeeded + receipt shape', () => {
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [
            { provider: 'codex', status: 'succeeded', familyDifferent: true },
            { provider: 'grok', status: 'failed', familyDifferent: true },
          ],
        }),
      ),
      true,
    );
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [
            { provider: 'codex', status: 'succeeded', familyDifferent: true },
            { provider: 'grok', status: 'skipped', familyDifferent: true },
          ],
        }),
      ),
      true,
    );
  });

  it('is true when skipPlanEndReview true with non-empty reason outside automate (forbidSkip off)', () => {
    assert.equal(
      planEndReviewOk({
        legs: [
          { provider: 'codex', status: 'failed' },
          { provider: 'grok', status: 'failed' },
        ],
        skipPlanEndReview: true,
        skipReason: 'operator accepted residual risk for dogfood',
      }),
      true,
    );
  });

  it('is false when skipPlanEndReview set but forbidSkip/durableAutomate (mandatory review)', () => {
    const skipReceipt = {
      legs: [
        { provider: 'codex', status: 'failed' },
        { provider: 'grok', status: 'failed' },
      ],
      skipPlanEndReview: true,
      skipReason: 'operator accepted residual risk for dogfood',
    };
    assert.equal(planEndReviewOk(skipReceipt, { forbidSkip: true }), false);
    assert.equal(planEndReviewOk(skipReceipt, { durableAutomate: true }), false);
  });

  it('is false when all legs skipped/failed and no skip reason', () => {
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [
            { provider: 'codex', status: 'skipped' },
            { provider: 'grok', status: 'failed' },
          ],
        }),
      ),
      false,
    );
    assert.equal(
      planEndReviewOk({
        legs: [
          { provider: 'codex', status: 'failed' },
          { provider: 'grok', status: 'failed' },
        ],
        skipPlanEndReview: true,
        skipReason: '',
      }),
      false,
    );
    assert.equal(
      planEndReviewOk({
        legs: [
          { provider: 'codex', status: 'failed' },
        ],
        skipPlanEndReview: true,
      }),
      false,
    );
    assert.equal(planEndReviewOk({ legs: [] }), false);
  });

  it('single remaining leg after host filter counts when succeeded + shape', () => {
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [{ provider: 'codex', status: 'succeeded', familyDifferent: true }],
        }),
      ),
      true,
    );
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [{ provider: 'grok', status: 'succeeded', familyDifferent: true }],
        }),
      ),
      true,
    );
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [{ provider: 'codex', status: 'failed', familyDifferent: true }],
        }),
      ),
      false,
    );
  });

  it('does not count leg with familyDifferent === false even if succeeded', () => {
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [
            { provider: 'codex', status: 'succeeded', familyDifferent: false },
            { provider: 'grok', status: 'failed', familyDifferent: true },
          ],
        }),
      ),
      false,
    );
  });

  it('fail-closed: missing familyDifferent does NOT count (strict true required)', () => {
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [{ provider: 'codex', status: 'succeeded' }],
        }),
      ),
      false,
    );
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [{ provider: 'grok', status: 'succeeded', familyDifferent: undefined }],
        }),
      ),
      false,
    );
  });

  it('fail-closed: missing or unknown provider does not count even if succeeded + familyDifferent', () => {
    assert.equal(
      planEndReviewOk(shapedOk({ legs: [{ status: 'succeeded', familyDifferent: true }] })),
      false,
    );
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [{ provider: 'local', status: 'succeeded', familyDifferent: true }],
        }),
      ),
      false,
    );
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [{ provider: '', status: 'succeeded', familyDifferent: true }],
        }),
      ),
      false,
    );
  });

  it('claude is a known external provider and counts when succeeded + familyDifferent', () => {
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [{ provider: 'claude', status: 'succeeded', familyDifferent: true }],
        }),
      ),
      true,
    );
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [
            { provider: 'claude', status: 'succeeded', familyDifferent: true },
            { provider: 'codex', status: 'skipped', familyDifferent: true },
            { provider: 'grok', status: 'skipped', familyDifferent: true },
          ],
        }),
      ),
      true,
    );
  });

  it('fail-closed: same-family succeeded (familyDifferent false) with known provider does not count', () => {
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [{ provider: 'codex', status: 'succeeded', familyDifferent: false }],
        }),
      ),
      false,
    );
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [{ provider: 'grok', status: 'succeeded', familyDifferent: false }],
        }),
      ),
      false,
    );
  });

  it('only known external providers codex|grok|claude count when succeeded + familyDifferent true', () => {
    assert.equal(
      planEndReviewOk(
        shapedOk({
          legs: [
            { provider: 'local', status: 'succeeded', familyDifferent: true },
            { provider: 'codex', status: 'succeeded', familyDifferent: true },
          ],
        }),
      ),
      true,
    );
  });

  it('finalize-shaped receipt with reviewFile/mode/verifiedAt passes when a leg succeeded', () => {
    assert.equal(
      planEndReviewOk({
        mode: 'external-both',
        range: 'origin/develop...HEAD',
        reviewFile: '.atomic-skills/reviews/2026-07-17-1200-demo-plan-end.md',
        verifiedAt: '2026-07-17T12:00:00.000Z',
        legs: [
          { provider: 'codex', status: 'succeeded', familyDifferent: true },
          { provider: 'grok', status: 'skipped', familyDifferent: true },
        ],
      }),
      true,
    );
  });

  it('F5: accepts only mode external-both on non-skip path (rejects bare both)', () => {
    assert.equal(planEndReviewOk(shapedOk({ mode: 'both' })), false);
    assert.equal(planEndReviewOk(shapedOk({ mode: 'external-both' })), true);
    assert.equal(planEndReviewOk(shapedOk({ mode: 'local' })), false);
    assert.equal(planEndReviewOk(shapedOk({ mode: '' })), false);
  });

  it('non-skip path requires non-empty reviewFile + mode + verifiedAt even with succeeded leg', () => {
    const leg = [{ provider: 'codex', status: 'succeeded', familyDifferent: true }];
    assert.equal(
      planEndReviewOk({ legs: leg }),
      false,
      'bare legs without shape must fail',
    );
    assert.equal(
      planEndReviewOk({
        legs: leg,
        mode: 'external-both',
        verifiedAt: '2026-07-17T12:00:00.000Z',
      }),
      false,
      'missing reviewFile',
    );
    assert.equal(
      planEndReviewOk({
        legs: leg,
        reviewFile: '  ',
        mode: 'external-both',
        verifiedAt: '2026-07-17T12:00:00.000Z',
      }),
      false,
      'whitespace reviewFile',
    );
    assert.equal(
      planEndReviewOk({
        legs: leg,
        reviewFile: '.atomic-skills/reviews/x.md',
        verifiedAt: '2026-07-17T12:00:00.000Z',
      }),
      false,
      'missing mode',
    );
    assert.equal(
      planEndReviewOk({
        legs: leg,
        reviewFile: '.atomic-skills/reviews/x.md',
        mode: 'external-both',
      }),
      false,
      'missing verifiedAt',
    );
    assert.equal(
      planEndReviewOk({
        legs: leg,
        reviewFile: '.atomic-skills/reviews/x.md',
        mode: 'external-both',
        verifiedAt: '   ',
      }),
      false,
      'whitespace verifiedAt',
    );
    assert.equal(
      planEndReviewOk({
        legs: leg,
        reviewFile: '.atomic-skills/reviews/x.md',
        mode: 'external-both',
        verifiedAt: 'not-a-date',
      }),
      false,
      'unparseable verifiedAt',
    );
  });

  it('skip path still works without legs/shape when skipPlanEndReview + non-empty reason', () => {
    assert.equal(
      planEndReviewOk({
        skipPlanEndReview: true,
        skipReason: 'no-family-different-provider',
      }),
      true,
    );
  });

  it('finalize-shaped receipt with skip-plan-end-review reason taxonomy passes without success legs', () => {
    for (const reason of SKIP_PLAN_END_REASON_TAXONOMY) {
      assert.equal(
        planEndReviewOk({
          mode: 'external-both',
          reviewFile: '.atomic-skills/reviews/2026-07-17-skip.md',
          legs: [
            { provider: 'codex', status: 'skipped', familyDifferent: true },
            { provider: 'grok', status: 'skipped', familyDifferent: true },
          ],
          skipPlanEndReview: true,
          skipReason: reason,
        }),
        true,
        `expected true for taxonomy reason ${reason}`,
      );
    }
  });

  it('exports non-empty skip reason taxonomy for guided --skip-plan-end-review', () => {
    assert.ok(Array.isArray(SKIP_PLAN_END_REASON_TAXONOMY));
    assert.ok(SKIP_PLAN_END_REASON_TAXONOMY.length >= 1);
    assert.ok(SKIP_PLAN_END_REASON_TAXONOMY.includes('no-family-different-provider'));
    assert.ok(SKIP_PLAN_END_REASON_TAXONOMY.includes('operator-accepted-residual-risk'));
  });

  it('F2: empty or missing intentVsDelivered fails planEndReviewOk under automate (forbidSkip)', () => {
    const base = shapedOk({ intentVsDelivered: undefined });
    delete base.intentVsDelivered;
    assert.equal(planEndReviewOk(base, { forbidSkip: true }), false);
    assert.equal(planEndReviewOk(base, { durableAutomate: true }), false);
    assert.equal(
      planEndReviewOk(shapedOk({ intentVsDelivered: [] }), { forbidSkip: true }),
      false,
    );
    assert.equal(
      planEndReviewOk(
        shapedOk({ intentVsDelivered: [{ label: 'x', status: 'unknown' }] }),
        { forbidSkip: true },
      ),
      false,
    );
  });

  it('F2: non-empty intentVsDelivered with matched|partial|missing|extra passes under automate', () => {
    for (const status of INTENT_VS_DELIVERED_STATUSES) {
      assert.equal(
        planEndReviewOk(
          shapedOk({
            intentVsDelivered: [{ id: 'r1', label: `row-${status}`, status }],
          }),
          { forbidSkip: true },
        ),
        true,
        `expected true for status ${status}`,
      );
    }
  });

  it('F2: intentVsDelivered optional outside automate (forbidSkip off)', () => {
    const bare = shapedOk({ intentVsDelivered: undefined });
    delete bare.intentVsDelivered;
    assert.equal(planEndReviewOk(bare), true);
    assert.equal(planEndReviewOk(shapedOk({ intentVsDelivered: [] })), true);
  });
});

describe('intentVsDeliveredOk', () => {
  it('false for empty missing non-array or bad status', () => {
    assert.equal(intentVsDeliveredOk(null), false);
    assert.equal(intentVsDeliveredOk(undefined), false);
    assert.equal(intentVsDeliveredOk([]), false);
    assert.equal(intentVsDeliveredOk('matched'), false);
    assert.equal(intentVsDeliveredOk([{ status: 'nope' }]), false);
    assert.equal(intentVsDeliveredOk([null]), false);
  });

  it('true for non-empty rows with allowed statuses', () => {
    assert.equal(
      intentVsDeliveredOk([
        { status: 'matched' },
        { status: 'partial' },
        { status: 'missing' },
        { status: 'extra' },
      ]),
      true,
    );
  });
});

describe('userValidationOk', () => {
  it('true when automate is not active (gate only applies under automate)', () => {
    assert.equal(userValidationOk({ automateActive: false }), true);
    assert.equal(
      userValidationOk({ automateActive: false, userValidatedAt: undefined }),
      true,
    );
    assert.equal(
      userValidationOk({ automateActive: false, userValidatedAt: '' }),
      true,
    );
    assert.equal(
      userValidationOk({ automateActive: false, userValidatedAt: 'not-a-date' }),
      true,
    );
  });

  // Callers MUST pass automateActive: true explicitly for automate gates.
  // Omission means the gate is inactive (non-automate path) — do not treat as fail-closed.
  it('omitted automateActive means gate inactive: userValidationOk({}) returns true', () => {
    assert.equal(userValidationOk({}), true);
    assert.equal(userValidationOk(), true);
    assert.equal(
      userValidationOk({ userValidatedAt: 'garbage' }),
      true,
    );
  });

  it('false when userValidatedAt missing/empty under automate', () => {
    assert.equal(userValidationOk({ automateActive: true }), false);
    assert.equal(
      userValidationOk({ automateActive: true, userValidatedAt: undefined }),
      false,
    );
    assert.equal(
      userValidationOk({ automateActive: true, userValidatedAt: null }),
      false,
    );
    assert.equal(
      userValidationOk({ automateActive: true, userValidatedAt: '' }),
      false,
    );
    assert.equal(
      userValidationOk({ automateActive: true, userValidatedAt: '   ' }),
      false,
    );
  });

  it('false for non-ISO / invalid timestamps under automate', () => {
    for (const bad of ['ok', 'yes', '0', 'not-a-date', 'true', '12345', 'July 17 2026']) {
      assert.equal(
        userValidationOk({ automateActive: true, userValidatedAt: bad }),
        false,
        `expected false for ${JSON.stringify(bad)}`,
      );
    }
  });

  it('requires authenticated button evidence and rejects session ISO timestamps', () => {
    assert.equal(userValidationOk({automateActive:true,userValidatedAt:buttonAt,userValidationEvidence:buttonEvidence}),true);
    for(const at of ['2026-07-17T19:00:00.000Z','2026-07-17T19:00:00Z','2026-07-17',buttonAt]) {
      assert.equal(userValidationOk({automateActive:true,userValidatedAt:at,validatorId:'operator-henry'}),false);
    }
    assert.equal(userValidationOk({automateActive:true,userValidatedAt:buttonAt,userValidationEvidence:{at:buttonAt}}),false);
  });

  it('optional validatorId does not alone satisfy the gate', () => {
    assert.equal(
      userValidationOk({
        automateActive: true,
        userValidatedAt: '',
        validatorId: 'operator-henry',
      }),
      false,
    );
  });
});

describe('automatePlanEndGatesOk (finalize/archive combined)', () => {
  const goodReceipt = {
    mode: 'external-both',
    reviewFile: '.atomic-skills/reviews/2026-07-17-demo-plan-end.md',
    verifiedAt: '2026-07-17T12:00:00.000Z',
    legs: [{ provider: 'codex', status: 'succeeded', familyDifferent: true }],
    intentVsDelivered: SAMPLE_INTENT_VS_DELIVERED,
  };
  const goodAt = buttonAt;

  it('inactive when automateActive is not true and no automate stamp', () => {
    assert.deepEqual(automatePlanEndGatesOk({}), {
      ok: true,
      planEndReviewOk: true,
      userValidationOk: true,
      reviewSkipForbidden: false,
    });
    assert.deepEqual(
      automatePlanEndGatesOk({ automateActive: false, receipt: null }),
      {
        ok: true,
        planEndReviewOk: true,
        userValidationOk: true,
        reviewSkipForbidden: false,
      },
    );
  });

  it('fail-closed: planExecutionMode automate enforces gates even when automateActive omitted', () => {
    const r = automatePlanEndGatesOk({
      planExecutionMode: 'automate',
      receipt: null,
      userValidatedAt: goodAt,
      userValidationEvidence: buttonEvidence,
    });
    assert.equal(r.ok, false);
    assert.equal(r.planEndReviewOk, false);
    assert.equal(r.userValidationOk, true);
  });

  it('fail-closed: stamp automate + missing userValidatedAt blocks even without automateActive', () => {
    const r = automatePlanEndGatesOk({
      planExecutionMode: 'automate',
      receipt: goodReceipt,
    });
    assert.equal(r.ok, false);
    assert.equal(r.planEndReviewOk, true);
    assert.equal(r.userValidationOk, false);
  });

  it('stamp automate + good receipt + ISO userValidatedAt ok without automateActive flag', () => {
    const r = automatePlanEndGatesOk({
      planExecutionMode: 'automate',
      receipt: goodReceipt,
      userValidatedAt: goodAt,
      userValidationEvidence: buttonEvidence,
    });
    assert.deepEqual(r, {
      ok: true,
      planEndReviewOk: true,
      userValidationOk: true,
      reviewSkipForbidden: true,
    });
  });

  it('F4: durable gates use stamp only — cliMode=1 does NOT skip finalize gates', () => {
    const r = automatePlanEndGatesOk({
      planExecutionMode: 'automate',
      cliMode: '1',
      receipt: null,
      userValidatedAt: undefined,
    });
    assert.equal(r.ok, false, 'session Mode-1 override must not disable durable stamp gates');
    assert.equal(r.planEndReviewOk, false);
    assert.equal(r.userValidationOk, false);
  });

  it('F4: clearExecutionMode alone does NOT disable durable stamp gates', () => {
    const r = automatePlanEndGatesOk({
      planExecutionMode: 'automate',
      clearExecutionMode: true,
      receipt: null,
    });
    assert.equal(
      r.ok,
      false,
      'must clearExecutionModeStamp (remove stamp) to leave durable gates',
    );
  });

  it('F4: after clearExecutionModeStamp, durable gates inactive', () => {
    const r = automatePlanEndGatesOk({
      planExecutionMode: undefined,
      clearExecutionMode: true,
      receipt: null,
    });
    assert.equal(r.ok, true);
  });

  it('clearly non-automate planExecutionMode stays ok true', () => {
    const r = automatePlanEndGatesOk({
      planExecutionMode: 'mode1',
      receipt: null,
    });
    assert.equal(r.ok, true);
  });

  it('HARD-BLOCKs finalize/archive under automate when receipt missing', () => {
    const r = automatePlanEndGatesOk({
      automateActive: true,
      receipt: null,
      userValidatedAt: goodAt,
      userValidationEvidence: buttonEvidence,
    });
    assert.equal(r.ok, false);
    assert.equal(r.planEndReviewOk, false);
    assert.equal(r.userValidationOk, true);
  });

  it('HARD-BLOCKs when all legs failed/skipped without skip reason', () => {
    const r = automatePlanEndGatesOk({
      automateActive: true,
      receipt: {
        mode: 'external-both',
        reviewFile: '.atomic-skills/reviews/x.md',
        verifiedAt: '2026-07-17T12:00:00.000Z',
        legs: [
          { provider: 'codex', status: 'failed', familyDifferent: true },
          { provider: 'grok', status: 'skipped', familyDifferent: true },
        ],
      },
      userValidatedAt: goodAt,
      userValidationEvidence: buttonEvidence,
    });
    assert.equal(r.ok, false);
    assert.equal(r.planEndReviewOk, false);
  });

  it('HARD-BLOCKs when skipPlanEndReview without non-empty reason', () => {
    const r = automatePlanEndGatesOk({
      automateActive: true,
      receipt: {
        legs: [],
        skipPlanEndReview: true,
        skipReason: '   ',
      },
      userValidatedAt: goodAt,
      userValidationEvidence: buttonEvidence,
    });
    assert.equal(r.ok, false);
    assert.equal(r.planEndReviewOk, false);
  });

  it('HARD-BLOCKs when userValidatedAt missing under automate even if receipt ok', () => {
    const r = automatePlanEndGatesOk({
      automateActive: true,
      receipt: goodReceipt,
    });
    assert.equal(r.ok, false);
    assert.equal(r.planEndReviewOk, true);
    assert.equal(r.userValidationOk, false);
  });

  it('ok when succeeded family-different leg + ISO userValidatedAt', () => {
    const r = automatePlanEndGatesOk({
      automateActive: true,
      receipt: goodReceipt,
      userValidatedAt: goodAt,
      userValidationEvidence: buttonEvidence,
    });
    assert.deepEqual(r, {
      ok: true,
      planEndReviewOk: true,
      userValidationOk: true,
      reviewSkipForbidden: true,
    });
  });

  it('HARD-BLOCKs skip-plan-end-review under durable automate even with non-empty reason', () => {
    const r = automatePlanEndGatesOk({
      automateActive: true,
      receipt: {
        skipPlanEndReview: true,
        skipReason: 'no-family-different-provider',
        legs: [{ provider: 'codex', status: 'skipped', familyDifferent: false }],
      },
      userValidatedAt: goodAt,
      userValidationEvidence: buttonEvidence,
    });
    assert.equal(r.ok, false);
    assert.equal(r.planEndReviewOk, false);
    assert.equal(r.userValidationOk, true);
    assert.equal(r.reviewSkipForbidden, true);
  });

  it('HARD-BLOCKs skip under stamp alone (session clear does not reopen skip)', () => {
    const r = automatePlanEndGatesOk({
      planExecutionMode: 'automate',
      clearExecutionMode: true,
      receipt: {
        skipPlanEndReview: true,
        skipReason: 'operator-accepted-residual-risk',
      },
      userValidatedAt: goodAt,
      userValidationEvidence: buttonEvidence,
    });
    assert.equal(r.ok, false);
    assert.equal(r.planEndReviewOk, false);
  });

  it('F2: empty intentVsDelivered fails under automate including session default', () => {
    const withoutIvd = {
      mode: 'external-both',
      reviewFile: '.atomic-skills/reviews/2026-07-17-demo-plan-end.md',
      verifiedAt: '2026-07-17T12:00:00.000Z',
      legs: [{ provider: 'codex', status: 'succeeded', familyDifferent: true }],
    };
    const stamp = automatePlanEndGatesOk({
      planExecutionMode: 'automate',
      receipt: withoutIvd,
      userValidatedAt: goodAt,
      userValidationEvidence: buttonEvidence,
    });
    assert.equal(stamp.ok, false);
    assert.equal(stamp.planEndReviewOk, false);

    const sessionDefault = automatePlanEndGatesOk({
      automateActive: true,
      receipt: { ...withoutIvd, intentVsDelivered: [] },
      userValidatedAt: goodAt,
      userValidationEvidence: buttonEvidence,
    });
    assert.equal(sessionDefault.ok, false);
    assert.equal(sessionDefault.planEndReviewOk, false);
  });

  it('F2: intentVsDelivered rows with status matched|partial|missing|extra open finalize with userValidatedAt', () => {
    const r = automatePlanEndGatesOk({
      automateActive: true,
      receipt: {
        ...goodReceipt,
        intentVsDelivered: [
          { label: 'goal', status: 'matched' },
          { label: 'extra path', status: 'extra' },
          { label: 'pending', status: 'missing' },
          { label: 'wip', status: 'partial' },
        ],
      },
      userValidatedAt: goodAt,
      userValidationEvidence: buttonEvidence,
    });
    assert.equal(r.ok, true);
    assert.equal(r.planEndReviewOk, true);
  });
});

describe('isDurableAutomateActive (H1)', () => {
  it('true on stamp alone even with clearExecutionMode', () => {
    assert.equal(
      isDurableAutomateActive({
        planExecutionMode: 'automate',
        clearExecutionMode: true,
      }),
      true,
    );
  });
  it('KNOWN_EXTERNAL_PROVIDERS is codex|grok|claude', () => {
    assert.deepEqual([...KNOWN_EXTERNAL_PROVIDERS].sort(), ['claude', 'codex', 'grok'].sort());
  });
});
