---
schemaVersion: "0.2"
slug: worktree-lifecycle-finalization-f4-check-de-colisao-cross-wt-no
projectId: atomic-skills
parentPlan: worktree-lifecycle-finalization
lessons:
  - id: L-001
    statement: >-
      T-001 especificava uma camada de DECISÃO fail-closed (P3: em indeterminação,
      BLOQUEIA), roteada a Mode 2 (Codex). O executor construiu EXATAMENTE o spec — e o
      acceptance só descrevia o happy-path (detecção genérica de comandos, ativa só com
      ≥2 WTs, conflito textual 1º gate, skip registrado, função pura). Os três furos
      caíram todos no espaço-negativo NÃO-especificado: (1) `crossWtGate` retornava `pass`
      com merge-probe indeterminado (`undefined`/`null`/`{}`) — fall-through ao build em
      vez de bloquear (codex F-001); (2) `crossWtGate(null)` lançava `TypeError`, violando
      o contrato "never-throws" (o `= {}` só cobre `undefined`) (codex F-002); (3) um
      result de runner malformado (sem `exitCode` numérico) era classificado como
      `project-command-failed` (falha real de build) em vez de bloqueio por adapter
      indeterminado (codex F-003 emerged). Os 16 testes happy-path passavam E o review
      local mesmo-modelo perdeu os três — só o pass Codex cross-model pegou.
    corrective: >-
      Para uma camada fail-closed, todo input indeterminado/null/malformado NÃO é
      tratamento de borda — é A FEATURE. O work-order/SPEC tem que fixar o contrato de
      espaço-negativo explicitamente ("só um resultado positivo explícito prossegue; todo
      o resto — indeterminado, null, malformado — BLOQUEIA") E o acceptance tem que
      enumerar esses casos como testes obrigatórios; senão um verifier happy-path + um
      review mesmo-modelo racionalizam a omissão em uníssono e a suite fica verde sobre o
      buraco. Rotear a um executor foreign (Mode 2) AMPLIFICA o risco: o executor não tem
      latitude para "também tratar os casos esquisitos" — constrói o spec ao pé da letra,
      então o spec É o teto da robustez. Rodar `review-code --mode=both`: o cross-model é
      o que pega o espaço-negativo ausente que o mesmo-modelo racionaliza (espelha
      wlf-f1/f2/f3 L-001). Sub-ponto: um guard escrito como OR composto (`A || B`) precisa
      de um teste isolando CADA metade — um único teste que satisfaz as duas deixa
      qualquer uma deletável sem quebrar a suite (local L1/L2, G3 anti-tautologia). Locus:
      scripts/cross-wt-gate.js (guards de crossWtGate) + acceptance da T-001.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      .atomic-skills/reviews/2026-06-17-2030-wlf-f4-cross-wt-collision.md (codex blind
      F-001/F-002 major fail-closed+never-throws; informed emerged F-003 runner-malformed;
      local L1/L2 OR-guard isolation); scripts/cross-wt-gate.js (merge-indeterminate +
      crossWtGate(options={}) normalize + runner-malformed-result guards);
      tests/cross-wt-gate.test.js 16→22; fix commit cf07d12
    createdAt: 2026-06-17T20:30:00Z
    validatedAt: 2026-06-17T20:30:00Z
  - id: L-002
    statement: >-
      T-003 wirou o consumidor (`archive`→`isTeardownSafe({branch, baseRef,
      integrationRef, prIdentity})` em `project-transitions.md`), fechando o follow-up que
      a wlf-f3 L-003 surfaceou — mas `project-finalize.md` Step 4 continuou DIZENDO que o
      wiring era um "open follow-up usando `isTeardownSafe({branch, baseRef})`", agora
      stale e contradizendo o consumidor wirado. O Codex blind F-003 / informed F-004
      pegou o anúncio obsoleto; o review local mesmo-modelo perdeu.
    corrective: >-
      Um follow-up cross-doc tem DOIS sítios — o gap (no consumidor) e o lugar onde ele é
      ANUNCIADO (na prosa do produtor). Fechar o gap sem riscar o anúncio deixa a doc do
      produtor mentindo. Quando você fecha um follow-up cujo wiring mora no arquivo de
      outra phase, re-ler a prosa do OUTRO lado do contrato produtor/consumidor e
      reconciliar os DOIS sítios na MESMA mudança. Isto é o espelho exato de wlf-f3 L-003
      (que era: não alegar `closed` quando está `open`) — aqui é o inverso (não deixar
      alegado-`open` quando já está `closed`). A burndown: o par de docs produtor/consumidor
      desincroniza nas DUAS direções; sempre que um lado muda, reconciliar a alegação do
      outro. Locus: project-finalize.md Step 4 ↔ project-transitions.md archive Step 5.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    recurrenceOf: worktree-lifecycle-finalization-f3-project-finalize-dedicado-de/L-003
    evidence: >-
      .atomic-skills/reviews/2026-06-17-2030-wlf-f4-cross-wt-collision.md (codex blind
      F-003 minor -> informed F-004 minor, stale "open follow-up");
      skills/shared/project-assets/project-finalize.md Step 4 (reescrito: handoff wired,
      both halves, aponta archive Step 5); fix commit cf07d12
    createdAt: 2026-06-17T20:30:00Z
    validatedAt: 2026-06-17T20:30:00Z
---

# Lessons — F4 check de colisão cross-WT no finalize (worktree-lifecycle-finalization)

Distiladas no phase-done de F4 a partir de sinal real: o review-gate `--mode=both` sobre
o diff de código da fase (`scripts/cross-wt-gate.js` + `tests/cross-wt-gate.test.js` novos
da T-001/Mode 2, mais `project-finalize.md` Step 1.5 da T-002 e `project-transitions.md`
archive Step 5 da T-003). O pass local (envelope selado, mesmo-modelo) achou 6 findings
(2 major de cobertura de teste de OR-guard, 4 minor de doc/detector). O Codex blind achou
2 major + 1 minor; o informed reconciliou para 4 (0 dropped, 3 maintained, 1 emerged),
incl. o emerged `runner-malformed-result`. Todos aplicados (`cross-wt-gate.js` +
`project-finalize.md` + `project-transitions.md`), commit `cf07d12`; suite re-verificada
na primária MERGED: `node --test tests/cross-wt-gate.test.js` → 22/22, exit 0; verdict
efetivo needs_changes→all-fixed.

**Validação da decisão `--mode=both` (cross-model):** os DOIS findings major mais sérios
(fail-closed em merge indeterminado; never-throws em `crossWtGate(null)`) foram pegos SÓ
pelo Codex — o review local mesmo-modelo passou por cima dos dois. Quarta fase
consecutiva (wlf-f1/f2/f3/f4) em que o cross-model pega uma classe que o mesmo-modelo
racionaliza. A L-001 é a generalização dessa recorrência para o caso fail-closed: o
espaço-negativo tem que estar no SPEC + verifier, não confiado ao review.

**Recorrência (sinal de burndown):** L-002 é `recurrenceOf` wlf-f3 L-003 — o mesmo par de
docs (`finalize.md` Step 4 ↔ `transitions.md` archive) desincronizou de novo, agora na
direção inversa (a F3 deixou alegado-`open` o que a F4 fechou). O contrato produtor/consumidor
cross-doc continua exigindo reconciliação bidirecional a cada mudança de qualquer lado.
