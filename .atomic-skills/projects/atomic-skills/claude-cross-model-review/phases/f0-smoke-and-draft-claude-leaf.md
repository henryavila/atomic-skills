---
schemaVersion: "0.1"
slug: claude-cross-model-review-f0-smoke-and-draft-claude-leaf
title: Smoke and draft Claude leaf
goal: Prove Claude Code headless can run a sealed one-shot review-shaped call,
  and draft the provider leaf files from observed flags (briefing channel + tool
  ids locked).
status: active
branch: plan/claude-cross-model-review
started: 2026-07-17T18:41:49.722Z
lastUpdated: 2026-07-17T19:06:05.000Z
nextAction: F0 complete — materialize F1 or continue F1–F5 on this branch
parentPlan: claude-cross-model-review
phaseId: F0
businessIntent:
  value: Em Codex/Grok, poder revisar com Claude (e com o terceiro family) sem
    mudar defaults legados — fecha o gap de cross-model.
  workflow: "F0: smoke headless Claude sealed call, registrar canal/tools/auth,
    draft providers/claude leaf. Downstream: fixtures, routing, merge/model,
    skill UX, KB."
  rules: Third leaf only; host different from reviewer; legacy
    HOST_EXTERNAL_DEFAULT unchanged; no fake live model catalog; safe-mode plus
    dontAsk plus read allowlist; never bypassPermissions for review.
  outOfScope: Anthropic HTTP SDK backend; changing host defaults; Cursor or Gemini
    as external providers; auto-apply of external findings; renaming
    codex-bridge-assets.
  doneWhen: smoke-notes.md com canal/tools/auth/exit-0 E providers/claude
    preflight e invocation com safe-mode e dontAsk.
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
exitGates:
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
      outputSummary: smoke-notes markers present
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
      outputSummary: providers/claude preflight+invocation with safe-mode/dontAsk
      verifiedCommit: b0de8446fd78b12057889196b54692521134fb88
stack:
  - id: 1
    title: Smoke and draft Claude leaf
    type: task
    openedAt: 2026-07-17T18:41:49.722Z
tasks:
  - id: T-001
    title: Prove headless Claude sealed call
    status: done
    lastUpdated: 2026-07-17T19:06:05.000Z
    scopeBoundary:
      - Do not edit production skill bodies, routing modules, or install code.
        Smoke only.
    acceptance:
      - Headless claude --safe-mode -p with Read,Grep,Glob returns exit 0 and
        non-empty stdout; smoke-notes records briefing-channel, tools-allowlist,
        auth-path, exit-0, model-aliases-from-help.
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
    outputs:
      - kind: file
        path: .atomic-skills/projects/atomic-skills/claude-cross-model-review/smoke-notes.md
    summary: Rodar smoke headless e gravar canal/tools/auth em smoke-notes.
    weight: 2
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:06:05.000Z
      passed: true
      exitCode: 0
      outputSummary: smoke-notes dogfood
      verifiedCommit: b0de8446fd78b12057889196b54692521134fb88
  - id: T-002
    title: Draft providers/claude leaf from smoke
    status: done
    lastUpdated: 2026-07-17T19:06:05.000Z
    scopeBoundary:
      - Do not change codex/ or grok/ leaves. Do not wire routing or skill
        bodies yet.
    acceptance:
      - "preflight checks binary presence, `claude --version`, auth failure
        messages, dirty-tree, git-repo (mirror Grok structure).;
        invocation-canonical documents portable timeout, private mktemp dir,
        stdout/stderr paths, DO NOT list forbidding bypassPermissions, and the
        F0-proven briefing channel.; Both files name Provider: claude and path
        under providers/claude/."
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
    outputs:
      - kind: file
        path: skills/shared/codex-bridge-assets/providers/claude/preflight-checks.txt
      - kind: file
        path: skills/shared/codex-bridge-assets/providers/claude/invocation-canonical.txt
    summary: Escrever preflight e invocation-canonical da leaf Claude.
    weight: 3
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:06:05.000Z
      passed: true
      exitCode: 0
      outputSummary: claude leaf files written
      verifiedCommit: b0de8446fd78b12057889196b54692521134fb88
parked: []
emerged: []
summary: Provar headless Claude e rascunhar a folha providers/claude.
---

# Narrative / notes

Initiative for phase **F0 — Smoke and draft Claude leaf**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
