# Design — Claude as external cross-model review provider

**Project:** `atomic-skills`  
**Plan slug:** `claude-cross-model-review`  
**Date:** 2026-07-17  
**Status:** ratified by user (B2); critic `approve_with_nits` (0 blocker/critical); nits applied

## Context

Cross-model review already supports two external sealed-envelope providers: **Codex** and **Grok**. Claude Code is detected as a **host** family, but is **not** an external provider. Consequence:

| Host | Can review with the other two families today? |
|------|-----------------------------------------------|
| Claude | Yes — Codex + Grok (`external-both`) |
| Codex | No — only Grok |
| Grok | No — only Codex |

The product goal is: **from any of the three IDEs (Claude, Codex, Grok), the operator can run sealed external review with the other two model families.**

Evidence that the gap is real (not inferential):

```js
// src/cross-model-host-default.js
/** @typedef {'local' | 'codex' | 'grok'} ProviderId */
const EXTERNAL_PROVIDERS = new Set(['codex', 'grok']);
// HOST_EXTERNAL_DEFAULT.claude = 'codex' — Claude is host only
```

```js
// src/external-both-merge.js
/** @typedef {'codex' | 'grok'} ExternalProvider */
```

```js
// src/review-provider-field.js
export const PROVIDER_ENUM = Object.freeze(['codex', 'grok', 'local']);
```

On-disk provider leaves today: `skills/shared/codex-bridge-assets/providers/{codex,grok}/` only — no `claude/` leaf.  
Claude Code CLI on the author machine: `2.1.212` with `-p`/`--print`, `--safe-mode`, `--tools`, `--no-session-persistence` (verified_by: `claude --version` / `claude --help` 2026-07-17).

Architecture intent already exists: design **D5** of `grok-build-integration` named the module **`cross-model-bridge`** with provider leaves; Grok filled the second leaf. This design fills the third.

## Decisions

### D1 — Claude is a third external sealed-envelope provider leaf

**WHAT:** Add `providers/claude/` under `skills/shared/codex-bridge-assets/` with the same two files every external provider has: `preflight-checks.txt` and `invocation-canonical.txt`. Bind `«PROVIDER»=claude` through the existing two-pass skeleton in `envelope-orchestration.md`.

**WHY:** The envelope (anti-framing, Pass 1 blind / Pass 2 informed, validation, review-file templates) is already provider-agnostic. Only preflight + invocation differ. Duplicating a parallel Claude review path would fork the sealed-envelope contract.

verified_by: `skills/shared/codex-bridge-assets/envelope-orchestration.md` (shared skeleton; provider leaves under `providers/«PROVIDER»/`).

### D2 — Invocation uses Claude Code CLI headless, not Anthropic HTTP SDK

**WHAT:** Invoke the installed `claude` binary in print mode, analogous to `codex exec` and `grok --prompt-file`.

**Provisional shape (flags verified against CLI 2.1.x help; freeze only after F0 smoke — especially briefing input channel):**

```bash
run_with_timeout <TIMEOUT_SECONDS> claude \
  --safe-mode \
  -p \
  ${REVIEW_MODEL_ID:+--model "$REVIEW_MODEL_ID"} \
  --effort high \
  --tools "Read,Grep,Glob" \
  --permission-mode dontAsk \
  --no-session-persistence \
  --disable-slash-commands \
  --output-format text \
  < <BRIEFING_PATH> \
  > <OUTPUT_PATH> 2> <STDERR_PATH>
```

**Permission surface (explicit):** `--permission-mode dontAsk` + allowlisted `--tools` is the sealed non-interactive surface. **Never** use `--dangerously-skip-permissions`, `--permission-mode bypassPermissions`, or always-approve for external review (same product rule as Grok’s DO-NOT on yolo / always-approve).

**Briefing input (provisional):** the shape above assumes stdin redirection into `-p` (Codex uses `- < file`; Grok uses `--prompt-file`). F0 **must** prove which channel works on the installed CLI before freezing `invocation-canonical.txt` (stdin | required `-p` string | any prompt-file flag). Until that smoke, treat the input channel as open (Open question #4).

**WHY:**

- Same operator mental model as other external legs (binary on PATH, version string, auth message, timeout wrapper).
- Read-only tool surface matches Codex read-only sandbox / Grok disallowed write tools.
- Stdout capture matches Grok (no Codex-style `-o`); private `mktemp -d` for paths.

verified_by: `claude --help` 2.1.212 (`--safe-mode`, `-p`, `--tools`, `--permission-mode`, `--no-session-persistence`); docs `https://code.claude.com/docs/en/headless`.

### D3 — Default auth path is `--safe-mode` (OAuth-compatible); `--bare` is opt-in

**WHAT:**

| Mode | When | Auth |
|------|------|------|
| `--safe-mode` (default in invocation-canonical) | Normal operators who used `claude login` | OAuth / normal Claude auth |
| `--bare` | Only when `ATOMIC_SKILLS_CLAUDE_BARE=1` **and** `ANTHROPIC_API_KEY` is set | API key only; bare skips OAuth/keychain |

**WHY:** Official headless docs state `--bare` never reads OAuth/keychain and requires `ANTHROPIC_API_KEY`. Defaulting to bare would break the majority of Claude Code installs that authenticate interactively. `--safe-mode` still strips CLAUDE.md / skills / plugins / hooks / memory — the anti-framing surface required for sealed review — without killing session auth.

verified_by: Claude headless docs § bare mode (auth strictly API key / apiKeyHelper); `claude --help` describes `--safe-mode` as disabling customizations including CLAUDE.md and hooks.

### D4 — Host default matrix stays legacy; Claude only adds options

**WHAT:** Do **not** change `HOST_EXTERNAL_DEFAULT`:

| Host | External default for `both` (unchanged) |
|------|----------------------------------------|
| claude | codex |
| codex | grok |
| grok | codex |
| cursor / unknown | codex |

New modes: `claude`, `both-claude`. Same-family rule: host `claude` + mode `claude`/`both-claude` → confirm→local or HARD ABORT (existing gate), never labeled CROSS-MODEL REVIEW.

**WHY:** Changing defaults rewrites operator habits and any automation that assumes `both` on Claude means local→codex. Adding Claude as opt-in / external-both leg is additive.

verified_by: `HOST_EXTERNAL_DEFAULT` in `src/cross-model-host-default.js`.

### D5 — `external-both` means “all family-different external providers”, fixed order

**WHAT:**

- Keep the flag name **`external-both`** (no rename to `external-others` in v1).
- Legs = `['codex','grok','claude'].filter(p => !isSameFamilyExternal(host, p))`.
- Fixed order always: **codex → grok → claude** (skip filtered).
- Host Claude → legs codex + grok (today’s behavior).
- Host Codex → legs grok + claude.
- Host Grok → legs codex + claude.

Collect-then-merge-then-triage unchanged: no triage/edit between legs; one leg failure does not abort the other; human triage only after merge.

**WHY:** Name already shipped in skill argument-hints and docs. Semantics already meant “the other external(s)” for two providers; generalizing to “all remaining family-different” preserves the product intent without a second flag.

verified_by: `resolveReviewRoute` external-both branch filters same-family for `['codex','grok']` today.

### D6 — Merge generalizes to N providers

**WHAT:** Extend `mergeExternalBothFindings` / CLI so provider identity is `codex | grok | claude` (open set of external ids registered in `EXTERNAL_PROVIDERS`). Merge key, severity, and partial-failure rules stay; provenance arrays list every agreeing provider.

**CLI compat (lock for F3):** keep positional paths in fixed order `codex.json grok.json [claude.json]`. Each arg may be a path, `-` (empty), or `skip`. Omitting the third arg means Claude leg `skipped` (preserves today’s 2-arg callers). No rename of `merge-external-both.js` in v1.

**WHY:** Host Codex/Grok need two external legs including Claude; hard-coding dual codex|grok blocks that without a second merge path.

### D7 — Model resolution and receipt enum include `claude` (no live catalog parity)

**WHAT:**

- `src/resolve-review-model.js`: provider `claude`.
- Flags: `--model-claude=` parallel to `--model-codex=` / `--model-grok=`; generic `--model=` still works for single-provider legs.
- `src/review-provider-field.js`: `PROVIDER_ENUM` includes `claude`.
- Review receipts record `provider: claude` + version from `claude --version`.

**Model discovery honesty (not Codex-parity):**

| Source | Codex | Claude |
|--------|-------|--------|
| Live CLI catalog | `codex debug models --bundled` (JSON) | **None** — no `claude models` / `claude model list` subcommand (CLI treats bare `models` as a prompt) |
| Interactive picker in-session | n/a for headless | `/model` TUI only — not headless |
| Atomic Skills today | `parseCodexModelsCatalog` + `list-review-models.js --provider=codex` | **not implemented** |

**v1 resolution policy for Claude:**

1. Explicit `--model` / `--model-claude` / `model:<id>` → `source: explicit` (id must pass `isSafeReviewModelId`).
2. No flag → **do not invent a model** → `source: cli-default` (omit `--model`; CLI default wins).
3. Interactive Step 0.model picker: offer **stable aliases** documented by Claude (`opus`, `sonnet`, `haiku`, plus any alias the installed `--help` names) + “CLI default” — **not** a live catalog. Label the picker as alias-based so operators do not think it is Codex-class discovery.
4. `--ask-model` headless: bind recommended alias for adversarial review (default recommendation: `opus` if present in the alias list, else `cli-default`). Do **not** pretend a ranked live catalog.

**Forbidden:** shipping a static full id dump as “the catalog of truth”; calling Anthropic Platform `List Models` as the primary path in v1 (API-key-only, wrong product surface for OAuth Claude Code operators). If Claude Code later ships a real list command, add `parseClaudeModelsList` without changing the flag contract.

verified_by: `claude --help` Commands list (no models subcommand); GitHub issue anthropics/claude-code#12612 (feature request for programmatic model list); `scripts/list-review-models.js` usage string `codex|grok` only; local probe `claude models` started a prompt session, not a catalog dump.

### D8 — Skill bodies and UX wire the new modes

**WHAT:** Update `review-code`, `review-plan`, `review-mode-ux.md`, `host-default-external.md`, `envelope-orchestration.md`, `diff-capture.md` argument tables so modes document `claude` / `both-claude` and external-both’s three-way filter. Product cadence label remains **CROSS-MODEL REVIEW**.

### D9 — Phased delivery mirrors Grok leaf adoption

**WHAT:** Implement in dependency order (smoke → leaves → routing → merge/models → skill UX → docs/install smoke), with TDD fixture tests for locked invocation flags (same pattern as `tests/cross-model-grok-invocation.test.js`).

## Chosen approach

**Weighed:**

1. **A — Third provider leaf on cross-model-bridge (CHOSEN)**  
   Extend EXTERNAL_PROVIDERS, add `providers/claude/*`, generalize merge/routing/model helpers, wire skill modes. Reuses sealed two-pass envelope end-to-end.

2. **B — Anthropic Messages API SDK path**  
   Direct HTTP calls without Claude Code tools. Rejected: no shared preflight/auth UX with other providers; loses read-only tool parity; two review stacks to maintain.

3. **C — Document-only “use Claude host for local; external remains Codex/Grok”**  
   Rejected: fails the user requirement that Codex/Grok hosts get a Claude external reviewer.

4. **D — Rename `external-both` → `external-others` and keep dual hard-wire**  
   Rejected for v1: flag churn without product gain; re-evaluate only if operator confusion appears.

**Recommendation that won:** A, with product flags fixed in D2–D5.

## Non-goals

- Changing host external defaults (`claude→codex`, `codex→grok`, `grok→codex`).
- Anthropic HTTP SDK as a parallel review backend.
- Auto-apply of external findings (human triage remains non-negotiable).
- Making same-family Claude-on-Claude headless count as CROSS-MODEL REVIEW.
- Marketplace / plugin packaging of Claude CLI itself.
- Cursor/Gemini as external providers in this plan.
- Renaming the on-disk directory `codex-bridge-assets` (compat alias stays; logical module remains `cross-model-bridge`).

## Blast radius

| Change | Reversibility | Containment |
|--------|---------------|-------------|
| New provider id `claude` in routing/receipts | Medium — receipts and tests start emitting the enum value | Additive enum; old receipts stay valid |
| `external-both` leg set includes Claude when host ∈ {codex,grok} | Medium — cost/latency: host filtered from 1 remaining external today → **2** legs after this plan | Opt-in mode; single-provider modes unchanged; partial-failure keeps good half |
| `external-both` on host `cursor` / `unknown` | Medium — today 2 legs (codex+grok); after plan **3** legs (codex+grok+claude) | Same opt-in + partial-failure containment; document in F4 UX cost line |
| Skill argument-hints / mode tables | Low | Docs + re-install skills |
| Invocation flag lock on Claude CLI | Medium if CLI renames tools or briefing channel | Version note in preflight; F0 freezes channel; re-smoke after major bumps |
| Merge API shape N-provider | Medium if callers pass only two JSON paths | Positional third arg optional (= claude skipped); 2-arg callers unchanged |

No data-model migration, no public npm API freeze, no install journal format break. Not a one-way data door; treat enum + mode semantics as the load-bearing contract and cover with unit tests before skill prose.

## Open questions

1. **Live model catalog for Claude Code CLI** — **resolved for v1 (D7): no.**  
   There is no headless catalog equivalent to Codex. Policy: aliases + `cli-default` + explicit `--model`. Revisit only if Anthropic ships a real list subcommand.

2. **Exact tool id strings under `--tools`** (`Read` vs `read_file`)?  
   Evidence needed: F0 smoke — if allowlist rejects unknown ids, lock the ids that exit 0 with a trivial prompt.

3. **Should `both` on Codex/Grok ever recommend Claude in the interactive picker copy** (still not change the default provider)?  
   Deferred to F4 UX copy; does not block routing.

4. **Briefing input channel for `claude -p`** (stdin redirect vs `-p "$(cat file)"` vs other)?  
   Evidence needed: F0 smoke on 2.1.x; freeze only the channel that returns a non-empty stdout for a sealed briefing file.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Anthropic SDK-only reviewer | Breaks preflight/tool/sandbox parity; second stack |
| Claude external only via subprocess from host Claude (not from Codex/Grok) | Does not close the matrix for Codex/Grok hosts |
| Default to `--bare` | Breaks OAuth-only installs; conflicts with sealed-review operator base |
| Change host defaults to prefer Claude | Breaks legacy `both` expectations without strong evidence of better default |
| New mode name `external-others` in v1 | Flag/docs churn; same semantics achievable under `external-both` |
| Zero tools (`--tools ""`) as the only path | Weaker than Grok/Codex read-only inspection; allowlist Read/Grep/Glob is the aligned default |
| Pretend Codex-parity model discovery via Anthropic HTTP `List Models` | API-key-only; wrong surface for OAuth Claude Code operators; design forbids as primary path (D7) |
| Static full-id model dump in-repo as catalog of truth | Envelhece; conflicts with “no models.yaml” product rule used for Codex/Grok |

## Implementation sketch (for plan decompose — not a task list)

Phases expected downstream (plan owns exact tasks):

1. **F0 — Smoke + draft leaf** — Prove `claude --safe-mode -p` with read-only tools; draft preflight/invocation; fixture test for locked flags.
2. **F1 — Provider leaf + install** — Land `providers/claude/*`; installer already copies `_assets`; fixture tests green.
3. **F2 — Routing** — EXTERNAL_PROVIDERS + modes + same-family + external-both filter; host-default unit tests.
4. **F3 — Merge + model + receipt** — N-provider merge; resolve-review-model claude; PROVIDER_ENUM.
5. **F4 — Skill UX** — review-code/plan bodies, review-mode-ux, argument-hints, envelope docs.
6. **F5 — Docs + live smoke** — KB update; manual smoke matrix host×provider; validate-skills.

## Critic gate

- Tier: same-provider fresh subagent (read-only).
- Verdict: **approve_with_nits** (blocker: 0, critical: 0, major: 0, minor: 2, nit: 2).
- Applied: F-001 briefing channel → Open Q4 + provisional D2; F-002 cursor/unknown 3-leg cost → Blast radius; F-003 dontAsk rationale → D2; F-004 merge CLI third arg → D6. Plus D7 model-discovery honesty from operator Q.

## Self-review against code-quality gates

- G1 read-before-claim: applied — claims about `ProviderId` / EXTERNAL_PROVIDERS / PROVIDER_ENUM / leaf dirs / Claude model catalog absence cite source modules, CLI help Commands list, and probe notes from 2026-07-17.
- G2 soft-language: applied — scanned; no ban-list hedges left in Decisions.
- G6 reference-or-strike: applied — every load-bearing claim carries verified_by or is marked as F0 smoke open question.
