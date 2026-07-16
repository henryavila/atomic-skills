# Host default external reviewer + same-family rules

Logical module: **cross-model-bridge**. Product intent (design D6/D7): the
external sealed-envelope reviewer MUST be a **different model family** than the
host session. Same-family headless CLI is **not** CROSS-MODEL REVIEW.

Pure routing helper (unit-tested): `src/cross-model-host-default.js`.

## Host detection order

1. Explicit `ATOMIC_SKILLS_HOST` (`claude` | `codex` | `grok` | `cursor` | `unknown`)
2. Session/env signals:
   - Grok: `GROK_SESSION_ID` or `GROK_WORKSPACE_ROOT` set
   - Codex: `CODEX_THREAD_ID` / `CODEX_CI` / obvious Codex host markers
   - Claude Code: `CLAUDECODE` / `CLAUDE_CODE_ENTRYPOINT` / `.claude` session norms
3. Fallback: **`unknown`** → external default **codex** (legacy)

## Host → external default matrix

| Host session (`hostFamily`) | External default | Also available |
|-----------------------------|------------------|----------------|
| `grok` | `codex` | local only as same-family path (not cross-model) |
| `codex` | `grok` | local |
| `claude` | `codex` (legacy `both` = local→codex) | `grok`; `external-both` (F3/F5) |
| `cursor` | `codex` | `grok` |
| `unknown` | `codex` | `grok` |

Modes consumed by review-code / review-plan (F3 fills UX; F2 locks routing):

| Mode | Meaning |
|------|---------|
| `local` | same-model sealed self-loop on host |
| `codex` | external sealed via Codex only |
| `grok` | external sealed via Grok only |
| `both` | local → **host external default** |
| `both-codex` / `both-grok` | local → forced provider |
| `external-both` | external Codex then Grok (Claude picker; merge later) |

## Same-family is not external

**Problem:** `--mode=grok` while the host *is* Grok (or codex-on-codex) does not
buy cross-family bias reduction. Headless same-family CLI is closer to a
fresh-context **local** agent than to a family-different reviewer.

**Product rule:** Do **not** invent a third same-family “pseudo-external”
pipeline. Same-family headless is **not** labeled CROSS-MODEL REVIEW.

### Interactive (TTY / ask_user_question available)

1. Detect requested external provider family == host family.
2. **Confirm with the user (same-family):** this is equivalent to launching a
   clean local review agent (sealed `local` path), **not** cross-model review.
3. On confirm → run **`local`** sealed path (`provider: local`,
   `sameFamilyRemap: true` on the receipt).
4. On decline → **abort** **or** offer the correct cross-family provider
   (host Grok → Codex; host Codex → Grok; host Claude is never same-family for
   codex/grok external).

### Non-interactive (no TTY, CI, headless skill invoke)

| Situation | Behavior |
|-----------|----------|
| Same-family requested, no confirm possible | **HARD ABORT** with a clear message naming the cross-family alternative and the opt-in flag below. **No** silent remap to local. |
| Operator explicitly accepts local remapping | Flag **`--accept-same-family-as-local`** (or env `ATOMIC_SKILLS_ACCEPT_SAME_FAMILY_AS_LOCAL=1`) → run **`local`** and record `provider: local` + `sameFamilyRemap: true`. **Never** count as cross-model / external provider in CROSS-MODEL REVIEW cadence. |

**No** flag named `--force-same-family` that pretends the run was external.
**No** silent remap without confirm **or** the explicit accept flag.

## Envelope binding

When the route resolves to an external provider `P ∈ {codex, grok}`:

1. Bind `«PROVIDER»` = `P` in `envelope-orchestration.md`
2. Preflight: `{{ASSETS_PATH}}/providers/P/preflight-checks.txt`
3. Invoke: `{{ASSETS_PATH}}/providers/P/invocation-canonical.txt`
4. Persist review receipt with `provider: P` (never claim cross-model when
   `sameFamilyRemap: true`)

When the route resolves to `local` (including same-family remap), use the
local-review sealed path — **not** the external provider leaves.
