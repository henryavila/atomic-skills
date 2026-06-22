---
schemaVersion: "0.2"
slug: skills-restructuring-f3-economia-de-tokens-per-skill
projectId: atomic-skills
parentPlan: skills-restructuring
lessons:
  - id: L-001
    statement: >-
      Mover um bloco verbatim para um asset lazy lido standalone deixa referências
      relativas no texto movido ("above", "this skill", "below", "the section below")
      com antecedente pendurado — o leitor do asset não tem o corpo da skill em volta.
      Na F3 gerou 2 findings minor no review local: gate-mode.md "everything above is
      unchanged" e directory-triage.md "the table template from this skill" (a tabela
      Phase 6 vive em hunt.md, não no asset).
    corrective: >-
      Ao extrair um bloco para um asset standalone, reescrever cada referência relativa
      para absoluta/self-contained NO MOMENTO do move: nomear skill+seção explicitamente
      ("the hunt skill (hunt.md → Phase 6 Hunt Report)") em vez de "this skill", e trocar
      "above/below" pelo alvo real. Antes de fechar a task, rodar
      `grep -nE 'above|below|this skill|this section' <asset>` e resolver cada hit.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      review .atomic-skills/reviews/2026-06-16-1941-skills-restructuring-f3.md
      (findings #1 minor, #2 minor); fix em commit aa1c16c.
    createdAt: 2026-06-16T19:45:00Z
    validatedAt: 2026-06-16T19:45:00Z
  - id: L-002
    statement: >-
      O gate de review do phase-done computa o sinal DESTRUCTIVE sobre o diff de fase;
      mover DOCUMENTAÇÃO que lista tokens destrutivos (review-code descreve `DROP TABLE`,
      `rm -rf`, `DELETE FROM`, etc.) injeta esses tokens como linhas adicionadas e dispara
      DESTRUCTIVE=TRUE falsamente, escalando para `--mode=both` (custo Codex) numa fase
      puramente de relocação. Na F3 o único trigger foi a doc da review-code realocada para
      diff-capture.md.
    corrective: >-
      Quando o sinal DESTRUCTIVE vem só de strings de documentação realocadas, verificar
      os três fatos (nenhum arquivo inteiro deletado + additions ≥ deletions + os tokens
      estão em doc, não em migração/código real) e tratar como falso-positivo: registrar
      override destructive→local no reviewGate e no review file. Reconhecer o padrão antes
      de pagar o custo cross-model.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      review .atomic-skills/reviews/2026-06-16-1941-skills-restructuring-f3.md
      (seção Destructive signal: additions 614 ≥ deletions 510, 0 whole-file deletes).
    createdAt: 2026-06-16T19:45:00Z
    validatedAt: 2026-06-16T19:45:00Z
---

# Lessons — F3 Economia de tokens: per-skill (skills-restructuring)

Destiladas no phase-done da F3 a partir de sinais reais do review local
(`review-code --mode=local` sobre `c895e50..1c55a32`, 2 findings minor, 0 blocker/
critical/major) e do gate de review em si. Ratificadas pelo operador.

- **L-001** (verbatim-move dangling references): os 2 minors do review eram referências
  relativas que perderam o antecedente ao serem lidas standalone no asset. Corrigido em
  `aa1c16c`. A regra geral — self-contain o texto movido — aplica diretamente à F4, que
  continua compondo/movendo blocos de skill.
- **L-002** (DESTRUCTIVE false-positive ao realocar doc de tokens): aplica a qualquer fase
  futura que mova conteúdo de/para review-code ou que documente tokens perigosos.

`scope: reusable` + `status: open` são dispostas no início de cada fase futura via
`node scripts/list-lessons.js --phase <id>`.
