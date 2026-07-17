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
| `both-grok`, `both-claude` | local → forced Grok |
| `external-both` | external Codex **then** Grok on the same cleaned artifact; merge via `src/external-both-merge.js` (key `file:line`+claim; higher severity wins; partial failure keeps good half) for human triage |

Aliases: `--mode=internal` → `local` (review-plan compat).

## Argument flags (in addition to skill-specific flags)

| Flag | Effect |
|------|--------|
| `--mode=<mode>` | Skip Step 0 picker; force mode from the table above |
| `--accept-same-family-as-local` | Non-interactive: same-family external remaps to sealed `local` (records `provider: local`, `sameFamilyRemap: true`; **never** counts as CROSS-MODEL REVIEW). Env: `ATOMIC_SKILLS_ACCEPT_SAME_FAMILY_AS_LOCAL=1` |
| `--model=<id>` | Force external reviewer model id for the active provider. Skips the model picker. Also accepts `--model <id>` and `model:<id>`. Pass `cli-default` to force an empty `--model` flag (provider CLI default). |
| `--model-codex=<id>` | Per-provider override when the external leg is Codex (or for the Codex leg of `external-both`). Wins over generic `--model` for that leg. |
| `--model-grok=<id>` | Per-provider override when the external leg is Grok (or for the Grok leg of `external-both`). Wins over generic `--model` for that leg. |
| `--ask-model` | Prefer the **recommended** model from the live provider catalog. Interactive: still show the picker with recommended first. Non-interactive: bind recommended automatically (writes `--model <recommended>`). |

Pure helper (unit-tested): `src/resolve-review-model.js`
(`parseModelArgs`, `resolveReviewModel`, `rankModelsForReview`).
CLI: `scripts/list-review-models.js --provider=codex|grok [--resolve …]`.

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
6. **Both then Grok** (`both-grok`, `both-claude`) — Force Grok as the external leg.
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

## Step 0.model — external model selection (after route, before envelope)

Run **once per external provider leg** that will actually invoke (skip when
`provider == local` / same-family remap / family-filtered `external-both` legs).

### 1. Discover catalog + recommended

```bash
PKG="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
node "$PKG/scripts/list-review-models.js" --provider=«PROVIDER» --json
```

- Codex catalog source: `codex debug models --bundled` (priority-ranked; lower
  `priority` = stronger/newer in the CLI list).
- Grok catalog source: `grok models` (CLI default first).
- Fail-open: empty catalog still allows `--model` / `cli-default`; do **not**
  abort the review solely because discovery failed — surface `catalogError` and
  continue with the picker options that remain (at least **CLI default**).

`recommended` = top of `rankModelsForReview` (Codex: lowest list-visible
priority; Grok: CLI-marked default). That is the skill's "best available for
adversarial review" suggestion — **not** a hard pin in non-interactive runs
unless `--ask-model` is set.

### 2. Resolve

Parse model flags from `{{ARG_VAR}}` via `parseModelArgs` (or the CLI
`--resolve` path). Then `resolveReviewModel`:

| Input | Result |
|-------|--------|
| `--model=<id>` / `--model-codex` / `--model-grok` | `action: run`, `source: explicit`, `modelFlag: --model <id>` (or empty when `cli-default`) |
| Interactive, no explicit model | `action: pick` — use {{ASK_USER_QUESTION_TOOL}} with `options` (recommended first, then other catalog models, then **CLI default (no --model flag)**) |
| `--ask-model` + non-interactive | `action: run`, `source: recommended`, bind recommended when known |
| Non-interactive, no flags | `action: run`, `source: cli-default`, **empty** `modelFlag` (backward compatible — provider CLI / `config.toml` default) |
| User picks `recommended` / a slug / `cli-default` | re-enter with `userChoice` → `action: run` |

When `unknownToCatalog: true` (explicit id not in the discovered list): warn
once ("model not in catalog — CLI may still accept it") and proceed.

### 3. Bind for invocation

Record for the envelope:

- `REVIEW_MODEL_ID` ← `modelId` (null when CLI default). Must pass
  `isSafeReviewModelId` (slug-shaped only); if `invalidModelId` is true, **abort**
  the external leg with a clear error — never pass an unsafe id to the shell.
- `REVIEW_MODEL_FLAG` ← `modelFlag` (e.g. `--model gpt-5.6-sol` or empty;
  empty when unsafe — fail closed)
- `REVIEW_MODEL_SOURCE` ← `explicit | user-pick | recommended | cli-default`

Prefer binding `REVIEW_MODEL_ID` and expanding
`${REVIEW_MODEL_ID:+--model "$REVIEW_MODEL_ID"}` in
`providers/«PROVIDER»/invocation-canonical.txt` for **both** Pass 1 and Pass 2
(quoted argv; never unquoted interpolation of an unvalidated id). Legacy
`<MODEL_FLAG>` is the same expansion when non-empty. Persist the chosen model
id in the review receipt frontmatter (`reviewer:` / model field) when known.

**external-both:** resolve **per leg** (Codex then Grok). Use
`--model-codex` / `--model-grok` when the two providers need different ids;
generic `--model` alone applies only as a fallback for a leg without a
per-provider override.

## Flow routing after resolve

- `provider == local` (or mode `local`, or same-family remap) → local sealed path only.
- External single provider (`codex` / `grok` modes, or the external leg of `both*`) → bind `«PROVIDER»` and run `envelope-orchestration.md`.
- `both` / `both-codex` / `both-grok`, `both-claude` with `includesLocal` → local phase first, then external on the **same** cleaned artifact / byte-identical `CAPTURED_DIFF` (no intent leakage into the external briefing).
- `external-both` with `externalProviders: […]` → **collect** envelope once per remaining provider in order (Codex then Grok when both remain; no triage between legs; one leg's failure does not abort the other). **Merge** with `mergeExternalBothFindings` / `scripts/merge-external-both.js`: identity = `file:line` + normalized claim; severity conflict keeps higher severity with dual provenance; per-provider status `succeeded|failed|skipped` (absent = skipped); partial failure keeps the successful half and surfaces the error. **Triage** the merged list only — never auto-apply.

## Non-interactive abort (no TTY, no `--mode=`)

Skills keep their existing hard abort (e.g. review-plan: pass `--mode=` explicitly). When `--mode=` **is** supplied but same-family, apply the same-family gate above (HARD ABORT unless accept flag).

## Product label

User-facing cadence string is **CROSS-MODEL REVIEW** (not "CODEX REVIEW"). Only a family-different external provider run qualifies.
