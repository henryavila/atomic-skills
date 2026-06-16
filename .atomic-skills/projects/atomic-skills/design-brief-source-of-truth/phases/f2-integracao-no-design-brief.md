---
schemaVersion: "0.1"
slug: design-brief-source-of-truth-f2-integracao-no-design-brief
title: Integração no design-brief
goal: o design-brief consome o catálogo com reconstrução-primeiro, comuta o R2
  por regime, e persiste o catálogo na árvore do app-alvo.
status: active
branch: plan/design-brief
started: 2026-06-16T15:34:48Z
lastUpdated: 2026-06-16T15:34:48Z
nextAction: "Start T-001: Orquestrador de reconstrução (reconstrução-primeiro) +
  CLI em src/app-map/reconstruct.js"
parentPlan: design-brief-source-of-truth
phaseId: F2
tasksDone: 1
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
    status: pending
    lastUpdated: 2026-06-16T15:34:48Z
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

- **Narrative:** Fase **F2 — Integração no design-brief**, **1/3 tasks** (T-001
  DONE). **T-001** (orquestrador `reconstruct.js` + CLI + teste) foi executado
  pelo **Codex (Mode 2)** no worktree `impl/db-t001`, ff-merjado em
  `plan/design-brief` @`ff0d51c`, e o verifier `node --test
  test/app-map/reconstruct.test.js` **PASSOU na árvore primária merjada (6/6)** →
  fechado com evidence. Worktree removido + branch deletada. Próximo: **T-002**.
- **Decision log:**
  - Operador optou **Mode 2 / Codex default** para as 3 tasks da F2 (cleared F1∧F2).
  - T-001 fechado: bridge diverge→buildCatalog via `toPageFact` + `evidenceForPage`
    (evidence cru = `{code, docs[]}` ordenado) → evidenceHash estável entre o
    freshness-check e o persist (load-bearing pra AC 3/4). Verifier 6/6 na primária.
  - **T-002 e T-003 editam ambos `skills/core/design-brief.md`** → NÃO pairwise-
    disjoint → executados **um de cada vez** (serial), nunca worktrees concorrentes.
    T-002 = §2 (Screen inventory); T-003 = §4 (R2) + nota no asset anti-contamination.
  - Falhas pré-existentes no `npm test` (`countSkills`/`installSkills`/`serve
    constants`) são ambientais (`dist/dashboard` não-buildado neste worktree),
    NÃO regressão de T-001 (que só adicionou src/app-map + scripts + test/app-map).
- **Single nextAction:** Despachar **T-002** ao Codex: criar worktree `impl/db-t002` off `ff0d51c` em `/home/henry/atomic-skills/.worktrees/db-t002`, escrever o briefing (§2 do design-brief consome o catálogo via reconstrução-primeiro; route-Glob vira legado opt-in; campos null → parar-e-perguntar) + criar `test/app-map/design-brief-step2.test.js`, dispatch `--sandbox workspace-write`.
- **Verbatim state:**
  - Verifier T-002: `node --test test/app-map/design-brief-step2.test.js`
  - Files T-002: `skills/core/design-brief.md` (SÓ §2), `test/app-map/design-brief-step2.test.js`
  - Verifier T-003: `node --test test/app-map/design-brief-r2.test.js`
  - Files T-003: `skills/core/design-brief.md` (SÓ §4), `skills/shared/design-brief-assets/anti-contamination.md`, `test/app-map/design-brief-r2.test.js`
  - Comando worktree T-002: `git worktree add -b impl/db-t002 /home/henry/atomic-skills/.worktrees/db-t002 ff0d51c`
  - Invocação Codex: `skills/shared/codex-bridge-assets/invocation-workspace-write.txt`
  - Telemetria: append em `.atomic-skills/status/dispatch-log.json`
- **Uncommitted changes:** prestes a commitar a transição de estado de T-001
  (`f2-integracao-no-design-brief.md` done+rollup+handoff, `dispatch-log.json`).
  Código-fonte já commitado em `ff0d51c`. Árvore limpa após o commit chore.
