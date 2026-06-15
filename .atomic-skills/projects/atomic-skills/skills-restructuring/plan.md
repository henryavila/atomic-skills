---
schemaVersion: "0.1"
slug: skills-restructuring
title: Reestruturação das skills atomic-skills
version: "1.0"
status: active
started: 2026-06-15T13:37:12.477Z
lastUpdated: 2026-06-15T14:21:04.364Z
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Single-source-of-truth
    body: um contrato vive em um único arquivo; os demais referenciam por ponteiro, nunca recopiam.
  - id: P2
    title: Lazy-load não recolapsa
    body: só gatilho ambiente (Iron Laws, gates, emergence ladder) fica resident; o resto move para detail/asset lazy.
  - id: P3
    title: Preservar comportamento
    body: mover e realocar conteúdo, nunca reescrever a semântica; GATE-R2 determinístico permanece intacto.
  - id: P4
    title: Verifier determinístico por task
    body: cada task fecha só com evidência de um verifier shell/test/query.
  - id: P5
    title: design-brief não contamina
    body: silêncio só na forma visual (camada 1); o modelo de interação (camada 2) e a filosofia/quem-decide (camada 3) são especificados com valores concretos, em blocos obrigatórios por tela. O brief define problema, fluxo, estados, dados, comportamento e filosofia; nunca a solução visual. Spec — docs/design/design-brief-three-layer-briefing.md.
glossary:
  - term: três camadas
    definition: o modelo da anti-contaminação do design-brief — (1) forma visual = silêncio (designer); (2) modelo de interação e (3) filosofia/quem-decide = especificados com valores concretos (produto). Spec em docs/design/design-brief-three-layer-briefing.md.
  - term: resident
    definition: bloco do corpo de uma skill carregado em toda invocação (e a cada turno em contexto).
  - term: promptframe
    definition: artefato que documenta metas de conteúdo e requisitos para a IA de design, deixando a execução visual ao agente de design.
  - term: verifier-exec
    definition: os padrões canônicos de execução de verifier; a fonte única passa a ser skills/shared/project-assets/verifier-exec.md após T1.4 (project-transitions.md apenas aponta para ela).
  - term: DS
    definition: design system (tokens + componentes + 1 template base).
phases:
  - id: F0
    slug: skills-restructuring-f0-pente-fino-de-consistencia
    title: Pente fino de consistência
    goal: corrigir resíduo e drift documental de baixo risco nas skills, sem mudar comportamento.
    dependsOn: []
    subPhaseCount: 7
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F0-G1
          description: Suite de validação de skills passa após as correções de pente fino.
          status: pending
          verifier:
            kind: shell
            command: npm run validate-skills
            expectExitCode: 0
    status: active
    summary: "Quick-wins de consistência: contagem de stages, caminhos mortos, cheat-sheets e gates."
  - id: F1
    slug: skills-restructuring-f1-economia-de-tokens-project-e-implement
    title: "Economia de tokens: project e implement"
    goal: restaurar o router fino e o driver enxuto movendo conteúdo não-ambiente para detail/asset lazy, sem perder comportamento.
    dependsOn:
      - F0
    subPhaseCount: 4
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F1-G1
          description: project.md e implement.md encolhem e a suite de validação continua verde.
          status: pending
          verifier:
            kind: shell
            command: test $(wc -c < skills/core/project.md) -lt 22000 && test $(wc -c < skills/core/implement.md) -lt 22000 && grep -q 'mode2-codex-lane' skills/core/implement.md && grep -q 'verifier-exec' skills/shared/project-assets/project-transitions.md && npm run validate-skills
            expectExitCode: 0
    status: pending
    summary: Enxuga o router project e o driver implement movendo conteúdo não-ambiente para lazy.
  - id: F2
    slug: skills-restructuring-f2-economia-de-tokens-padroes-transversais
    title: "Economia de tokens: padrões transversais"
    goal: aplicar uma receita por padrão repetido em N skills de uma vez. Depende de F1 (verifier-exec.md nasce em T1.4).
    dependsOn:
      - F1
    subPhaseCount: 7
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F2-G1
          description: O asset de envelope existe e a suite de validação passa.
          status: pending
          verifier:
            kind: shell
            command: test -f skills/shared/codex-bridge-assets/envelope-orchestration.md && npm run validate-skills
            expectExitCode: 0
    status: pending
    summary: Uma receita por padrão de bloat aplicada em todas as skills (RF/Rationalization, envelope, gates).
  - id: F3
    slug: skills-restructuring-f3-economia-de-tokens-per-skill
    title: "Economia de tokens: per-skill"
    goal: mover blocos mode-gated e branch-only de cada skill grande para assets lazy, carregando só o branch que roda.
    dependsOn:
      - F2
    subPhaseCount: 5
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F3-G1
          description: A suite de validação passa após os movimentos per-skill.
          status: pending
          verifier:
            kind: shell
            command: npm run validate-skills
            expectExitCode: 0
    status: pending
    summary: Move blocos mode-gated de cada skill grande para assets lazy.
  - id: F4
    slug: skills-restructuring-f4-feature-project-review
    title: "Feature: project review"
    goal: dar ao project um subcomando de auditoria de plano/iniciativa materializados, compondo linters, verify, review-plan e review-code.
    dependsOn:
      - F3
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F4-G1
          description: O subcomando existe e a suite de validação passa.
          status: pending
          verifier:
            kind: shell
            command: test -f skills/shared/project-assets/project-review.md && grep -q 'project review' skills/core/project.md && grep -qiE 'review-plan|review-code|verify' skills/shared/project-assets/project-review.md && npm run validate-skills
            expectExitCode: 0
    status: pending
    summary: Subcomando project review que audita plano/iniciativa materializados.
  - id: F5
    slug: skills-restructuring-f5-nova-skill-design-brief
    title: "Nova skill: design-brief"
    goal: criar a skill design-brief que gera prompts DS-first e telas-consomem-DS, nascida enxuta, ancorada no modelo de 3 camadas + R1–R9 (silêncio só no visual; interação e filosofia especificadas com valores concretos).
    dependsOn:
      - F4
    subPhaseCount: 5
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F5-G1
          description: A skill design-brief e seus assets existem e a validação passa.
          status: pending
          verifier:
            kind: shell
            command: test -f skills/core/design-brief.md && test -f skills/shared/design-brief-assets/ds-prompt.md && test -f skills/shared/design-brief-assets/screens-prompt.md && test -f skills/shared/design-brief-assets/fixtures-recipe.md && test -f skills/shared/design-brief-assets/anti-contamination.md && grep -q 'design-brief-assets' skills/core/design-brief.md && grep -qiE 'modelo de intera|filosofia|guardrail' skills/shared/design-brief-assets/screens-prompt.md && grep -qiE 'tr[eê]s camadas|3 camadas|substituir' skills/shared/design-brief-assets/anti-contamination.md && npm run validate-skills
            expectExitCode: 0
    status: pending
    summary: "Skill design-brief: gera prompts DS-first + telas-consomem-DS, sem contaminar o visual."
references:
  - kind: file
    path: docs/audits/project-implement-audit-2026-06-15.md
    label: Auditoria project+implement (pente fino + economia + integração review-plan)
  - kind: file
    path: docs/audits/token-economy-all-skills-2026-06-15.md
    label: Economia de tokens — todas as skills
planActive: true
planTitle: Reestruturação das skills atomic-skills
---

# Reestruturação das skills atomic-skills

## 1. Context

Consolida pente fino de consistência, economia de tokens da arquitetura, a feature `project review` e a skill nova `design-brief`. Fontes: `docs/audits/project-implement-audit-2026-06-15.md` e `docs/audits/token-economy-all-skills-2026-06-15.md`. Execução prevista via codex (Mode 2) com review Opus.

## 2. Inviolable principles

- **P1 Single-source-of-truth** — um contrato vive em um único arquivo; os demais referenciam por ponteiro, nunca recopiam.
- **P2 Lazy-load não recolapsa** — só gatilho ambiente (Iron Laws, gates, emergence ladder) fica resident; o resto move para detail/asset lazy.
- **P3 Preservar comportamento** — mover e realocar conteúdo, nunca reescrever a semântica; GATE-R2 determinístico permanece intacto.
- **P4 Verifier determinístico por task** — cada task fecha só com evidência de um verifier shell/test/query.
- **P5 design-brief não contamina** — o brief define problema, fluxo, estados, dados e constraints verificáveis; nunca a solução visual.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Reviews

- 2026-06-15 — review interno (local) + codex Pass 1 (gpt-5-codex, needs_changes, 0B/0C/5M). Ver `.atomic-skills/reviews/2026-06-15-1407-skills-restructuring.md`. CRITICAL interno (interior SPEC) corrigido; 5 majors do codex aplicados (glossário F-001, references F-002, gates F1/F4/F5 F-003/004/005).
