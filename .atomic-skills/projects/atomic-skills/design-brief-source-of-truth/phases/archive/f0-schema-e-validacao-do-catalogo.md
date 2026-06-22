---
schemaVersion: "0.1"
slug: design-brief-source-of-truth-f0-schema-e-validacao-do-catalogo
title: Schema e validação do catálogo
goal: estabelecer o contrato persistido do catálogo — schema JSON, validação na
  emissão e cobertura pelo validate-state — antes de qualquer reconstrução
  consumi-lo.
status: done
branch: plan/skills-restructuring
started: 2026-06-15T19:46:08.157Z
lastUpdated: 2026-06-16T10:51:14Z
nextAction: null
parentPlan: design-brief-source-of-truth
phaseId: F0
tasksDone: 3
tasksTotal: 3
gatesMet: 1
gatesTotal: 1
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-1
    description: O schema define e valida TODOS os campos do contrato (existence,
      conflicts, regime, inputsHash, provenance, audience, accessTier, status,
      purpose, label, id); o validador emit-time rejeita catálogo malformado; o
      validate-state cobre o catálogo durável.
    status: met
    metAt: 2026-06-16T10:51:14Z
    verifier:
      kind: shell
      command: node --test test/app-map/schema.test.js test/app-map/validate.test.js
        && npm run validate-state test/fixtures
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T10:51:14Z
      passed: true
      exitCode: 0
      outputSummary: "Gate verifier on merged primary 009a95b: node --test
        schema+validate → 8/8 pass; npm run validate-state test/fixtures → 1
        app-map catalog valid, exit 0. Post-review (2 codex majors fixed:
        schemaVersion enum + page-id uniqueness)."
    verifierLabel: "shell: node --test test/app-map/schema.test.js test/app-map/valida…"
    evidenceSummary: passed · 2026-06-16
stack:
  - id: 1
    title: Schema e validação do catálogo
    type: task
    openedAt: 2026-06-15T19:46:08.157Z
tasks:
  - id: T-001
    title: Schema JSON do catálogo
    status: done
    lastUpdated: 2026-06-16T01:08:41Z
    closedAt: 2026-06-16T01:08:41Z
    summary: Schema JSON com os campos requeridos do contrato e os enums.
    description: "Define o schema do `app-map.json` com os campos requeridos do
      contrato e os enums. Files: meta/schemas/app-map.schema.json"
    scopeBoundary:
      - não alterar os outros schemas em meta/schemas/ nem o src/decompose.js.
    acceptance:
      - required inclui id, label, purpose, audience, accessTier, status,
        regime, existence, provenance e conflicts não-resolvidos
      - declara inputsHash e schemaVersion
      - enums para accessTier, status e existence.
    verifier:
      kind: shell
      command: node --test test/app-map/schema.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T01:08:41Z
      passed: true
      exitCode: 0
      outputSummary: node --test test/app-map/schema.test.js → tests 4, pass 4, fail 0
        (re-verificado no primary merged ac117c4)
  - id: T-002
    title: Validador emit-time
    status: done
    lastUpdated: 2026-06-16T01:16:11Z
    closedAt: 2026-06-16T01:16:11Z
    summary: Valida o catálogo na emissão; malformado aborta antes de gravar.
    description: "Valida um catálogo contra o schema antes de gravar; malformado
      aborta a emissão. Files: src/app-map/validate.js,
      test/app-map/validate.test.js"
    scopeBoundary:
      - só validação; não lê fontes nem escreve o catálogo em disco.
    acceptance:
      - catálogo válido passa
      - catálogo malformado lança e a emissão aborta sem gravar arquivo.
    verifier:
      kind: shell
      command: node --test test/app-map/validate.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T01:16:11Z
      passed: true
      exitCode: 0
      outputSummary: node --test test/app-map/validate.test.js → tests 2, pass 2, fail
        0 (re-verificado no primary merged aeaa60a)
  - id: T-003
    title: Registro no validate-state com fixture
    status: done
    lastUpdated: 2026-06-16T01:35:47Z
    closedAt: 2026-06-16T01:35:47Z
    summary: Registra o catálogo no validate-state, com fixture que prova a falha.
    description: "Faz o catálogo durável ser descoberto e validado pelo
      validate-state, com fixture que prova a falha. Files:
      scripts/validate-state.js, test/app-map/validate-state.test.js,
      test/fixtures/app-map-invalid.json"
    scopeBoundary:
      - não mudar a validação de plan e initiative; só adicionar o app-map ao
        discovery de schemas.
    acceptance:
      - validate-state descobre e valida o app-map.json em árvore tracked
      - a fixture inválida faz o validate-state sair com código não-zero.
    verifier:
      kind: shell
      command: npm run validate-state test/fixtures
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T01:35:47Z
      passed: true
      exitCode: 0
      outputSummary: "npm run validate-state test/fixtures → '1 app-map catalog(s)
        valid', exit 0 (re-verificado no primary merged 886da30). Acceptance-2:
        node --test test/app-map/validate-state.test.js → 2/2 pass. Regressão:
        validate-state .atomic-skills → 42 files valid, 12 plans, scopeBoundary
        ok."
parked: []
emerged: []
summary: "Fecha o contrato do catálogo: schema, validação na emissão e cobertura
  pelo validate-state."
---

# Narrative / notes

Initiative for phase **F0 — Schema e validação do catálogo**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Self-review against code-quality gates

- **G1 read-before-claim**: 3 tasks fechadas, cada uma com `outputs[]`/verifier e evidência; cada fix de review colou as linhas-fonte antes de editar.
- **G2 soft-language**: scaneado nextAction + descrições de task/criterion contra o ban list; 0 violações.
- **G6 reference-or-strike**: 1 exit criterion, met com `evidence` populado (shell 8/8 + validate-state, exit 0 em 009a95b); 0 deferred, 0 unverified.
- **Codex review**: `review-code 4f05a79..b739a81 --mode=both` em HEAD 009a95b, verdict needs_changes (codex 0B/0C/2M; local 1M/3m), os 3 majors corrigidos (08b844d, 009a95b), file `.atomic-skills/reviews/2026-06-16-0749-design-brief-source-of-truth-f0.md`.
- **Review gate (G2)**: gravado em `plan.phases[F0].reviewGate = { status: passed, at: 009a95b, mode: both, reviewFile, verifiedAt }`.
- **Lessons (G1)**: distiladas 4 lessons (todas reusable) em `lessons/design-brief-source-of-truth-f0-schema-e-validacao-do-catalogo.md`, ratificadas pelo operador. O gate de início da F1 as dispõe.

## Session handoff
- **Narrative:** F0 (Schema e validação do catálogo) do plano `design-brief-source-of-truth` **IMPLEMENTADA via Mode 2 (Codex)** no worktree de integração `impl/design-brief-source-of-truth` (`/home/henry/atomic-skills-db`); árvore principal `plan/skills-restructuring` congelada. **As 3 tasks DONE e re-verificadas no primary merged**: T-001 (schema, ac117c4, 4/4), T-002 (validador emit-time, aeaa60a, 2/2), T-003 (discovery no validate-state + fixtures, 886da30 — validate-state test/fixtures exit 0 + validate-state.test.js 2/2 + regressão 42 files). Falta a **fronteira de fase: phase-done** (exit gate F0-G1 + review-code), que NÃO rodei — opt-in do operador.
- **Decision log:** (1) Executor = Mode 2/Codex (operador via AskUserQuestion). (2) Topologia = 1 worktree de integração + worktrees Codex efêmeros por-task. (3) Serial pela cadeia de verifiers acoplados ao schema. (4) Codex nunca escreve `.atomic-skills/`; Opus faz done/snapshot/telemetria. (5) `node_modules` symlinkado (gitignored). (6) Commit externo `4ca8cdc` em `plan/skills-restructuring` em paralelo — sem overlap (isolamento útil). (7) T-003: design settado por mim no work-order (discovery por nome canônico `app-map.json` + fixture válida em `test/fixtures/app-map/` + inválida não-descoberta) p/ resolver a tensão verifier↔acceptance. (8) Codex deu timeout (124) no self-check da T-003 APÓS completar as edições — ambiental; verifiquei independente no primary.
- **Single nextAction:** Rodar `phase-done` para a F0: executar o exit gate `node --test test/app-map/schema.test.js test/app-map/validate.test.js && npm run validate-state test/fixtures`, depois `review-code` (phase-diff gate), gravar `reviewGate` no plano, distilar lessons, e advance do plano (currentPhase F0→F1). Tudo isso a partir do worktree `/home/henry/atomic-skills-db`.
- **Verbatim state:** Integration worktree `/home/henry/atomic-skills-db` branch `impl/design-brief-source-of-truth` @ `886da30`. 3/3 tasks done (evidence shell passed). F0 exit gate F0-G1: `node --test test/app-map/schema.test.js test/app-map/validate.test.js && npm run validate-state test/fixtures` — pending (roda no phase-done). dispatch-log: 8 records. Arquivos novos: meta/schemas/app-map.schema.json, src/app-map/validate.js, scripts/validate-state.js (mod), test/app-map/{schema,validate,validate-state}.test.js, test/fixtures/app-map/app-map.json + app-map-invalid.json.
- **Uncommitted changes:** integration worktree — state edits (T-003 done + rollups + dispatch-log + este handoff), a commitar agora. Main tree: clean. Worktree `codex/db-t003` a remover. Para merge final: `git -C /home/henry/atomic-skills merge impl/design-brief-source-of-truth` (sem conflito esperado vs 4ca8cdc).
