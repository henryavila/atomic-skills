---
schemaVersion: "0.1"
slug: skills-restructuring-f2-economia-de-tokens-padroes-transversais
title: "Economia de tokens: padrões transversais"
goal: aplicar uma receita por padrão repetido em N skills de uma vez. Depende de
  F1 (verifier-exec.md nasce em T1.4).
status: pending
branch: null
started: 2026-06-15T13:37:12.477Z
lastUpdated: 2026-06-15T13:54:20.262Z
nextAction: "Start T2.1: Convenção Red Flags e Rationalization em todas as skills"
parentPlan: skills-restructuring
phaseId: F2
tasksDone: 0
tasksTotal: 7
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 7
exitGates:
  - id: F2-G1
    description: O asset de envelope existe e a suite de validação passa.
    status: pending
    verifier:
      kind: shell
      command: test -f skills/shared/codex-bridge-assets/envelope-orchestration.md &&
        npm run validate-skills
      expectExitCode: 0
    verifierLabel: "shell: test -f skills/shared/codex-bridge-assets/envelope-orchestr…"
stack:
  - id: 1
    title: "Economia de tokens: padrões transversais"
    type: task
    openedAt: 2026-06-15T13:37:12.477Z
tasks:
  - id: T2.1
    title: Convenção Red Flags e Rationalization em todas as skills
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Convenção RF/Rationalization aplicada a 6 skills
    description: "Aplicar a convenção: gatilhos one-liner resident, refutação
      deletada quando só reafirma um Red Flag, ou movida para asset lazy por
      skill. Arquivos: skills/core/brainstorm.md, skills/core/fix.md,
      skills/core/hunt.md, skills/core/parallel-dispatch.md,
      skills/core/parallel-dispatch-audit.md, skills/core/debate.md"
    scopeBoundary:
      - não tocar prompt.md nem save-and-push.md (já enxutas); preservar os
        gatilhos one-liner.
    acceptance:
      - no máximo duas dessas skills mantêm uma tabela Rationalization completa.
    verifier:
      kind: shell
      command: test $(grep -rl '## Rationalization' skills/core/brainstorm.md
        skills/core/fix.md skills/core/hunt.md skills/core/parallel-dispatch.md
        skills/core/parallel-dispatch-audit.md skills/core/debate.md | wc -l)
        -le 2
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/brainstorm.md
      - kind: file
        path: skills/core/fix.md
      - kind: file
        path: skills/core/hunt.md
      - kind: file
        path: skills/core/parallel-dispatch.md
      - kind: file
        path: skills/core/parallel-dispatch-audit.md
      - kind: file
        path: skills/core/debate.md
  - id: T2.2
    title: Extrair o esqueleto do envelope codex
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Esqueleto do envelope codex extraído para asset compartilhado
    description: "Extrair os 11-12 passos byte-idênticos do sub-flow codex para
      codex-bridge-assets/envelope-orchestration.md; review-code e review-plan
      passam a referenciar. Arquivos:
      skills/shared/codex-bridge-assets/envelope-orchestration.md,
      skills/core/review-code.md, skills/core/review-plan.md"
    scopeBoundary:
      - deixar em cada review só os deltas artefato-específicos; não tocar os
        assets-folha já corretos.
    acceptance:
      - o asset de orquestração existe
      - ambos os reviews o referenciam.
    verifier:
      kind: shell
      command: test -f skills/shared/codex-bridge-assets/envelope-orchestration.md &&
        grep -q 'envelope-orchestration' skills/core/review-code.md && grep -q
        'envelope-orchestration' skills/core/review-plan.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/codex-bridge-assets/envelope-orchestration.md
      - kind: file
        path: skills/core/review-code.md
      - kind: file
        path: skills/core/review-plan.md
  - id: T2.3
    title: Gates de qualidade por referência, não paráfrase
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Gates G1-G7 por referência, não paráfrase, em 4 skills
    description: "Substituir as paráfrases inline de G1-G7 pelo one-liner de
      referência que code-quality-gates.md prescreve, em brainstorm, hunt, fix e
      review-code. Arquivos: skills/core/brainstorm.md, skills/core/hunt.md,
      skills/core/fix.md, skills/core/review-code.md"
    scopeBoundary:
      - manter o bloco de self-review onde ele molda a saída; remover só as
        definições inline duplicadas.
    acceptance:
      - cada um dos quatro corpos referencia code-quality-gates.md por caminho.
    verifier:
      kind: shell
      command: test $(grep -rl 'code-quality-gates.md' skills/core/brainstorm.md
        skills/core/hunt.md skills/core/fix.md skills/core/review-code.md | wc
        -l) -eq 4
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/brainstorm.md
      - kind: file
        path: skills/core/hunt.md
      - kind: file
        path: skills/core/fix.md
      - kind: file
        path: skills/core/review-code.md
  - id: T2.4
    title: Scaffolds emit-time para assets lazy
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Scaffolds emit-time do parallel-dispatch viram assets lazy
    description: "Mover templates emit-time (prompt skeleton, plan-file template,
      closing report) para assets lazy em parallel-dispatch e
      parallel-dispatch-audit; eleger uma spec canônica para os campos do
      report. Arquivos: skills/core/parallel-dispatch.md,
      skills/core/parallel-dispatch-audit.md,
      skills/shared/parallel-dispatch-assets/templates.md"
    scopeBoundary:
      - não mover gatilhos ambiente; só scaffolds consumidos no passo de emissão.
    acceptance:
      - o asset de templates existe
      - parallel-dispatch encolhe abaixo de 13000 bytes.
    verifier:
      kind: shell
      command: test -f skills/shared/parallel-dispatch-assets/templates.md && test
        $(wc -c < skills/core/parallel-dispatch.md) -lt 13000
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/parallel-dispatch.md
      - kind: file
        path: skills/core/parallel-dispatch-audit.md
      - kind: file
        path: skills/shared/parallel-dispatch-assets/templates.md
  - id: T2.5
    title: Colapsar re-derivação de verifier-exec no verify-claim
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: verify-claim aponta para verifier-exec em vez de re-derivar
    description: "Reduzir o step 4 do verify-claim ao verdict-shape mais ponteiro
      para verifier-exec.md (criado em T1.4); remover a re-derivação da regra
      PASS por-kind. Arquivos: skills/core/verify-claim.md"
    scopeBoundary:
      - não alterar o self-review checkpoint nem a Iron Law do verify-claim.
    acceptance:
      - verify-claim.md referencia verifier-exec
      - a regra de testsCollected aparece no máximo duas vezes.
    verifier:
      kind: shell
      command: grep -q 'verifier-exec' skills/core/verify-claim.md && test $(grep -c
        'testsCollected' skills/core/verify-claim.md) -le 2
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/verify-claim.md
  - id: T2.6
    title: Reduzir debug-techniques inline no fix
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: fix reduz debug-techniques inline a ponteiro
    description: "Reduzir a re-derivação de boundary instrumentation em fix.md a
      gatilho mais ponteiro para debug-techniques.md. Arquivos:
      skills/core/fix.md"
    scopeBoundary:
      - não tocar o Process do fix; só o parágrafo de boundary instrumentation.
    acceptance:
      - fix.md referencia debug-techniques.md.
    verifier:
      kind: shell
      command: grep -q 'debug-techniques' skills/core/fix.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/fix.md
  - id: T2.7
    title: Adicionar ponteiro worktree no parallel-dispatch
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: parallel-dispatch ganha ponteiro para worktree-isolation
    description: "Adicionar a terceira opção de remédio para colisão de escopo
      apontando worktree-isolation.md. Arquivos:
      skills/core/parallel-dispatch.md"
    scopeBoundary:
      - não reescrever as opções existentes; só adicionar a opção worktree.
    acceptance:
      - parallel-dispatch.md referencia worktree-isolation.
    verifier:
      kind: shell
      command: grep -q 'worktree-isolation' skills/core/parallel-dispatch.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/parallel-dispatch.md
parked: []
emerged: []
summary: Uma receita por padrão de bloat aplicada em todas as skills
  (RF/Rationalization, envelope, gates).
planTitle: Reestruturação das skills atomic-skills
planActive: true
---

# Narrative / notes

Initiative for phase **F2 — Economia de tokens: padrões transversais**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
