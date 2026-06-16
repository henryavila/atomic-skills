---
schemaVersion: "0.1"
slug: skills-restructuring-f1-economia-de-tokens-project-e-implement
title: "Economia de tokens: project e implement"
goal: restaurar o router fino e o driver enxuto movendo conteúdo não-ambiente para detail/asset lazy, sem perder comportamento.
status: active
branch: null
started: 2026-06-15T13:37:12.477Z
lastUpdated: 2026-06-16T13:27:29Z
nextAction: "All F1 tasks done — run phase-done to verify exit gate F1-G1 + the review-code gate, then advance to F2 (user opts in)."
parentPlan: skills-restructuring
phaseId: F1
tasksDone: 5
tasksTotal: 5
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F1-G1
    description: project.md e implement.md encolhem e a suite de validação continua verde.
    status: pending
    verifier:
      kind: shell
      command: test $(wc -c < skills/core/project.md) -lt 22000 && test $(wc -c < skills/core/implement.md) -lt 22000 && grep -q 'mode2-codex-lane' skills/core/implement.md && grep -q 'verifier-exec' skills/shared/project-assets/project-transitions.md && npm run validate-skills
      expectExitCode: 0
    verifierLabel: "shell: test $(wc -c < skills/core/project.md) -lt 22000 && test $(…"
stack:
  - id: 1
    title: "Economia de tokens: project e implement"
    type: task
    openedAt: 2026-06-15T13:37:12.477Z
tasks:
  - id: T1.1
    title: Router fino — mover blocos de referência para detail lazy
    status: done
    closedAt: 2026-06-16T13:04:12Z
    lastUpdated: 2026-06-16T13:04:12Z
    summary: "Router fino: schema-ref/rollups/cq-gates saem do resident para detail"
    description: "Mover schema quick-reference, mecânica de rollups/summaries e code-quality-gates do bloco resident de project.md para os detail files que os usam, deixando ponteiro de uma linha. Incorpora as correções T0.2/T0.3/T0.4 no novo local. Arquivos: skills/core/project.md, skills/shared/project-assets/project-transitions.md, skills/shared/project-assets/project-create-plan.md"
    scopeBoundary:
      - não mover Iron Law, pre-mutation gates, gate-status invariant, ratify gate nem emergence ladder (ficam resident).
    acceptance:
      - project.md não contém mais o heading Schema quick-reference
      - um detail file contém o conteúdo
      - project.md encolhe abaixo de 22000 bytes.
    verifier:
      kind: shell
      command: "! grep -q 'Schema quick-reference' skills/core/project.md && test $(wc -c < skills/core/project.md) -lt 22000 && npm run validate-skills"
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T13:04:12Z
      exitCode: 0
      passed: true
      outputSummary: "! grep 'Schema quick-reference' (absent) && project.md=20396B < 22000 && validate-skills → '✓ All 15 skills valid (schema_version 0.2)'; exit 0"
    outputs:
      - kind: file
        path: skills/core/project.md
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
  - id: T1.2
    title: Colapsar Red Flags e Rationalization do implement
    status: done
    closedAt: 2026-06-16T13:11:49Z
    lastUpdated: 2026-06-16T13:11:49Z
    summary: "Red Flags/Rationalization do implement: gatilhos resident, refutação lazy"
    description: "Manter os gatilhos one-liner de Red Flags resident e mover a tabela de refutação Temptation→Reality para um asset lazy lido sob demanda. Arquivos: skills/core/implement.md, skills/shared/implement-antipatterns.md"
    scopeBoundary:
      - não remover os gatilhos one-liner; não tocar o Process nem a Iron Law.
    acceptance:
      - implement.md encolhe abaixo de 22000 bytes
      - o asset de anti-padrões existe
      - o corpo aponta para ele.
    verifier:
      kind: shell
      command: test -f skills/shared/implement-antipatterns.md && test $(wc -c < skills/core/implement.md) -lt 22000 && grep -q 'implement-antipatterns' skills/core/implement.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T13:11:49Z
      exitCode: 0
      passed: true
      outputSummary: "test -f implement-antipatterns.md (exists) && implement.md=17931B < 22000 && grep 'implement-antipatterns' (2 refs); exit 0. Red Flags trimmed to triggers + pointer; Rationalization table moved to asset."
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
  - id: T1.3
    title: Contrato Mode-2 em fonte única
    status: done
    closedAt: 2026-06-16T13:13:43Z
    lastUpdated: 2026-06-16T13:13:43Z
    summary: Contrato Mode-2 vira stub no implement, fonte única no lane
    description: "Reduzir o contrato Mode-2 em implement.md a um stub de quatro itens com ponteiro; manter a fonte única em mode2-codex-lane.md. Arquivos: skills/core/implement.md, skills/shared/mode2-codex-lane.md"
    scopeBoundary:
      - não duplicar F1/F2 nem o racional SDD no implement; o contrato completo vive só no lane.
    acceptance:
      - implement.md referencia mode2-codex-lane.md
      - a re-derivação de F1/F2 sai do implement.
    verifier:
      kind: shell
      command: grep -q 'mode2-codex-lane' skills/core/implement.md && test $(grep -c 'spec-readiness' skills/core/implement.md) -le 1
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T13:13:43Z
      exitCode: 0
      passed: true
      outputSummary: "grep 'mode2-codex-lane' (1 ref) && grep -c 'spec-readiness'=1 (<=1); exit 0. Mode-2 section reduced to 4-item stub + pointer; F1/F2 re-derivation removed from implement.md (16107B). validate-skills → All 15 skills valid."
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/mode2-codex-lane.md
  - id: T1.4
    title: Partir transitions e extrair verifier-exec compartilhado
    status: done
    closedAt: 2026-06-16T13:08:06Z
    lastUpdated: 2026-06-16T13:08:06Z
    summary: Transitions partido em core/rare + verifier-exec.md compartilhado
    description: "Separar o hot-path (done/push/pop) do cold-path em project-transitions, e extrair os padrões de execução de verifier para verifier-exec.md como fonte única. Arquivos: skills/shared/project-assets/project-transitions.md, skills/shared/project-assets/verifier-exec.md"
    scopeBoundary:
      - não inlinar o executor de verifier nos callers; preservar a semântica de GATE-R2.
    acceptance:
      - verifier-exec.md existe
      - project-transitions.md referencia verifier-exec
      - a suite de validação passa.
    verifier:
      kind: shell
      command: test -f skills/shared/project-assets/verifier-exec.md && grep -q 'verifier-exec' skills/shared/project-assets/project-transitions.md && npm run validate-skills
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T13:08:06Z
      exitCode: 0
      passed: true
      outputSummary: "test -f verifier-exec.md (exists) && grep 'verifier-exec' project-transitions.md (2 refs) && validate-skills → '✓ All 15 skills valid'; exit 0. transitions.md 32762→28692B."
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/project-assets/verifier-exec.md
  - id: T1.5
    title: Corrigir decompose H3-mode para materializar o interior SPEC das tasks
    status: done
    closedAt: 2026-06-16T13:27:29Z
    lastUpdated: 2026-06-16T13:27:29Z
    summary: decompose H3-mode passa a materializar o interior SPEC das tasks
    description: "O decompose (src/decompose.js), no modo H3 (### Tn), extrai só id+título e descarta o corpo da task (description + Files/scopeBoundary/acceptance/verifier), embora o SPEC gate (lint-source.js --spec) exija a forma verbosa ### Tn. Resultado: todo `new plan` materializa tasks sem interior — sem sinal de conclusão e não-dispatcháveis pro codex. Corrigir o H3-mode para parsear os 4 campos SPEC + a lead-description e mapeá-los aos campos de schema. Arquivos: src/decompose.js, tests/decompose.test.js"
    scopeBoundary:
      - não alterar a grammar de fases (## F<N>) nem o exit_gate YAML
      - não tocar o modo Sub-fases bullet; preservar R-ORCH-10 (heurísticas de fase intactas, exceto a extração de interior por task H3)
    acceptance:
      - "um source com ### Tn + os 4 campos materializa task.scopeBoundary/acceptance/verifier/description"
      - find-signalless-tasks reporta 0 num plano recém-materializado cujos tasks têm verifier
      - tests/decompose.test.js cobre o novo parsing de interior H3 (RED→GREEN)
      - validate-state passa nas tasks materializadas
    verifier:
      kind: shell
      command: node --test tests/decompose.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T13:27:29Z
      exitCode: 0
      passed: true
      outputSummary: "node --test tests/decompose.test.js → exit 0; tests 72, pass 72, fail 0 (5 new H3-interior tests RED→GREEN). decompose H3-mode now parses description+Files→outputs+scopeBoundary+acceptance+verifier; materialized SPEC tasks carry verifier (find-signalless=0) + validate-state end-to-end PASS."
    outputs:
      - kind: file
        path: src/decompose.js
      - kind: file
        path: tests/decompose.test.js
    tags:
      - correctness
      - toolchain
    provenance:
      surfacedAt: 2026-06-15T14:05:45.977Z
      surfacedDuring: skills-restructuring-f0-pente-fino-de-consistencia (review-plan)
      surfacedBy: ai
    context:
      solves: Todo `new plan` materializa tasks sem o interior SPEC, tornando-as não-implementáveis (implement recusa por R-ORCH-23) e não-roteáveis pro lane codex — sem corrigir, todo plano futuro precisa de remendo manual.
      trigger: "O review-plan interno deste plano achou 31/31 tasks sem interior; a causa-raiz é o decompose H3-mode descartar o corpo da task enquanto o SPEC gate exige a forma ### Tn verbosa."
      assumesStillValid:
        - "o SPEC gate continua exigindo a forma ### Tn verbosa (lint-source.js --spec)"
        - src/decompose.js continua sendo o transform canônico do decompose
        - tasks precisam do interior estruturado no schema pra serem dispatcháveis
      ratifiedAt: 2026-06-15T14:05:45.977Z
      ratifiedBy: human
      lastReviewedAt: 2026-06-15T14:05:45.977Z
parked: []
emerged: []
summary: Enxuga o router project e o driver implement movendo conteúdo não-ambiente para lazy.
planTitle: Reestruturação das skills atomic-skills
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Economia de tokens: project e implement**.

## Decisions

- **Executor: Mode 1 (Opus codifica), opt-out do default Codex.** Operador escolheu opt-out do batch F1 para Mode 1 — overlap forte de arquivos (T1.1↔T1.4 em project-transitions.md; T1.2↔T1.3 em implement.md) + `parallelismAllowed: false` zeram o ganho de worktree do Codex; cirurgia de markdown com P3 (preservar semântica) fica mais limpa single-threaded com review inline.
- **T1.1 split semântico (não monolítico).** Schema field-reference + summaries + level-hygiene → project-create-plan.md (usados na materialização); Dashboard rollups + focus markers → project-transitions.md (recomputados em done/phase-done/reconcile — o ponteiro da linha 86 já apontava pra cá). Code-quality gates do router viraram ponteiro (project-create-plan.md já tinha seção fuller; specifics de nextAction/exit-criterion preservados lá).

## Session handoff
- **Narrative:** Fase F1 (5 tasks), Mode 1 — **5/5 fechadas com PASS verificado** (evidência em cada task). T1.1 (project.md 28696→20396B), T1.4 (verifier-exec.md extraído como fonte única, transitions partido hot/cold), T1.2 (implement.md 27001→17931B, anti-patterns asset), T1.3 (Mode-2 stub de 4 itens, implement.md→16107B), T1.5 (decompose H3-mode materializa o interior SPEC, TDD 72/72). **F1-G1 (exit gate) verifica PASS** (exit 0). Pendente: rodar `phase-done` (usuário opta).
- **Decision log:** ver `## Decisions`. Adições: verifier-exec.md como fonte única (callers→project-transitions.md ainda resolvem via ponteiro); 'spec-readiness' 1x no stub Mode-2; decompose parseia o verifier via inline flow-map `{kind: …}` (mesma forma do exit_gate). **Test fix-forward fora de scopeBoundary:** as mudanças T1.1/T1.4 (mover schema-ref do router; mover verifier patterns) invalidaram 2 testes em `tests/project.test.js` que fixavam os locais antigos — atualizei-os ao novo local (não estavam no scopeBoundary de nenhuma task; os verifiers per-task não incluíam `npm test`, então só apareceram no run completo). Surfaçado ao usuário.
- **Single nextAction:** Rodar **`phase-done` de F1** (verifica F1-G1 [PASS, exit 0] + o gate review-code sobre o diff da fase, distila lessons com o usuário, avança currentPhase→F2) — **usuário opta** (intrusive-actions). Depois implementar **F2** (7 tasks, spec-ready), F3 (5), F4 (3) — mesmo ritmo single-threaded. F5 já está done.
- **Fora deste handoff (delegado):** a consolidação das 3 worktrees (design-brief, fix-aideck, multiplan) + o merge final + as 8 falhas pré-existentes de contagem (`countSkills`/`installSkills`) vão para uma **branch de finalização dedicada, conduzida por outro agente** (decisão do usuário, 2026-06-16). NÃO tratar aqui. Lembrete do conflito conhecido para esse agente: `plan/multiplan-focus` edita `skills/core/implement.md`, que a F1 reescreveu — conflito de merge garantido (resolver serial-aware, sem force-resolve).
- **focus.json auto-refresh: RESOLVIDO** nesta sessão. Os hooks de project-status `SessionStart`+`Stop` foram instalados em `.atomic-skills/status/hooks/` e registrados em `.claude/settings.local.json` (local, gitignored). O Stop hook roda `refresh-state` a cada turno → focus.json não fica mais stale. Verificado: stop.sh refrescou um focus.json forçado a 2020 → agora (exit 0). Outro ambiente/clone (ex.: o agente de finalização) precisa registrar o próprio `settings.local.json` — os scripts em `.atomic-skills/status/hooks/` já são commitados/compartilhados.
- **Verbatim state:** `node scripts/validate-state.js .../f1-economia-de-tokens-project-e-implement.md` → exit 0. F1-G1: `test $(wc -c < skills/core/project.md) -lt 22000 && test $(wc -c < skills/core/implement.md) -lt 22000 && grep -q 'mode2-codex-lane' skills/core/implement.md && grep -q 'verifier-exec' skills/shared/project-assets/project-transitions.md && npm run validate-skills` → exit 0. `npm test` → `tests 876, pass 868, fail 8`. **As 8 falhas são PRÉ-EXISTENTES** (baseline confirmado com `git stash`): 3× `countSkills` (tests/detect.test.js — espera '13 core', catalog tem 14 após a skill design-brief/F5) + 5× `installSkills` (tests/install.test.js — contagens de skill/asset). Nenhum gate rodava `npm test`, então ficaram red desde F5. **F1 introduziu 0 falhas líquidas** (as 2 que introduzi em project.test.js foram corrigidas; project.test.js = 34/34).
- **Uncommitted changes:** clean tree. Commits desta sessão no topo de `plan/skills-restructuring` (mais recente primeiro): `feat(project): wire SessionStart+Stop hooks so focus.json auto-refreshes` · `docs(project): record post-merge consolidation checklist` (agora substituído pela delegação acima — histórico) · `chore(project): refresh focus.json digest` · `feat(skills): F1 — economia de tokens em project e implement` (a fase em si: 2 novos assets, fix-forward de tests/project.test.js, backfill benigno de f0). `.claude/settings.local.json` é local (gitignored), não está nos commits.

## Self-review against code-quality gates (F1 implementation)
- **G1 read-before-claim:** applied — cada task fechada linka a source/o run do verifier na sua `evidence.outputSummary`; tamanhos (20396B/16107B) e contagens (72/72 testes, 8 pré-existentes) são de runs reais pastados, não inferidos.
- **G2 soft-language:** applied — claims de conclusão são `passed: true` com exit code observado; handoff escaneado pela ban-list.
- **G6 reference-or-strike:** applied — literais do handoff são paths/comandos/saídas verbatim (verifiers completos, `tests 876 pass 868 fail 8`).

## Links

_(plan doc, external refs)_
