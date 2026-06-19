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
nextAction: "Start T-001: focus.json git-ignore + status/* merge=union, com
  round-trip preservado"
parentPlan: worktree-lifecycle-finalization
phaseId: F5
tasksDone: 0
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
    status: pending
    lastUpdated: 2026-06-17T20:45:00Z
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
