# Adversarial review — brainstorm-hardening F1

- **mode:** local
- **scope:** product files only
  - `scripts/lint-design.js`
  - `tests/lint-design.test.js`
  - `docs/skills/brainstorm.md`
  - `meta/catalog.yaml` (brainstorm entry)
  - `.atomic-skills/reviews/brainstorm-hardening-F1-captured.diff`
- **stance:** ignore author framing / eval pass; judge substance only
- **adjacent read (not edited):** `skills/core/brainstorm.md`, `skills/shared/debate-assets/critic.md`, on-disk `design.md` corpus, Stage 4 call sites
- **suite:** `node --test tests/lint-design.test.js` → 26 pass / 0 fail (re-run)

---

## Findings

| # | Severity | File:line | Claim (as written) | Impact | Recommendation |
|---|----------|-----------|--------------------|--------|----------------|
| F1 | **HIGH** | `scripts/lint-design.js:35–39` | Distinct required sections Context / Interview / Decisions matched by independent `\b…\b` / separator regexes on `normTitle` | **One heading can satisfy multiple keys.** Live: `## Decision Context` matches both `/\bcontext\b/` and `/\bdecisions?\b/` → `lintDesignMd` returns `[]` with **no** separate `## Decisions` or `## Context`. Same for `## Interview Context` (Interview + Context) and `## Out of Context Analysis` (Context only). The expanded always-required set does not require *distinct* section objects — only that each regex hits some heading with non-placeholder body. Gate theater: one blended heading + filler siblings. | Require exclusive / primary title match (e.g. normalized title equals or starts with the key label), or score the best unique section per key and reject dual-credit. Add RED tests: `## Decision Context` alone must not clear both Context and Decisions. |
| F2 | **HIGH** | `scripts/lint-design.js:34–40` + Stage 4 callers (`project-create-plan.md:59`, `:352`) | Expanding always-required to Context, Non-goals, Interview with no grandfathering | **Hot-path hard-break on pre-F1 designs.** Re-lint of corpus: `projects/atomic-skills/integrity-remediation/design.md` fails (`missing "Interview"`); 21/22 under `.atomic-skills/projects/**/design.md` fail (almost all missing Interview; some also Context/Non-goals). Stage 4 / “accept existing design.md” still runs the same CLI — previously lint-clean artifacts now HARD-BLOCK decompose. F1 intentionally avoided mass re-lint, but **did not** document operational migration, adopt exemption for legacy shapes, or a versioned lint profile. | Document breaking change + migrate path (retrofit template, or lint schema version, or “legacy design” flag). At minimum call out in docs/catalog that re-lint of pre-F1 designs fails until Interview/Context/Non-goals exist. |
| F3 | **HIGH** | `docs/skills/brainstorm.md:7,11` + `meta/catalog.yaml:735–749` vs `skills/core/brainstorm.md:79–85` | Docs/catalog: lint **always requires** Context, Non-goals, Interview, Decisions, Chosen approach | **Agent-facing skill body still contradicts the new machine contract.** `skills/core/brainstorm.md:79` still says “mandatory and enforced by lint-design **(and expanding toward Interview / Context / Non-goals as required)**”; only Decisions / Chosen approach / Blast radius are marked **(lint-required)**; Interview / Context / Non-goals sit under “**Plus, for a usable design**” (optional tier). Agents load the skill body first; docs/catalog lag behind or are ignored. F1 fixed F0’s “lint claim is false” only on docs surface — the primary skill still understates enforcement. | Update `skills/core/brainstorm.md` “The design doc” list: mark Context, Non-goals, Interview as **(lint-required)**; delete “expanding toward” and the usable-vs-required split for those three. Same pass for `skills/shared/debate-assets/critic.md:29` (still lists only Decisions / Chosen approach / Blast radius as required sections). |
| F4 | **MEDIUM** | `tests/lint-design.test.js:49–53`, `:79–87` | RED coverage for missing sections; “five always-required violations” | **Assertions weakened + mislabeled.** Missing Decisions used to `assert.equal(v.length, 1)`; now `assert.ok(v.some(/Decisions/))` — green if Decisions is missing **and** other sections were accidentally stripped, or if extra noise violations appear. Test name/comment say “**five** always-required violations” while asserting `v.length === 4` (Context present). Contract is mostly locked, but the suite no longer pins “exactly one violation for a single missing section” and advertises the wrong count. | Restore `v.length === 1` (or `=== expected`) on single-section RED tests; rename to “four missing always-required violations” or include a fifth missing key in the fixture. |
| F5 | **MEDIUM** | `scripts/lint-design.js:44` + `hasRealContent` (`:96–106`) | “real content, not empty/TODO”; angle placeholders `^<[^>]*>$` | **Placeholder class over-matches full-line angle-bracket bodies.** Live: Context body `<!-- note -->` alone → `present but empty` (HTML comment matches `^<[^>]*>$`). Same class rejects legitimate single-tag lines (`<details>…` on one line). Combined with new always-required Context/Interview/Non-goals, more headings hit this false empty. Conversely **under-matches theater**: bodies `x` / `ok` / `yes` / `none` pass all five always-required keys (`lintDesignMd` → `[]`). Lint still cannot distinguish spine from filler. | Narrow angle placeholder to known templates (`REPLACE_*`, `<fill…>`, `<…placeholder…>`); do not treat HTML comments as empty. Document that content quality is critic/F2-detector territory — do not market “real content” as process-complete Interview. |
| F6 | **MEDIUM** | `docs/skills/brainstorm.md:7` / `meta/catalog.yaml:738–739` | “PLAN refuses to start without that **approved**, lint-clean design” after listing Interview + research + debate + critic | **Approval ≠ lint.** PLAN precondition (unchanged in F1) still only runs `lint-design.js`. Critic verdict, design-gates receipt, research-digest, and Interview *process* are not checked at Stage 4. F1 docs/catalog **re-state** the full process then claim PLAN refuses without “approved” design — same docs/enforcement drift as F0 F12, now re-published with the expanded section list as if the full ladder were the gate. | Say “PLAN refuses without a **section-lint-clean** design.md (Context/Non-goals/Interview/Decisions/Chosen approach; Blast radius if migration). Critic/process gates are brainstorm/agent-enforced until detectors land.” |
| F7 | **LOW** | `scripts/lint-design.js:36` | Non-goals: `/non[-\s]+goals?/` after underscore→space normalize | **Asymmetric heading acceptance.** `## Non_goals` and `## Non-goals` pass; `## NonGoals` (camel) and `## Non—goals` (em dash) fail. Chosen-approach path documents underscore handling; separator class still only ASCII hyphen/space. Agents copying typographic dashes from docs can fail Non-goals while Context/Interview (word-boundary) still pass. | Normalize en/em dashes to hyphen before match; optionally accept camel `nongoals` if desired. Add a RED/GREEN edge test for `Non—goals` / `NonGoals`. |
| F8 | **LOW** | `tests/lint-design.test.js:32–37` | `withoutSection` helper strips `## Label\n\n…` until next `##` | **Test-only stripper is H2 + blank-line only**, while production matches any heading level and bodies without a blank line. Helper is correct for current `GOOD` fixture; a future H3 GOOD or tight heading style would make RED tests no-ops (replace fails, original section remains, assertion fails loudly) or worse if assertions stay loose (F4). | Prefer fixture builders that omit sections explicitly, or call `parseSections` + rebuild; keep `withoutSection` as a narrow helper with a comment. |
| F9 | **INFO** | `scripts/lint-design.js:34–40` + tests | Context / Non-goals / Interview always-required; Blast radius migration-only | **Core F1 goal is implemented and suite-green.** `REQUIRED` order and flags match docs/catalog; empty/TODO/REPLACE/`TBD` bodies fail for the new keys; fence-quoted `## Decisions` still does not count; migration flag behavior retained. Live strip of each always-required section produces the expected `missing required section "…"` strings. | Keep; do not regress Decisions/Chosen approach always-required or Blast radius `migrationOnly: true`. |
| F10 | **INFO** | Diff scope | F1 product set | **No design-gates / find-missing-design-process / Stage 8 / lint-source changes in captured diff.** Scope discipline holds relative to F2. Historical `design.md` not mass-edited (consistent with F2 break in F2). | Detectors and skill-body alignment remain follow-ups (F3, F6). |
| F11 | **INFO** | Security | CLI `readFileSync(files[0])` | No new command construction from design body; pure string scan. Untrusted markdown cannot inject shell via this script. Path is operator-supplied argv (pre-existing). | — |

---

## Checklist results (explicit)

| Checklist item | Result |
|----------------|--------|
| 1. Required-section contract matches docs/catalog | **PASS for code+docs** — F9; **FAIL for skill body** — F3 |
| 2. False acceptance / dual-credit headings | **FAIL** — F1 |
| 3. Empty/placeholder enforcement for new keys | **PASS with caveats** — F5 (angle/HTML over-match; 1-char theater under-match) |
| 4. Breaking change / legacy design.md | **FAIL** — F2 (no migrate story on hot path) |
| 5. Tests that lock the contract without tautology | **PARTIAL** — new RED cases exist; weakened length asserts + wrong “five” label (F4); dual-credit untested (F1) |
| 6. Docs claim vs PLAN/actual gate | **FAIL** — F6 (“approved” oversell) |
| 7. Scope creep into F2 detectors | **PASS** — F10 |
| 8. Security | **PASS** — F11 |

---

## Second-pass confirmation

Re-read full current `scripts/lint-design.js` (`REQUIRED`, `normalizeHeading`, `parseSections`, `hasRealContent`, `lintDesignMd`, CLI), full `tests/lint-design.test.js`, full `docs/skills/brainstorm.md`, brainstorm block of `meta/catalog.yaml`, and the captured F1 diff hunks. Confirmed with live `node` probes:

1. `## Decision Context` + other minimal sections → **zero violations** (dual-credit Context+Decisions).
2. `## Out of Context Analysis` satisfies Context.
3. `<!-- note -->` alone under Context → empty violation via `^<[^>]*>$`.
4. One-character bodies `x`/`ok`/`yes`/`go`/`none` → full pass.
5. `integrity-remediation/design.md` and the bulk of `.atomic-skills/projects/**/design.md` fail post-F1 Interview (and some Context/Non-goals) requirement.
6. `skills/core/brainstorm.md:79–85` still “expanding toward” / “usable design” for the three new lint keys; `critic.md:29` still lists only Decisions / Chosen approach / Blast radius.
7. Suite 26/0 green; F1 does implement the REQUIRED expansion and documents it in docs+catalog.

No finding depends on commit messages, eval verdict, or “phase pass” labels. F0 CRITICAL “lint does not enforce Interview” is **code-fixed** in F1; residual is skill/critic prose lag (F3) and new quality/compat holes (F1, F2, F5, F6).

---

## Counts by severity

| Severity | Count |
|----------|------:|
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 3 |
| LOW | 2 |
| INFO | 3 |
| **Total findings** | **11** |

**Blocking for “section lint is a trustworthy multi-section gate” marketing:** F1 (dual-credit), F2 (legacy hard-break undocumented), F3 (skill body still soft on the new keys).

**F1 acceptable if reframed as:** REQUIRED array expansion + docs/catalog sync + tests for missing/empty new keys, with known residual skill-body lag and no heading-exclusivity or legacy migrate story. As written, machine enforcement is real for *some* heading that matches each regex with non-placeholder text — not for five well-formed, distinct design sections with process-grade Interview content.
