---
date: 2026-05-25T14:16:03-03:00
topic: aideck-multi-project
artifact: .atomic-skills/plans/aideck-multi-project.md
skill: review-plan
reviewer: gpt-5-codex
codex_version: "0.130.0"
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 5, emerged: 0}
schema_version: "1.0"
---

# Cross-Model Review — aideck-multi-project

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan defines the broad phase order, but several core contracts are underspecified: project identity, default project semantics, SSE compatibility, registration validation, and watcher failure isolation. These are not small implementation details; they affect whether existing consumers keep receiving the correct project state and whether multi-project behavior can be implemented consistently.

## Findings

### F-001 [critical] ambiguity — .atomic-skills/plans/aideck-multi-project.md:36-38

**Evidence:**
```yaml
  - term: projectId
    definition: "Identificador derivado do basename do rootDir. Regex:
      `^[a-z][a-z0-9-]{0,63}$`. Deve ser único no registry."
```

**Claim:** Project identity is underspecified because deriving `projectId` only from `basename(rootDir)` cannot both satisfy the regex and guarantee uniqueness across distinct rootDirs.

**Impact:** Two projects with the same directory name in different parents collide, and any project whose basename contains uppercase letters, underscores, dots, spaces, or starts with a digit cannot register despite the zero-config requirement; implementation will either reject valid local projects or invent incompatible collision behavior midstream.

**Recommendation:** Define the exact `projectId` derivation algorithm, invalid-name handling, duplicate-basename behavior, and whether clients may provide an explicit `projectId`; add registration tests for invalid basenames and duplicate basenames.

**Confidence:** high

---

### F-002 [major] coverage gap — .atomic-skills/plans/aideck-multi-project.md:16-20

**Evidence:**
```yaml
  - id: P2
    title: Backward-compatible API
    body: As rotas existentes (`/api/state/:consumer`, `/api/health`, `/sse`)
      continuam funcionando para o projeto default (o primeiro registrado).
      Nenhum consumidor existente quebra.
```

**Claim:** The plan requires `/sse` backward compatibility but never defines scoped SSE endpoints, filtering behavior, event payload shape, or a gate proving legacy `/sse` only exposes the default project.

**Impact:** Existing SSE consumers may receive cross-project events, miss events after multi-project changes, or break if event payloads are changed to include `projectId` without a compatibility contract.

**Recommendation:** Add an SSE-specific phase item and exit gates covering legacy `/sse` default-project behavior, project-scoped subscription behavior, and event payload compatibility.

**Confidence:** high

---

### F-003 [major] ambiguity — .atomic-skills/plans/aideck-multi-project.md:33-35

**Evidence:**
```yaml
  - term: ProjectRegistry
    definition: Estrutura in-memory no aiDeck que mapeia projectId para rootDir +
      watcher. Volatile por design (reconstruída via re-registro).
```

**Claim:** Default project lifecycle is ambiguous because the registry is volatile while backward compatibility depends on “the first registered” project.

**Impact:** If the first project unregisters, crashes, reconnects later, or the aiDeck process restarts and projects re-register in a different order, legacy routes such as `/api/state/:consumer` and unprefixed dashboard routes can silently point at a different project.

**Recommendation:** Specify stable default-project rules, including startup, re-registration order, unregistering the default, and whether callers can explicitly set or preserve the default; add tests for each transition.

**Confidence:** high

---

### F-004 [major] coverage gap — .atomic-skills/plans/aideck-multi-project.md:53-60

**Evidence:**
```yaml
        - id: F0-G1
          description: POST /api/projects/register aceita rootDir, cria entrada no
            registry, retorna 201
          status: pending
          verifier:
            kind: shell
            command: cd /Volumes/External/code/aideck && npm test -- --grep 'register'
            expectExitCode: 0
```

**Claim:** Registration validation is missing because the gate only checks that `rootDir` is accepted and stored, not that it exists, is canonical, contains `.atomic-skills/`, or handles duplicate rootDirs safely.

**Impact:** The server can register nonexistent paths, equivalent paths under different spellings, or directories that are not atomic-skills projects, causing watchers and state readers to fail later under project-scoped routes.

**Recommendation:** Add explicit registration contract and tests for absolute/canonical path validation, `.atomic-skills/` presence, nonexistent paths, duplicate rootDirs, and duplicate `projectId`s.

**Confidence:** high

---

### F-005 [major] coverage gap — .atomic-skills/plans/aideck-multi-project.md:25-28

**Evidence:**
```yaml
  - id: P4
    title: Watcher-per-project isolation
    body: Cada rootDir registrado tem seu próprio chokidar watcher. Falha ou
      lentidão em um não afeta os outros.
```

**Claim:** Watcher failure isolation is stated as a principle but not covered by the F1 gates, which only verify independent change events and unregister behavior.

**Impact:** A watcher error, unreadable directory, rebuild exception, or slow event handler in one project can still poison shared process state or block event delivery for other projects while the plan appears complete.

**Recommendation:** Add F1 tasks and tests that inject watcher errors and slow handlers for one project and verify the other project continues serving state and emitting events.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/plans/aideck-multi-project.md:107 — What are the exact project-scoped paths for `entities` and `inbox`, and do existing consumers call unprefixed versions today?
- .atomic-skills/plans/aideck-multi-project.md:240 — Are the F1/F2 `kind: test` verifiers always executed from `/Volumes/External/code/aideck/`, or should they include an explicit working directory like F0?

## Out of scope

- UX and visual layout of the dashboard bands.
- Deployment, CI/CD, authentication, authorization, and performance benchmarking.

## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The external constraints reinforce the blind-pass findings rather than invalidating them. The plan depends on backward-compatible same-origin `/api/state/project-status`, `/api/health`, and `/sse`, but it does not define enough of the identity, default-project, SSE, registration-validation, or watcher-failure contracts to keep existing consumers stable while introducing multiple projects.

## Findings

### F-001 [critical] ambiguity — .atomic-skills/plans/aideck-multi-project.md:36

**Evidence:**
```yaml
  - term: projectId
    definition: "Identificador derivado do basename do rootDir. Regex:
      `^[a-z][a-z0-9-]{0,63}$`. Deve ser único no registry."
```

**Claim:** Project identity is underspecified because deriving `projectId` only from `basename(rootDir)` cannot both satisfy the regex and guarantee uniqueness across distinct rootDirs.

**Impact:** Two projects with the same directory name in different parents collide, and any project whose basename contains uppercase letters, underscores, dots, spaces, or starts with a digit cannot register despite the zero-config requirement; implementation will either reject valid local projects or invent incompatible collision behavior midstream.

**Recommendation:** Define the exact `projectId` derivation algorithm, invalid-name handling, duplicate-basename behavior, and whether clients may provide an explicit `projectId`; add registration tests for invalid basenames and duplicate basenames.

**Confidence:** high

---

### F-002 [major] coverage gap — .atomic-skills/plans/aideck-multi-project.md:16

**Evidence:**
```yaml
  - id: P2
    title: Backward-compatible API
    body: As rotas existentes (`/api/state/:consumer`, `/api/health`, `/sse`)
      continuam funcionando para o projeto default (o primeiro registrado).
      Nenhum consumidor existente quebra.
```

**Claim:** The plan requires `/sse` backward compatibility but never defines scoped SSE endpoints, filtering behavior, event payload shape, or a gate proving legacy `/sse` only exposes the default project.

**Impact:** Existing same-origin SSE consumers may receive cross-project events, miss events after multi-project changes, or break if event payloads are changed to include `projectId` without a compatibility contract.

**Recommendation:** Add an SSE-specific phase item and exit gates covering legacy `/sse` default-project behavior, project-scoped subscription behavior, and event payload compatibility.

**Confidence:** high

---

### F-003 [major] ambiguity — .atomic-skills/plans/aideck-multi-project.md:33

**Evidence:**
```yaml
  - term: ProjectRegistry
    definition: Estrutura in-memory no aiDeck que mapeia projectId para rootDir +
      watcher. Volatile por design (reconstruída via re-registro).
```

**Claim:** Default project lifecycle is ambiguous because the registry is volatile while backward compatibility depends on “the first registered” project.

**Impact:** If the first project unregisters, crashes, reconnects later, or the aiDeck process restarts and projects re-register in a different order, legacy routes such as `/api/state/:consumer`, `/sse`, and unprefixed dashboard routes can silently point at a different project.

**Recommendation:** Specify stable default-project rules, including startup, re-registration order, unregistering the default, and whether callers can explicitly set or preserve the default; add tests for each transition.

**Confidence:** high

---

### F-004 [major] coverage gap — .atomic-skills/plans/aideck-multi-project.md:53

**Evidence:**
```yaml
        - id: F0-G1
          description: POST /api/projects/register aceita rootDir, cria entrada no
            registry, retorna 201
```

**Claim:** Registration validation is missing because the gate only checks that `rootDir` is accepted and stored, not that it exists, is canonical, contains `.atomic-skills/`, or handles duplicate rootDirs safely.

**Impact:** The server can register nonexistent paths, equivalent paths under different spellings, or directories that are not atomic-skills projects, causing watchers and state readers to fail later under project-scoped routes.

**Recommendation:** Add explicit registration contract and tests for absolute/canonical path validation, `.atomic-skills/` presence, nonexistent paths, duplicate rootDirs, and duplicate `projectId`s.

**Confidence:** high

---

### F-005 [major] coverage gap — .atomic-skills/plans/aideck-multi-project.md:25

**Evidence:**
```yaml
  - id: P4
    title: Watcher-per-project isolation
    body: Cada rootDir registrado tem seu próprio chokidar watcher. Falha ou
      lentidão em um não afeta os outros.
```

**Claim:** Watcher failure isolation is stated as a principle but not covered by the F1 gates, which only verify independent change events and unregister behavior.

**Impact:** A watcher error, unreadable directory, rebuild exception, or slow event handler in one project can still poison shared process state or block event delivery for other projects while the plan appears complete.

**Recommendation:** Add F1 tasks and tests that inject watcher errors and slow handlers for one project and verify the other project continues serving state and emitting events.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/plans/aideck-multi-project.md:107 — What are the exact project-scoped paths for `entities` and `inbox`, and do existing consumers call unprefixed versions today?
- .atomic-skills/plans/aideck-multi-project.md:240 — Are the F1/F2 `kind: test` verifiers always executed from `/Volumes/External/code/aideck/`, or should they include an explicit working directory like F0?

## Out of scope

- UX and visual layout of the dashboard bands.
- Deployment, CI/CD, authentication, authorization, and performance benchmarking.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [critical] — same
- F-002-blind → F-002-final [major] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-004-final [major] — same
- F-005-blind → F-005-final [major] — same

### Emerged

- _(none)_

## Briefings used

<details>
<summary>Pass 1 briefing</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Non-goals (factual, no rationale)

- This review does not cover UX/visual design of the dashboard
- This review does not cover deployment or CI/CD pipelines
- This review does not cover authentication or authorization (aiDeck is localhost-only)
- This review does not cover performance benchmarking

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Artifact to review

Path: .atomic-skills/plans/aideck-multi-project.md

---BEGIN ARTIFACT---
---
schemaVersion: "0.1"
slug: aideck-multi-project
title: Suporte Multi-Projeto no aiDeck
version: "1.0"
status: active
started: 2026-05-25T17:06:39.511Z
lastUpdated: 2026-05-25T17:06:39.511Z
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Single-instance, multi-rootDir
    body: Uma instância de aiDeck, uma porta. Projetos se registram via API; nunca
      existe mais de um processo aiDeck rodando.
  - id: P2
    title: Backward-compatible API
    body: As rotas existentes (`/api/state/:consumer`, `/api/health`, `/sse`)
      continuam funcionando para o projeto default (o primeiro registrado).
      Nenhum consumidor existente quebra.
  - id: P3
    title: Zero-config for single-project
    body: Quem usa apenas um projeto não precisa mudar nada. O comportamento
      single-project é o default e funciona sem flags ou configuração extra.
  - id: P4
    title: Watcher-per-project isolation
    body: Cada rootDir registrado tem seu próprio chokidar watcher. Falha ou
      lentidão em um não afeta os outros.
glossary:
  - term: rootDir
    definition: Diretório raiz de um projeto que contém `.atomic-skills/`. Cada
      projeto tem um rootDir distinto.
  - term: ProjectRegistry
    definition: Estrutura in-memory no aiDeck que mapeia projectId para rootDir +
      watcher. Volatile por design (reconstruída via re-registro).
  - term: projectId
    definition: "Identificador derivado do basename do rootDir. Regex:
      `^[a-z][a-z0-9-]{0,63}$`. Deve ser único no registry."
  - term: register
    definition: Ato de adicionar um rootDir ao ProjectRegistry via `POST
      /api/projects/register`. Cria watcher e expoe state.
phases:
  - id: F0
    slug: aideck-multi-project-f0-projectregistry-no-aideck
    title: ProjectRegistry no aiDeck
    goal: Criar a estrutura ProjectRegistry in-memory e a API de
      registro/desregistro/listagem de projetos no aiDeck server.
    dependsOn: []
    subPhaseCount: 5
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F0-G1
          description: POST /api/projects/register aceita rootDir, cria entrada no
            registry, retorna 201
          status: pending
          verifier:
            kind: shell
            command: cd /Volumes/External/code/aideck && npm test -- --grep 'register'
            expectExitCode: 0
        - id: F0-G2
          description: GET /api/projects lista projetos registrados
          status: pending
          verifier:
            kind: shell
            command: cd /Volumes/External/code/aideck && npm test -- --grep 'projects'
            expectExitCode: 0
        - id: F0-G3
          description: /api/health retorna campo projects[] com ao menos o projeto default
          status: pending
          verifier:
            kind: shell
            command: cd /Volumes/External/code/aideck && npm test -- --grep
              'health.*projects'
            expectExitCode: 0
    status: active
  - id: F1
    slug: aideck-multi-project-f1-multi-watcher-por-projeto
    title: Multi-watcher por projeto
    goal: Cada projeto registrado no ProjectRegistry ganha seu proprio watcher
      chokidar, com ciclo de vida gerenciado pelo registry.
    dependsOn:
      - F0
    subPhaseCount: 4
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: Registrar 2 projetos cria 2 watchers independentes; file change em
            um emite evento apenas para aquele projectId
          status: pending
          verifier:
            kind: test
            runner: npm
            pattern: test -- --grep 'multi-watcher'
        - id: F1-G2
          description: Desregistrar um projeto para o watcher sem afetar o outro
          status: pending
          verifier:
            kind: test
            runner: npm
            pattern: test -- --grep 'unregister.*watcher'
    status: pending
  - id: F2
    slug: aideck-multi-project-f2-rotas-project-scoped-no-aideck
    title: Rotas project-scoped no aiDeck
    goal: Adicionar rotas prefixadas por projectId para acessar state, entities e
      inbox de projetos especificos.
    dependsOn:
      - F1
    subPhaseCount: 4
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: GET /api/projects/:id/state/project-status retorna state do projeto
            correto
          status: pending
          verifier:
            kind: test
            runner: npm
            pattern: test -- --grep 'project-scoped state'
        - id: F2-G2
          description: Rotas existentes sem prefixo continuam retornando state do projeto
            default
          status: pending
          verifier:
            kind: test
            runner: npm
            pattern: test -- --grep 'backward-compat'
    status: pending
  - id: F3
    slug: aideck-multi-project-f3-ensureaideck-como-registro
    title: ensureAideck como registro
    goal: Modificar ensureAideck() no atomic-skills para registrar o projeto no
      aiDeck existente em vez de matar e reiniciar.
    dependsOn:
      - F2
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F3-G1
          description: ensureAideck de projeto B com aiDeck rodando para projeto A
            registra B sem matar A
          status: pending
          verifier:
            kind: test
            runner: npm
            pattern: test -- --grep 'multi-project register'
        - id: F3-G2
          description: projectId derivado do CWD e validado como slug
          status: pending
          verifier:
            kind: test
            runner: npm
            pattern: test -- --grep 'derive projectId'
    status: pending
  - id: F4
    slug: aideck-multi-project-f4-dashboard-multi-projeto-na-homepage
    title: Dashboard multi-projeto na HomePage
    goal: Dashboard exibe projetos registrados como bands separadas na HomePage,
      cada um com seus planos e iniciativas.
    dependsOn:
      - F3
    subPhaseCount: 4
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F4-G1
          description: HomePage renderiza 2 ConsumerBands quando 2 projetos registrados
          status: pending
          verifier:
            kind: manual
            description: Registrar 2 projetos via API, abrir dashboard, verificar 2 bands
              visualmente
        - id: F4-G2
          description: Dashboard funciona com aiDeck antigo (sem /api/projects) via
            fallback single-project
          status: pending
          verifier:
            kind: manual
            description: Apontar dashboard para aiDeck sem rotas /api/projects, verificar
              que homepage carrega normalmente
    status: pending
  - id: F5
    slug: aideck-multi-project-f5-navegacao-project-scoped-no-dashboard
    title: Navegacao project-scoped no Dashboard
    goal: Rotas, links e navigation do dashboard incluem contexto de projeto para
      que planos/iniciativas de projetos diferentes nao colidam.
    dependsOn:
      - F4
    subPhaseCount: 4
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F5-G1
          description: Clicar num plano do projeto B navega para /project-b/plans/slug
            (nao /plans/slug)
          status: pending
          verifier:
            kind: manual
            description: Registrar 2 projetos, clicar num plano do segundo, verificar URL
              inclui projectId
        - id: F5-G2
          description: Rotas sem prefixo continuam funcionando para backward-compat
          status: pending
          verifier:
            kind: manual
            description: Abrir /plans/existing-slug sem projectId, verificar que carrega o
              plano do projeto default
    status: pending
references: []
---

# Suporte Multi-Projeto no aiDeck

## 1. Context

Hoje o aiDeck opera com um único rootDir por instância. Quando um segundo projeto chama `ensureAideck()`, a instância existente é morta e reiniciada apontando para o novo CWD. Isso impede que dois ou mais projetos compartilhem o mesmo dashboard simultaneamente. Este plano implementa o suporte a múltiplos rootDirs por instância, com registro dinâmico via API e visualização separada por projeto no dashboard.

## 2. Inviolable principles

- **P1 Single-instance, multi-rootDir** — Uma instância de aiDeck, uma porta. Projetos se registram via API; nunca existe mais de um processo aiDeck rodando.
- **P2 Backward-compatible API** — As rotas existentes (`/api/state/:consumer`, `/api/health`, `/sse`) continuam funcionando para o projeto default (o primeiro registrado). Nenhum consumidor existente quebra.
- **P3 Zero-config for single-project** — Quem usa apenas um projeto não precisa mudar nada. O comportamento single-project é o default e funciona sem flags ou configuração extra.
- **P4 Watcher-per-project isolation** — Cada rootDir registrado tem seu próprio chokidar watcher. Falha ou lentidão em um não afeta os outros.

## 3. Phase tree

| Phase | Title | Tasks | Gates | Depends on |
|-------|-------|-------|-------|------------|
| F0 | ProjectRegistry no aiDeck | 5 | 3 | — |
| F1 | Multi-watcher por projeto | 4 | 2 | F0 |
| F2 | Rotas project-scoped no aiDeck | 4 | 2 | F1 |
| F3 | ensureAideck como registro | 3 | 2 | F2 |
| F4 | Dashboard multi-projeto na HomePage | 4 | 2 | F3 |
| F5 | Navegacao project-scoped no Dashboard | 4 | 2 | F4 |

F0-F2 operam no repo **aideck** (`/Volumes/External/code/aideck/`).
F3 opera no repo **atomic-skills** (`/Volumes/External/code/atomic-skills/`).
F4-F5 operam no dashboard dentro de **atomic-skills** (`src/dashboard/`).

## Self-review against code-quality gates

- **G1 read-before-claim**: Claims sobre codigo existente (ensureAideck kill+restart, single rootDir, hardcoded CONSUMER) foram verificadas via Read tool durante a analise pre-plano (serve.js:200-217, api.ts:18, index.ts:53). N/A para tasks descrevendo codigo novo.
- **G2 soft-language**: Scanned plan body for ban list; 0 occurrences.
- **G6 reference-or-strike**: Plan describes future work (tasks with target files). No bare claims about existing code state in body. All existing-code references verified in conversation context.
---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

# Required Output Format — Pass 1 (Blind)

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

## Format rules

- `<lang>` in Evidence fence: use the language of the file (`js`, `ts`, `py`, `md`, `yaml`). If unknown, leave blank.
- IDs must match regex `F-\d{3}` (e.g. `F-001`, not `F-1`, not `F-001-blind`). The `-blind` suffix is added by Pass 2 reconciliation if needed.
- Severity enum: `blocker | critical | major | minor | nit`. No other values.
- Confidence enum: `high | medium | low`. No other values.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space (no items).

## Forbidden

- Markdown other than the template above.
- Bullet lists summarizing findings outside the per-finding structure.
- "What works well" sections.
- Praise or hedging ("the author probably intends...").
- Multiple verdicts.
- Multiple frontmatter blocks.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above

Begin review now.
```

</details>

<details>
<summary>Pass 2 briefing</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Non-goals (factual, no rationale)

- This review does not cover UX/visual design of the dashboard
- This review does not cover deployment or CI/CD pipelines
- This review does not cover authentication or authorization (aiDeck is localhost-only)
- This review does not cover performance benchmarking

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Artifact to review

Path: .atomic-skills/plans/aideck-multi-project.md

---BEGIN ARTIFACT---
---
schemaVersion: "0.1"
slug: aideck-multi-project
title: Suporte Multi-Projeto no aiDeck
version: "1.0"
status: active
started: 2026-05-25T17:06:39.511Z
lastUpdated: 2026-05-25T17:06:39.511Z
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Single-instance, multi-rootDir
    body: Uma instância de aiDeck, uma porta. Projetos se registram via API; nunca
      existe mais de um processo aiDeck rodando.
  - id: P2
    title: Backward-compatible API
    body: As rotas existentes (`/api/state/:consumer`, `/api/health`, `/sse`)
      continuam funcionando para o projeto default (o primeiro registrado).
      Nenhum consumidor existente quebra.
  - id: P3
    title: Zero-config for single-project
    body: Quem usa apenas um projeto não precisa mudar nada. O comportamento
      single-project é o default e funciona sem flags ou configuração extra.
  - id: P4
    title: Watcher-per-project isolation
    body: Cada rootDir registrado tem seu próprio chokidar watcher. Falha ou
      lentidão em um não afeta os outros.
glossary:
  - term: rootDir
    definition: Diretório raiz de um projeto que contém `.atomic-skills/`. Cada
      projeto tem um rootDir distinto.
  - term: ProjectRegistry
    definition: Estrutura in-memory no aiDeck que mapeia projectId para rootDir +
      watcher. Volatile por design (reconstruída via re-registro).
  - term: projectId
    definition: "Identificador derivado do basename do rootDir. Regex:
      `^[a-z][a-z0-9-]{0,63}$`. Deve ser único no registry."
  - term: register
    definition: Ato de adicionar um rootDir ao ProjectRegistry via `POST
      /api/projects/register`. Cria watcher e expoe state.
phases:
  - id: F0
    slug: aideck-multi-project-f0-projectregistry-no-aideck
    title: ProjectRegistry no aiDeck
    goal: Criar a estrutura ProjectRegistry in-memory e a API de
      registro/desregistro/listagem de projetos no aiDeck server.
    dependsOn: []
    subPhaseCount: 5
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F0-G1
          description: POST /api/projects/register aceita rootDir, cria entrada no
            registry, retorna 201
          status: pending
          verifier:
            kind: shell
            command: cd /Volumes/External/code/aideck && npm test -- --grep 'register'
            expectExitCode: 0
        - id: F0-G2
          description: GET /api/projects lista projetos registrados
          status: pending
          verifier:
            kind: shell
            command: cd /Volumes/External/code/aideck && npm test -- --grep 'projects'
            expectExitCode: 0
        - id: F0-G3
          description: /api/health retorna campo projects[] com ao menos o projeto default
          status: pending
          verifier:
            kind: shell
            command: cd /Volumes/External/code/aideck && npm test -- --grep
              'health.*projects'
            expectExitCode: 0
    status: active
  - id: F1
    slug: aideck-multi-project-f1-multi-watcher-por-projeto
    title: Multi-watcher por projeto
    goal: Cada projeto registrado no ProjectRegistry ganha seu proprio watcher
      chokidar, com ciclo de vida gerenciado pelo registry.
    dependsOn:
      - F0
    subPhaseCount: 4
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: Registrar 2 projetos cria 2 watchers independentes; file change em
            um emite evento apenas para aquele projectId
          status: pending
          verifier:
            kind: test
            runner: npm
            pattern: test -- --grep 'multi-watcher'
        - id: F1-G2
          description: Desregistrar um projeto para o watcher sem afetar o outro
          status: pending
          verifier:
            kind: test
            runner: npm
            pattern: test -- --grep 'unregister.*watcher'
    status: pending
  - id: F2
    slug: aideck-multi-project-f2-rotas-project-scoped-no-aideck
    title: Rotas project-scoped no aiDeck
    goal: Adicionar rotas prefixadas por projectId para acessar state, entities e
      inbox de projetos especificos.
    dependsOn:
      - F1
    subPhaseCount: 4
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: GET /api/projects/:id/state/project-status retorna state do projeto
            correto
          status: pending
          verifier:
            kind: test
            runner: npm
            pattern: test -- --grep 'project-scoped state'
        - id: F2-G2
          description: Rotas existentes sem prefixo continuam retornando state do projeto
            default
          status: pending
          verifier:
            kind: test
            runner: npm
            pattern: test -- --grep 'backward-compat'
    status: pending
  - id: F3
    slug: aideck-multi-project-f3-ensureaideck-como-registro
    title: ensureAideck como registro
    goal: Modificar ensureAideck() no atomic-skills para registrar o projeto no
      aiDeck existente em vez de matar e reiniciar.
    dependsOn:
      - F2
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F3-G1
          description: ensureAideck de projeto B com aiDeck rodando para projeto A
            registra B sem matar A
          status: pending
          verifier:
            kind: test
            runner: npm
            pattern: test -- --grep 'multi-project register'
        - id: F3-G2
          description: projectId derivado do CWD e validado como slug
          status: pending
          verifier:
            kind: test
            runner: npm
            pattern: test -- --grep 'derive projectId'
    status: pending
  - id: F4
    slug: aideck-multi-project-f4-dashboard-multi-projeto-na-homepage
    title: Dashboard multi-projeto na HomePage
    goal: Dashboard exibe projetos registrados como bands separadas na HomePage,
      cada um com seus planos e iniciativas.
    dependsOn:
      - F3
    subPhaseCount: 4
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F4-G1
          description: HomePage renderiza 2 ConsumerBands quando 2 projetos registrados
          status: pending
          verifier:
            kind: manual
            description: Registrar 2 projetos via API, abrir dashboard, verificar 2 bands
              visualmente
        - id: F4-G2
          description: Dashboard funciona com aiDeck antigo (sem /api/projects) via
            fallback single-project
          status: pending
          verifier:
            kind: manual
            description: Apontar dashboard para aiDeck sem rotas /api/projects, verificar
              que homepage carrega normalmente
    status: pending
  - id: F5
    slug: aideck-multi-project-f5-navegacao-project-scoped-no-dashboard
    title: Navegacao project-scoped no Dashboard
    goal: Rotas, links e navigation do dashboard incluem contexto de projeto para
      que planos/iniciativas de projetos diferentes nao colidam.
    dependsOn:
      - F4
    subPhaseCount: 4
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F5-G1
          description: Clicar num plano do projeto B navega para /project-b/plans/slug
            (nao /plans/slug)
          status: pending
          verifier:
            kind: manual
            description: Registrar 2 projetos, clicar num plano do segundo, verificar URL
              inclui projectId
        - id: F5-G2
          description: Rotas sem prefixo continuam funcionando para backward-compat
          status: pending
          verifier:
            kind: manual
            description: Abrir /plans/existing-slug sem projectId, verificar que carrega o
              plano do projeto default
    status: pending
references: []
---

# Suporte Multi-Projeto no aiDeck

## 1. Context

Hoje o aiDeck opera com um único rootDir por instância. Quando um segundo projeto chama `ensureAideck()`, a instância existente é morta e reiniciada apontando para o novo CWD. Isso impede que dois ou mais projetos compartilhem o mesmo dashboard simultaneamente. Este plano implementa o suporte a múltiplos rootDirs por instância, com registro dinâmico via API e visualização separada por projeto no dashboard.

## 2. Inviolable principles

- **P1 Single-instance, multi-rootDir** — Uma instância de aiDeck, uma porta. Projetos se registram via API; nunca existe mais de um processo aiDeck rodando.
- **P2 Backward-compatible API** — As rotas existentes (`/api/state/:consumer`, `/api/health`, `/sse`) continuam funcionando para o projeto default (o primeiro registrado). Nenhum consumidor existente quebra.
- **P3 Zero-config for single-project** — Quem usa apenas um projeto não precisa mudar nada. O comportamento single-project é o default e funciona sem flags ou configuração extra.
- **P4 Watcher-per-project isolation** — Cada rootDir registrado tem seu próprio chokidar watcher. Falha ou lentidão em um não afeta os outros.

## 3. Phase tree

| Phase | Title | Tasks | Gates | Depends on |
|-------|-------|-------|-------|------------|
| F0 | ProjectRegistry no aiDeck | 5 | 3 | — |
| F1 | Multi-watcher por projeto | 4 | 2 | F0 |
| F2 | Rotas project-scoped no aiDeck | 4 | 2 | F1 |
| F3 | ensureAideck como registro | 3 | 2 | F2 |
| F4 | Dashboard multi-projeto na HomePage | 4 | 2 | F3 |
| F5 | Navegacao project-scoped no Dashboard | 4 | 2 | F4 |

F0-F2 operam no repo **aideck** (`/Volumes/External/code/aideck/`).
F3 opera no repo **atomic-skills** (`/Volumes/External/code/atomic-skills/`).
F4-F5 operam no dashboard dentro de **atomic-skills** (`src/dashboard/`).

## Self-review against code-quality gates

- **G1 read-before-claim**: Claims sobre codigo existente (ensureAideck kill+restart, single rootDir, hardcoded CONSUMER) foram verificadas via Read tool durante a analise pre-plano (serve.js:200-217, api.ts:18, index.ts:53). N/A para tasks descrevendo codigo novo.
- **G2 soft-language**: Scanned plan body for ban list; 0 occurrences.
- **G6 reference-or-strike**: Plan describes future work (tasks with target files). No bare claims about existing code state in body. All existing-code references verified in conversation context.
---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

# Required Output Format — Pass 1 (Blind)

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

## Format rules

- `<lang>` in Evidence fence: use the language of the file (`js`, `ts`, `py`, `md`, `yaml`). If unknown, leave blank.
- IDs must match regex `F-\d{3}` (e.g. `F-001`, not `F-1`, not `F-001-blind`). The `-blind` suffix is added by Pass 2 reconciliation if needed.
- Severity enum: `blocker | critical | major | minor | nit`. No other values.
- Confidence enum: `high | medium | low`. No other values.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space (no items).

## Forbidden

- Markdown other than the template above.
- Bullet lists summarizing findings outside the per-finding structure.
- "What works well" sections.
- Praise or hedging ("the author probably intends...").
- Multiple verdicts.
- Multiple frontmatter blocks.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above

## External constraints (verifiable)

The constraints below are verifiable externally. Each line includes how to
verify if needed. Treat as ground truth.

- Node.js >= 18.0.0 required (verify: `grep engines package.json`)
- aiDeck binds to 127.0.0.1 only — localhost, never exposed to network (verify: grep LOCALHOST in aideck/src/server/index.ts)
- aiDeck is a single Hono HTTP server on one port (default 7777) — no multi-port, no clustering
- ProjectRegistry is in-memory only — volatile, reconstructed via re-registration on restart
- The plan spans TWO repos: aideck (server) and atomic-skills (skills + dashboard)
- Dashboard is React 19 + Vite SPA, served via aideck --static-dir
- Existing consumers use /api/state/project-status, /api/health, /sse (same-origin) — these must not break
- schemaVersion for all .atomic-skills/ state files is '0.1'

## Pass 1 (blind) findings

The following findings were produced by your previous review WITHOUT the
constraints above. Re-evaluate each against the constraints.

---BEGIN PASS 1 OUTPUT---
---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan defines the broad phase order, but several core contracts are underspecified: project identity, default project semantics, SSE compatibility, registration validation, and watcher failure isolation. These are not small implementation details; they affect whether existing consumers keep receiving the correct project state and whether multi-project behavior can be implemented consistently.

## Findings

### F-001 [critical] ambiguity — .atomic-skills/plans/aideck-multi-project.md:36-38

**Evidence:**
```yaml
  - term: projectId
    definition: "Identificador derivado do basename do rootDir. Regex:
      `^[a-z][a-z0-9-]{0,63}$`. Deve ser único no registry."
```

**Claim:** Project identity is underspecified because deriving `projectId` only from `basename(rootDir)` cannot both satisfy the regex and guarantee uniqueness across distinct rootDirs.

**Impact:** Two projects with the same directory name in different parents collide, and any project whose basename contains uppercase letters, underscores, dots, spaces, or starts with a digit cannot register despite the zero-config requirement; implementation will either reject valid local projects or invent incompatible collision behavior midstream.

**Recommendation:** Define the exact `projectId` derivation algorithm, invalid-name handling, duplicate-basename behavior, and whether clients may provide an explicit `projectId`; add registration tests for invalid basenames and duplicate basenames.

**Confidence:** high

---

### F-002 [major] coverage gap — .atomic-skills/plans/aideck-multi-project.md:16-20

**Evidence:**
```yaml
  - id: P2
    title: Backward-compatible API
    body: As rotas existentes (`/api/state/:consumer`, `/api/health`, `/sse`)
      continuam funcionando para o projeto default (o primeiro registrado).
      Nenhum consumidor existente quebra.
```

**Claim:** The plan requires `/sse` backward compatibility but never defines scoped SSE endpoints, filtering behavior, event payload shape, or a gate proving legacy `/sse` only exposes the default project.

**Impact:** Existing SSE consumers may receive cross-project events, miss events after multi-project changes, or break if event payloads are changed to include `projectId` without a compatibility contract.

**Recommendation:** Add an SSE-specific phase item and exit gates covering legacy `/sse` default-project behavior, project-scoped subscription behavior, and event payload compatibility.

**Confidence:** high

---

### F-003 [major] ambiguity — .atomic-skills/plans/aideck-multi-project.md:33-35

**Evidence:**
```yaml
  - term: ProjectRegistry
    definition: Estrutura in-memory no aiDeck que mapeia projectId para rootDir +
      watcher. Volatile por design (reconstruída via re-registro).
```

**Claim:** Default project lifecycle is ambiguous because the registry is volatile while backward compatibility depends on “the first registered” project.

**Impact:** If the first project unregisters, crashes, reconnects later, or the aiDeck process restarts and projects re-register in a different order, legacy routes such as `/api/state/:consumer` and unprefixed dashboard routes can silently point at a different project.

**Recommendation:** Specify stable default-project rules, including startup, re-registration order, unregistering the default, and whether callers can explicitly set or preserve the default; add tests for each transition.

**Confidence:** high

---

### F-004 [major] coverage gap — .atomic-skills/plans/aideck-multi-project.md:53-60

**Evidence:**
```yaml
        - id: F0-G1
          description: POST /api/projects/register aceita rootDir, cria entrada no
            registry, retorna 201
          status: pending
          verifier:
            kind: shell
            command: cd /Volumes/External/code/aideck && npm test -- --grep 'register'
            expectExitCode: 0
```

**Claim:** Registration validation is missing because the gate only checks that `rootDir` is accepted and stored, not that it exists, is canonical, contains `.atomic-skills/`, or handles duplicate rootDirs safely.

**Impact:** The server can register nonexistent paths, equivalent paths under different spellings, or directories that are not atomic-skills projects, causing watchers and state readers to fail later under project-scoped routes.

**Recommendation:** Add explicit registration contract and tests for absolute/canonical path validation, `.atomic-skills/` presence, nonexistent paths, duplicate rootDirs, and duplicate `projectId`s.

**Confidence:** high

---

### F-005 [major] coverage gap — .atomic-skills/plans/aideck-multi-project.md:25-28

**Evidence:**
```yaml
  - id: P4
    title: Watcher-per-project isolation
    body: Cada rootDir registrado tem seu próprio chokidar watcher. Falha ou
      lentidão em um não afeta os outros.
```

**Claim:** Watcher failure isolation is stated as a principle but not covered by the F1 gates, which only verify independent change events and unregister behavior.

**Impact:** A watcher error, unreadable directory, rebuild exception, or slow event handler in one project can still poison shared process state or block event delivery for other projects while the plan appears complete.

**Recommendation:** Add F1 tasks and tests that inject watcher errors and slow handlers for one project and verify the other project continues serving state and emitting events.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/plans/aideck-multi-project.md:107 — What are the exact project-scoped paths for `entities` and `inbox`, and do existing consumers call unprefixed versions today?
- .atomic-skills/plans/aideck-multi-project.md:240 — Are the F1/F2 `kind: test` verifiers always executed from `/Volumes/External/code/aideck/`, or should they include an explicit working directory like F0?

## Out of scope

- UX and visual layout of the dashboard bands.
- Deployment, CI/CD, authentication, authorization, and performance benchmarking.
---END PASS 1 OUTPUT---

## Your task in this pass

1. Re-evaluate ALL findings from Pass 1 against the External Constraints.
   For EACH Pass 1 finding, decide one of:
   - **DROP** — finding is invalid given a constraint or non-goal
   - **MAINTAIN** — finding stands, severity unchanged
   - **REFINE** — finding stands but severity changes

2. Identify NEW findings that emerge ONLY because of these constraints
   (e.g. the artifact violates a constraint you couldn't see in Pass 1).

3. Output the FULL final findings list (use new sequential IDs starting at
   F-001) plus a complete `## Pass 2 reconciliation` block.

## Output format

# Required Output Format — Pass 2 (Informed)

Same template as Pass 1 PLUS an obligatory `## Pass 2 reconciliation` block.
You MUST respond in this exact structure.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id>
pass: informed
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words>

## Findings

### F-001 [<severity>] <category> — <file>:<line>

**Evidence:** <...>
**Claim:** <...>
**Impact:** <...>
**Recommendation:** <...>
**Confidence:** <...>

---

### F-002 ... (final IDs — these are the post-constraints findings)

## Questions (non-findings)

- <file>:<line> — <question>

## Out of scope

- <item>

## Pass 2 reconciliation

### Dropped from blind pass

<For each Pass 1 finding you are dropping, write one line:>

- F-001-blind [<severity>] <category> — DROPPED: <one-sentence reason citing
  which constraint or non-goal makes it invalid>

<If no drops: write `- _(none)_`>

### Maintained

<For each Pass 1 finding kept (with or without severity change):>

- F-002-blind → F-001-final [<severity>] — <same | severity changed: was X, now Y>

<If no maintained: write `- _(none)_`>

### Emerged

<For each NEW finding that surfaced only because constraints were revealed:>

- F-XXX-final [<severity>] <category> — emerged: <one-sentence reason citing
  the constraint that triggered the finding>

<If no emerged: write `- _(none)_`>
````

## Rules specific to Pass 2

- Final findings use sequential IDs `F-001, F-002, ...` (no `-final` suffix in the `## Findings` section — only in reconciliation references).
- In reconciliation, refer to blind findings with `-blind` suffix and maintained mappings with `→ F-XXX-final`.
- `counts` is the COUNT OF FINAL findings (post-reconciliation), not blind.
- `pass: informed` (literal).
- All universal rules from `output-template-pass1.md` apply.

Begin reconciliation now.
```

</details>

## Fixes applied in this session

<!-- Append-only. Triagem step adds lines here as user approves/skips. -->

- F-001 [critical] projectId derivation: APPLIED — expanded glossary definition with full derivation algorithm (sanitization, collision handling, explicit id override)
- F-002 [major] SSE backward-compat: APPLIED — added F1-G3 gate (legacy /sse default-project filtering)
- F-003 [major] default project lifecycle: APPLIED — expanded ProjectRegistry glossary definition with default project rules (promotion, unregister, restart)
- F-004 [major] registration validation: APPLIED — added F0-G4 (reject invalid rootDirs) and F0-G5 (idempotent re-register)
- F-005 [major] watcher failure isolation: APPLIED — added F1-G4 gate (watcher error in one project does not block others)
