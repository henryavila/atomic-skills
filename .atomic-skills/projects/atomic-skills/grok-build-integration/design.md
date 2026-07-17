# Design — Grok Build native integration + cross-model review

**Project:** `atomic-skills`  
**Plan slug:** `grok-build-integration`  
**Date:** 2026-07-16  
**Status:** approved (user 2026-07-16; critic approve_with_nits 0 blocker/critical; F-001 closed pre-approval)

## Context

Atomic Skills is multi-IDE (Claude, Cursor, Gemini, Codex, OpenCode, Copilot) but has **no Grok Build target**. Grok already free-rides on compat discovery (`.agents/skills/`, `.claude/`) with **wrong tool names** (Claude-shaped render) and **no hooks**. Meanwhile cross-model review is hard-wired to **Codex only**, so a session *on Grok* cannot get a family-different reviewer, and a session on Claude cannot use Grok as the second family.

The user wants **full-stack integration** (install through deep runtime), managed as a multi-phase plan — not a single-session dump. Observations that override generic defaults:

- **L4:** deliver as a **Grok plugin** (skills + hooks owned by the plugin), not only loose files under `.grok/skills/`.
- **L7:** external review must be **host ≠ reviewer**. Host Grok → Codex; host Codex → Grok; host Claude → Codex and/or Grok. Same-family “external” is *not* cross-model value — see Decisions.

Evidence (G1):

- `src/config.js` `IDE_CONFIG` — no `grok` key; Codex → `.agents/skills/...`.
- `src/render.js` — only Gemini gets a non-Claude tool map; Codex/Grok free-ride get `Bash` / `Read tool` / `Agent`.
- `src/runtime-layers/auto-update.js` — only merges `.claude/settings.json`.
- `skills/shared/project-assets/hooks/README.md` — project hooks only Claude + Codex; others no-op.
- `skills/shared/codex-bridge-assets/*` + `envelope-orchestration.md` — sealed two-pass, Codex invocation only.
- `docs/kb/cross-model-review-design.md` — cross-family is the point; Codex is the only external.
- Grok docs (`~/.grok/docs/user-guide/08-skills.md`, `09-plugins.md`, `10-hooks.md`, `14-headless-mode.md`) — native skills, plugins, hooks, `grok -p` headless with sandbox / tool denylist.

## Decisions

### D1 — Ship the full layer stack, phased

Implement all layers agreed in analysis (L1–L7 product paths; L0 free-ride remains incidental, not a product promise). Order is dependency-first (render/install before hooks before plugin; bridge before skill UX). Parallelism only where scopes are disjoint (e.g. docs/KB vs invocation smoke).

| Layer | Product intent |
|-------|----------------|
| L1 | First-class install target `grok` |
| L2 | Renderer tool map for Grok (and fix Codex same bug) |
| L3 | Hooks Soft/Strict + auto-update on Grok surfaces |
| L4 | Plugin owns skills+hooks under `~/.grok/plugins/atomic-skills` (or project `.grok/plugins/`) |
| L5 | Skill conditionals `ide.grok` + optional agents/personas for subagent contracts |
| L6 | Host-agnostic state/aiDeck unchanged; SessionStart digest works on Grok; MCP deferred unless a phase proves need |
| L7 | Multi-provider sealed envelope; host≠reviewer matrix |

**L6 MCP is a non-goal for v1** unless an exit gate of a late phase fails without it. State remains files + scripts.

### D2 — Install + render foundation (L1+L2)

- **`IDE_CONFIG.grok` (authoritative v1 shape)** — plugin delivery, not `.grok/skills` file-set:

```js
'grok': {
  name: 'Grok Build',
  dir: '.grok/plugins/atomic-skills/skills',  // under plugin root; user-scope → ~/.grok/plugins/...
  format: 'markdown',
  filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),
  // no SKILL_NAMESPACE segment: plugin package IS the namespace
  supportsUserScope: true,
  delivery: 'plugin', // installer special-case: also write plugin.json + hoist assets
}
```

- **Assets path (single contract):** sibling of `skills/` inside the plugin package —  
  `{{ASSETS_PATH}}` = `{scopePrefix}.grok/plugins/atomic-skills/_assets`  
  (never under a recursively scanned skill dir). `getAssetsDir('grok')` implements this; do not use the generic “parent of ide.dir + atomic-skills/_assets” formula if it would place assets outside the plugin.
- **Detection:** `IDE_DETECT_DIRS.grok = '.grok'` (and user-scope presence of `~/.grok` may preselect in interactive install).
- Renderer: explicit `ide.grok` + `ide.codex` tool profiles. **Provisional** Grok skill-body map (lock via F0 render snapshot + F2 headless smoke; mark unverified ids until locked):

| Var | Provisional Grok value | Lock when |
|-----|------------------------|-----------|
| BASH | `run_terminal_command` | F0 snapshot; F2 may adjust if headless id differs |
| READ | `read_file` | F0 |
| WRITE | `write` | F0 |
| REPLACE | `search_replace` | F0 |
| GREP | `grep` | F0 |
| GLOB | `list_dir` | F0 |
| INVESTIGATOR | `spawn_subagent` (explore) | F0 |
| ASK | `ask_user_question` | F0 |

- `{{#if ide.grok}}` for genuine quirks only.
- KB: `docs/kb/grok-build-compatibility.md`.
- Install/uninstall parity + round-trip covers the **plugin tree** (not a parallel `.grok/skills` tree).

### D3 — Hooks (L3)

- Project hooks scripts stay under `.atomic-skills/status/hooks/` (host-agnostic).
- **Registration precedence for Grok:**
  1. **Plugin** `hooks/hooks.json` inside the atomic-skills plugin — primary for project Soft/Strict (SessionStart / PreToolUse / Stop).
  2. **User auto-update only** may also stage a small file under `~/.grok/hooks/` (version-check SessionStart) so update checks run even when no project plugin trust is granted — must not duplicate project Soft/Strict.
  3. Do **not** rely on Claude `settings.json` compat as the Grok primary path.
- Matchers use **real Grok tool names** (`search_replace|write`). Scripts accept dual host vocabularies or normalize at wrapper.
- Auto-update provider plans effects per installed IDE (Claude settings + Grok hooks), not Claude-only.
- Soft = SessionStart + PreToolUse; Strict += Stop.

### D4 — Plugin owns skills+hooks (L4) — single root from F0

**Invariant:** For IDE `grok`, the **only** durable skill/asset root is the plugin package:

| Scope | Plugin root |
|-------|-------------|
| user | `~/.grok/plugins/atomic-skills/` |
| project | `<repo>/.grok/plugins/atomic-skills/` |

Contents from the first grok install that writes skills (F0+):

- `plugin.json` — name `atomic-skills`, version from package.json, skills/hooks paths
- `skills/<name>/SKILL.md` — rendered core (+ modules)
- `_assets/` — lazy detail + templates (`{{ASSETS_PATH}}`)
- `hooks/hooks.json` — **F0 may ship empty `{}` or SessionStart stub**; F1 fills Soft/Strict

**Forbidden:** installing a second full tree under `.grok/skills/atomic-skills/` or leaving interim+plugin coexistence after any successful install step. Test: after install/update, assert zero skill files under `.grok/skills/atomic-skills/` owned by this package.

**F0 vs F4 split (no dual-track):**

| Phase | Plugin tree |
|-------|-------------|
| F0 | Create plugin package + skills + assets + minimal `plugin.json`; hooks file stub OK |
| F1 | Fill hooks Soft/Strict + auto-update registration |
| F4 | Harden (agents optional, trust docs, inspect smoke, any journal edge cases) — **not** a path migration from `.grok/skills` |

Journal effects reverse the whole plugin package; round-trip green. Marketplace out of v1.

### D5 — Cross-model bridge module (L7)

- Module name: **`cross-model-bridge`** (replaces / generalizes `codex-bridge`).
- Compat: existing installs and docs that say `codex-bridge` keep working via alias or thin re-export until a migrate note.
- Shared envelope assets (anti-framing, pass1/2 templates, validation, review-file template) stay **provider-agnostic**.
- Provider leaves:
  - `providers/codex/` — preflight + invocation (current canonical `codex exec` shape)
  - `providers/grok/` — preflight + invocation (`grok -p` / `--prompt-file`, read-only sandbox, disallow write tools, ephemeral session, portable timeout, capture markdown to file)
- Invocation contracts are **smoke-proven** before skill bodies hardcode flags (Grok CLI version observed: `grok 0.2.x`).

### D6 — Host ≠ reviewer matrix

| Host session | External default | Also available |
|--------------|------------------|----------------|
| Grok | Codex | (local only as same-family path) |
| Codex | Grok | local |
| Claude Code | Codex (legacy `both` = local→codex) | Grok; Codex+Grok via explicit mode |
| Cursor / unknown | Codex | Grok |

Modes (review-code / review-plan):

| Mode | Meaning |
|------|---------|
| `local` | same-model sealed self-loop on host |
| `codex` | external sealed via Codex only |
| `grok` | external sealed via Grok only |
| `both` | local → **host external default** (Claude: codex; Grok host: codex; Codex host: grok) |
| `both-codex` / `both-grok` | local → forced provider |
| `external-both` | external Codex **then** Grok on same cleaned artifact (Claude picker); merge findings for triage |

Detection order for host: explicit `ATOMIC_SKILLS_HOST` → env/session signals (`GROK_SESSION_ID` / `GROK_WORKSPACE_ROOT`, Claude/Codex markers) → unknown→codex external default.

### D7 — Same-family is not external: confirm → local agent

**Problem:** Requesting `--mode=grok` while the host *is* Grok (or codex-on-codex) does **not** buy cross-family bias reduction. Headless `grok -p` from Grok is closer to a **fresh-context local agent** than to Codex.

**Decision:** Do **not** invent a third same-family “pseudo-external” pipeline. Same-family headless CLI is **not** labeled CROSS-MODEL REVIEW.

**Interactive (TTY / ask_user_question available):**

1. Detect requested external provider family == host family.
2. **Confirm with the user**: this is same-family and is equivalent to launching a clean local review agent (sealed `local` path), not cross-model review.
3. On confirm → run **`local`** sealed path.
4. On decline → abort **or** offer the correct cross-family provider (host Grok → Codex; host Codex → Grok; host Claude never same-family for codex/grok external).

**Non-interactive (no TTY, CI, headless skill invoke):**

| Situation | Behavior |
|-----------|----------|
| Same-family requested, no confirm possible | **HARD ABORT** with a clear message naming the cross-family alternative and the opt-in flag below. **No** silent remap to local. |
| Operator explicitly accepts local remapping | Flag **`--accept-same-family-as-local`** (or env `ATOMIC_SKILLS_ACCEPT_SAME_FAMILY_AS_LOCAL=1`) → run **`local`** and record `provider: local` + `sameFamilyRemap: true` on the review receipt. **Never** count as cross-model / external provider in CROSS-MODEL REVIEW cadence. |

**No** flag named `--force-same-family` that pretends the run was external. **No** silent remap without confirm **or** the explicit accept flag.

Rationale: same-family headless vs local agent are not byte-equivalent (sandbox, wiring, UX) but are the **same product class** (second pass, same model family). Honest routing is confirm→local (interactive) or abort / explicit accept-as-local (non-interactive). True external stays family-different CLI.

### D8 — Product surfaces rename and schema

- User-facing **CODEX REVIEW** line → **CROSS-MODEL REVIEW** (rename now). Detail always shows `provider: codex|grok|local`.
- `last-review.json` / review file frontmatter gain `provider` (+ provider version string).
- `review-due`, plan creation review gates, verify C-7: “cross-model” means any external provider ≠ host, not Codex-only.
- INDEX rows include provider.

### D9 — L5 scope (bounded)

- Wire `ide.grok` conditionals where subagent/tool behavior diverges (`implement`, `parallel-dispatch`, `project` router already uses tool vars).
- Optional: install thin Grok agent defs under the plugin `agents/` only if a phase task needs a named type beyond built-in `explore`/`plan`. **Default: no agent flood** — skill prose + `spawn_subagent` is enough for v1.

### D10 — Non-goals (v1)

- Publishing to xAI official marketplace catalog.
- MCP server for project state (revisit if token cost of YAML parse becomes a measured problem).
- Mode-2 *execution* lane via Grok (execution offload is separate from review; do not conflate).
- Replacing aiDeck or `.atomic-skills/` state model.
- Auto-merging external findings into code without human triage.

## Chosen approach

**Weighed:**

1. **Compat-only (L0)** — zero code; Grok reads Codex/Claude installs. Rejected as product: wrong tools, no hooks, no plugin, review stuck on Codex-from-Claude mental model.
2. **File-set only under `.grok/skills/`** — simple multi-IDE parity. Rejected as sole delivery: user wants **native Grok Build** (plugin + hooks lifecycle).
3. **Plugin-only without multi-IDE install journal** — Grok-first but breaks Atomic Skills install/uninstall parity and multi-host one-shot install. Rejected.
4. **Chosen: Phased full stack** — journal-backed install that **materializes a Grok plugin** (L4 owns skills+hooks), shared render profiles (L2), hooks Soft/Strict (L3), **`cross-model-bridge`** with Codex+Grok providers and host≠reviewer defaults (L7), product rename CROSS-MODEL REVIEW, same-family → confirm→local. L5 thin. L6 state unchanged; MCP out.

**Sequencing (phase tree for the plan):**

| Phase | Focus | Exit idea |
|-------|--------|-----------|
| **F0** | L1+L2: `IDE_CONFIG.grok` plugin shape, render profiles grok+codex, materialize plugin skills+assets+plugin.json (hooks stub), tests + KB draft | Install `--ides grok` writes only plugin root; tool names correct; uninstall clean |
| **F1** | L3: fill plugin hooks Soft/Strict + auto-update; dual-vocab matchers | SessionStart registered; round-trip still clean |
| **F2** | L7 bridge: `cross-model-bridge`, providers, smoke, host matrix, same-family confirm→local | Envelope fixture both providers |
| **F3** | L7 UX: review modes, CROSS-MODEL REVIEW, last-review, review-due | No Codex-only product hardcode |
| **F4** | L4 harden: inspect/plugin list smoke, optional agents, trust docs | Plugin is the complete Grok surface |
| **F5** | L5 + catalog + external-both + keywords + final verify | Docs coherent; external-both on Claude |

**No path migration phase** — plugin root is authoritative from F0 (critic F-001 closed).

## Blast radius

One-way or sticky choices:

| Decision | Risk | Containment |
|----------|------|-------------|
| Plugin as sole Grok skill root | Users with manual `.grok/skills` copies may duplicate names | Document uninstall; dedupe by name (Grok priority rules); no silent dual install |
| Rename CODEX REVIEW | Scripts/docs grepping the string break | Grep migration in-repo; review INDEX accepts old rows as read-compat one release if needed |
| `cross-model-bridge` rename | Module catalog / install manifests | Alias `codex-bridge` → same assets; changelog |
| Host detection wrong | Wrong external default | Override flags always win; explicit `ATOMIC_SKILLS_HOST` |
| Grok CLI flag churn | Invocation breaks | Smoke test in CI or gated script; pin documented flags per grok version range |

## Non-goals

See D10. Also: no redesign of sealed-envelope science (two-pass, factual briefing stay).

## Open questions

| Q | Resolution path |
|---|-----------------|
| Exact Grok headless flag set + headless tool ids | F2 smoke; lock `providers/grok/invocation-canonical.txt`; skill-body map locked in F0 snapshot tests and updated if smoke disagrees |
| Whether project-scope plugin requires `/hooks-trust` every clone | Document; Soft hooks fail-open if untrusted |
| external-both merge algorithm (agreement key) | **Resolved:** fixed order Codex then Grok; merge key = `file:line` + normalized claim text; severity conflict → keep higher severity, list both providers in provenance; if one provider fails preflight/invoke → surface partial results + error, do not drop the other provider’s findings; human triage required |
| Cursor/unknown: offer Grok external before preflight? | Always offer in picker; fail at invoke preflight if binary missing (same as Codex) |
| Same-family without TTY | **Resolved (D7):** HARD ABORT unless `--accept-same-family-as-local` / env; never silent local remap |
| cross-model-bridge filesystem root vs logical module | **Resolved:** logical module name + catalog; assets may live under `skills/shared/codex-bridge-assets/` (or renamed later) with `providers/{codex,grok}/`; no requirement to move all paths in F2 |

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| L0 free-ride as “done” | Wrong tools; no product claim |
| Dual install L1 skills + full plugin copy | Drift between trees |
| Same-family headless as “external” | Product lie; no cross-family gain |
| Hard abort only on same-family (no local path) | User preferred confirm→local when interactive; non-interactive uses abort + opt-in accept-as-local |
| Silent same-family remap in CI | Hides operator intent; forbids without flag |
| `both` on Claude = first available external | Unpredictable; keep local→codex legacy |
| Keep label CODEX REVIEW forever | Host Grok defaulting to Codex makes the label false |
| Two modules codex-bridge + grok-bridge without shared envelope | Duplicates orchestration; user chose cross-model-bridge |

## Self-review against code-quality gates

- G1 read-before-claim: applied — claims cite `src/config.js`, `src/render.js`, `src/runtime-layers/auto-update.js`, project hooks README, codex-bridge assets, Grok user-guide paths, live `grok --version` / `codex --version`.
- G2 soft-language: applied — phase exits and decisions use concrete must/must-not language; scanned for “probably/might just” hedges in Decisions.
- G6 reference-or-strike: applied — matrix and modes are design decisions (to be verified by F2/F3 tests); open questions marked for smoke evidence rather than asserted as shipping fact.

## Implementation notes for PLAN (not tasks yet)

- **Package version:** do not autonomously bump major; follow user versioning preference (minor unless schema break requires more).
- **TDD:** renderer/provider pure functions and install journal effects get tests first; skill body changes validated via validate-skills + fixture renders.
- **Session discipline:** one phase active at a time; materialize F0 first; later phases descriptor-only until promoted.
- **Communication:** skill bodies remain EN-only; PT via renderer language directive.
