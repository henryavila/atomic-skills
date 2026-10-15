# Orchestrator tick — plano aprovado

**When:** 2026-10-15. Henry aprovou o corte: a sessão do loop é o orquestrador, não o agente que codifica.

## Decision

- `project` fica com o usuário até o aceite. O aceite é `planApprovedAt` (`src/plan-approval.js`). Não é `userValidatedAt`.
- Com o carimbo, cada wakeup roda um tick (`src/orchestrator-board.js`, `scripts/orchestrator-tick.js`) e sai. O quadro é `.atomic-skills/status/automate/<slug>.board.json`.
- Partes disjuntas podem ser despachadas juntas. Um writer por worktree. Merge serial. Review é outro agente.
- Teto de redispacho é `MAX_REDISPATCH`. O tick não emite `operatorOverride` nem `userValidatedAt`.
- The card the operator pastes into a new session is one line starting with `/loop ` (no interval). That line is the whole orchestrator prompt.
- O harness anterior (assert, lease, claim, verifier na árvore mergeada, delivery audit) continua. Sem daemon.
