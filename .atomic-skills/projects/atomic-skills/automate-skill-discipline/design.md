# Design — Automate skill discipline remediation

## Context

`implement --mode=automate` landed as **pure maestro** (plan `implementation-automate-mode`, archived): opt-in stamp, code-only phase writer, fixed evaluation order, plan-end `external-both` + `userValidationOk`. Layer-1 pure STOP helpers exist (`src/automate-orchestrator-gates.js`). Bordas de fase/finalize já falham fechado via `preflightPhaseDone` + GATE-R4 + `automatePlanEndGatesOk`.

A auditoria de 2026-07-21 (`audit-implement-automate-skill-discipline.md`) mostrou o gap estrutural já admitido em `docs/kb/automate-orchestrator-realism.md`:

> *implement --mode=automate is skill-driven orchestration: the host agent is the maestro. There is no long-running Node process that spawns writers, waits on leases, and refuses illegal transitions by force.*

**Problema:** a skill *descreve* ser a skill (A–I, pure maestro, nunca silent Mode-1), mas o **miolo A–E** e a **autenticidade de F** não se obrigam a si mesmos. O modelo pode:

1. Codar product source na sessão host com stamp automate ligado (silent Mode-1)
2. Forjar `evaluationGate: { status: passed, verdict: pass }` sem rodar evaluation agent
3. Chamar `done` sem claim report validado / merge / reachability
4. Pular complex `review-code --mode=both` antes de `done`
5. Encadear fases sem opt-in do operador

**Meta:** fechar esses buracos com **fail closed barato** (assert CLI + authenticity + claim-bound close + cursor mínimo + pause entre fases) — sem Layer 4 daemon multi-host.

Ground truth (G1):

```
docs/kb/automate-orchestrator-realism.md:8-19  — skill-driven; no full runtime
src/automate-orchestrator-gates.js:44-109     — canSpawn / canClose / canRunPhaseDone / canFinalize
scripts/lifecycle-order-guard.js:522-532      — preflightPhaseDone + evaluation check
scripts/validate-state.js:626-668             — GATE-R4 shape honesty only
meta/schemas/plan.schema.json:385-414         — evaluationGate sem reportPath
skills/core/implement.md pure-maestro A–I     — prosa A–I + HARD-GATE read asset
```

verified_by: paths above from live tree at design time.

## Decisions

1. **Remediação = enforcement em camadas, não reescrita do pure-maestro.** O contrato A–I e pure-maestro de `implementation-automate-mode` permanece a lei. Este plano só torna saltos ilegais **machine-detectable** e **hard-blocked** onde o custo for baixo.

2. **Ordem de entrega = ROI da auditoria (R1→R3→R4→R2→R5).**  
   - **F0 / R1:** `scripts/assert-automate-gate.js` + prosa obrigando assert antes de spawn / done-batch / phase-done / finalize.  
   - **F1 / R3:** autenticidade de `evaluationGate` (report pointer + skip só com flag de operador).  
   - **F2 / R4:** close sob automate amarrado a claim validado + reachability (+ complex both quando `isComplexTask`).  
   - **F3 / R2:** cursor durável mínimo de step do maestro (anti-pulo A–I) — **não** Layer 4 spawn supervisor.  
   - **F4 / R5:** pause machine entre fases + framing Mode-1 vs Automate + antipatterns de forge/silent Mode-1/rm lease.

3. **Assert CLI é Layer 2, não runtime de spawn.** O script lê disco + reutiliza helpers puros; exit 0/1; **não** spawna writer. Skill prose e (onde couber) preflight/done paths **devem** invocá-lo ou o predicado equivalente — “esqueci o helper” deixa de ser caminho feliz.

4. **evaluationGate shape-only é insuficiente.** `status: passed` exige ponteiro para `evaluationReport` (path sob `.atomic-skills/` ou initiative) + `at`/`verifiedAt` honestos. `status: skipped` exige `operatorSkip: true` (ou equivalente schema) **e** reason não-vazio — o agente sozinho não inventa skip. GATE-R4 e `phaseEvaluationAllowsClose` sobem a mesma regra. Skip retroativo legítimo (legado pré-gate) continua possível só com operatorSkip + reason auditável.

5. **Claim-bound close sob stamp automate.** Quando `plan.executionMode === 'automate'` (durable), o path de close (`done` / preflight / assert `--gate done`) exige: claim report validado (`canCloseTasksFromClaims`), reachability no plan branch, e para complex tasks receipt/`review-code --mode=both` com severidade gateada. Silent Mode-1 (host edita product source sem claim) deve falhar o gate de done, não só a prosa.

6. **Cursor de step é status file, não workqueue de produto.** Arquivo sob `.atomic-skills/status/automate/<plan-slug>.json` (ou path canônico equivalente) com `step`, `phaseId`, `redispatchCount`, paths de claim/lease. Assert e transitions recusam avanço se `step` for incompatível com a ação (ex.: `done` com step < E; `phase-done` com step ≠ G). **Não** incluir adapters de spawn por host neste plano (Layer 4 out).

7. **Pause entre fases é flag durável, não só prosa.** Após `phase-done` bem-sucedido sob automate, o plano/fase fica em estado `awaiting-operator-advance` (ou flag equivalente no status/cursor) até o operador re-invocar `implement` / `continue` / materialize da próxima. Encadear F_n → F_n+1 sem opt-in é HARD-BLOCK.

8. **Sem nova skill top-level `automate.md`.** Mudanças em `skills/core/implement.md`, assets lazy, `project-transitions` / finalize paths, `src/*`, `scripts/*`, schema, validate-state, testes. Non-automate permanece byte-identical nos defaults (P1 do plano original).

9. **Layer 4 full maestro (daemon, multi-host spawn) é non-goal.** Só reabre se dogfood de F0–F3 mostrar falhas que Layer 2+cursor não peguem.

10. **Framing cognitivo.** `implement.md` Mindset deve branchar explicitamente: Mode 1 = execution driver; Automate = pure maestro / orchestrator only — reduz o pull de “eu codifico”.

## Chosen approach

**Nome: Layer-2 assert + authenticity + claim-bound done + thin step cursor + phase pause.**

### Abordagens pesadas

| Abordagem | Prós | Contras | Veredito |
|-----------|------|---------|----------|
| **A — Só prosa + antipatterns** | Zero schema | Auditoria prova que não basta | Rejeitada como remediação principal |
| **B — Full Layer 4 daemon** | Enforcement máximo | Multi-mês; luta com modelo multi-host; KB proíbe antes de dogfood L1–2 | Rejeitada neste plano |
| **C — Layer 2 assert + schema authenticity + claim-bound + thin cursor + pause (recomendada)** | Fail closed barato; reusa helpers; alinhado à KB realism | Ainda depende de o agente rodar assert (mitigado se done/phase-done paths chamam predicados) | **Escolhida** |
| **D — Só assert CLI sem schema/cursor** | 1–2 dias | evaluationGate forge e step-skip continuam | Rejeitada sozinha (insuficiente para P0-2/P0-1 pleno) |

### Runtime após este plano

```
implement --mode=automate (stamp)
  assert spawn → C lease+writer
  assert claims → D/D.5/E
  claim-bound done (machine) per task
  F evaluation → report on disk → stamp evaluationGate with reportPath
  assert phase-done → G
  phase-done → cursor: awaiting-operator-advance
  operator continue → H (materialize if needed) → A…
  last phase → assert finalize → I userValidatedAt
```

### Non-goals

- Novo top-level skill `automate.md`
- Silent Mode-1 fallback “por conveniência”
- Auto-materialize / LLM-filled `businessIntent`
- Full maestro daemon / spawn adapters multi-host (Layer 4)
- Mudar defaults de Mode 1 / Mode 2 quando automate off
- Auto-finalize / auto-archive

## Blast radius

| Mudança | Reversibilidade | Contenção |
|---------|-----------------|-----------|
| Schema `evaluationGate` (+ reportPath / operatorSkip) | Planos archived com skip retroativo precisam continuar válidos ou migrar uma vez | GATE-R4 + `buildEvaluationGate`; migrate/normalize se necessário; non-automate sem gate intacto |
| claim-bound `done` sob stamp | Só afeta `executionMode: automate` | Predicado gated por stamp; Mode 1 unstamped unchanged |
| status file cursor | Apagar status file = recovery operator | Path sob `.atomic-skills/status/`; never product source |
| assert CLI | Removível; prosa pode degradar | Novo script em `scripts/` + package.json `files` se publicado |
| phase pause flag | Clear via operator continue | Só sob stamp automate |

One-way doors: schema honesty de evaluationGate (consumidores de plan.md) e qualquer hard-fail de `validate-state` em planos automate ativos mid-flight — F1 deve incluir path de recovery documentado (operatorSkip com reason, ou re-run evaluation).

## Rejected alternatives

- **Prosa-only (A):** já falhou o teste de “a skill ser a skill” na auditoria.
- **Layer 4 agora (B):** viola `automate-orchestrator-realism.md` (“Do not start Layer 4 until Layers 1–2 have dogfood evidence”).
- **Assert-only (D):** não fecha forge de evaluationGate nem salto de step sem cursor.
- **Forçar evaluation agent via subprocess Node:** impossível de forma host-portable; authenticity via artifact no disco é o substituto realista.

## Open questions

1. **Path canônico do evaluationReport** — `.atomic-skills/reviews/` vs initiative body vs `phases/<id>-evaluation.json`? Preferência de design: **arquivo sob `.atomic-skills/reviews/`** (mesmo diretório de review receipts) com link em `evaluationGate.reportPath`, para reutilizar disco já versionado. Confirmar na materialização F1 se o schema prefere relative path from repo root.
2. **Detecção silent Mode-1** — heurística “product paths dirty sem claim paths” vs “HEAD avançou sem claim SHAs”? Preferência: **claim obrigatório + reachability**; dirty product paths sem claim entry = block done. Não tentar provar “o host não editou” via FS watch.
3. **Nome do estado de pause** — campo em plan frontmatter vs só cursor status file? Preferência: **cursor status file** (menos schema plan) + superfície em `project view`/help; plan.md só se view exigir.

## Self-review against code-quality gates

- G1 read-before-claim: applied — Context cita `docs/kb/automate-orchestrator-realism.md`, `src/automate-orchestrator-gates.js`, `scripts/lifecycle-order-guard.js`, `scripts/validate-state.js`, `meta/schemas/plan.schema.json` evaluationGate.
- G2 soft-language: applied — decisions usam must/requires/HARD-BLOCK; ban list scanned.
- G6 reference-or-strike: applied — claims de comportamento atual apontam path; open questions marcadas como preferência de design, não fact.
