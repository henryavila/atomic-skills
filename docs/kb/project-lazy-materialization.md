# Project lazy materialization

Referencia operacional para o ciclo `atomic-skills:project new plan` -> `materialize <phase>` em planos multi-fase.

## Contrato

**Regra.** `new plan` materializa somente a F0 como initiative markdown. F1..N entram no `plan.md` como descritores completos, com `subPhaseCount: 0`, `status: pending` e source sidecar `.source.json` para a ativação futura. O código que emite os descritores está em `src/decompose.js:1004-1033`, e o write lazy forte está em `src/decompose.js:1077-1104`.

**Descriptor-only.** Uma fase descriptor-only é uma entrada em `plan.phases[]` sem arquivo `phases/<slug>.md`. `subPhaseCount: 0` nesse estado significa "desconhecido até materializar", não fase vazia. O detector usa existência do arquivo de initiative como fronteira de materialização (`scripts/find-missing-business-intent.js:14-19`, `:122-140`).

**Materializada.** Uma fase materializada tem arquivo de initiative em `phases/`. A partir daí, o `businessIntent` precisa existir em duas superfícies: `plan.phases[].businessIntent` e frontmatter da initiative. O detector reporta o primeiro campo ausente em cada superfície e exige `value`, `workflow`, `rules`, `outOfScope` e `doneWhen` (`scripts/find-missing-business-intent.js:21-29`, `:43-45`, `:135-146`).

**Verbo de ativação.** `atomic-skills:project materialize <phase>` é o caminho de descriptor-only para initiative ativa. O router declara o comando em `skills/core/project.md:25` e carrega `project-materialize.md` em `skills/core/project.md:62`. O detalhe consome o source sidecar, coleta a espinha `businessIntent`, escreve a initiative via `writeInitiativeFile`, atualiza o descriptor e roda detector, validação de estado e refresh (`skills/shared/project-assets/project-materialize.md:5-10`, `:24-32`, `:108-146`).

## Operação

1. Em `new plan`, espere `plan.md` + uma initiative F0 + sidecars F1..N. Não espere arquivos `phases/f1-*.md` antes da ativação.
2. Ao avançar, `phase-done`, `switch` e `phase-reopen` delegam para o mesmo `materialize <phase>` quando o alvo ainda é descriptor-only (`skills/shared/project-assets/project-materialize.md:159-165`).
3. Preencha `businessIntent` em linguagem configurada de instalação. `[NEEDS CLARIFICATION]` conta como campo ausente (`scripts/find-missing-business-intent.js:24-29`, `:39-45`, `:220-221`).
4. Depois da escrita, rode `scripts/find-missing-business-intent.js .atomic-skills`, `scripts/validate-state.js` nos arquivos tocados e `scripts/refresh-state.js` (`skills/shared/project-assets/project-materialize.md:135-146`).

## After materialize — implement (including automate)

Materialize only admits the phase for execution; it does not close tasks. Drive SPEC-admitted
tasks with `atomic-skills:implement` (default Mode 1). Operators who want the host session as
**pure maestro** (one code-only phase writer per phase, forced cross-model phase/complex
review, plan-end `external-both` + user validation) pass **`--mode=automate`**. Full contract:
`skills/core/implement.md`. Operator overview:
`docs/concepts/project-tracking.md` § *Step 3.5 — Drive tasks (`implement`) and opt-in automate mode*.

## Tasks core fingerprint (R3)

At publish time, `scripts/materialize-state.js` → `assertTasksCoreMatchesSidecar`
hashes the **live** sidecar `tasks[]` core vs the initiative tasks core
(`src/tasks-fingerprint.js`). Mismatch → **refuse** (no live rename). Core =
id, title (trim+collapse ws), files/outputs paths, scopeBoundary, acceptance,
verifier. Allowlist mutations (summary/weight/status/businessIntent/…) do not
refuse. Missing `.source.json` skips the check (bootstrap without capture).
Changing SPEC requires explicit re-capture / re-spec — not silent rewrite during
`materialize`.

## Spine quality (R1)

After presence (`find-missing-business-intent.js`), run
`find-weak-business-intent.js` (HARD). Rewrite weak fields; no approve-anyway.

## D9 e D10

**D9 - gate-como-hipótese.** O gate de presença prova preenchimento da espinha; o
lint de qualidade reduz rubber-stamp óbvio mas **não** prova eficácia causal.
Instrumentação de medida (eventos + `report-plan-quality`) vive no plano
`materialize-spec-quality-guards` (P3). Redução de rework permanece hipótese a
medir.

**D10 - constituição fora do plano.** Consolidar anti-patterns em catálogo consultado pelo gate é iniciativa separada. Este plano registra o non-goal e não adiciona `alternatives` por fase (`.atomic-skills/projects/atomic-skills/phase-materialization/design.md:239-252`, `:368-374`).

## Self-review against code-quality gates

- G1 read-before-claim: applied - contrato citado por arquivo:linha em `src/decompose.js`, `skills/core/project.md`, `skills/shared/project-assets/project-materialize.md`, `scripts/find-missing-business-intent.js` e design do plano.
- G2 soft-language: applied - ban-list scan aplicado no texto novo.
- G6 reference-or-strike: applied - toda afirmação de comportamento aponta para fonte versionada ou para decisão D9/D10 do design.
