Track the current workstream with concrete evidence.

## Fundamental Rule

NO STATUS WITHOUT EVIDENCE.
Do not treat inference as truth. If something is not confirmed, say so
explicitly and show the evidence you used.

## Process

### 1. Resolve context

- Read `docs/superpowers/status/_map.yml`, if it exists.
- Read `docs/superpowers/status/_map.md`, if it exists.
- Read `docs/superpowers/status/index.md` and the detailed workstream file, if they exist.
- Identify candidate workstreams.

### 2. Resolve the workstream

- Work on one workstream at a time.
- If there is real ambiguity between plausible candidates, ask which workstream the user wants to inspect.
- If there is one dominant workstream with sufficient evidence, continue directly.

### 3. Discover artifacts and collect evidence

- Use `_map.yml` first and heuristics only as fallback.
- Do not assume fixed paths for design, spec, or plan artifacts.
- When resolving identity and artifact mapping, use this precedence:
  1. explicit user correction in the current session
  2. `_map.yml`
  3. canonical workstream file
  4. `index.md`
  5. heuristics
- When resolving workstream state, use this precedence:
  1. explicit user correction in the current session
  2. canonical workstream file
  3. `index.md`
  4. provisional state derived from evidence
  5. heuristics
- Collect evidence from git, diff, tests, reviews, validations, and project artifacts.

### 4. Classify the state

- Use these internal canonical tokens:
  - `design`
  - `spec`
  - `plan`
  - `code`
  - `verification`
  - `finish`
- In visible user-facing output, render them as:
  - `Design`
  - `Specification`
  - `Planning`
  - `Implementation`
  - `Verification`
  - `Finalization`
- Keep `lifecycle` and `confidence` separate.
- Visible lifecycle states in the report:
  - `not started`
  - `in progress`
  - `blocked`
  - `done`
  - `skipped`
  - `not applicable`
- Confidence classes:
  - `confirmed`
  - `inferred`
  - `unknown`
- Count `reviews` by stage separately from `verifications`.
- Do not let inferred-but-unconfirmed completion increase structural progress.

### 5. Handle pending inferences

- Show one inference at a time.
- List the hypothesis and concrete evidence.
- Ask the user to `confirm`, `reject`, or `defer`.
- If the user rejects an inference, correct canonical state and `_map.yml` when the mistake is in mapping.

### 6. Offer canonical persistence

- If the run materially improves clarity, offer to update:
  - `docs/superpowers/status/_map.md`, when human repository notes should be preserved
  - `docs/superpowers/status/index.md`
  - `docs/superpowers/status/<workstream>.md`
  - `docs/superpowers/status/_map.yml`, when discovery rules need correction
- Do not force writes during ordinary read-only runs without a change in canonical understanding.

### 7. Emit the final report

Format the report for fast CLI reading:

- First line: the workstream name in uppercase, with no label.
- Then:
  - `Repo: ...`
  - `Data: ...`
- Use uppercase block titles. If the client visibly supports ANSI, you may color only the block titles. The report must remain readable without color.
- Inside each block, start field labels with uppercase letters.
- Never use internal IDs like `Task 1` in the main view. Always translate them into concrete human actions.

Block order:

1. `SUMMARY`
2. `PENDING INFERENCE`, only when one exists
3. `PIPELINE`
4. `DONE`
5. `IN PROGRESS`
6. `NEXT`
7. `BLOCKERS`
8. `VERIFICATIONS BY STAGE`
9. `EVIDENCE`, only when there is ambiguity, conflict, or a relevant inference

### 8. SUMMARY format

Use exactly these fields:

- `Objective`
- `Now`
- `Current stage`
- `Already done`
- `Still missing`
- `Next action`

Keep `Already done` and `Still missing` short and dense. Do not turn the summary into a changelog.

### 9. PIPELINE format

- Always show all 6 canonical stages.
- Use fixed-width, aligned columns suitable for terminal output.
- Each line must show:
  - stage
  - state
  - total reviews
  - short summary
  - next action
- The current stage must have stronger emphasis, with a visual prefix. If visible color is available, it may also use color.
- Future stages should appear more subdued.
- `stage`, `state`, and `reviews` do not wrap.
- `short summary` and `next action` may continue on the next line.
- When there is a continuation line, align it with the left edge of its own column so the layout does not look broken.

Example direction:

```text
PIPELINE
> Design          done         reviews: 1   format defined                -
> Specification   done         reviews: 2   specification approved        -
* Planning        in progress  reviews: 3   plan reviewed                 save final version
  Implementation  not started  reviews: 0   metadata and prompts pending  register skill in catalog
```

### 10. VERIFICATIONS BY STAGE format

Use a separate block, one line per stage:

```text
VERIFICATIONS BY STAGE
- Design: 0
- Specification: 1
- Planning: 0
- Implementation: 3
- Verification: 2
- Finalization: 0
```

## Red Flags

- "The file exists, so it must be done"
- "The plan says one thing, but I can guess the rest"
- "I can show `Task 1` in the report, the user will understand"
- "I should hide ambiguity to keep the report clean"
- "Color alone solves readability"

If you thought any of the above: STOP. Fix the report structure.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "More detail always helps" | Detail without hierarchy destroys scanability |
| "The pipeline can carry everything" | The pipeline is for stages; concrete work lives outside it |
| "I inferred it with high confidence, so I can assume it" | No. Show the evidence and ask for approval |
| "A pretty table is enough" | Without good structure, a table only organizes confusion |
