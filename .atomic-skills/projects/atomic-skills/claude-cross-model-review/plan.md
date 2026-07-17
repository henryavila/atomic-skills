---
schemaVersion: "0.1"
slug: claude-cross-model-review
title: Claude as external cross-model review provider
version: "1.0"
status: active
started: 2026-07-17T18:41:49.722Z
lastUpdated: 2026-07-17T19:06:05.000Z
branch: plan/claude-cross-model-review
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Third leaf, not a fork
    body: Claude is a `providers/claude/` sealed-envelope leaf on the existing
      skeleton; do not invent a parallel review stack or Anthropic HTTP SDK
      backend.
  - id: P2
    title: Host ≠ reviewer
    body: same-family Claude-on-Claude never counts as CROSS-MODEL REVIEW;
      confirm→local or HARD ABORT with `--accept-same-family-as-local`.
  - id: P3
    title: Legacy defaults stay
    body: "`HOST_EXTERNAL_DEFAULT` is unchanged (`claude→codex`, `codex→grok`,
      `grok→codex`); Claude is additive via modes and external-both legs."
  - id: P4
    title: Model discovery honesty
    body: no fake live catalog; explicit `--model` / aliases / `cli-default` only
      (design D7).
  - id: P5
    title: Safe headless surface
    body: default invocation uses `--safe-mode` + allowlisted read tools +
      `dontAsk`; never bypassPermissions / skip-permissions for review.
  - id: P6
    title: Collect-then-merge
    body: external-both finishes all family-different legs before human triage;
      partial failure keeps the good half.
glossary:
  - term: provider leaf
    definition: "`preflight-checks.txt` + `invocation-canonical.txt` under
      `skills/shared/codex-bridge-assets/providers/<id>/`."
  - term: external-both
    definition: mode that runs every family-different external provider in fixed
      order `codex → grok → claude`, then merges findings.
  - term: cli-default
    definition: resolve path that omits `--model` so the provider CLI picks its
      configured default.
  - term: same-family remap
    definition: "route that records `provider: local` when host family equals
      requested external provider."
phases:
  - id: F0
    slug: claude-cross-model-review-f0-smoke-and-draft-claude-leaf
    title: Smoke and draft Claude leaf
    goal: Prove Claude Code headless can run a sealed one-shot review-shaped call,
      and draft the provider leaf files from observed flags (briefing channel +
      tool ids locked).
    dependsOn: []
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F0-G1
          description: Smoke notes record briefing-channel, tools-allowlist, auth-path,
            exit-0, and model-aliases-from-help (each present).
          status: met
          verifier:
            kind: shell
            command: test -s
              .atomic-skills/projects/atomic-skills/claude-cross-model-review/smoke-notes.md
              && grep -q 'briefing-channel'
              .atomic-skills/projects/atomic-skills/claude-cross-model-review/smoke-notes.md
              && grep -q 'tools-allowlist'
              .atomic-skills/projects/atomic-skills/claude-cross-model-review/smoke-notes.md
              && grep -q 'auth-path'
              .atomic-skills/projects/atomic-skills/claude-cross-model-review/smoke-notes.md
              && grep -q 'exit-0'
              .atomic-skills/projects/atomic-skills/claude-cross-model-review/smoke-notes.md
              && grep -q 'model-aliases-from-help'
              .atomic-skills/projects/atomic-skills/claude-cross-model-review/smoke-notes.md
            expectExitCode: 0
          metAt: 2026-07-17T19:06:05.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-17T19:06:05.000Z
            passed: true
            exitCode: 0
            outputSummary: F0-G1
            verifiedCommit: b0de8446fd78b12057889196b54692521134fb88
        - id: F0-G2
          description: Both Claude provider leaf files exist (preflight + invocation) with
            safe-mode and non-bypass permission surface.
          status: met
          verifier:
            kind: shell
            command: test -s
              skills/shared/codex-bridge-assets/providers/claude/preflight-checks.txt
              && test -s
              skills/shared/codex-bridge-assets/providers/claude/invocation-canonical.txt
              && grep -q 'safe-mode'
              skills/shared/codex-bridge-assets/providers/claude/invocation-canonical.txt
              && grep -E 'dontAsk|permission-mode'
              skills/shared/codex-bridge-assets/providers/claude/invocation-canonical.txt
            expectExitCode: 0
          metAt: 2026-07-17T19:06:05.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-17T19:06:05.000Z
            passed: true
            exitCode: 0
            outputSummary: F0-G2
            verifiedCommit: b0de8446fd78b12057889196b54692521134fb88
    status: active
    businessIntent:
      value: Em Codex/Grok, poder revisar com Claude (e com o terceiro family) sem
        mudar defaults legados — fecha o gap de cross-model.
      workflow: "F0: smoke headless Claude sealed call, registrar canal/tools/auth,
        draft providers/claude leaf. Downstream: fixtures, routing, merge/model,
        skill UX, KB."
      rules: Third leaf only; host different from reviewer; legacy
        HOST_EXTERNAL_DEFAULT unchanged; no fake live model catalog; safe-mode
        plus dontAsk plus read allowlist; never bypassPermissions for review.
      outOfScope: Anthropic HTTP SDK backend; changing host defaults; Cursor or Gemini
        as external providers; auto-apply of external findings; renaming
        codex-bridge-assets.
      doneWhen: smoke-notes.md com canal/tools/auth/exit-0 E providers/claude
        preflight e invocation com safe-mode e dontAsk.
    summary: Provar headless Claude e rascunhar a folha providers/claude.
  - id: F1
    slug: claude-cross-model-review-f1-provider-leaf-fixtures-and-install
    title: Provider leaf fixtures and install surface
    goal: Lock the Claude leaf with the same fixture-test pattern as Grok and ensure
      install still stages providers under `_assets`.
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: Claude invocation fixture test is green.
          status: pending
          verifier:
            kind: shell
            command: test -f tests/cross-model-claude-invocation.test.js && node --test
              tests/cross-model-claude-invocation.test.js
            expectExitCode: 0
        - id: F1-G2
          description: Install suite remains green with providers/claude on disk.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/install.test.js
            expectExitCode: 0
    status: pending
    summary: Travar a leaf Claude com testes de fixture e install.
  - id: F2
    slug: claude-cross-model-review-f2-routing-host-matrix-and-modes
    title: Routing host matrix and modes
    goal: Register Claude as an external provider id; add modes; same-family gate;
      external-both filters to family-different legs in order codex→grok→claude.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: Host-default unit tests green; EXTERNAL_PROVIDERS includes claude;
            isSameFamilyExternal(claude,claude) true.
          status: pending
          verifier:
            kind: shell
            command: grep -q "claude" src/cross-model-host-default.js && grep -E
              "EXTERNAL_PROVIDERS.*claude|'claude'"
              src/cross-model-host-default.js && test -f
              tests/cross-model-host-default.test.js && node --test
              tests/cross-model-host-default.test.js
            expectExitCode: 0
        - id: F2-G2
          description: host-default-external.md documents external-both order codex → grok
            → claude and mode both-claude or claude external.
          status: pending
          verifier:
            kind: shell
            command: grep -q 'codex → grok → claude'
              skills/shared/codex-bridge-assets/host-default-external.md && grep
              -E 'both-claude|mode.*claude|provider.*claude'
              skills/shared/codex-bridge-assets/host-default-external.md
            expectExitCode: 0
    status: pending
    summary: Registrar Claude no routing e na matriz external-both.
  - id: F3
    slug: claude-cross-model-review-f3-merge-n-provider-model-resolve-rec
    title: Merge N-provider, model resolve, receipt enum
    goal: Merge accepts Claude; model flags work without live catalog; receipts can
      record provider claude.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F3-G1
          description: "external-both-merge tests green: Claude as third provider; 2-arg
            legacy compat; 3-arg with claude; skip patterns."
          status: pending
          verifier:
            kind: shell
            command: test -f tests/external-both-merge.test.js && node --test
              tests/external-both-merge.test.js
            expectExitCode: 0
        - id: F3-G2
          description: resolve-review-model (aliases + cli-default, no live catalog) and
            review-provider-field include claude.
          status: pending
          verifier:
            kind: shell
            command: test -f tests/resolve-review-model.test.js && test -f
              tests/review-provider-field.test.js && node --test
              tests/resolve-review-model.test.js
              tests/review-provider-field.test.js
            expectExitCode: 0
    status: pending
    summary: Generalizar merge N-provider, model flags e receipt enum.
  - id: F4
    slug: claude-cross-model-review-f4-skill-ux-and-envelope-wiring
    title: Skill UX and envelope wiring
    goal: Operators can select Claude modes from review-code / review-plan; envelope
      orchestration binds providers/claude; argument-hints document the matrix.
    dependsOn:
      - F3
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F4-G1
          description: Skill bodies mention both-claude; envelope shows third merge arg
            and «PROVIDER» includes claude.
          status: pending
          verifier:
            kind: shell
            command: grep -q 'both-claude' skills/core/review-code.md && grep -q
              'both-claude' skills/core/review-plan.md && grep -E
              'claude\.json|claude.json'
              skills/shared/codex-bridge-assets/envelope-orchestration.md &&
              grep -E
              "codex.*grok.*claude|claude.*grok.*codex|providers/claude|«PROVIDER».*claude|PROVIDER.*claude"
              skills/shared/codex-bridge-assets/envelope-orchestration.md
            expectExitCode: 0
        - id: F4-G2
          description: validate-skills is green.
          status: pending
          verifier:
            kind: shell
            command: npm run validate-skills
            expectExitCode: 0
    status: pending
    summary: Ligar modes Claude nos skills review-code/plan e assets UX.
  - id: F5
    slug: claude-cross-model-review-f5-kb-docs-and-matrix-smoke-checklist
    title: KB docs and matrix smoke checklist
    goal: Document the three-provider matrix and model-discovery honesty; leave an
      operator-runnable smoke checklist for the three hosts.
    dependsOn:
      - F4
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F5-G1
          description: KB documents three-provider modes and Claude model policy.
          status: pending
          verifier:
            kind: shell
            command: grep -q 'both-claude\|mode=claude' docs/kb/cross-model-review-design.md
              && grep -E 'cli-default|alias'
              docs/kb/cross-model-review-design.md
            expectExitCode: 0
        - id: F5-G2
          description: Unit suites for routing, merge, model, provider-field, and claude
            invocation are green together.
          status: pending
          verifier:
            kind: shell
            command: test -f tests/cross-model-claude-invocation.test.js && test -f
              tests/cross-model-host-default.test.js && test -f
              tests/external-both-merge.test.js && test -f
              tests/resolve-review-model.test.js && test -f
              tests/review-provider-field.test.js && node --test
              tests/cross-model-claude-invocation.test.js
              tests/cross-model-host-default.test.js
              tests/external-both-merge.test.js
              tests/resolve-review-model.test.js
              tests/review-provider-field.test.js
            expectExitCode: 0
    status: pending
    summary: Documentar matriz 3-way na KB e checklist de smoke.
references: []
---

# Claude as external cross-model review provider

## 1. Context

Close the host×reviewer matrix so Codex and Grok hosts can run sealed external review with Claude Code, and Claude remains able to use Codex + Grok. Deliver a third `cross-model-bridge` provider leaf, N-provider merge, routing modes, and skill UX — without claiming live model-catalog parity with Codex.

## 2. Inviolable principles

- **P1 Third leaf, not a fork** — Claude is a `providers/claude/` sealed-envelope leaf on the existing skeleton; do not invent a parallel review stack or Anthropic HTTP SDK backend.
- **P2 Host ≠ reviewer** — same-family Claude-on-Claude never counts as CROSS-MODEL REVIEW; confirm→local or HARD ABORT with `--accept-same-family-as-local`.
- **P3 Legacy defaults stay** — `HOST_EXTERNAL_DEFAULT` is unchanged (`claude→codex`, `codex→grok`, `grok→codex`); Claude is additive via modes and external-both legs.
- **P4 Model discovery honesty** — no fake live catalog; explicit `--model` / aliases / `cli-default` only (design D7).
- **P5 Safe headless surface** — default invocation uses `--safe-mode` + allowlisted read tools + `dontAsk`; never bypassPermissions / skip-permissions for review.
- **P6 Collect-then-merge** — external-both finishes all family-different legs before human triage; partial failure keeps the good half.

## 2b. Dogfood invocation proof (2026-07-17)

verified_by: live `claude 2.1.212` headless run against this plan (~84s, exit 0).

```bash
claude --safe-mode -p --effort high --tools "Read,Grep,Glob" \
  --permission-mode dontAsk --no-session-persistence --disable-slash-commands \
  --output-format text < briefing.md > out.md
```

- briefing-channel: stdin-redirect (proven)
- tools-allowlist: Read,Grep,Glob (proven)
- auth-path: safe-mode + existing login (proven; stderr empty)
- model-aliases-from-help: fable, opus, sonnet
- Full review: `.atomic-skills/reviews/2026-07-17-claude-dogfood-plan-review-clean.md`
- Plan gates below were tightened from that review (F0-G1 AND markers; F0-G2 both files; F2 EXTERNAL_PROVIDERS + non-false-pass greps; F3/F4/F5 file-exists + third merge arg / provider enum).

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Reviews

- internal: 2026-07-17 — self-loop Stage 8a (zero major+). Soft-language scan hits=0. Phases F0–F5 SPEC-admitted from design-approved source. Model discovery honesty (D7) locked.
- cross-model (claude dogfood): needs_changes — 2B/2C/4M/2m applied 2026-07-17 — .atomic-skills/reviews/2026-07-17-claude-dogfood-plan-review-clean.md
- cross-model (codex): SKIPPED — dogfood used Claude leaf path first; optional second family later

## Implementation status (2026-07-17 dogfood fix-all)

- providers/claude leaf + fixture tests
- routing modes claude/both-claude; external-both order codex→grok→claude
- merge N-provider + --model-claude + PROVIDER_ENUM claude
- skill UX + KB + install counts
- unit suite: cross-model-* + install green
