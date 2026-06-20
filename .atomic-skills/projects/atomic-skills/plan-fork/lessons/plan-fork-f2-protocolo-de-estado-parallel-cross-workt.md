---
schemaVersion: "0.2"
slug: plan-fork-f2-protocolo-de-estado-parallel-cross-workt
projectId: atomic-skills
parentPlan: plan-fork
lessons:
  - id: L-001
    statement: atomicWriteback retornava um conflito (token-mismatch / lock-timeout)
      sem gravar o pendingWriteback durável — deixava o registro de recuperação pro
      caller; um crash ou tratamento errado do caller perdia a recuperação e o fork
      parallel ficava não-convergido. O codex (cross-model, disjunto) pegou; o pass
      local mesmo-modelo não.
    corrective: A função que DETECTA um conflito deve gravar o marcador de recuperação
      durável ela mesma, ANTES de retornar (uma API única de conflito tipo
      writebackOrDefer), nunca confiar no caller para registrar. Locus
      src/parallel-state.js writebackOrDefer (4e23baf da F2, commit 1f24eb3).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-20-0120-plan-fork-f2.md
    createdAt: 2026-06-20T01:33:14Z
    validatedAt: 2026-06-20T01:33:14Z
  - id: L-002
    statement: Um token de revisão null contra um arquivo canônico ausente passava o
      CAS (null === null) e criava estado no lugar errado, em vez de abortar a
      resolução. Codex disjunto.
    corrective: Um alvo canônico ausente é um erro de resolução (abort/conflict), não
      um estado vazio gravável; só permitir criar sob uma flag explícita
      (allowCreate=false por default). Locus src/parallel-state.js atomicWriteback
      guard canonical-absent.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-20-0120-plan-fork-f2.md
    createdAt: 2026-06-20T01:33:14Z
    validatedAt: 2026-06-20T01:33:14Z
  - id: L-003
    statement: O file lock (.links.lock O_EXCL) sem pid+timestamp e sem TTL fazia um
      writer crashado bricar o canal de writeback do pai pra sempre; e o retry-loop
      sem delay (~1ms total) não serializava processos concorrentes, devolvendo false
      lock-timeout. Local #1/#2 = codex F-002, cross-confirmado.
    corrective: Num file lock advisory, carimbe pid+timestamp e recupere o stale (pid
      morto via kill(pid,0) OU lock mais velho que um TTL); use backoff síncrono real
      entre tentativas. O content-hash CAS continua sendo a garantia de correção; o
      lock é só pra reduzir false-conflicts. Locus src/parallel-state.js
      isStaleLock/atomicWriteback.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-20-0120-plan-fork-f2.md
    createdAt: 2026-06-20T01:33:14Z
    validatedAt: 2026-06-20T01:33:14Z
  - id: L-004
    statement: O pass local mesmo-modelo achou os bugs mecânicos de lock/temp mas
      MISSED os 2 gaps arquiteturais (conflito-sem-registro L-001, write-token-null
      L-002) que o codex cross-model pegou blind — confirmando que o mesmo-modelo é
      cego aos próprios pontos cegos num contrato de concorrência.
    corrective: Para uma fase que produz um contrato one-way-door (protocolo de
      concorrência, schema porta-de-mão-única, caro de reverter), rode review-code
      --mode=both mesmo com DESTRUCTIVE=false. Reforça design-brief-F0 L-001 (recorrência
      explícita do mesmo padrão).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-20-0120-plan-fork-f2.md
    recurrenceOf: L-001
    createdAt: 2026-06-20T01:33:14Z
    validatedAt: 2026-06-20T01:33:14Z
  - id: L-005
    statement: O teste rotulado "concurrency" rodava dois atomicWriteback em SEQUÊNCIA
      num processo só — não exercia o lock; uma mutação removendo openSync(wx) ainda
      passaria. Codex F-005 / nota do pass local.
    corrective: Para testar que um lock GATEIA, pré-crie um lock vivo+fresh e asserte
      que o contender recebe lock-timeout (sem escrever), ou use worker_threads com
      uma barreira; sempre nomeie a mutação que o teste mata. Locus
      tests/parallel-state.test.js "the lock actually GATES".
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-20-0120-plan-fork-f2.md
    createdAt: 2026-06-20T01:33:14Z
    validatedAt: 2026-06-20T01:33:14Z
---

# Lessons — plan-fork F2 (Protocolo de estado parallel cross-worktree)

Destiladas no phase-done da F2, a partir dos 11 achados confirmados do `review-code`
`--mode=both` (local 6 + codex 5, 3 cross-confirmados + 2 disjuntos só do codex) sobre
`669cac6..HEAD` — ver `.atomic-skills/reviews/2026-06-20-0120-plan-fork-f2.md`.
Ratificadas pelo operador (L-001..L-005). Todos os 11 corrigidos em `1f24eb3` antes do
gate F2-G1 ser marcado `met`. L-004 é `recurrenceOf` L-001 do tema "cross-model pega o
ponto cego do mesmo-modelo".
