---
name: handoff-real-automate-2026-09-25
description: Ponto de retomada do plano real-automate depois do pause/format 2026-09-25. Ler isto antes de materializar F2.
metadata:
  type: reference
---

# Handoff — real-automate (pause 2026-09-25)

A máquina local vai ser formatada. O trabalho está no GitHub em
`origin/plan/real-automate`. A memória local do Grok (`~/.grok/memory-v2`)
some com o disco. Esta pasta `.ai/memory/` é o que sobrevive.

## Como retomar numa máquina limpa

```bash
git clone git@github.com:henryavila/atomic-skills.git
cd atomic-skills
git fetch origin plan/real-automate
git worktree add .worktrees/real-automate origin/plan/real-automate
cd .worktrees/real-automate
```

Ler, nesta ordem:

1. `.ai/memory/MEMORY.md`
2. este arquivo
3. `.ai/memory/decisao-unattended-bloco.md` (contrato; o plano manda se discordar)
4. `.atomic-skills/projects/atomic-skills/real-automate/plan.md`

Branch de segurança no origin, mesmo commit:
`backup/pre-format-2026-09-25-real-automate`.

## Onde parou

| Item | Estado |
|---|---|
| Branch | `plan/real-automate` (não existia no origin até este push) |
| `currentPhase` | **F2** Protótipo, `status: pending`, descriptor-only |
| F0 Partida que recusa | **done**, arquivada em `phases/archive/2026-09-f0-partida-que-recusa.md` |
| F1 Cartão de bloco | **done**, arquivada em `phases/archive/2026-09-f1-cartao-de-bloco.md` |
| Cursor | `.atomic-skills/status/automate/real-automate.json` → `awaiting-operator-advance`, `phaseId: F1` |
| Próxima ação gravada na F1 | `present phase-start package for F2 validate-only` |
| Detector de arquitetura | existe: `scripts/find-missing-architecture.js` + 15 testes |
| Detector de UI | **não existe** (`find-missing-ui.js` é a F2) |
| Spawn do writer | F3; `automate-run.js` ainda para antes de disparar writer |
| Flow | ratificado `2026-09-25T17:43:12.500Z`, `ratifiedBy: operator`, sha `8210bfc367f08e…` |
| Ground-truth receipt | `fp=f1ed5608e242` em `## Reviews`; o **corpo** do ground-truth ficou velho (ainda diz que o detector de arquitetura não existe) |

HEAD no pause: `9907b895` `chore(project): advance real-automate F1`.

## O que fazer na próxima sessão

1. Reinstalar o pacote no host (hooks da caneta não vêm de um clone cru).
2. Abrir o worktree da `plan/real-automate`.
3. Materializar F2 (`atomic-skills:project materialize` da fase Protótipo). O sidecar
   `phases/f2-prototipo.source.json` já tem T-001/T-002/T-003.
4. Antes de `implement`, restampar ground-truth: o texto em `## Ground-truth review`
   ainda trata `find-missing-architecture.js` como ausente e `--require-external`
   como não criado. Editar o plano sem restampar deixa o `fp=` stale.
5. Implementar F2: `scripts/find-missing-ui.js` + `tests/find-missing-ui.test.js`,
   e `automate-run.js` passando a chamar esse detector.
6. Não implementar F3 (writer/merge) nesta fatia.

F2 T-001: `ui/ui.json` lista telas com path+sha, ou `{ "none": true }` com motivo.
F2 T-002: recusa `none: true` se o plano toca Vue/sheet/viewer/editor; recusa sha
de arquitetura divergente; `exitGateType: ui-gate` não é o carimbo.
F2 T-003: `automate-run.js` chama `find-missing-ui.js`.

## Decisões que a próxima sessão não pode reabrir

- Flag `--automate`. Não existe `--unattended`.
- A skill não é o enforce. Portas = exit code em `scripts/automate-run.js`.
- Chat “aprovado” / “ok” não carimba flow nem validação. Flow: seletor
  `Sim, é isso` → `flow-ratification.js --ratify`. Validação final: botão da página.
- Review both: CLI externo (`claude`/`codex`/`grok`) ≠ host aberto. Recibo com
  comando, exit, stderr, veredito. Linha `- internal:` no `plan.md` não conta.
  `--require-external` existe e a partida tem de passá-la.
- Codex 401 (stderr real) nas reviews F0/F1 autorizou descer para local. “Sem token”
  só no chat não autoriza.
- Unidade de trabalho = **fase** (todas as tasks pending). Não usar “unidade”.
- No grafo, manter em inglês: gate, review, CLI, PR, merge, audit, critical, major.
  Processo em português.
- Estados da corrida: ociosa, recusada, rodando, travada, mudanca_grande,
  aguardando, validada. Implement/review/fix/audit vivem no grafo, não como
  estados extra.
- Hosts da caneta: Claude Code, Codex, Grok. Cursor/Gemini = no-op.
- `lastAssert` em `src/maestro-cursor.js` é cursor da sessão. Quem fecha a fase
  pode gravar; a sessão orquestradora não.
- Cada fase deste plano só fecha com o **teste da própria fase** em exit 0.

Contrato longo: `.ai/memory/decisao-unattended-bloco.md`.
O `plan.md` manda quando os dois discordam.

## Recibos F0/F1 (já no git)

- Reviews F1: `.atomic-skills/reviews/2026-09-25-real-automate-F1-local.md`,
  `…-F1-codex-stderr.md`, `audit-delivery-real-automate-F1.md`
- Claims F1: `.atomic-skills/status/automate/real-automate-claims.json`
  (T-001/T-002/T-003 `claimed-pass`)
- F1 fechou com dual-leg (local + Codex 401 stderr) e delivery audit CLOSED.

## O que esta máquina local tinha e o git não precisa

- Worktrees de writer (`real-automate-F0-fix3`, `real-automate-F1-fix1`) — commits
  já merged em `plan/real-automate`.
- `~/.grok/memory-v2` — consolidado neste handoff + `decisao-unattended-bloco.md`.
- Identity git do automate neste worktree: `Test <test@local>`. Commits humanos
  deste pause usam Henry Ávila.
