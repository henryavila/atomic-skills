---
schemaVersion: "0.2"
slug: deadline-burnup-forecast-f4-geracao-de-dados-de-calibracao-endu
projectId: atomic-skills
parentPlan: deadline-burnup-forecast
lessons:
  - id: L-001
    statement: >-
      O verifier de uma task cobria só o teste do comportamento NOVO, não os
      testes estruturais/de-contrato que já guardam os arquivos que a task editou.
      T-001 editou `skills/shared/project-assets/project-transitions.md` (guardado
      por `tests/transition-emits.test.js`), mas seu verifier só rodava
      `tests/append-completion-actuals.test.js` — então uma regressão de prosa
      (cláusula anti-duplicação virou início-de-frase, quebrando um match
      case-sensitive) PASSOU o gate da task e só apareceu na varredura full-suite
      do phase-done.
    corrective: >-
      No decompose/SPEC, para CADA arquivo nos `Files` de uma task, fazer grep dos
      testes existentes que leem/asseram aquele arquivo e incluí-los no `verifier`
      da task — não só o teste do comportamento novo. Alternativa/complemento:
      rodar a suíte completa no fechamento da task (não apenas no phase-done), para
      que uma regressão fora do verifier estreito apareça no gate da task, não uma
      fase depois.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-1952-code-deadline-burnup-forecast-f4.md
    createdAt: 2026-06-19T19:53:26Z
    validatedAt: 2026-06-19T19:53:26Z
  - id: L-002
    statement: >-
      Um identificador phase-LOCAL (`taskId` — `T-001` recorre em toda fase) usado
      como chave de um conjunto cross-fase precisa ser phase-scoped
      (`<phaseId>/<taskId>`). F4 acertou isso no match do dispatch-log
      (plan+phase+taskId) mas, no MESMO feature, chaveou o corte de grandfather do
      closedAt por `taskId` puro — então grandfatherar um `F0/T-001` antigo eximia
      silenciosamente um `F1/T-001` novo, derrotando o gate forward-only (finding
      CRITICAL pego só pelo pass codex cross-model; o review local mesmo-modelo não
      pegou).
    corrective: >-
      Ao construir um Set/Map chaveado por `taskId` através de iniciativas/fases,
      sempre scopar por fase. E tratar uma inconsistência mesma-feature (um site
      chaveia scoped, um site irmão chaveia por id puro) como gatilho de review —
      é o sinal de que o autor já tinha o padrão certo num lugar e o esqueceu no
      outro. Reforça design-brief-SoT/L-001: rodar `review-code --mode=both` em
      fase de contrato mesmo com diff aditivo (o cross-model se pagou aqui).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-1952-code-deadline-burnup-forecast-f4.md
    createdAt: 2026-06-19T19:53:26Z
    validatedAt: 2026-06-19T19:53:26Z
  - id: L-003
    statement: >-
      Uma capacidade adicionada a um sistema que já expõe múltiplos
      paths/layouts precisa cobrir TODOS eles, senão o path não-coberto degrada em
      silêncio. `harden-closedat.js` varria só o layout nested (`phases/`) embora o
      validador suporte nested E flat (`plans/` + `initiatives/`) → grandfather
      vazio num plano flat. `appendCompletion` derivava dispatch-actuals só na CLI,
      mas a prosa da transição oferece CLI E forma programática → a forma
      programática perdia os actuals. Ambas as lacunas eram silenciosas e foram
      pegas pelo codex.
    corrective: >-
      Ao tocar uma superfície que o sistema já expõe por múltiplas variantes
      (layouts de arquivo, caminhos de invocação CLI vs programático), enumerar
      essas variantes existentes ANTES de implementar e cobrir cada uma — ou
      rejeitá-la explicitamente com erro claro. "Funciona no caminho que eu testei"
      não é cobertura quando o sistema documenta/suporta outros.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-19-1952-code-deadline-burnup-forecast-f4.md
    createdAt: 2026-06-19T19:53:26Z
    validatedAt: 2026-06-19T19:53:26Z
---

# Lessons — deadline-burnup-forecast F4 (Geração de dados de calibração + endurecer closedAt)

Distiladas no phase-done de F4, ratificadas pelo operador. Sinais de falha reais:

- **L-001** veio de uma regressão de T-001 achada na varredura full-suite durante T-003 (não pelo verifier estreito de T-001). Corrigida na fase (commit `d2d3cf0`).
- **L-002** veio do finding CRITICAL do pass codex cross-model (`gpt-5-codex`), disjunto do review local — grandfather do closedAt chaveado por taskId puro. Remediado com chave `<phaseId>/<taskId>` (commit `8a088d4`) + teste de mutação (same-id-outra-fase ainda gateado).
- **L-003** veio de dois findings major do codex (F-002 flat layout no harden-closedat; F-003 path programático do appendCompletion sem actuals). Remediados em `8a088d4`.

Dispostas no gate de início das próximas fases via `node scripts/list-lessons.js --phase <id>` (appliesTo: [] = todas).
