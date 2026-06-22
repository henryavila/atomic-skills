---
schemaVersion: "0.2"
slug: skills-restructuring-f2-economia-de-tokens-padroes-transversais
projectId: atomic-skills
parentPlan: skills-restructuring
lessons:
  - id: L-001
    statement: >-
      Ao extrair o esqueleto byte-idêntico de N callers para um asset parametrizado
      (T2.2, envelope-orchestration.md), a lista de substituições do esqueleto cobriu só
      a INTERSEÇÃO dos placeholders — {{ARTIFACT_PATH}}, presente apenas no template do
      review-plan (pass1-briefing-template-plan.txt), ficou órfão e seria deixado por
      substituir no briefing codex. O step-3 original do review-plan o substituía.
    corrective: >-
      Ao consolidar um sub-flow compartilhado num asset parametrizado, enumerar a UNIÃO
      dos placeholders/substituições de todos os callers E de cada template-folha que o
      esqueleto preenche — não a interseção. Marcar os caller-only como opcionais ("só
      quando o template do caller os tem"). Antes de fechar a task, fazer grep dos
      templates-folha (pass1-briefing-template-*.txt etc.) por {{...}} que o esqueleto
      precisa cobrir, confirmando que cada um tem uma entrada de substituição.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      review .atomic-skills/reviews/2026-06-16-1856-skills-restructuring-f2.md (finding #1,
      major); fix em commit 2e09b596 (slot «ARTIFACT» + step-3 cobrem {{ARTIFACT_PATH}}).
    createdAt: 2026-06-16T19:00:49Z
    validatedAt: 2026-06-16T19:00:49Z
---

# Lessons — F2 Economia de tokens: padrões transversais (skills-restructuring)

Destilada no phase-done da F2 a partir de um sinal real: 1 finding major do review local
(`review-code --mode=local` sobre `113d5e8..HEAD`) — a extração do esqueleto do envelope
codex (T2.2) cobriu só os placeholders comuns aos dois reviews, deixando `{{ARTIFACT_PATH}}`
(só do review-plan) órfão. Ratificada pelo operador. O finding já foi corrigido em
`2e09b596`; a lição captura a regra geral (UNIÃO, não interseção, ao parametrizar). Aplica
diretamente à F3, que continua movendo blocos para assets lazy. `scope: reusable` +
`status: open` é disposta no início de cada fase futura via
`node scripts/list-lessons.js --phase <id>`.
