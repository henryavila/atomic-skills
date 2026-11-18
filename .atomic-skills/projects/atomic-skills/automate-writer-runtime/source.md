# Automate writer runtime (1 + A + B)

Close the gap where `implement --mode=automate` documents pure-maestro but the host codes product source itself. Ship skill spawn recipe (#1), Layer 3 host-local runner (A), and plan-tree product-source fence (B).

## Principles

- **P1 Host-thin close path** — Under automate, product source reaches the plan branch only via writer branch merge; host never closes tasks on its own product commits.
- **P2 Runner is the writer channel** — Work-order, lease, sealed brief, claim validate are owned by a package CLI; skill prose points at that CLI, not a second invented protocol.
- **P3 Soft recipe, hard fence** — Spawn remains host-invoked; refuse of illegal done is machine-checked.
- **P4 No Layer 4 in this plan** — No daemon spawn adapter; no multi-host supervisor.
- **P5 Compose, do not fork** — Extend lease, claim-report, assert-automate-gate, maestro cursor; no parallel gate system.
- **P6 No second top-level skill** — Extend implement + shared assets only.

## Glossary

- **sealed brief** — Self-contained phase-writer prompt written by the runner (work-order + code-only fence); no host chat history.
- **plan-tree product fence** — Assert/done gate that rejects product path changes on plan branch not explained by claim SHAs.
- **host-local runner** — Per-host CLI (Layer 3) for prepare/validate of one phase writer cycle.
- **product path** — Path classified as product/source for fence purposes (not `.atomic-skills/` durable state).

## F0 — Skill recipe and honesty (#1)

Goal: Make Grok (and portable) phase-writer spawn instructions explicit; document guarantee limits honestly.

### T-001 Grok phase-writer spawn recipe in implement and maestro

- Files: skills/core/implement.md, skills/shared/implement-automate-maestro.md, skills/shared/implement-phase-writer.md
- scopeBoundary: Do not implement runner CLI or fence helpers. Do not invent plugin agent types beyond general-purpose explore plan. Do not enable concurrent phase writers.
- acceptance: it - Grok block documents general-purpose phase-writer spawn with worktree or cwd and constructed brief.; it - explore is reserved for heavy reads not phase coding.; it - host product coding under isAutomateActive is listed as forbidden next to the spawn recipe.; it - skill bodies keep tool abstraction via template vars or ide conditionals.
- verifier: { kind: shell, command: "node -e \"const fs=require('fs'); const a=fs.readFileSync('skills/core/implement.md','utf8'); const b=fs.readFileSync('skills/shared/implement-automate-maestro.md','utf8'); const c=fs.readFileSync('skills/shared/implement-phase-writer.md','utf8'); if(!/general-purpose/.test(a+b+c)) process.exit(1); if(!/spawn_subagent|INVESTIGATOR_TOOL|subagent/.test(a+b)) process.exit(1); console.log('ok')\"", expectExitCode: 0 }

### T-002 Antipatterns and realism honesty for 1+A+B

- Files: skills/shared/implement-antipatterns.md, docs/kb/automate-orchestrator-realism.md
- scopeBoundary: Do not claim Layer 4 is shipped. Do not remove existing Layer 1-2.5 documentation.
- acceptance: it - realism doc describes Layer 3 runner path and names scripts/automate-phase-run.js as the CLI entry once introduced.; it - antipatterns include host product coding under automate and skipping the runner when automate stamp is set.; it - guarantee language states fence blocks close not that spawn is process-forced.
- verifier: { kind: shell, command: "node -e \"const fs=require('fs'); const r=fs.readFileSync('docs/kb/automate-orchestrator-realism.md','utf8'); if(!/Layer 3/.test(r)) process.exit(1); const a=fs.readFileSync('skills/shared/implement-antipatterns.md','utf8'); if(!/Mode-1|product source|host/.test(a)) process.exit(1); console.log('ok')\"", expectExitCode: 0 }

```yaml
exit_gate:
  - id: G-F0-1
    description: Skill and docs name the Grok portable writer spawn path and honesty limits.
    verifier: { kind: shell, command: "node -e \"const fs=require('fs'); const p=['skills/core/implement.md','skills/shared/implement-automate-maestro.md','docs/kb/automate-orchestrator-realism.md']; for (const f of p){ if(!fs.existsSync(f)) process.exit(1);} console.log('ok')\"", expectExitCode: 0 }
```

## F1 — Layer 3 host-local runner (A)

Goal: Package CLI prepares one phase writer cycle and validates claims without hosting a daemon.

### T-003 Pure work-order and sealed-brief builders

- Files: src/automate-work-order.js, src/automate-sealed-brief.js, tests/automate-work-order.test.js, tests/automate-sealed-brief.test.js
- scopeBoundary: Do not spawn subagents. Do not mutate plan.md task status. Do not perform git worktree add in pure builders.
- acceptance: it - work-order includes only pending or active SPEC-admitted tasks of the phase.; it - sealed brief includes code-only fence and claim-report shape and excludes host chat history.; it - unit tests pass for missing SPEC fields fail closed.
- verifier: { kind: shell, command: "node --test tests/automate-work-order.test.js tests/automate-sealed-brief.test.js", expectExitCode: 0 }

### T-004 CLI automate-phase-run prepare and validate

- Files: scripts/automate-phase-run.js, src/automate-phase-run-lib.js, tests/automate-phase-run.test.js, docs/kb/automate-orchestrator-realism.md
- scopeBoundary: Do not call spawn_subagent from Node. Do not run orchestrator done or phase-done. Do not nest worktree under plan worktree path. Do not git-add lease secret files.
- acceptance: it - prepare exits 0 only when lease acquired and brief path exists.; it - validate exits non-zero on invalid claim report with shared SHAs without base head.; it - prepare refuses when isLeaseBlocking.; it - tests use temp dirs with no network.
- verifier: { kind: shell, command: "node --test tests/automate-phase-run.test.js", expectExitCode: 0 }

### T-005 Skill Step C points at runner

- Files: skills/core/implement.md, skills/shared/implement-automate-maestro.md, skills/shared/implement-phase-writer.md
- scopeBoundary: Do not implement fence logic. Do not hardcode absolute home paths; use package-root pattern.
- acceptance: it - maestro Step C lists prepare then spawn then validate order.; it - package-root resolution pattern matches other scripts in implement.md.; it - grep finds automate-phase-run in maestro asset.
- verifier: { kind: shell, command: "node -e \"const fs=require('fs'); const b=fs.readFileSync('skills/shared/implement-automate-maestro.md','utf8'); if(!/automate-phase-run/.test(b)) process.exit(1); console.log('ok')\"", expectExitCode: 0 }

```yaml
exit_gate:
  - id: G-F1-1
    description: Runner prepare validate covered by unit tests and skill wiring.
    verifier: { kind: shell, command: "node --test tests/automate-work-order.test.js tests/automate-sealed-brief.test.js tests/automate-phase-run.test.js", expectExitCode: 0 }
```

## F2 — Plan-tree product-source fence (B)

Goal: Under durable automate, block orchestrator done when plan-branch product paths changed outside claim-backed SHAs.

### T-006 Pure product-path classifier and fence predicate

- Files: src/automate-product-fence.js, tests/automate-product-fence.test.js
- scopeBoundary: Do not run git in the pure predicate; inject path lists. Do not change plan schema.
- acceptance: it - state paths under .atomic-skills do not trip the fence.; it - product path without claim coverage returns ok false with reason.; it - product path covered by claim paths returns ok true.; it - empty plan-branch product diff returns ok true.
- verifier: { kind: shell, command: "node --test tests/automate-product-fence.test.js", expectExitCode: 0 }

### T-007 Wire fence into assert done and orchestrator gates

- Files: src/automate-orchestrator-gates.js, scripts/assert-automate-gate.js, tests/assert-automate-gate.test.js, tests/automate-orchestrator-gates.test.js
- scopeBoundary: Do not change phase-done evaluationGate semantics beyond done path. Do not delete lastAssert behavior.
- acceptance: it - assert gate done fails closed when product fence fails under automate stamp.; it - assert still passes when claims valid and fence ok.; it - existing claim-bound done tests remain green or updated intentionally.
- verifier: { kind: shell, command: "node --test tests/assert-automate-gate.test.js tests/automate-orchestrator-gates.test.js tests/automate-product-fence.test.js", expectExitCode: 0 }

### T-008 Skill and antipattern for fence

- Files: skills/shared/implement-automate-maestro.md, skills/shared/implement-antipatterns.md, docs/kb/automate-orchestrator-realism.md
- scopeBoundary: Do not soften fence with chat waiver.
- acceptance: it - maestro Step E mentions product fence or assert done failure for plan-tree product paths.; it - antipatterns include host product commit on plan branch under automate.
- verifier: { kind: shell, command: "node -e \"const fs=require('fs'); const m=fs.readFileSync('skills/shared/implement-automate-maestro.md','utf8'); if(!/fence|product path|plan-tree product/i.test(m)) process.exit(1); console.log('ok')\"", expectExitCode: 0 }

```yaml
exit_gate:
  - id: G-F2-1
    description: Fence unit tests and assert done integration pass.
    verifier: { kind: shell, command: "node --test tests/automate-product-fence.test.js tests/assert-automate-gate.test.js", expectExitCode: 0 }
```

## F3 — Integration surface and dogfood checklist

Goal: Full suite green; install path; operator dogfood checklist for 1+A+B without claiming Layer 4.

### T-009 Full test suite and package files sanity

- Files: package.json, scripts/automate-phase-run.js, src/automate-product-fence.js, skills/core/implement.md
- scopeBoundary: Do not bump major version. Do not reintroduce gitignore mutation for .atomic-skills.
- acceptance: it - npm test exits 0.; it - scripts/automate-phase-run.js exists under scripts/.; it - package.json files array still includes scripts/ and src/.
- verifier: { kind: shell, command: "npm test", expectExitCode: 0 }

### T-010 Dogfood checklist doc

- Files: docs/kb/automate-writer-runtime-dogfood.md, docs/kb/automate-orchestrator-realism.md, .ai/memory/reference-automate-writer-runtime.md
- scopeBoundary: Do not claim dogfood already passed. Do not document Layer 4 as done.
- acceptance: it - checklist has ordered steps prepare spawn validate merge assert done.; it - checklist documents fail case for Mode-1 plan-tree product commit.; it - reference file exists for session recovery.
- verifier: { kind: shell, command: "node -e \"const fs=require('fs'); if(!fs.existsSync('docs/kb/automate-writer-runtime-dogfood.md')) process.exit(1); if(!fs.existsSync('.ai/memory/reference-automate-writer-runtime.md')) process.exit(1); console.log('ok')\"", expectExitCode: 0 }

```yaml
exit_gate:
  - id: G-F3-1
    description: Full npm test green and dogfood checklist published.
    verifier: { kind: shell, command: "npm test && test -f docs/kb/automate-writer-runtime-dogfood.md", expectExitCode: 0 }
```
