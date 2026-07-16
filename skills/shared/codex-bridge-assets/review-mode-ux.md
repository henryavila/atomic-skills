# Review mode UX (shared by review-code + review-plan)

Canonical product rules for mode selection and host≠reviewer routing.
Pure helper (unit-tested): `src/cross-model-host-default.js`
(`resolveReviewRoute`, `defaultExternalProvider`, `detectHostFamily`).
Host matrix + same-family policy: `{{ASSETS_PATH}}/host-default-external.md`.

## Modes

| Mode | Meaning |
|------|---------|
| `local` | same-model sealed self-loop on the host |
| `codex` | external sealed envelope via Codex only |
| `grok` | external sealed envelope via Grok only |
| `both` | local → **host external default** (Claude/Cursor/unknown→codex; Grok host→codex; Codex host→grok) |
| `both-codex` | local → forced Codex |
| `both-grok` | local → forced Grok |
| `external-both` | external Codex **then** Grok on the same cleaned artifact; merge via `src/external-both-merge.js` (key `file:line`+claim; higher severity wins; partial failure keeps good half) for human triage |

Aliases: `--mode=internal` → `local` (review-plan compat).

## Argument flags (in addition to skill-specific flags)

| Flag | Effect |
|------|--------|
| `--mode=<mode>` | Skip Step 0 picker; force mode from the table above |
| `--accept-same-family-as-local` | Non-interactive: same-family external remaps to sealed `local` (records `provider: local`, `sameFamilyRemap: true`; **never** counts as CROSS-MODEL REVIEW). Env: `ATOMIC_SKILLS_ACCEPT_SAME_FAMILY_AS_LOCAL=1` |

## Host detection (before picker / routing)

1. Explicit `ATOMIC_SKILLS_HOST` if set
2. Session signals: `GROK_SESSION_ID` / `GROK_WORKSPACE_ROOT` → grok; Codex markers → codex; Claude markers → claude; Cursor markers → cursor
3. Else `unknown` → external default **codex**

Call `detectHostFamily` / `defaultExternalProvider` (or mirror the matrix) so the picker labels and `both` resolution stay consistent.

## Step 0 — host-aware mode picker

Skip when `--mode=` was supplied. Otherwise use {{ASK_USER_QUESTION_TOOL}}.

**Question (code):** "How should this code change be reviewed?"  
(When `DESTRUCTIVE` is true for review-code, prepend the destructive-diff caution from the skill body — cross-model strongly advised.)

**Question (plan):** "How should this plan be reviewed?"

**Options (always offer; label the host default):**

1. **Both (local then host external default)** — Recommended for significant work. Local first; then the host's family-different external (`codex` or `grok` per matrix). ~$1–2 external cost.
2. **Local only** — Cheap same-model sealed pass.
3. **Codex only** — External Codex sealed envelope (cross-model only when host ≠ codex).
4. **Grok only** — External Grok sealed envelope (cross-model only when host ≠ grok).
5. **Both then Codex** (`both-codex`) — Force Codex as the external leg regardless of host default.
6. **Both then Grok** (`both-grok`) — Force Grok as the external leg.
7. **External both (Codex then Grok)** (`external-both`) — Two external envelopes, no local leg. Prefer on Claude hosts when both CLIs are available. Same-family legs are filtered (Grok host runs Codex only; Codex host runs Grok only).

Default: **Both** (host external default). Set `mode` from the answer.

## Same-family gate (after mode is known)

Run `resolveReviewRoute({ hostFamily, mode, interactive, acceptSameFamilyAsLocal, sameFamilyDecision? })`:

| Result `action` | Operator behavior |
|-----------------|-------------------|
| `run` | Proceed with `provider` / `externalProvider` / `includesLocal` / `externalProviders` from the result |
| `confirm-same-family` | Interactive only: confirm that this is equivalent to a clean **local** agent, not CROSS-MODEL REVIEW. Confirm → re-enter with `sameFamilyDecision: 'confirm'` (runs local). Decline → abort. Offer cross-family → `sameFamilyDecision: 'offer-cross-family'`. |
| `abort` | STOP. Print `message` (names cross-family alternative + `--accept-same-family-as-local`). **No silent local remap** in non-interactive without the flag. |

**Receipt rule:** same-family remap records `provider: local` + `sameFamilyRemap: true`. Never write `provider: codex` or `provider: grok` for a remapped same-family run. Such a run does **not** advance CROSS-MODEL REVIEW cadence.

## Flow routing after resolve

- `provider == local` (or mode `local`, or same-family remap) → local sealed path only.
- External single provider (`codex` / `grok` modes, or the external leg of `both*`) → bind `«PROVIDER»` and run `envelope-orchestration.md`.
- `both` / `both-codex` / `both-grok` with `includesLocal` → local phase first, then external on the **same** cleaned artifact / byte-identical `CAPTURED_DIFF` (no intent leakage into the external briefing).
- `external-both` with `externalProviders: […]` → run envelope once per remaining provider in order (Codex then Grok when both remain). Merge with `mergeExternalBothFindings` (`src/external-both-merge.js`): identity = `file:line` + normalized claim; severity conflict keeps higher severity with dual provenance; partial provider failure keeps the successful half and surfaces the error. Human triage only — never auto-apply.

## Non-interactive abort (no TTY, no `--mode=`)

Skills keep their existing hard abort (e.g. review-plan: pass `--mode=` explicitly). When `--mode=` **is** supplied but same-family, apply the same-family gate above (HARD ABORT unless accept flag).

## Product label

User-facing cadence string is **CROSS-MODEL REVIEW** (not "CODEX REVIEW"). Only a family-different external provider run qualifies.
