---
schemaVersion: "0.2"
slug: plan-fork-f3-loop-de-retomada-pause-e-parallel
projectId: atomic-skills
parentPlan: plan-fork
lessons:
  - id: L-001
    statement: >-
      O pass codex cross-model pegou um gap arquitetural disjunto que o pass local
      mesmo-modelo missou. O archive step 2 era uma OFERTA de retomada, não um hard
      gate de controle de fluxo; um executor literal andando os steps cairia no
      finalize (step 3 Plan archival) mesmo em refuse/no-TTY/falha de writeback,
      produzindo exatamente o estado proibido (filho arquivado com pai inconsistente).
      O invariante de transação estava em prosa, não wired como controle de fluxo.
    corrective: >-
      Num procedure doc, uma guarda que protege uma sequência de mutação tem que ser
      um gate de fluxo EXPLÍCITO (PARE antes do step N nesta condição), não só um
      invariante declarado em prosa que um executor literal pula. E rode review-code
      --mode=both em procedimentos de transação/concorrência. Reforça F2 L-004
      (mesmo-modelo é cego aos próprios pontos cegos). Locus
      project-transitions.md archive step 2 (corrigido em b6969e5).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-20-0942-plan-fork-f3.md
    createdAt: 2026-06-20T09:51:26Z
    validatedAt: 2026-06-20T09:51:26Z
  - id: L-002
    statement: >-
      Numa fase cuja lógica é um procedure doc executado por agente (sem executor JS),
      os 8 testes iniciais ficaram quase-tautológicos: re-testavam primitivas já
      cobertas da F2 (recordPendingWriteback) ou asseriam a própria escrita do teste.
      Tanto o pass local quanto o codex marcaram que removendo a lógica do doc os
      testes ainda passariam — não gateavam o contrato que diziam cobrir.
    corrective: >-
      Quando a lógica da fase é um procedure doc sem executor JS, gate o doc com
      testes de CONTRATO do doc (ler o .md e asserir ordem/tokens de guarda via
      indexOf, falhando se o guard sair) e force falhas reais (ex. EISDIR) em vez de
      chamar o recorder direto; nunca asserir a mutação que o próprio teste fez. Locus
      tests/parallel-state.test.js describe procedure-doc contract (b6969e5).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-20-0942-plan-fork-f3.md
    createdAt: 2026-06-20T09:51:26Z
    validatedAt: 2026-06-20T09:51:26Z
  - id: L-003
    statement: >-
      A escrita de retomada pause toca dois arquivos não-atomicamente (parent plan.md
      + initiative da âncora). A versão inicial gravava o marker durável só DEPOIS de
      detectar falha; uma exceção entre os dois writes deixaria estado parcial sem
      marcador de recovery. O codex refinou o error-handling pra marker-before-mutation,
      além do que a nota de crash-window do pass local cobria.
    corrective: >-
      Uma escrita multi-arquivo NÃO-atômica (transação/resume) grava o marker de
      recovery durável ANTES da primeira escrita, e limpa só DEPOIS que todas as
      escritas + o refresh-state tiverem sucesso; em qualquer exceção o marker fica e
      o finalize aborta. Locus project-transitions.md fork-resume step 3 pause/accept
      (b6969e5).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-20-0942-plan-fork-f3.md
    createdAt: 2026-06-20T09:51:26Z
    validatedAt: 2026-06-20T09:51:26Z
---

# Lessons — F3 (loop de retomada, pause e parallel)

Distiladas no phase-done da F3 a partir do review-code --mode=both (local + codex).
Ratificadas pelo usuário. O phase-start gate da F4 dispõe as reusable+open via
`node scripts/list-lessons.js --phase F4`.
