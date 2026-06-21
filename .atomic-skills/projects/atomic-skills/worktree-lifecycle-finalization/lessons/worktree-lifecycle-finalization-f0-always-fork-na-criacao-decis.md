---
schemaVersion: "0.2"
slug: worktree-lifecycle-finalization-f0-always-fork-na-criacao-decis
projectId: atomic-skills
parentPlan: worktree-lifecycle-finalization
lessons:
  - id: L-001
    statement: Uma mudança de "virar o default/gatilho" (lazy→always-fork na F0/T-001)
      tem sites de ripple ALÉM do parágrafo-título — bullets irmãos (Pause/Proceed),
      o exemplo de código e a própria premissa da seção (Stage 6 "they share one
      working tree"). O work-order mandou reescrever só o parágrafo e "manter a
      pre-flight intacta", deixando o Stage 6 auto-contraditório (o caminho lazy de
      branch nula no caso solo seguiu documentado e alcançável). O review-code local
      pegou (finding major #1).
    corrective: Quando o spec/work-order muda um default referenciado em prosa,
      ENUMERAR todos os sites dependentes (outros bullets, exemplos de código, a
      premissa/rationale) no próprio spec — o executor edita só os nomeados. E o gate
      review-code do phase-done deve diffar a SEÇÃO inteira do doc, não só a linha
      mudada, para flagrar a meia-aplicação.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: "git 01c2455 (F0 review-gate fix); review-code finding #1 sobre o diff
      d104632..789ca16 em skills/shared/project-assets/project-create-plan.md Stage 6"
    createdAt: 2026-06-17T12:26:23Z
    validatedAt: 2026-06-17T12:26:23Z
  - id: L-002
    statement: Uma asserção de teste de "presença em doc" que casa uma string já
      presente ANTES da mudança é trivialmente verdadeira e não guarda nada — o
      doc-test do Stage 6 asseriu `/plan\/<slug>/`, que já existia no bullet "Own
      worktree" do doc lazy (review-code finding #3).
    corrective: Asserções sobre prosa/doc devem asserir o que MUDOU (a frase
      discriminante ausente na versão anterior). Checagem por asserção nova — "o doc
      pré-mudança passaria nela?"; se sim, reescrever para a frase discriminante (aqui,
      a declaração `todo plano … forka incondicional`).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: "git 01c2455; review-code finding #3 em tests/plan-branch-policy.test.js"
    createdAt: 2026-06-17T12:26:23Z
    validatedAt: 2026-06-17T12:26:23Z
---

# Lessons — F0 Always-fork na criação (worktree-lifecycle-finalization)

Distiladas no phase-done de F0 (pivô Git Flow) a partir de sinal real: o gate
review-code (local) sobre o diff da fase pegou a mudança always-fork **meia-aplicada**
no Stage 6 (finding major #1) e uma asserção de doc-test trivial (#3). Ambas
ratificadas pelo operador. As demais checagens do review (logic/race/error/refs) e os
dois exit-gates (G-1 test 9/9, G-2 focus-digest 11/11 + validate-skills 15/15) passaram.

**Recorrência observada (não nova lição):** a `L-001` do F0 pre-pivot
(`lessons/worktree-lifecycle-finalization-f0-nascimento-da-branch-sob-con.md` — "o
auto-report `ℹ tests N` do Codex é não-confiável") **recorreu** nesta sessão: o Codex
reportou `tests 1` enquanto a suíte real tinha 9. O corrective dela segurou (re-rodei o
verifier determinístico na primária MERGED, não confiei no report), então nenhuma nova
lição foi necessária — o re-run load-bearing fez seu trabalho.

`scope: reusable` + `status: open` ⇒ dispostas no início de cada fase futura via
`node scripts/list-lessons.js --phase <id>`.
