---
verdict: fail
max_severity: critical
findings_count: 7
---

## F-001 [critical] Write-through is declared globally but only gated for three transition blocks

**Evidence (file:line):** `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:24`, `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:119`, `skills/core/project.md:126`, `skills/shared/project-assets/project-transitions.md:3`, `scripts/lint-transition-emits.js:25`

**Claim:** P4 says every mutation must run `refresh-state → helper → todo_write`, but F2 only gates `done`, `reconcile`, and `phase-done`. Existing project mutation surfaces include `phase-reopen`, `switch`, `unblock`, `archive`, `push/pop`, dependency mutations, emergence mutations, etc.

**Impact:** Grok TODO can remain stale after valid state mutations while the plan still passes its gates.

**Recommendation:** Add an explicit mutation matrix and extend the structural detector, or add a sibling detector, for every status/focus-affecting mutator. Gate negative fixtures for `phase-reopen`, `switch`, `unblock`, and `archive` at minimum.

**Confidence:** High

## F-002 [critical] SessionStart reseed is promised as behavior, but the hook cannot perform `todo_write`

**Evidence (file:line):** `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:147`, `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:172`, `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:155`, `skills/shared/project-assets/hooks/session-start.sh:215`, `skills/shared/project-assets/hooks/session-start.sh:399`, `skills/shared/project-assets/hooks/README.md:33`

**Claim:** The plan says SessionStart reseeds the phase scaffold, but the hook only emits `additionalContext`. F3-G1 also only greps `skills/core/implement.md`, so no gate proves SessionStart can or does apply `todo_write`.

**Impact:** The post-compaction/start recovery guarantee is false unless a Grok agent manually follows prose. That is exactly where P5 says the harness cannot provide a snapshot.

**Recommendation:** Reframe SessionStart as a hint-only cue, and make the actual reseed an explicit Grok skill step that calls helper then `todo_write`. Add a dogfood gate specifically for session start and post-compaction reseed.

**Confidence:** High

## F-003 [major] F1 does not gate the canonical helper contract

**Evidence (file:line):** `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:88`, `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:97`, `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:109`, `meta/schemas/plan.schema.json:262`, `meta/schemas/initiative.schema.json:55`

**Claim:** F1 promises canonical labels and correct statuses, but F1-G2 only verifies that JSON parses and `j.todos` is an array. It does not prove `summary || title`, stable IDs, `merge` behavior, descriptor-only formatting, paused mapping, or phase/initiative status precedence.

**Impact:** A helper can emit structurally valid but semantically useless TODOs and still pass the phase.

**Recommendation:** Make the helper output contract explicit in F1 gates: `{merge, todos[]}`, ID shape, content format, status mapping, paused behavior, descriptor-only behavior, no-active-plan behavior, and malformed/ambiguous focus behavior.

**Confidence:** High

## F-004 [major] F0 can pass without freezing the actual contract

**Evidence (file:line):** `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:48`, `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:56`, `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:61`, `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:76`

**Claim:** F0’s goal includes label, status mapping, reseed, SoT order, and anti-proc policy, but F0-G1 only checks a KB file exists and contains either `refresh-state` or `todo_write`.

**Impact:** Later implementation phases can build against an incomplete or ambiguous contract while F0 is recorded as closed.

**Recommendation:** Split F0 into concrete greps/tests for canonical label, `summary || title`, SoT order, paused behavior, merge/replace semantics, anti-proc rule, and Grok-local scope. Keep manual PASS as supplemental, not the main proof.

**Confidence:** High

## F-005 [major] F3 verifier is a weak grep and misses required files

**Evidence (file:line):** `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:147`, `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:155`, `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:160`, `skills/core/implement.md:90`, `skills/core/implement.md:97`

**Claim:** F3 touches implement start, automate flow, reseed, and anti-proc, but F3-G1 only searches `skills/core/implement.md`. The regex `compaction|reseed|proc` is an alternation, so one incidental `proc` match can satisfy the whole second half.

**Impact:** Automate maestro, project help/start cues, and hook cues can remain unwired while the gate passes.

**Recommendation:** Require separate checks per term and per file: `skills/core/implement.md`, `skills/shared/implement-automate-maestro.md`, `skills/core/project.md`, `project-help.md`, and SessionStart hint text if retained.

**Confidence:** High

## F-006 [major] Final regression gate omits the parity it claims to protect

**Evidence (file:line):** `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:176`, `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:183`, `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:188`, `package.json:20`, `tests/install-uninstall-roundtrip.test.js:80`, `tests/install-uninstall-roundtrip.test.js:100`

**Claim:** F4 says install parity remains intact, but its shell gate runs only the two new unit tests. Existing roundtrip coverage for all public IDEs, including Grok, is not required.

**Impact:** Changes to Grok plugin skill/hook surfaces can ship with install/uninstall residue or stale rendered package behavior.

**Recommendation:** Add focused parity gates: `node --test tests/install-uninstall-roundtrip.test.js tests/render.test.js tests/compatibility.test.js`, plus hook tests if SessionStart text changes. Prefer `npm test` for final closure if runtime cost is acceptable.

**Confidence:** High

## F-007 [minor] Review metadata claims a linked design, but `references` is empty

**Evidence (file:line):** `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:199`, `.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/plan.md:228`

**Claim:** The review line says the critic-approved design is linked at `design.md`, but frontmatter has `references: []`.

**Impact:** Audit trail is weaker than claimed; future reviewers cannot follow the approved-design source from the plan metadata.

**Recommendation:** Add the design artifact to `references` or remove the “linked at design.md” claim.

**Confidence:** High