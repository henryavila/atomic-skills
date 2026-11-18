# brainstorm — Interview (B0) lazy asset

Read when multi-phase `atomic-skills:brainstorm` runs B0. The Interview is
**HARD** before research-digest and before `debate --gate`. Content ratified
here lands in `design.md` (`## Interview` plus seeds for Context / Non-goals).

## Purpose

Stop premature convergence: the agent does **not** invent the problem frame alone.
The user states the problem, scope, and stakes; the agent echoes and waits for
explicit ratify. This is the **entrevista** (Interview) gate.

## HALT questions (ask all)

Use {{ASK_USER_QUESTION_TOOL}} (or equivalent structured ask). Collect concrete
answers for every field:

| Field | Ask (intent) |
|-------|----------------|
| **Problema / Problem** | What problem are we solving? One or two sentences. |
| **In-scope** | What is in scope for this design? |
| **Out-of-scope / Non-goals** | What is explicitly out of scope? |
| **Done-when (design)** | When is the *design* done (not the whole plan)? |
| **Stakes** | What is expensive to reverse? One-way doors? |
| **Fontes / Sources** | Repo paths, prior designs, constraints the agent must read. |

Optional follow-ups only when a field is blank or placeholder: primary fork,
audience, success metric for the design conversation.

## Proof-of-work (ratify)

1. Draft a spine table (or bullet list) from the user's answers — all six fields.
2. Echo it back. Ask the user to **Aprovar entrevista** / **Ajustar** / **Cancelar**
   (or EN: Approve Interview / Adjust / Cancel).
3. On adjust: apply corrections and re-echo; do not proceed on an unconfirmed draft.
4. On approve: set process receipt `interviewAccepted: true` (see
   `process-receipt.md`) and copy the ratified content into `design.md` under
   `## Interview` when writing the doc (B3).

## Bans

- **Bare `ok` / `yes` / `lgtm` / `do it` without a spine** is **not** acceptance.
  Re-prompt with the missing fields visible.
- Do **not** invent in-scope / out-of-scope the user never said.
- Do **not** skip Interview because "the goal arg is enough" or "obvious problem."
- Do **not** start B0b research or B1 debate until Interview is ratified.

## After Interview

Proceed to B0b (research-digest) per `research.md`, then B1 always
`atomic-skills:debate --gate`. Ad-hoc / single-task / `adopt` never load this
path (DESIGN-exempt lanes).
