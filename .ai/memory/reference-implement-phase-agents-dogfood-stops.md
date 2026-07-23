# Dogfood stops — implement-phase-agents (host-thin automate)

**Why this exists:** 2026-07-23 dogfood session overloaded the operator with
micro-approvals and a literal `decision-review PASS` token. Henry stopped and
required re-validation: operator load under automate is **two stops per phase**,
not a chat ceremony of N pickers.

## Operator stops (exactly two per phase under automate)

1. **Phase-start package (once)**  
   Present objective + task list (id/title) + drafted BI.  
   Operator: validate/edit then **one** ratify (`ratify` / `aprovado` / clear accept).  
   **Not:** blank BI form; inventing task spine; mid-phase micro-acks.

2. **Decision-review (once, phase end)**  
   After tasks done + evaluation + review-code both are green, present the
   **decision log** (and residual majors needing disposition if any).  
   Operator: **one** clear PASS or FAIL on that log.  
   Equivalent clear PASS language is enough (`aprovado`, `PASS`, `decision-review PASS`).  
   **Do not** demand a single magic string as the only valid token.

## Host MUST NOT (dogfood / pure-maestro UX)

- Require the **literal** string `decision-review PASS` only (examples in skill
  prose are non-exhaustive).
- Insert extra operator gates between package ratify and decision-review:
  - per-finding “ok?”
  - per-fix re-approval
  - T-NNN manual re-ack when the verifier is shell and already re-verified
  - evaluation “ok?”
  - both-review “ok?” when no disposition is required
- Use repeated `ask_user_question` pickers when a single free-form ratify/PASS
  is enough.
- Run as a mega-session that makes the human the implementer; phase work stays
  in the phase writer; host is dispatch/merge/verify/state + the two hardgates.

## Host MAY still do without asking

- Spawn writer, merge, re-verify, `done`, evaluation agent, `review-code both`,
  re-dispatch fix agents (max 2) with dispositions **appended to the decision log**.
- Present progress summaries that do **not** block on operator “ok”.

## When an extra operator stop is legitimate

- **Major** review/eval findings that require disposition `accept|defer|fix`
  (record in decision log). Prefer bundling into the end decision-review
  surface rather than N mid-flight pickers when possible.
- **Blocker/critical** that needs operator stop after max re-dispatch.
- **FAIL** on decision-review (explicit).

## Session recovery

On resume of `implement-phase-agents` under `executionMode: automate`, re-read
this file + plan `executionMode: automate` + active phase handoff. Do not
re-introduce literal-token ceremony.

## Related

- Plan design: phase-start validate-only + decision-review hardgate
- Skills: `implement-automate-maestro.md`, `implement-decision-log.md`
- Plan slug: `implement-phase-agents`
