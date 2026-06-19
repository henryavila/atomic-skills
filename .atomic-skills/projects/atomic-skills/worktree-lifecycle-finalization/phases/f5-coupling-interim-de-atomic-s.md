---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f5-coupling-interim-de-atomic-s
title: Coupling interim de .atomic-skills/ (Decisão 5)
goal: conter com o mínimo o coupling do tree `.atomic-skills/` entre feature-PRs
  — `focus.json` (estado-de-sessão regenerável) vai para `.gitignore` como
  carve-out explícito ao "tree versionado", e os JSON append-only de `status/*`
  ganham `.gitattributes merge=union`; a partição estrutural fica como plano
  separado.
status: active
branch: plan/worktree-lifecycle-finalization
started: 2026-06-17T20:30:00Z
lastUpdated: 2026-06-17T20:30:00Z
nextAction: "PHASE BOUNDARY — F5 task 1/1 DONE (gates 0/2 pending, resolvem no
  phase-done). Próximo (operator-prompted, NÃO auto-rodar): phase-done F5 — roda
  exit-gates G-1 (grep merge=union + node --test dispatch-log-merge-union +
  round-trip) + G-2 (validate-skills), review-code --mode=both no diff da fase,
  distila lessons, grava reviewGate no plan.md e avança currentPhase F5→F6."
parentPlan: worktree-lifecycle-finalization
phaseId: F5
tasksDone: 1
tasksTotal: 1
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: focus.json ignorado (já satisfeito) + dispatch-log.json em NDJSON com
      merge=union PROVADO (check-attr + union-merge lossless), pontuais não-unidos;
      round-trip install/uninstall verde com focus.json não-rastreado.
    status: pending
    verifier:
      kind: shell
      command: grep -q 'focus.json' .gitignore && grep -qi 'merge=union'
        .gitattributes && node --test tests/dispatch-log-merge-union.test.js &&
        node --test tests/install-uninstall-roundtrip.test.js
    verifierLabel: "shell: grep merge=union .gitattributes && node --test …merge-union + roundtrip"
  - id: G-2
    description: Suite e skills válidos após o carve-out.
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills
    verifierLabel: "shell: npm run validate-skills"
stack:
  - id: 1
    title: Coupling interim de .atomic-skills/ (Decisão 5)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: dispatch-log.json → NDJSON + merge=union provado (focus.json já ignorado),
      round-trip preservado
    status: done
    closedAt: 2026-06-17T21:00:00Z
    lastUpdated: 2026-06-17T21:00:00Z
    summary: Converte dispatch-log.json (único append-only) para NDJSON e aplica
      merge=union union-safe; focus.json já estava no .gitignore.
    outputs:
      - kind: file
        path: .gitattributes
      - kind: file
        path: .atomic-skills/status/dispatch-log.json
      - kind: file
        path: skills/shared/mode2-codex-lane.md
      - kind: test
        path: tests/dispatch-log-merge-union.test.js
    scopeBoundary:
      - carve-out MÍNIMO de coupling — NÃO particionar estruturalmente o tree
        (plano separado)
      - "`merge=union` SÓ no append-only NDJSON (`dispatch-log.json`); NUNCA nos
        pontuais (`last-review`/`last-session`/`routing` são sobrescritos)"
      - union-merge só é lossless em arquivo line-oriented — por isso o
        `dispatch-log.json` VIRA NDJSON (1 objeto JSON válido/linha), não array
      - a mudança no `.gitignore` é repo-policy manual, FORA do contrato
        install/uninstall (já satisfeita — `focus.json` já ignorado)
      - "dispatch-log.json é STATE-tree (`.atomic-skills/`) → conversão é
        Opus-owned (fence); Codex toca só source (.gitattributes, skill, teste)."
    acceptance:
      - "`dispatch-log.json` é NDJSON: cada linha um objeto JSON válido, o arquivo
        não é mais um array único"
      - "`.gitattributes` aplica `merge=union` a
        `.atomic-skills/status/dispatch-log.json` (provado por `git check-attr`) e
        NÃO aos pontuais; `focus.json` segue ignorado no `.gitignore` (pré-existente)"
      - "um teste PROVA a losslessness do union-merge (`git merge-file --union`
        sobre fixtures NDJSON, dois appends concorrentes → ambas as linhas
        presentes, cada uma JSON válido) — não só grep"
      - "`skills/shared/mode2-codex-lane.md` instrui append NDJSON (1 linha por
        registro), não append-ao-array"
      - round-trip install/uninstall segue verde; statusline ainda acha focus.json.
    verifier:
      kind: shell
      command: grep -q 'focus.json' .gitignore && grep -qi 'merge=union'
        .gitattributes && node --test tests/dispatch-log-merge-union.test.js &&
        node --test tests/install-uninstall-roundtrip.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T21:00:00Z
      exitCode: 0
      passed: true
      outputSummary: "Verifier completo exit 0 na primária MERGED @ 59ee587 + conversão
        Opus: grep focus.json (.gitignore, pré-existente) + grep merge=union
        (.gitattributes) + node --test dispatch-log-merge-union (3/3 pass: wired,
        pointwise-not-union, NDJSON union lossless) + round-trip 4/4. git check-attr
        prova dispatch-log.json→union e last-review.json→unspecified. validate-skills
        15/15, validate-state exit 0. dispatch-log.json migrado array→NDJSON (16
        records, round-trip parse lossless). Mode 2 Codex (impl/wlf-f5-t-001, ff
        59ee587); auto-report -o 'pass 1' DESCARTADO per wlf-f0-nascimento L-001
        (real 3/3); Codex adaptou require→import (repo ESM) corretamente; fence:
        conversão do dispatch-log Opus-owned, Codex só source."
parked: []
emerged: []
summary: "Contém o coupling de .atomic-skills: focus.json ignorado + status/*
  com merge=union."
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F5 — Coupling interim de .atomic-skills/ (Decisão 5)**.

## Session handoff
- **Narrative:** **F5 — task 1/1 DONE** (gates 0/2 pending, resolvem no `phase-done`).
  PHASE BOUNDARY. T-001 em **Mode 2/Codex** (escolha do operador, reconfirmada após
  re-escopo): Codex fez o source (`.gitattributes`, `mode2-codex-lane.md` §9 NDJSON,
  `tests/dispatch-log-merge-union.test.js`) em `impl/wlf-f5-t-001`, ff-merged `59ee587`;
  a conversão `dispatch-log.json` array→NDJSON (state-tree) foi **Opus-owned** (fence).
  Re-verificado na primária MERGED: verifier exit 0, merge-union 3/3, round-trip 4/4,
  validate-skills/state verdes.
- **Decision log:** (1) Grounding achou `focus.json` já no `.gitignore` (1º critério
  pré-satisfeito) + a Decisão 5 literal (union em array pretty-printed) corromperia JSON
  → **refinada (ratify human) para NDJSON+union**. (2) Verifier reforçado para PROVAR o
  merge (`check-attr` + `merge-file --union`), não só grep (per L-001 deste plano).
  (3) Auto-report `-o` do Codex "pass 1" DESCARTADO — real 3/3 (wlf-f0 L-001 RE-confirmada
  uma 2ª vez no plano). (4) Codex adaptou `require`→`import` (repo ESM) — desvio correto.
- **Single nextAction:** **(operator-prompted)** Rodar `phase-done F5`: exit-gates G-1
  (grep merge=union + node --test dispatch-log-merge-union + round-trip) + G-2
  (validate-skills), `review-code --mode=both` no diff da fase, distila lessons, grava
  `reviewGate` no `plan.md` e avança `currentPhase` F5→F6.
- **Verbatim state:** Commits desta sessão (F5): `bbeb0f3` (amend SPEC NDJSON),
  `59ee587` (feat Codex source, ff), próximo: `chore(project): done F5/T-001` (conversão
  NDJSON + estado). Worktree `impl/wlf-f5-t-001` a remover pós-commit. **Follow-up
  herdado:** PROJECT-STATUS.md ainda precisa de regen completo via `project-status`.

## Decisions

- **Decisão 5 refinada (NDJSON for union-safety):** `merge=union` só é lossless em
  arquivos line-oriented. O único append-only de `status/*` é o `dispatch-log.json`,
  um array JSON pretty-printed onde union-merge produziria JSON inválido (`}` seguido
  de `{` sem vírgula). Resolução ratificada (human): converter `dispatch-log.json` para
  NDJSON (1 objeto/linha) e então aplicar `merge=union` — a única realização que entrega
  o intento da Decisão 5. Os pontuais (`last-review`/`last-session`/`routing`) NÃO são
  unidos. O verifier PROVA o merge (`git check-attr` + `git merge-file --union` sobre
  fixtures), não só `grep` (per L-001 deste plano: verifier happy-path racionaliza o gap).
- **focus.json:** o carve-out (`.atomic-skills/focus.json` no `.gitignore`) já estava
  presente de sessão anterior — 1º critério da T-001 pré-satisfeito; o trabalho restante
  é só o union-safety do dispatch-log.
- **Routing:** T-001 mantida em Mode 2 (Codex) para dogfood da lane (operador), apesar
  do escopo auto-referencial. State-fence: a conversão do `dispatch-log.json`
  (state-tree) é Opus-owned; Codex toca só source (.gitattributes, skill, teste).

## Links

_(plan doc, external refs)_
