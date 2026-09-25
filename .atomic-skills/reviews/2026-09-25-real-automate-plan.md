# review-plan real-automate

provider: codex
host: grok
mode: both
model: cli-default (pass 1 reported reviewer gpt-6)
sameFamilyRemap: false

## Local fix log

Compared the plan with `.ai/memory/decisao-unattended-bloco.md`.

Applied in the plan file before the external pass:

- F0 start must use a plan fixture, not `projects/atomic-skills/real-automate/source.md`.
- F0 must prove the hook returns 2 on a synthetic write.
- F4 audit stays on every phase close. The final page does not replace that gate.

Applied after Codex pass 1, because they contradict the text just written or name a gate that could not be executed:

- F-002: probe lock is not `pen.lock`. Unlocked hook stays exit 0. Probe lock makes a synthetic write exit 2, then the probe lock is removed. F0 still does not take the operational lock.
- F-003: chat shell stays denied. The program runs verifiers. The writer shell does not.
- F-004: `pen.lock` has owner and pid. Dead pid does not keep the session blocked. Child is stopped before release.
- F-005: the architecture stamp records which sketch was chosen. The prototype cites that choice.
- F-006: F4 exit gate names the three checks instead of "os três testes acima".

Applied after the operator chose apply on F-001:

- The start gate requires a real write through the active host's tool. That write must be refused and must not create a file. A script-only exit 2 is not enough. Without that proof the program does not start.

Initiative file `.atomic-skills/projects/atomic-skills/real-automate/phases/f0-partida-que-recusa.md` was not edited inside the review. Synced afterward, with `source.md` and the F1/F3/F4 sidecars, to this plan frontmatter: probe lock, real host write, fixture plan.md, chosen sketch, lock owner and pid, named F4 checks.

## External findings (codex pass 1)

Verdict: needs_changes. counts: blocker 0, critical 1, major 5.

F-001 critical. Direct hook execution does not prove the host calls the hook. Recommendation: probe through the host's tool dispatch.

F-002 major. Preflight demanded exit 2 without the lock the hook needs. Resolved in the plan by an isolated probe lock.

F-003 major. Shell deny also blocks the writer's checks. Resolved by moving verifiers to the program.

F-004 major. Lock had no owner or crash recovery. Resolved in the F3 goal.

F-005 major. Two sketches without a recorded choice. Resolved by requiring the chosen sketch on the stamp.

F-006 major. F4 gate said "three tests above" without names. Resolved by naming the checks.
