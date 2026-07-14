---
date: 2026-07-14T13:49:56-03:00
topic: integrity-remediation-f0-phase-8e2e4e3-r13
artifact: b2a845a5d7e832c88622cb21c89aff6ee33927e1..8e2e4e39742c4537e15b449210d7072a2c3723b3
skill: review-code
reviewer: gpt-5-codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
framing_delta: {dropped: 1, maintained: 3, emerged: 1}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F0 phase 8e2e4e3 r13

## Capture manifest

- Ref: b2a845a5d7e832c88622cb21c89aff6ee33927e1..8e2e4e39742c4537e15b449210d7072a2c3723b3
- Captured diff: 5,267,564 bytes / 115,688 lines / 78 files
- SHA-256: 46aa76694b564cf2ae9cd9c848ef28334870bd93d99a9e3e3c3bfc3560fd77cc
- Patch id: 0833550902a3471d111f7908269bd232f0627573
- Mode: codex; model override: codex-auto-review; reasoning: high; sandbox: read-only
- Worktree was clean before capture and remained read-only during both passes.

## Structural validation

- Pass 1: frontmatter, verdict, counts, pass id, four findings and mandatory fields validated.
- Pass 2: frontmatter, verdict, counts, reconciliation headers and four final findings validated.
- Reconciliation: one blind finding dropped, three maintained and one emerged.

## Operator scope triage

- Final F-001 major — validated and fixed. `project-create-plan` and every remaining changed skill call now reuse a trusted `PKG_ROOT`; all 86 unchecked `|| echo .` package-script fallbacks were removed, including the calls the original narrow guard could not see.
- Final F-002 major — validated and fixed. `decompose-plan` accepts an exclusive `--business-intent-file` transport, while the creation/adopt recipes allocate, write, consume and clean a temporary JSON file without shell interpolation. The legacy inline option remains compatible.
- Final F-003 major — validated and fixed. `refresh-state` rejects invalid required projection fields and item statuses, reports them through `indexErrors`, and preserves the last trusted index row.
- Final F-004 minor — validated and fixed. The static guard now covers arbitrary package-owned `scripts/*.js` fallbacks and includes a positive `lint-design.js` fixture.
- Blind F-003 major — dropped. A present malformed dispatch ledger is deliberately fail-closed by the F0 contract and existing tests.
- Delegated decisions: close the fallback class comprehensively rather than one call site at a time; preserve the stricter self-contained checkout verification in `project-view`, `project-materialize`, and `project-create-plan`; retain runtime identity in the resident router for its lazy assets; preserve the prior unsafe-Markdown exception contract while adding structural validation.
- Remaining substantive count after remediation at `6e04867`: zero blocker, zero critical, zero major, zero minor. A fresh clean-checkpoint review remains required for phase approval.

## Remediation evidence

- RED: the four focused files collected 156 tests, with 136 passing and 20 failing before production/docs changed. Failures covered file transport, trusted-root docs, invalid projections and all newly exposed unchecked fallbacks.
- GREEN: the same focused set passed 156/156 after remediation.
- T-006 verifier: 164/164 materialization, refresh, dispatch-log and decompose tests passed.
- Full regression: 1,767 tests collected — 1,759 passed, 8 skipped, 0 failed.
- Validators: 166 state files / 26 plans / 1 routing config valid; all 15 skills valid; `project.md` byte budget green at 22,977 bytes; diff-check clean.

## Pass 1 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The changed skill/runtime surface has three material regressions. The new `project-create-plan` flow still resolves package-owned code through an unchecked `echo .` fallback, and it transports arbitrary `businessIntent` JSON through single-quoted shell text. Both break the installed-runtime contract the rest of the diff is trying to establish.

In the runtime path, `appendCompletion()` now turns any malformed `dispatch-log.json` line into a hard failure for later `task-done` writes, and the new PROJECT-STATUS refresh code silently normalizes malformed initiative state into blank/`0/0` rows instead of surfacing it as corruption.

## Findings

### F-001 [major] security — skills/shared/project-assets/project-create-plan.md:140-147

**Evidence:**
```md
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
node "$PKG_ROOT/scripts/decompose-plan.js" materialize \
  --source '<source.md>' \
  --slug '<slug>' \
  --project-id '<project-id>' \
  --branch 'plan/<slug>' \
  --started-commit '<started-commit>' \
  --business-intent '<businessIntent-json>'
```

**Claim:** If `~/.atomic-skills/package-root` is absent or unreadable, this flow executes `./scripts/decompose-plan.js` from the consumer repo instead of the installed package root.

**Impact:** Plan creation can run repo-local code that was never meant to be trusted as the packaged runtime, or just fail nondeterministically on repos without that script. That breaks the install-root trust model the rest of the diff introduces.

**Recommendation:** Remove the `|| echo .` fallback for package-owned scripts. Resolve a verified absolute `PKG_ROOT` first (package identity plus required entrypoint existence) and abort if it cannot be proven.

**Confidence:** high

---

### F-002 [major] compatibility — skills/shared/project-assets/project-create-plan.md:141-152

**Evidence:**
```md
node "$PKG_ROOT/scripts/decompose-plan.js" materialize \
  --source '<source.md>' \
  --slug '<slug>' \
  --project-id '<project-id>' \
  --branch 'plan/<slug>' \
  --started-commit '<started-commit>' \
  --business-intent '<businessIntent-json>'

`--business-intent` transports the same object previously passed as
`businessIntent: <businessIntent>`; serialize the ratified five-field spine as
JSON without changing its values.
```

**Claim:** The new CLI contract passes arbitrary `businessIntent` JSON through a single-quoted shell argument, which is not safe for valid values containing `'`.

**Impact:** Ordinary ratified text such as `customer's workflow` breaks the shell command or changes the JSON bytes sent to `decompose-plan.js`, so plan materialization can fail or persist a different businessIntent than the user approved.

**Recommendation:** Stop embedding raw JSON in single quotes. Pass the object through a temp file, stdin, or a robust escaping/encoding step that preserves arbitrary content exactly.

**Confidence:** high

---

### F-003 [major] error handling — scripts/append-completion.js:248-357

**Evidence:**
```js
/**
 * Read the Mode-2 dispatch telemetry sidecar and derive this task's execution
 * actuals { attempts, durationMs, escalations }. Reads canonical NDJSON and the
 * legacy array/hybrid forms accepted by `parseDispatchLog`.
 * Returns the actuals object built from ONLY the finite fields it can derive, or
 * `undefined` when the file is absent or no record matches (plan+phase+taskId).
 * Malformed present input throws with its physical line; missing Mode-1 telemetry
 * remains graceful and is not an error.
 */
export function readDispatchActuals(root, { planSlug, phaseId, taskId } = {}) {
  if (!hasText(taskId)) return undefined;
  const path = join(resolve(root), '.atomic-skills', 'status', 'dispatch-log.json');
  if (!existsSync(path)) return undefined;
  const log = parseDispatchLog(readFileSync(path, 'utf8'), { source: path });

export function appendCompletion(root, entry) {
  let effectiveEntry = entry;
  if (entry && entry.event === 'task-done' && entry.actuals == null) {
    const derived = readDispatchActuals(root, {
      planSlug: entry.planSlug, phaseId: entry.phaseId, taskId: entry.taskId,
    });
```

**Claim:** `appendCompletion()` now hard-fails `task-done` writes whenever `dispatch-log.json` contains any malformed record, because it parses the whole sidecar and does not catch `readDispatchActuals()` failures before appending.

**Impact:** One stale corrupt telemetry line blocks later completion events from being recorded at all, which breaks downstream phase-close/accounting flows and leaves analytics permanently stale until a human repairs the log.

**Recommendation:** Catch `readDispatchActuals()` failures inside `appendCompletion()` and degrade to “no actuals” with a warning, or isolate strict parsing to the matching record set without aborting the append.

**Confidence:** high

---

### F-004 [minor] observability — scripts/refresh-state.js:81-121

**Evidence:**
```js
const tasks = Array.isArray(fm.tasks) ? fm.tasks : [];
const gates = Array.isArray(fm.exitGates) ? fm.exitGates : [];
return {
  projection: {
    slug: fm.slug,
    phaseId: typeof fm.phaseId === 'string' ? fm.phaseId : '',
    status: typeof fm.status === 'string' ? fm.status : '',
    tasksDone: tasks.filter((task) => task?.status === 'done').length,
    tasksTotal: tasks.length,
    gatesMet: gates.filter((gate) => gate?.status === 'met').length,
    gatesTotal: gates.length,

const replacement = [
  markdownCell(projection.slug, 'slug'),
  markdownCell(projection.phaseId, 'phaseId'),
  markdownCell(projection.status, 'status'),
  markdownCell(`${projection.tasksDone}/${projection.tasksTotal}`, 'tasks'),
  markdownCell(`${projection.gatesMet}/${projection.gatesTotal}`, 'gates'),
];
```

**Claim:** The new PROJECT-STATUS projection treats missing `phaseId`/`status` and malformed `tasks`/`exitGates` as empty values instead of projection errors, then writes those blanks back into the index.

**Impact:** A partially written or manually corrupted initiative file is masked as a blank/`0/0` row in `PROJECT-STATUS.md`, which destroys useful operator signal exactly when the underlying state is already damaged.

**Recommendation:** Treat missing/invalid `phaseId`, `status`, `tasks`, and `exitGates` as projection errors; do not replace the existing row for that initiative when those fields are not trustworthy.

**Confidence:** medium

## Questions (non-findings)

- None.

## Out of scope

- Historical review transcript prose under `.atomic-skills/reviews/` was treated as audit context only, not as independent executable evidence.

## Pass 2 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
As restrições confirmam três regressões materiais. `project-create-plan.md` ainda executa código package-owned via fallback inseguro para `.` quando o marker `~/.atomic-skills/package-root` não existe, e ainda transporta `businessIntent` como JSON dentro de aspas simples, o que quebra valores válidos exigidos pelo contrato do CLI. Além disso, `refresh-state.js` continua normalizando iniciativas estruturalmente inválidas em linhas vazias/`0/0`, em vez de preservar a linha confiável anterior e reportar falha parcial.

O finding cego sobre `dispatch-log.json` não procede nesta fase: o comportamento fail-closed é uma exigência explícita do contrato e está coberto pelos testes adicionados. Em contrapartida, as novas restrições expõem um furo no guard de `skill-script-resolution`: o teste não cobre a maioria dos fallbacks inseguros que ainda permanecem no próprio `project-create-plan.md`.

## Findings

### F-001 [major] security — skills/shared/project-assets/project-create-plan.md:58-147

**Evidence:**
```md
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/lint-design.js" projects/<project-id>/<slug>/design.md

PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
node "$PKG_ROOT/scripts/decompose-plan.js" materialize \
  --source '<source.md>' \
  --slug '<slug>' \
  --project-id '<project-id>' \
  --branch 'plan/<slug>' \
  --started-commit '<started-commit>' \
  --business-intent '<businessIntent-json>'
```

**Claim:** O fluxo `project-create-plan` ainda resolve scripts package-owned por `$(cat ... || echo .)`, então um marker ausente ou ilegível faz a skill executar arquivos homônimos do repositório consumidor.

**Impact:** A criação de plano pode rodar código local não confiável em vez do runtime instalado, violando o modelo de confiança do package root e introduzindo falhas não determinísticas ou execução indevida de scripts do consumidor.

**Recommendation:** Reutilize o resolvedor confiável já documentado em `project-view.md`/`project-materialize.md`: resolva um `PKG_ROOT` absoluto uma vez, prove identidade do pacote + entrypoint embarcado, reutilize esse valor em todas as chamadas e remova todos os `|| echo .`.

**Confidence:** high

---

### F-002 [major] compatibility — skills/shared/project-assets/project-create-plan.md:147-152

**Evidence:**
```md
--business-intent '<businessIntent-json>'

`--business-intent` transports the same object previously passed as
`businessIntent: <businessIntent>`; serialize the ratified five-field spine as
JSON without changing its values.
```

**Claim:** A skill manda `businessIntent` arbitrário como JSON dentro de aspas simples, embora `scripts/decompose-plan.js` exija receber os bytes exatos do argumento para fazer `JSON.parse`.

**Impact:** Valores válidos com apóstrofos ou metacaracteres de shell, como `customer's workflow`, quebram a invocação ou alteram o payload persistido, fazendo a materialização falhar ou gravar um `businessIntent` diferente do que o usuário ratificou.

**Recommendation:** Pare de embutir JSON cru entre aspas simples; passe `businessIntent` por arquivo temporário, `stdin`, ou uma codificação/escaping robusta que preserve o conteúdo byte a byte.

**Confidence:** high

---

### F-003 [major] correctness — scripts/refresh-state.js:94-105

**Evidence:**
```js
const tasks = Array.isArray(fm.tasks) ? fm.tasks : [];
const gates = Array.isArray(fm.exitGates) ? fm.exitGates : [];
return {
  projection: {
    slug: fm.slug,
    phaseId: typeof fm.phaseId === 'string' ? fm.phaseId : '',
    status: typeof fm.status === 'string' ? fm.status : '',
    tasksDone: tasks.filter((task) => task?.status === 'done').length,
    tasksTotal: tasks.length,
    gatesMet: gates.filter((gate) => gate?.status === 'met').length,
    gatesTotal: gates.length,
```

**Claim:** `initiativeProjection()` converte campos obrigatórios inválidos ou ausentes em `''` e `[]` em vez de rejeitar a projeção, embora o esquema canônico exija `status`, `tasks`, `exitGates` e, para fases materializadas, `phaseId` não vazio.

**Impact:** Uma initiative parcialmente escrita ou corrompida pode sobrescrever uma linha confiável de `PROJECT-STATUS.md` com status/fase vazios e `0/0`, ocultando a corrupção exatamente no canal que deveria sinalizá-la aos operadores e ao aiDeck.

**Recommendation:** Trate `phaseId`, `status`, `tasks` e `exitGates` ausentes ou estruturalmente inválidos como erro de projeção; preserve a linha existente e encaminhe o caso para `indexErrors` em vez de publicar blanks.

**Confidence:** high

---

### F-004 [minor] tests — tests/skill-script-resolution.test.js:48

**Evidence:**
```js
const UNTRUSTED_PACKAGE_FALLBACK = /\$\(cat\s+"\$HOME\/\.atomic-skills\/package-root"[^)]*\|\|\s*echo\s+\.\)\/(?:src\/[\w.-]+\.js|scripts\/materialize-state\.js)/g
```

**Claim:** O guard de `skill-script-resolution` só detecta fallbacks inseguros para `src/*.js` e `scripts/materialize-state.js`, então chamadas atuais como `.../scripts/lint-design.js`, `.../scripts/lint-source.js`, `.../scripts/decompose-plan.js` e `.../scripts/validate-state.js` passam sem falhar a suíte.

**Impact:** A proteção de CI que deveria impedir regressões de resolução por cwd continua verde enquanto o próprio `project-create-plan.md` mantém múltiplos fallbacks inseguros, permitindo que a mesma classe de defeito siga sendo publicada.

**Recommendation:** Generalize o detector para qualquer `scripts/*.js` package-owned ou valide a presença do bloco de resolução confiável aprovado; acrescente casos positivos para `decompose-plan.js`, linters, detectores e validadores.

**Confidence:** high

## Questions (non-findings)

- _(none)_

## Out of scope

- Transcrições históricas em `.atomic-skills/reviews/` foram tratadas apenas como artefatos de auditoria, não como prova independente.

## Pass 2 reconciliation

### Dropped from blind pass

- F-003-blind [major] error handling — DROPPED: a restrição externa fixa que `dispatch-log.json` presente e malformado deve falhar fechado, e `tests/append-completion-dispatchlog.test.js:261-330` verifica exatamente esse contrato.

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same
- F-004-blind → F-003-final [major] — severity changed: was minor, now major

### Emerged

- F-004-final [minor] tests — emerged: a restrição externa mandou verificar `tests/skill-script-resolution.test.js`, e esse guard só cobre `src/*.js` e `scripts/materialize-state.js`, deixando sem cobertura os demais fallbacks inseguros ainda presentes em `project-create-plan.md`.
