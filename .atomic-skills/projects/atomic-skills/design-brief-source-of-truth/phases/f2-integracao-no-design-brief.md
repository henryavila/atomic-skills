---
schemaVersion: "0.1"
slug: design-brief-source-of-truth-f2-integracao-no-design-brief
title: Integração no design-brief
goal: o design-brief consome o catálogo com reconstrução-primeiro, comuta o R2
  por regime, e persiste o catálogo na árvore do app-alvo.
status: active
branch: plan/design-brief
started: 2026-06-16T15:34:48Z
lastUpdated: 2026-06-16T16:41:30Z
nextAction: "Start T-003: switch do R2 por regime em skills/core/design-brief.md
  §4 + nota no asset anti-contamination (último task da F2)"
parentPlan: design-brief-source-of-truth
phaseId: F2
tasksDone: 2
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: o design-brief consome o catálogo (reconstrução-primeiro), o R2
      comuta por regime, e o catálogo persiste no app-alvo passando pela
      validação emit-time.
    status: pending
    verifier:
      kind: shell
      command: node --test test/app-map/reconstruct.test.js
        test/app-map/design-brief-step2.test.js
        test/app-map/design-brief-r2.test.js
    verifierLabel: "shell: node --test test/app-map/reconstruct.test.js test/app-map/d…"
stack:
  - id: 1
    title: Integração no design-brief
    type: task
    openedAt: 2026-06-15T19:46:08.157Z
tasks:
  - id: T-001
    title: Orquestrador de reconstrução (reconstrução-primeiro) + CLI
    status: done
    closedAt: 2026-06-16T16:33:04Z
    lastUpdated: 2026-06-16T16:33:04Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T16:33:04Z
      exitCode: 0
      passed: true
      testsCollected: 6
      outputSummary: "node --test test/app-map/reconstruct.test.js (merged primary
        tree) — tests 6, pass 6, fail 0, duration_ms 137. Executor: Codex Mode 2
        (worktree impl/db-t001, merged ff into plan/design-brief @ff0d51c)."
    summary: Orquestra os módulos F1 em reconstrução-primeiro (delta por
      evidenceHash) e persiste no app-alvo; CLI não-interativo de dois modos
      (--delta / --persist).
    description: "Orquestrador que liga sources→code-scan→diverge (delta) + persist,
      com freshness por evidenceHash e resolução de path+projectId do app-alvo;
      a confirmação interativa fica no agente (JS recebe resoluções). Files:
      src/app-map/reconstruct.js, scripts/app-map-reconstruct.js,
      test/app-map/reconstruct.test.js"
    scopeBoundary:
      - orquestra só os módulos F1
        (sources/code-scan/diverge/confirm/persist/hash) e resolve
        path+projectId do app-alvo; NÃO edita skills/core/design-brief.md nem o
        coração anti-contaminação; NÃO muta artefatos humanos; a confirmação
        interativa fica no agente (o JS recebe resoluções, não pergunta).
    acceptance:
      - resolve `<appRoot>/.atomic-skills/app-map/` + projectId (basename do
        appRoot ou fornecido)
      - catálogo ausente → pipeline roda e marca delta=inventário; greenfield
        (zero código) não emite catálogo vazio silencioso
      - catálogo fresco (evidenceHash inalterado por-página) → zero delta sem
        re-pergunta
      - evidência mudada → delta só das páginas mudadas (reusa reRunDelta da F1)
      - CLI `node scripts/app-map-reconstruct.js <appRoot> --delta|--persist` é
        o ponto de entrada
    verifier:
      kind: shell
      command: node --test test/app-map/reconstruct.test.js
  - id: T-002
    title: Step 2 = reconstrução-primeiro; route-Glob vira legado opt-in
    status: done
    closedAt: 2026-06-16T16:41:30Z
    lastUpdated: 2026-06-16T16:41:30Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T16:41:30Z
      exitCode: 0
      passed: true
      testsCollected: 4
      outputSummary: "node --test test/app-map/design-brief-step2.test.js (merged
        primary tree) — tests 4, pass 4, fail 0. Asseram reconstrução-primeiro
        (ordenação cliIndex<consume<glob), existence+delta,
        null→parar-perguntar, glob legado opt-in nunca default. Executor: Codex
        Mode 2 (impl/db-t002, ff em plan/design-brief @59eb549)."
    summary: Reescreve o §2 do design-brief para invocar a reconstrução antes de
      consumir e demover o route-Glob ao vivo a legado opt-in.
    description: "Edita o §2 (Screen inventory) para consumir o catálogo (existence/
      divergências) via reconstrução-primeiro; route-Glob vira legado opt-in.
      Files: skills/core/design-brief.md,
      test/app-map/design-brief-step2.test.js"
    scopeBoundary:
      - edita SÓ o §2 (Screen inventory) do design-brief.md; NÃO toca o Iron Law
        nem as camadas 2/3 (anti-contaminação); NÃO altera o §4 (isso é T-003);
        não muta src/app-map.
    acceptance:
      - o §2 invoca a reconstrução (CLI `--delta`) ANTES de consumir
      - consome existence/divergências do catálogo (não Glob-só-código)
      - campos audience/accessTier null → parar-e-perguntar
      - o route-Glob ao vivo aparece explicitamente como legado opt-in, nunca o
        default
      - o teste estrutural assere todos esses âncoras no arquivo da skill (não
        só a palavra)
    verifier:
      kind: shell
      command: node --test test/app-map/design-brief-step2.test.js
  - id: T-003
    title: Switch do R2 por regime (brownfield minera / greenfield pergunta / nunca
      silencia)
    status: pending
    lastUpdated: 2026-06-16T15:34:48Z
    summary: Faz o R2 minerar do código em brownfield e perguntar ao operador
      (semeado pelos artefatos) em greenfield, nunca silenciando o parâmetro.
    description: "Edita o §4 (R2) para comutar por regime via o catálogo, semeando
      greenfield pelos artefatos; camada-1-silêncio intacta. Files:
      skills/core/design-brief.md,
      skills/shared/design-brief-assets/anti-contamination.md,
      test/app-map/design-brief-r2.test.js"
    scopeBoundary:
      - edita SÓ o §4 (R2) do design-brief.md + a nota de regime no asset
        anti-contamination; NÃO altera a regra de silêncio da camada 1; NÃO toca
        o §2 (isso é T-002); não muta src/app-map.
    acceptance:
      - o §4 (R2) minera valores do código em brownfield
      - em greenfield pergunta ao operador semeado pelos artefatos do catálogo
      - nunca silencia o parâmetro (omissão = decisão, R3 intacto)
      - a regra de silêncio da camada 1 fica inalterada
      - o teste estrutural assere brownfield-minera + greenfield-pergunta +
        nunca-silencia + camada-1-intacta
    verifier:
      kind: shell
      command: node --test test/app-map/design-brief-r2.test.js
parked: []
emerged: []
summary: "Pluga o catálogo no design-brief: Step 2, switch do R2 e persistência
  no app-alvo."
planTitle: "design-brief: reconstrução da fonte-de-verdade (catálogo app-map)"
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F2 — Integração no design-brief**. Materializada no phase-done da F1
(2026-06-16): metadados stale corrigidos (`branch` era `plan/skills-restructuring`; `started`/
`lastUpdated` herdados do scaffold), ativada, e a phase-start lessons gate dispositada (abaixo).

> **RE-DECOMPOSTA (2026-06-16) — agora SPEC-ready.** As 3 tasks T-001…T-003 antigas (decompostas
> 2026-06-15, antes da Revisão 2; verifiers grep-presença + persist.test.js-já-passa) foram
> **substituídas** por 3 tasks novas contra a Revisão 2 + os contratos F1 construídos, passando o
> SPEC gate (`node scripts/lint-source.js …/.f2-source.md --spec` → `EXIT=0`). Verifiers agora são
> `kind: test` determinísticos: T-001 comportamental (orquestrador), T-002/T-003 testes estruturais
> de contrato sobre a prosa da skill (asseram os âncoras de integração — o mais forte para edição de
> prosa; a *qualidade* da prosa é coberta pelo review-code no phase-done, não pelo verifier).
>
> **Decisão de arquitetura (DECOMPOSE):** a skill `design-brief` é um agente interativo com
> `{{ASK_USER_QUESTION_TOOL}}` (operador sempre presente — D9), então a confirmação-por-divergência
> fica NO AGENTE; o JS do app-map é não-interativo/testável. O orquestrador `reconstruct.js` expõe
> `computeReconstruction` (→ delta) + `persistReconstruction`, com um CLI de dois modos
> (`--delta` emite o delta; `--persist` grava). A skill: roda `--delta`, arbitra via o tool, roda `--persist`.

## Decisions

- **2026-06-16 — Lessons da phase-start gate (disposição):**
  - **[F1 L-001] APLICAR** a T-003: persist grava arquivos reais na árvore do app-alvo — a nova task
    deve ter ≥1 teste contra FS real (`mkdtempSync`), não só stub (a F1 já adicionou esse teste em
    `persist.test.js`; T-003 deve reusá-lo/estendê-lo para o path do app-alvo).
  - **[F0 L-003] APLICAR**: qualquer teste novo da F2 deve ser descoberto pelo `npm test` (glob
    `test/**` já ampliado na F0); confirmar, não assumir.
  - **[F0 L-001] MANTER**: a F2 consome o contrato porta-de-mão-única mas não produz schema novo;
    rodar `review-code` no diff de integração (modo `local` salvo se mexer no schema → `both`).
  - **[F1 L-002] / [F0 L-002, L-004] MANTER como referência** (específicas de extração/schema; não
    diretamente acionáveis na integração de prosa).

## Links

- Doc de design (Revisão 2, fonte da F2): `../design.md` (D5'/D6', Chosen approach pós-Revisão 2)
- Alvo da integração: `skills/core/design-brief.md` (Step 2 / R2), `skills/shared/design-brief-assets/`
- Contratos construídos na F1: `src/app-map/{sources,code-scan,diverge,confirm,persist,hash}.js`

## Session handoff

- **Narrative:** Fase **F2 — Integração no design-brief**, **2/3 tasks** (T-001 +
  T-002 DONE). T-001 (orquestrador) e T-002 (§2 reconstrução-primeiro) executados
  pelo **Codex (Mode 2)**, ff-merjados em `plan/design-brief` (@`ff0d51c`, @`59eb549`),
  ambos verifiers **PASSARAM na árvore primária merjada** (6/6 e 4/4) → fechados com
  evidence. Worktrees removidos. Próximo e ÚLTIMO: **T-003** (§4 R2 switch por regime).
  Ao fechar T-003 → último task da F2 → **oferta de phase-done** (NÃO auto-rodar).
- **Decision log:**
  - Operador optou **Mode 2 / Codex default** para as 3 tasks da F2 (cleared F1∧F2).
  - T-002 fechado: §2 reescrito (reconstrução-primeiro com ordenação cli<consume<glob,
    existence+delta, null→parar-perguntar, glob legado opt-in nunca default). Teste
    estrutural com checagem de ORDENAÇÃO (não tautológico). Verifier 4/4 na primária.
  - **T-003 edita `skills/core/design-brief.md` §4 (R2) + `skills/shared/design-brief-
    assets/anti-contamination.md`** (nota de regime). NÃO toca §2 (T-002, já feito),
    NÃO altera a regra de silêncio da camada 1 (Iron Law), não muta src/app-map.
  - Husky pre-commit regenera docs ao editar skill `.md` (idempotente p/ T-002, sem
    resíduo). Esperar isso de novo no commit de T-003.
  - Falhas pré-existentes no `npm test` (`countSkills`/`installSkills`/`serve
    constants`) são ambientais (`dist/dashboard` não-buildado), NÃO regressão.
- **Single nextAction:** Despachar **T-003** ao Codex: criar worktree `impl/db-t003` off HEAD (`59eb549`) em `/home/henry/atomic-skills/.worktrees/db-t003`, briefing (§4 R2 comuta por regime do catálogo: brownfield minera código / greenfield pergunta operador semeado pelos artefatos / nunca silencia, R3 intacto, camada-1 intacta; nota de regime no asset anti-contamination) + criar `test/app-map/design-brief-r2.test.js`, dispatch `--sandbox workspace-write`.
- **Verbatim state:**
  - Verifier T-003: `node --test test/app-map/design-brief-r2.test.js`
  - Files T-003: `skills/core/design-brief.md` (SÓ §4), `skills/shared/design-brief-assets/anti-contamination.md`, `test/app-map/design-brief-r2.test.js`
  - Comando worktree T-003: `git worktree add -b impl/db-t003 /home/henry/atomic-skills/.worktrees/db-t003 59eb549`
  - Exit-gate G-1 da F2: `node --test test/app-map/reconstruct.test.js test/app-map/design-brief-step2.test.js test/app-map/design-brief-r2.test.js` (roda no phase-done)
  - Invocação Codex: `skills/shared/codex-bridge-assets/invocation-workspace-write.txt`
- **Uncommitted changes:** prestes a commitar a transição de estado de T-002
  (`f2-...md` done+rollup+handoff+nextAction, `dispatch-log.json`). Código já em
  `59eb549`. Árvore limpa após o commit chore.
