# Operator dogfood checklist — automate-default + operator gates

**Status:** checklist only — does **not** claim dogfood already passed.  
**Plan slug:** `automate-default-and-operator-gates`  
**Mode:** bare `implement` (automate **default** — pure maestro)  
**Scope of this checklist:** F0 default ON + Mode 1 escape · F1 present-before-PASS · F2 plan-end `intentVsDelivered`

Use this on a **real multi-phase plan** so the next automate run proves the three gates
**without chat memory**. Mark each item **PASS** or **FAIL**. Soft language (“looks fine”)
is invalid.

Related (host-thin phase agents, package ratify, AskUserQuestion channel, phase close):
[`docs/kb/implement-phase-agents-dogfood.md`](./implement-phase-agents-dogfood.md).

## What this checklist proves (F0–F2)

| Gate | Failure mode it catches | Machine surface |
|------|-------------------------|-----------------|
| **F0** automate default | Bare `implement` still Mode 1 / opt-in-only | `isAutomateActive({})` / parse without `--mode` |
| **F0** Mode 1 escape | No explicit non-automate path | `--mode=1` / `mode:1` → `isAutomateActive` **false** |
| **F1** read-before-PASS | Blind decision-review PASS (package not shown) | `packagePresentedAt` / `packagePath` + AskUserQuestion body |
| **F2** intent-vs-delivered | Plan-end generic review without intent vs delivered | receipt `intentVsDelivered[]`; `assert-automate-gate --gate finalize` |

## Preflight (optional machine helpers)

```bash
# Unit-level (repo checkout — no live plan required)
node --test tests/implement-mode.test.js
node --test tests/decision-review-gate.test.js
node --test tests/plan-end-review.test.js

# Live plan under durable automate (replace <slug> / <project>):
# node scripts/assert-automate-gate.js --plan <slug> --project <project> --gate phase-done
# node scripts/assert-automate-gate.js --plan <slug> --project <project> --gate finalize
```

---

## F0 — Automate default + Mode 1 escape

Bare implement must activate pure-maestro; Mode 1 requires an **explicit** escape.

| # | Check | PASS | FAIL |
|---|--------|------|------|
| A1 | **Bare implement activates automate (default / `isAutomateActive`):** session starts pure-maestro with **no** `--mode=automate` flag — absent CLI mode + no non-automate stamp + no clear → `isAutomateActive` **true** | ☐ | ☐ |
| A2 | Host runs pure-maestro Steps A–I (phase writers / host-thin), **not** Mode 1 session codes, on bare `implement` | ☐ | ☐ |
| A3 | **Mode 1 explicit escape (`--mode=1`):** `implement --mode=1` (or `mode:1` / known Mode-1 tokens: `default`, `mode1`, `1`, `session`) yields `isAutomateActive` **false** and does **not** enter pure-maestro | ☐ | ☐ |
| A4 | Explicit Mode 1 CLI overrides an automate plan stamp for the **session** coding loop (durable plan-end gates still stamp-first — see F2) | ☐ | ☐ |
| A5 | First confirmed automate entry may still stamp durable `executionMode: automate`; absence of CLI mode is **not** Mode 1 | ☐ | ☐ |

**Quick code proof (no live plan):**

```bash
node -e "
const { isAutomateActive, parseImplementMode } = require('./src/implement-mode.js');
if (isAutomateActive({}) !== true) process.exit(1);
if (isAutomateActive({ cliMode: parseImplementMode('--mode=1').mode }) !== false) process.exit(1);
console.log('ok: default ON + --mode=1 escape');
"
```

---

## F1 — Decision package before PASS (read-before-PASS / present-before-PASS)

Operator cannot PASS decision-review until the host presents the decision package in the
**same** hardgate turn. Channel is **AskUserQuestion-only** under automate.

| # | Check | PASS | FAIL |
|---|--------|------|------|
| D1 | Host builds decision package (`buildDecisionPackage` / summaryMarkdown + path to phase JSONL) before the PASS\|FAIL ask | ☐ | ☐ |
| D2 | **present-before-PASS / read-before-PASS:** package **body** (entries table / summary, or no-decisions banner) appears in the **same** AskUserQuestion turn as PASS\|FAIL — not path-only, not “package apresentado” without body | ☐ | ☐ |
| D3 | Host/agent **never** writes `decisionReview status=passed` without an **explicit operator** PASS token in that same turn | ☐ | ☐ |
| D4 | Stamp carries **`packagePresentedAt`** (ISO) and/or **`packagePath`** present evidence; under automate, phase-done **blocked** without present evidence | ☐ | ☐ |
| D5 | Decision-review channel is **AskUserQuestion-only** (PASS\|FAIL options); decline → re-Ask or STOP — **not** free-text “type decision-review PASS” recovery | ☐ | ☐ |
| D6 | Evaluation agent output and review-code receipts **never** substitute for decision-review operator PASS | ☐ | ☐ |

With present evidence missing under automate:

```bash
# Expect non-zero while decisionReview lacks packagePresentedAt/packagePath
# (or status is not passed):
node scripts/assert-automate-gate.js --plan <slug> --project <project> --gate phase-done
```

---

## F2 — Plan-end `intentVsDelivered` + finalize blocked without it

After the last phase, plan-end must compare intent vs delivered and stamp non-empty
`intentVsDelivered` rows before finalize/archive under automate.

| # | Check | PASS | FAIL |
|---|--------|------|------|
| I1 | Host builds intent + delivered surfaces (`buildIntentSurface` / `buildDeliveredSurface`) and injects the **Intent vs delivered** brief into plan-end external review | ☐ | ☐ |
| I2 | Plan-end runs **`review-code --mode=external-both` only** (receipt `mode` must be `external-both` — bare `both` fails `planEndReviewOk`) | ☐ | ☐ |
| I3 | Plan-end receipt stamps non-empty **`intentVsDelivered`** rows with `status` one of `matched` \| `partial` \| `missing` \| `extra` | ☐ | ☐ |
| I4 | **Finalize blocked without it:** empty, missing, or invalid `intentVsDelivered` under automate → `planEndReviewOk(..., { forbidSkip: true })` **false** and `assert-automate-gate --gate finalize` **exits non-zero** | ☐ | ☐ |
| I5 | Operator `userValidatedAt` / user validation remains required; skip flags do **not** bypass under durable automate | ☐ | ☐ |
| I6 | Finalize/archive durable gate is stamp-first (`isDurableAutomateActive` / `canFinalizeOrArchive`) — session clear alone does **not** open finalize while the stamp remains | ☐ | ☐ |

With empty `intentVsDelivered` under automate:

```bash
# Expect blocked / non-zero:
node scripts/assert-automate-gate.js --plan <slug> --project <project> --gate finalize
```

---

## Aggregate dogfood result

| Outcome | Mark |
|---------|------|
| **DOGFOOD PASS** — every applicable A\*, D\*, I\* row above is PASS | ☐ |
| **DOGFOOD FAIL** — any required row is FAIL | ☐ |

Do **not** mark DOGFOOD PASS in memory, plan status, or PR text until this checklist has
been used on a real plan and all required rows are PASS.

For host-thin phase-agent stops (package ratify, mid-phase micro-acks, phase close order),
complete [`implement-phase-agents-dogfood.md`](./implement-phase-agents-dogfood.md) as well —
that checklist is complementary, not a substitute for F0–F2 rows here.

## References

- Skills: `skills/core/implement.md`, `skills/shared/implement-automate-maestro.md`, `skills/shared/implement-decision-log.md`
- Default / escape: `src/implement-mode.js` (`isAutomateActive`, `parseImplementMode`)
- present-before-PASS / read-before-PASS: `src/decision-review-gate.js`, `src/decision-review-package.js`
- intentVsDelivered / finalize: `src/plan-end-review.js`, `src/plan-end-intent-surface.js`, `src/automate-orchestrator-gates.js`
- CLI: `scripts/assert-automate-gate.js` (`--gate phase-done|finalize`)
- Operator realism: `docs/kb/automate-orchestrator-realism.md`
- Sibling dogfood: `docs/kb/implement-phase-agents-dogfood.md`
