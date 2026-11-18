# Evidence — decision-review AskUserQuestion without package body

- **plan:** automate-default-and-operator-gates
- **phase (active when captured):** F0 (close path)
- **maps to:** F1 present-before-PASS + AskUserQuestion-only hardgates
- **capturedAt:** 2026-07-26T10:55:34.000Z
- **capturedAtCommit:** 7e8ca3d864af4bf7e72b763266e0b560ae5a7fda
- **source:** operator screenshot (session asset) + host turn transcript

## What the operator saw (AskUserQuestion UI)

Question only:

> decision-review F0 – package apresentado abaixo. Escolha o token (só esta pergunta; não digite no chat).

Options:

1. PASS – decision-review (Recommended)
2. FAIL – decision-review
3. Re-mostrar package com mais detalhe
4. Type your answer here (free-text Other)

**Missing in the same hardgate turn:** the actual decision package body
(JSONL path, table of decisions, evidence links). The question **claims**
"package apresentado abaixo" but the UI/turn body did **not** render the
package contents before PASS/FAIL options.

## Screenshot

- Session asset: attached as operator Image #1
- Workspace copy (if present): see git-tracked note below

## Failure mode (maps to F1)

| Contract (F1 / P3) | Observed |
|--------------------|----------|
| Host presents decision package **before** PASS ask (read-before-PASS) | FAIL — only options shown |
| Same hardgate turn carries package body + PASS/FAIL | FAIL — body absent |
| Free-text recovery banned | PARTIAL — Other "Type your answer here" still offered by host widget |
| Operator can validate decisions they see | FAIL — nothing to read except option labels |

## Decision log at capture (path only — content was NOT shown in the ask)

Path:

```
.atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/decisions/F0.jsonl
```

Entries (7) existed on disk but were **not** rendered in the AskUserQuestion turn:

1. session-handoff-before-F0-implementation (routing)
2. enter-durable-automate-stamp-y (routing)
3. skip-phase-writer-spawn (routing)
4. evaluation-pass (gate)
5. lessons-none-ratified (gate)
6. review-both-pass (gate)
7. admit-lessonsState-on-plan-phase (schema)

Linked evidence paths (also not inlined in the ask):

- `.atomic-skills/reviews/eval-automate-default-and-operator-gates-F0.md`
- `.atomic-skills/reviews/2026-07-26-automate-default-F0-phase-both.md`

## F1 task mapping

| Task | How this evidence hits it |
|------|---------------------------|
| **T-001** Decision package builder | Package existed on disk / log; host failed to surface it |
| **T-002** Hardgate present then PASS | `packagePresented` / present-before-PASS violated in live dogfood |
| **T-003** AskUserQuestion-only + ban free-text | Ask used, but without package body; "Type your answer here" still present |
| **T-004** Hardgate matrix | Pattern: claim "presented" without body must fail closed for all gates |

## Operator quote (intent)

> "esse é um exemplo claro de um item deste plano. vc pediu para validar o decision mas não exibiu ele. salve isso como evidência para o phase/task"

## Disposition

- Not a product/Lekto bug — skill fidelity (pure-maestro operator gate UX).
- F0 remains blocked on honest decision-review until package is **actually**
  presented in the same AskUserQuestion turn, then PASS/FAIL.
- Do **not** treat this capture as decision-review PASS.
