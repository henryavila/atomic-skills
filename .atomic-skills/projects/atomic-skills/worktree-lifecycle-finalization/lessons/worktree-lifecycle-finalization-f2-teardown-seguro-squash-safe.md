---
schemaVersion: "0.2"
slug: worktree-lifecycle-finalization-f2-teardown-seguro-squash-safe
projectId: atomic-skills
parentPlan: worktree-lifecycle-finalization
lessons:
  - id: L-001
    statement: >-
      O teardown prova integração via um estado EXTERNO AUTORITATIVO (`gh pr view`
      state==MERGED + baseRefName==integrationRef + headRefOid) em vez de
      ancestralidade local — porque sob squash-merge `git merge-base --is-ancestor`
      é falso por construção (o squash cria um SHA novo). No review-gate --mode=both
      o pass BLIND cross-model (Codex) levantou isso como um major (F-001:
      "squash-head-match retorna safe sem provar que o baseRef LOCAL contém o
      merge"), DISJOINTO do pass local. A reconciliação informed DROPOU o major sob
      a constraint de que GitHub MERGED é integração autoritativa no remoto
      (independente do origin/<ref> local stale) e o `git branch -d` nativo é uma 2ª
      guarda — confirmando o design aprovado (Decisão 4).
    corrective: >-
      Quando uma decisão de segurança repousa num sinal EXTERNO autoritativo (estado
      de PR mergeado, etc.) em vez de prova local, o revisor cross-model cego vai
      sinalizar o gap "ref local stale" como falso-safe. A reconciliação correta NÃO
      é bolt-on a checagem local que o design deliberadamente omite (sob squash ela é
      impossível) — é tornar a AUTORIDADE explícita como constraint verificável (o
      sinal externo é autoritativo para "mergeado em <ref>") + nomear a 2ª guarda
      nativa (`git branch -d`, não-force). Rodar review-code --mode=both no diff:
      o blind pass levanta, o informed pass reconcilia com a constraint.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      .atomic-skills/reviews/2026-06-17-1651-wlf-f2-teardown.md (codex blind F-001
      major -> informed DROPPED); scripts/worktree-teardown.js squash-head-match path;
      fix/review commit 2a69940
    createdAt: 2026-06-17T16:51:02Z
    validatedAt: 2026-06-17T16:51:02Z
  - id: L-002
    statement: >-
      Guards booleanos compostos (`A || B` retornando um único outcome) escondem um
      gap de cobertura: um teste que exercita só a metade-A passa enquanto uma
      regressão que dropa a metade-B sobe verde. O pass local pegou DUAS dessas
      metades não-testadas em isTeardownSafe — `!live.mergedAt` (do not-merged) e
      `!integrationRef` (do indeterminate-base) — cada uma com só a outra metade
      coberta.
    corrective: >-
      Para cada metade de um guard OR (`A || B`), adicionar um teste que ISOLA aquela
      metade (a outra condição falsa) e confirmar por mutação que dropar a metade
      flipa o reason code (não só o boolean). Espelha a wlf-f0 L-002 (asserções não
      devem ser vacuamente-verdadeiras): a metade não-testada é exatamente onde uma
      regressão passa despercebida. Locus: qualquer guard multi-condição num decision
      layer.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      .atomic-skills/reviews/2026-06-17-1651-wlf-f2-teardown.md (local L-1/L-2);
      tests/worktree-teardown.test.js (+ testes MERGED+mergedAt:null e
      integrationRef-absent); commit 2a69940
    createdAt: 2026-06-17T16:51:02Z
    validatedAt: 2026-06-17T16:51:02Z
  - id: L-003
    statement: >-
      Um decision layer contratado para "sempre retorna um objeto de decisão, nunca
      lança" deixava sua única chamada externa (`gh.prView(prIdentity)`) sem
      try/catch — um adapter que lança (CLI ausente, auth expirada, rede, identidade
      malformada) crashava o caller em vez de surfacar um block seguro. O Codex blind
      pegou (F-002); a reconciliação informed dropou-o como fora-do-contrato-do-adapter,
      mas foi aplicado como hardening por ser consistente com os outros adapters do
      módulo (`defaultGit` já captura) e com o P3 (falha-segura = BLOQUEIA).
    corrective: >-
      Num módulo de decisão fail-safe, a chamada externa/adapter ganha `try/catch ->
      blocked(reason)` (aqui `gh-lookup-failed`), nunca propaga o throw — consistente
      com o estilo defensivo já estabelecido no módulo. Adicionar um teste onde o
      adapter injetado lança e asserir o block. Defense-in-depth não espera o contrato
      do adapter garantir no-throw.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      .atomic-skills/reviews/2026-06-17-1651-wlf-f2-teardown.md (codex blind F-002);
      scripts/worktree-teardown.js try/catch -> blocked('gh-lookup-failed');
      tests/worktree-teardown.test.js (teste de throw); commit 2a69940
    createdAt: 2026-06-17T16:51:02Z
    validatedAt: 2026-06-17T16:51:02Z
---

# Lessons — F2 teardown seguro squash-safe (worktree-lifecycle-finalization)

Distiladas no phase-done de F2 a partir de sinal real: o review-gate `--mode=both`
sobre o diff de código da fase (`scripts/worktree-teardown.js` + os testes). O pass
local (envelope selado) achou 3 minors (gaps de cobertura de guard composto + o
default-gh stub). O pass Codex blind achou um finding major DISJOINTO (F-001, a
squash-path não prova containment local) + 1 minor (F-002, gh.prView pode lançar).
A reconciliação informed do Codex DROPOU ambos os blind sob constraints verificáveis
(GitHub MERGED é integração autoritativa no remoto; `git branch -d` é 2ª guarda nativa;
adapters default fail-closed) — verdict final `approve`. As 3 lessons foram ratificadas
pelo operador. Todos os fixes aplicados são HARDENING (testes de cobertura + fail-safe
try/catch), não correções de bug — o design aprovado (Decisão 4) sustentou-se.

**Confirmação (não-lição nova):** a `mode2 L-001` (o auto-report `-o` do Codex é
não-confiável; o adjudicador é o re-run do verifier na primária MERGED) segurou na
dispatch Mode 2 de T-001: o Codex auto-reportou "passes"; o adjudicador foi o re-run
determinístico na primária merged (17/17, depois 21/21 pós-review). O corrective fez seu
trabalho.

**Confirmação (não-lição nova):** a `design-brief L-001` / `wlf-f1 L-001` (rodar
`review-code --mode=both` num módulo porta-de-mão-única; o cross-model pega o que o local
não pega) validou-se de novo — o Codex pegou o major F-001 disjunto do pass local. O
valor cross-model aqui foi levantar-e-reconciliar (não um blocker sobrevivente), mas
sustenta manter `--mode=both` para módulos safety.
