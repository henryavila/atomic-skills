# Claude as external cross-model review provider

Close the host×reviewer matrix so Codex and Grok hosts can run sealed external review with Claude Code, and Claude remains able to use Codex + Grok. Deliver a third `cross-model-bridge` provider leaf, N-provider merge, routing modes, and skill UX — without claiming live model-catalog parity with Codex.

## Inviolable principles

- **P1 Third leaf, not a fork** — Claude is a `providers/claude/` sealed-envelope leaf on the existing skeleton; do not invent a parallel review stack or Anthropic HTTP SDK backend.
- **P2 Host ≠ reviewer** — same-family Claude-on-Claude never counts as CROSS-MODEL REVIEW; confirm→local or HARD ABORT with `--accept-same-family-as-local`.
- **P3 Legacy defaults stay** — `HOST_EXTERNAL_DEFAULT` is unchanged (`claude→codex`, `codex→grok`, `grok→codex`); Claude is additive via modes and external-both legs.
- **P4 Model discovery honesty** — no fake live catalog; explicit `--model` / aliases / `cli-default` only (design D7).
- **P5 Safe headless surface** — default invocation uses `--safe-mode` + allowlisted read tools + `dontAsk`; never bypassPermissions / skip-permissions for review.
- **P6 Collect-then-merge** — external-both finishes all family-different legs before human triage; partial failure keeps the good half.

## Glossary

- **provider leaf** — `preflight-checks.txt` + `invocation-canonical.txt` under `skills/shared/codex-bridge-assets/providers/<id>/`.
- **external-both** — mode that runs every family-different external provider in fixed order `codex → grok → claude`, then merges findings.
- **cli-default** — resolve path that omits `--model` so the provider CLI picks its configured default.
- **same-family remap** — route that records `provider: local` when host family equals requested external provider.

## F0 — Smoke and draft Claude leaf

Goal: Prove Claude Code headless can run a sealed one-shot review-shaped call, and draft the provider leaf files from observed flags (briefing channel + tool ids locked).

### T-001 Prove headless Claude sealed call

- Files: .atomic-skills/projects/atomic-skills/claude-cross-model-review/smoke-notes.md
- scopeBoundary: Do not edit production skill bodies, routing modules, or install code. Smoke only.
- acceptance: A one-shot `claude --safe-mode -p` (or the channel F0 proves) with read-only tools returns non-empty stdout and exit 0 for a fixed prompt `PONG`.; Briefing input channel is recorded as one of: stdin-redirect, `-p` file contents, or other flag that works on the installed CLI.; Tool allowlist ids that work are recorded (e.g. `Read,Grep,Glob` or the ids the CLI accepts).; Auth path used (`safe-mode` with existing login vs API key) is recorded.
- verifier: { kind: shell, command: "test -s .atomic-skills/projects/atomic-skills/claude-cross-model-review/smoke-notes.md && grep -E 'briefing-channel|tools-allowlist|auth-path|exit-0' .atomic-skills/projects/atomic-skills/claude-cross-model-review/smoke-notes.md", expectExitCode: 0 }
- RED→GREEN: missing smoke-notes fails the grep; write the file with the four markers after a real CLI run.

### T-002 Draft providers/claude leaf from smoke

- Files: skills/shared/codex-bridge-assets/providers/claude/preflight-checks.txt, skills/shared/codex-bridge-assets/providers/claude/invocation-canonical.txt
- scopeBoundary: Do not change codex/ or grok/ leaves. Do not wire routing or skill bodies yet.
- acceptance: preflight checks binary presence, `claude --version`, auth failure messages, dirty-tree, git-repo (mirror Grok structure).; invocation-canonical documents portable timeout, private mktemp dir, stdout/stderr paths, DO NOT list forbidding bypassPermissions, and the F0-proven briefing channel.; Both files name Provider: claude and path under providers/claude/.
- verifier: { kind: shell, command: "test -s skills/shared/codex-bridge-assets/providers/claude/preflight-checks.txt && test -s skills/shared/codex-bridge-assets/providers/claude/invocation-canonical.txt && grep -q 'safe-mode' skills/shared/codex-bridge-assets/providers/claude/invocation-canonical.txt && grep -q 'dontAsk\\|permission-mode' skills/shared/codex-bridge-assets/providers/claude/invocation-canonical.txt", expectExitCode: 0 }
- RED→GREEN: fixture test later (F1) fails until flags match; draft files enable F1 tests.

```yaml
exit_gate:
  - id: F0-G1
    description: Smoke notes record briefing channel, tools allowlist, auth path, and a successful headless exit 0.
    verifier: { kind: shell, command: "test -s .atomic-skills/projects/atomic-skills/claude-cross-model-review/smoke-notes.md && grep -E 'briefing-channel|tools-allowlist|auth-path|exit-0' .atomic-skills/projects/atomic-skills/claude-cross-model-review/smoke-notes.md", expectExitCode: 0 }
  - id: F0-G2
    description: Draft Claude provider leaf files exist with safe-mode and non-bypass permission surface.
    verifier: { kind: shell, command: "test -s skills/shared/codex-bridge-assets/providers/claude/invocation-canonical.txt && grep -q 'safe-mode' skills/shared/codex-bridge-assets/providers/claude/invocation-canonical.txt", expectExitCode: 0 }
```

## F1 — Provider leaf fixtures and install surface

Goal: Lock the Claude leaf with the same fixture-test pattern as Grok and ensure install still stages providers under `_assets`.

### T-001 Fixture-lock Claude invocation flags

- Files: tests/cross-model-claude-invocation.test.js, tests/fixtures/cross-model-bridge/claude-invocation-required-flags.txt
- scopeBoundary: Do not change routing/merge logic. Leaf content may be tightened to match fixtures only.
- acceptance: Test fails if invocation-canonical lacks required tokens from the F0-proven set (e.g. safe-mode, -p or proven channel, permission-mode dontAsk, no-session-persistence, output-format, timeout wrapper).; Test fails if preflight-checks lacks which/version/auth/dirty-tree checks.; `node --test tests/cross-model-claude-invocation.test.js` exits 0 when leaf matches.
- verifier: { kind: shell, command: "node --test tests/cross-model-claude-invocation.test.js", expectExitCode: 0 }
- RED→GREEN: write failing test asserting required flag strings; then ensure leaf files contain them.

### T-002 Confirm install stages providers/claude

- Files: tests/install.test.js
- scopeBoundary: Do not redesign installer effects. Only assert providers directory includes claude after install when assets are staged.
- acceptance: Existing install/assets tests still pass.; A check proves `providers/claude` is part of the shared assets set that install copies (grep install or assets listing includes claude after leaf lands).
- verifier: { kind: shell, command: "node --test tests/install.test.js", expectExitCode: 0 }
- RED→GREEN: if install already copies providers/* recursively, T-001 leaf presence is enough; otherwise add one assertion for claude path.

```yaml
exit_gate:
  - id: F1-G1
    description: Claude invocation fixture test is green.
    verifier: { kind: shell, command: "node --test tests/cross-model-claude-invocation.test.js", expectExitCode: 0 }
  - id: F1-G2
    description: Install suite remains green with providers/claude on disk.
    verifier: { kind: shell, command: "node --test tests/install.test.js", expectExitCode: 0 }
```

## F2 — Routing host matrix and modes

Goal: Register Claude as an external provider id; add modes; same-family gate; external-both filters to family-different legs in order codex→grok→claude.

### T-001 Extend cross-model-host-default for Claude

- Files: src/cross-model-host-default.js, tests/cross-model-host-default.test.js
- scopeBoundary: Do not implement merge or skill prose. Do not change HOST_EXTERNAL_DEFAULT values.
- acceptance: EXTERNAL_PROVIDERS includes claude; modes include claude and both-claude.; externalProviderForMode('claude'|'both-claude') returns claude; both still uses host default.; isSameFamilyExternal('claude','claude') is true; isSameFamilyExternal('codex','claude') is false.; external-both legs for host claude are [codex, grok]; for host codex are [grok, claude]; for host grok are [codex, claude]; for cursor/unknown are [codex, grok, claude].; Unit tests cover the matrix above and same-family abort/confirm paths for claude.
- verifier: { kind: shell, command: "node --test tests/cross-model-host-default.test.js", expectExitCode: 0 }
- RED→GREEN: add failing matrix cases; implement until green.

### T-002 Update host-default-external docs leaf

- Files: skills/shared/codex-bridge-assets/host-default-external.md
- scopeBoundary: Docs only for this task; skill bodies are F4.
- acceptance: Matrix table lists Claude as external option and same-family rule for host claude.; external-both described as family-filtered codex→grok→claude order.; Envelope binding section mentions providers/claude/.
- verifier: { kind: shell, command: "grep -q 'claude' skills/shared/codex-bridge-assets/host-default-external.md && grep -q 'external-both' skills/shared/codex-bridge-assets/host-default-external.md", expectExitCode: 0 }
- RED→GREEN: doc greps fail until matrix text lands.

```yaml
exit_gate:
  - id: F2-G1
    description: Host-default unit tests green with Claude modes and external-both filter.
    verifier: { kind: shell, command: "node --test tests/cross-model-host-default.test.js", expectExitCode: 0 }
  - id: F2-G2
    description: host-default-external.md documents Claude external and external-both order.
    verifier: { kind: shell, command: "grep -E 'claude|codex → grok|codex.*grok.*claude' skills/shared/codex-bridge-assets/host-default-external.md", expectExitCode: 0 }
```

## F3 — Merge N-provider, model resolve, receipt enum

Goal: Merge accepts Claude; model flags work without live catalog; receipts can record provider claude.

### T-001 Generalize external-both merge to N providers

- Files: src/external-both-merge.js, scripts/merge-external-both.js, tests/external-both-merge.test.js
- scopeBoundary: Do not change severity rank or merge-key algorithm. Do not rewrite skill Flow D prose beyond what F4 owns.
- acceptance: ExternalProvider typedef includes claude.; merge accepts three sides; dual/triple provenance on same merge key; higher severity wins.; CLI: optional third positional arg; omitting third leaves claude status skipped; two-arg callers still work.; Partial failure with one of three failed keeps successful findings + errors map.
- verifier: { kind: shell, command: "node --test tests/external-both-merge.test.js", expectExitCode: 0 }
- RED→GREEN: tests for three-provider merge and third-arg skip; implement until green.

### T-002 Claude branch in resolve-review-model and list-review-models

- Files: src/resolve-review-model.js, scripts/list-review-models.js, tests/resolve-review-model.test.js
- scopeBoundary: No live Anthropic HTTP catalog. No static full-id dump.
- acceptance: parseModelArgs consumes --model-claude= / --model-claude space form.; provider claude resolves: explicit id → source explicit; none → cli-default; --ask-model → recommended alias (opus if in alias list) or cli-default.; list-review-models.js accepts --provider=claude and returns alias list (not empty catalog error that aborts usage for other providers).; rank/recommend for claude does not claim priority JSON from Codex.
- verifier: { kind: shell, command: "node --test tests/resolve-review-model.test.js", expectExitCode: 0 }
- RED→GREEN: failing tests for model-claude flags and cli-default; implement alias path.

### T-003 Receipt provider enum includes claude

- Files: src/review-provider-field.js, tests/review-provider-field.test.js
- scopeBoundary: Do not change same-family remap rule (still forces provider local).
- acceptance: PROVIDER_ENUM includes claude; normalizeProvider('claude') returns claude.; buildProviderFields with provider claude and sameFamilyRemap false records claude; remap true still records local.
- verifier: { kind: shell, command: "node --test tests/review-provider-field.test.js", expectExitCode: 0 }
- RED→GREEN: enum assertion fails until claude is added.

```yaml
exit_gate:
  - id: F3-G1
    description: external-both-merge tests green with Claude as third provider and optional third CLI arg.
    verifier: { kind: shell, command: "node --test tests/external-both-merge.test.js", expectExitCode: 0 }
  - id: F3-G2
    description: resolve-review-model and review-provider-field tests green with Claude.
    verifier: { kind: shell, command: "node --test tests/resolve-review-model.test.js tests/review-provider-field.test.js", expectExitCode: 0 }
```

## F4 — Skill UX and envelope wiring

Goal: Operators can select Claude modes from review-code / review-plan; envelope orchestration binds providers/claude; argument-hints document the matrix.

### T-001 Wire review-code and review-plan modes for Claude

- Files: skills/core/review-code.md, skills/core/review-plan.md
- scopeBoundary: Do not reimplement envelope steps inline; reference envelope-orchestration and provider leaves. Do not change local-review agent design.
- acceptance: argument-hint and mode tables include claude, both-claude, and external-both as family-filtered multi-provider.; Flow B accepts mode claude; Flow C both-claude; Flow D order codex then grok then claude (filter same-family).; Provider binding text is «PROVIDER» ∈ {codex, grok, claude}.; Closing summary Provider field lists claude.
- verifier: { kind: shell, command: "grep -E 'both-claude|--mode=claude|claude' skills/core/review-code.md skills/core/review-plan.md && grep -q 'external-both' skills/core/review-code.md", expectExitCode: 0 }
- RED→GREEN: greps fail until mode tables updated.

### T-002 Update shared review UX assets

- Files: skills/shared/codex-bridge-assets/review-mode-ux.md, skills/shared/codex-bridge-assets/envelope-orchestration.md, skills/shared/local-review-assets/diff-capture.md
- scopeBoundary: Shared assets only; no dashboard code.
- acceptance: review-mode-ux host-aware picker options include Claude external where family-different.; envelope-orchestration external-both order mentions claude; provider set documents three leaves.; diff-capture flag table includes --mode=claude.
- verifier: { kind: shell, command: "grep -q 'claude' skills/shared/codex-bridge-assets/review-mode-ux.md && grep -q 'claude' skills/shared/codex-bridge-assets/envelope-orchestration.md && grep -q 'claude' skills/shared/local-review-assets/diff-capture.md", expectExitCode: 0 }
- RED→GREEN: greps fail until docs updated.

### T-003 validate-skills after skill rewrites

- Files: skills/core/review-code.md, skills/core/review-plan.md (only as already edited)
- scopeBoundary: Fix skill schema issues only; no feature expansion.
- acceptance: npm run validate-skills exits 0.
- verifier: { kind: shell, command: "npm run validate-skills", expectExitCode: 0 }
- RED→GREEN: validation fails on bad frontmatter/argument-hint; fix until green.

```yaml
exit_gate:
  - id: F4-G1
    description: Skill bodies and shared UX assets mention Claude modes and external-both order.
    verifier: { kind: shell, command: "grep -q 'both-claude' skills/core/review-code.md && grep -q 'claude' skills/shared/codex-bridge-assets/envelope-orchestration.md", expectExitCode: 0 }
  - id: F4-G2
    description: validate-skills is green.
    verifier: { kind: shell, command: "npm run validate-skills", expectExitCode: 0 }
```

## F5 — KB docs and matrix smoke checklist

Goal: Document the three-provider matrix and model-discovery honesty; leave an operator-runnable smoke checklist for the three hosts.

### T-001 Update cross-model-review KB

- Files: docs/kb/cross-model-review-design.md
- scopeBoundary: KB only; no code changes.
- acceptance: External modes list includes claude / both-claude.; external-both described as family-filtered codex→grok→claude.; Model selection section states Claude has no live catalog; aliases + cli-default.; Host defaults table still shows legacy defaults and Claude as available external.
- verifier: { kind: shell, command: "grep -q 'claude' docs/kb/cross-model-review-design.md && grep -E 'cli-default|alias|no live|without live' docs/kb/cross-model-review-design.md", expectExitCode: 0 }
- RED→GREEN: greps fail until KB updated.

### T-002 Operator smoke checklist in plan lessons or docs

- Files: docs/kb/cross-model-review-design.md
- scopeBoundary: Checklist only inside the KB; does not require CI to run paid external reviews.
- acceptance: Checklist rows for host Claude external-both → codex+grok; host Codex → grok+claude; host Grok → codex+claude.; Single-provider --mode=claude preflight path documented.; Notes that live smoke is manual and cost-bearing.
- verifier: { kind: shell, command: "test -s docs/kb/cross-model-review-design.md && grep -E 'host Codex|host Grok|mode=claude' docs/kb/cross-model-review-design.md", expectExitCode: 0 }
- RED→GREEN: missing matrix bullets fail greps; add section.

```yaml
exit_gate:
  - id: F5-G1
    description: KB documents three-provider modes and Claude model policy.
    verifier: { kind: shell, command: "grep -q 'both-claude\\|mode=claude' docs/kb/cross-model-review-design.md && grep -E 'cli-default|alias' docs/kb/cross-model-review-design.md", expectExitCode: 0 }
  - id: F5-G2
    description: Unit suites for routing, merge, model, provider-field, and claude invocation are green together.
    verifier: { kind: shell, command: "node --test tests/cross-model-claude-invocation.test.js tests/cross-model-host-default.test.js tests/external-both-merge.test.js tests/resolve-review-model.test.js tests/review-provider-field.test.js", expectExitCode: 0 }
```
