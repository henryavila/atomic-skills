# Project lazy materialization

Referencia operacional para o ciclo `atomic-skills:project new plan` -> `materialize <phase>` em planos multi-fase.

## Contrato

**Regra.** `new plan` materializa somente a F0 como initiative markdown. F1..N entram no `plan.md` como descritores completos, com `subPhaseCount: 0`, `status: pending` e source sidecar `.source.json` para a ativação futura. O código que emite os descritores está em `src/decompose.js:1004-1033`, e o write lazy forte está em `src/decompose.js:1077-1104`.

**Descriptor-only.** Uma fase descriptor-only é uma entrada em `plan.phases[]` sem arquivo `phases/<slug>.md`. `subPhaseCount: 0` nesse estado significa "desconhecido até materializar", não fase vazia. O detector usa existência do arquivo de initiative como fronteira de materialização (`scripts/find-missing-business-intent.js:14-19`, `:122-140`).

**Materializada.** Uma fase materializada tem arquivo de initiative em `phases/`. A partir daí, o `businessIntent` precisa existir em duas superfícies: `plan.phases[].businessIntent` e frontmatter da initiative. O detector reporta o primeiro campo ausente em cada superfície e exige `value`, `workflow`, `rules`, `outOfScope` e `doneWhen` (`scripts/find-missing-business-intent.js:21-29`, `:43-45`, `:135-146`).

**Verbo de ativação.** `atomic-skills:project materialize <phase>` é o caminho de descriptor-only para initiative ativa. O router declara o comando em `skills/core/project.md:25` e carrega `project-materialize.md` em `skills/core/project.md:62`. O detalhe consome o source sidecar, coleta a espinha `businessIntent`, escreve a initiative via `writeInitiativeFile`, atualiza o descriptor e roda detector, validação de estado e refresh (`skills/shared/project-assets/project-materialize.md:5-10`, `:24-32`, `:108-146`).

## Operação

1. Em `new plan`, espere `plan.md` + uma initiative F0 + sidecars F1..N. Não espere arquivos `phases/f1-*.md` antes da ativação.
2. Ao avançar sob **Mode 1**, `phase-done`, `switch` e `phase-reopen` delegam para o mesmo `materialize <phase>` (Mode A blank-form) quando o alvo ainda é descriptor-only. Sob **automate**, `phase-done` **não** blank-form materializa o sucessor: avança o ponteiro e aponta `nextAction` para o ritual phase-start package; Step H/B faz draft → validate-only → ratify → materialize Mode B com a espinha ratificada (`project-transitions.md`, `implement-automate-maestro.md`, `project-materialize.md` Mode B).
3. Preencha `businessIntent` em linguagem configurada de instalação (Mode A: formulário em branco; Mode B automate: espinha pré-ratificada do package). `[NEEDS CLARIFICATION]` conta como campo ausente (`scripts/find-missing-business-intent.js:24-29`, `:39-45`, `:220-221`).
4. Depois da escrita, rode `scripts/find-missing-business-intent.js .atomic-skills`, `scripts/validate-state.js` nos arquivos tocados e `scripts/refresh-state.js` (`skills/shared/project-assets/project-materialize.md`).

## After materialize — implement (including automate)

Materialize only admits the phase for execution; it does not close tasks. Drive SPEC-admitted
tasks with `atomic-skills:implement` (default Mode 1). Operators who want the host session as
**pure maestro** (one code-only phase writer per phase, forced cross-model phase/complex
review, plan-end `external-both` + user validation) pass **`--mode=automate`**. Full contract:
`skills/core/implement.md` + `skills/shared/implement-automate-maestro.md`. Operator overview:
`docs/concepts/project-tracking.md` § *Step 3.5 — Drive tasks (`implement`) and opt-in automate mode*.

### Host-thin automate — phase-start package (draft → ratify → materialize)

Under **`--mode=automate`** the host stays **host-thin** (dispatch / merge / verify / state only —
no product source edits, no product entrypoint diagnostics). At every phase boundary and before
each phase-writer spawn, automate runs the **phase-start package** ritual (shared at Step **B**
and Step **H** in `implement-automate-maestro.md`). **Single sequenced contract** (no dual blank-form
vs draft contradiction under automate):

1. **Draft package only (ephemeral while descriptor-only):** present phase **objective** +
   **task list** (id + title, titles advisory) + **drafted** `businessIntent` spine. **No durable
   BI write** and **no materialize publish** yet if the phase is still descriptor-only.
2. **Operator validate-only:** accept/edit the **BI spine** fields; inventing from a blank form is
   forbidden. Durable **title** renames are **not** a package-ratify path (R3 fingerprint —
   re-spec / sidecar re-capture). Blank-fill BI and silent auto-PASS of the draft are forbidden.
3. **Explicit ratify token** in the same turn.
4. **Then materialize (descriptor-only only):** after ratify, orchestrate materialize from the
   phase source sidecar (`.source.json`) and **write the ratified spine** on publish. Under
   automate, materialize **accepts the pre-ratified complete spine** (Mode B in
   `project-materialize.md`) — it does **not** require blank-form invent and does **not** write
   BI **before** ratify. Quality HARD rules (`find-weak-business-intent.js`) still apply after write.
5. **Only after ratify (+ materialize if needed):** build work-order (re-enter Step B after H),
   acquire lease, spawn a **fresh** phase agent (forbid reusing previous writer context). **No path**
   allows silent host coding of the new phase product source before ratify.
6. **`phase-done` under automate** advances the descriptor pointer and sets handoff **single
   nextAction** to the package ritual (e.g. `present phase-start package for F{N} validate-only` /
   `await package ratify` / `spawn fresh writer after ratify`). It does **not** blank-form
   materialize the successor as a separate invent-BI UX — Step H/B owns materialize after ratify.
   Mode 1 may still hand off bare `project materialize <phase-id>` (Mode A blank form).
7. Session handoff **single nextAction** is mandatory at the boundary. Plan-level or
   closed-initiative nextAction may point at the package ritual before the successor initiative
   exists. Preserve active initiative handoff until phase-done.
8. Phase close under automate still requires the **decision-review** mandatory manual hardgate
   (operator PASS only — agents never write decision-review PASS) after evaluationGate, before
   `phase-done`. See `skills/shared/implement-decision-log.md` and
   `src/automate-orchestrator-gates.js` (`canRunPhaseDone` = evaluationGate **AND** decisionReview).

Spine quality HARD rules (`find-weak-business-intent.js`) are unchanged by this package ritual —
materialize still refuses weak / missing spine; automate must not stamp BI PASS without
operator ratify.

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
**Measure:** append-only JSONL via `src/plan-quality-events.js` (kinds:
`spine_quality_fail`, `fingerprint_refuse`, `phase_reopen`, `task_reopen`) and
`node scripts/report-plan-quality.js [--window-days 14]`. `materialize-state`
emits `fingerprint_refuse` fail-open on refuse. Reduction of rework remains a
hypothesis to measure — not a proven benefit.

**D10 - constituição fora do plano.** Consolidar anti-patterns em catálogo consultado pelo gate é iniciativa separada. Este plano registra o non-goal e não adiciona `alternatives` por fase (`.atomic-skills/projects/atomic-skills/phase-materialization/design.md:239-252`, `:368-374`).

## Self-review against code-quality gates

- G1 read-before-claim: applied - contrato citado por arquivo:linha em `src/decompose.js`, `skills/core/project.md`, `skills/shared/project-assets/project-materialize.md`, `scripts/find-missing-business-intent.js` e design do plano.
- G2 soft-language: applied - ban-list scan aplicado no texto novo.
- G6 reference-or-strike: applied - toda afirmação de comportamento aponta para fonte versionada ou para decisão D9/D10 do design.
