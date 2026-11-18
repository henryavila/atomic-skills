# Adversarial review — brainstorm-hardening F0

- **mode:** local
- **ref:** `cc60fd46..62c43f8e`
- **at:** `e591f7595975652372c5a0347c91fa96f14d3315`
- **scope:** product files only (skills/core/brainstorm.md, brainstorm-assets/*, project-create-plan.md, docs/skills/brainstorm.md, tests/project.test.js)
- **diff:** `.atomic-skills/reviews/brainstorm-hardening-F0-captured.diff`
- **stance:** ignore author framing; judge substance only

---

## Findings

| # | Severity | File:line | Claim (as written) | Impact | Recommendation |
|---|----------|-----------|--------------------|--------|----------------|
| F1 | **CRITICAL** | `skills/shared/project-assets/project-create-plan.md:352` | Multi-phase DESIGN **always** runs Interview → research-digest → `debate --gate` (no skip ladder) — Stage 2:40, DESIGN integration:350 | Same file **explicitly allows** accepting any existing `design.md` that only passes `lint-design.js`. That lint checks only Decisions / Chosen approach (/ Blast radius with `--migration`). No Interview, no `research-digest.md`, no debate, no design-gates receipt. Agent can invent a two-section design.md, skip B0–B1, and proceed. | Either delete/narrow the escape hatch (require `design-gates` `status: ready` + digest path + critic evidence), or stop claiming “always / no skip ladder” for multi-phase. |
| F2 | **CRITICAL** | `skills/core/brainstorm.md:79–85` + `scripts/lint-design.js:31–35` | “These sections are mandatory and enforced by `scripts/lint-design.js`” then lists `## Interview` under usable design and asserts “Every required section must carry real content … **fails the lint**.” | **False enforcement claim.** `lint-design.js` only requires Decisions + Chosen approach (+ Blast radius with `--migration`). Interview / Context / Non-goals / Open questions / Rejected alternatives are **not** scanned. A design without `## Interview` still exits 0. | Split language: lint-required vs process-required. Or extend lint (F2 work) to require Interview (+ optional Rejected alternatives when multi-approach). Do not claim lint enforces what it does not. |
| F3 | **HIGH** | `skills/core/brainstorm.md:9` vs `:73`, `:131` | Iron Law handoff needs: design.md + section lint + critic Approved + user approval. Closing / B5 also require design-gates receipt + `interviewAccepted` + `research-digest.md`. | Receipt and digest are **not** in the Iron Law / HARD-GATE block. B5 uses soft “ensure”. An agent can hand off after critic+user approve without writing receipt or digest and still satisfy the Iron Law text. | Put receipt+digest into Iron Law / HARD-GATE, or mark them as non-blocking until detectors exist. Do not list them as clean-run outputs if Iron Law omits them. |
| F4 | **HIGH** | `project-create-plan.md:56–63` (Stage 4 PLAN precondition) | “Refuse without an **approved** design”; HARD-BLOCKS on lint only | “Approved” is redefined as lint-clean file existence. No check for critic verdict, design-gates JSON, research-digest, or Interview section. Contradicts brainstorm’s multi-artifact “clean run” and undermines the whole F0 process story at the only deterministic gate that actually runs today. | Stage 4 must eventually run process detectors (future `find-missing-design-process.js`). Until then, document honestly that PLAN only enforces section lint, not process. |
| F5 | **HIGH** | `tests/project.test.js:801–805` | Test comment: “Multi-phase always Interview + research-digest + debate --gate (no skip ladder)” | **Tautology / under-powered.** Assertions are unscoped `assert.match(content, /Interview/)`, `/research-digest/`, `/debate --gate/` on the **entire** asset (~550 lines). Any incidental word pass. Does **not** assert Stage 2/DESIGN integration wording together, does **not** fail if line 352 escape hatch remains, does **not** read `skills/core/brainstorm.md` or brainstorm-assets at all. `doesNotMatch(/only when ≥2 viable approaches AND/)` is a single-phrase ban easily reintroduced with synonym skip language. | Scope to Stage 2 + DESIGN integration slices; assert full chain strings; assert **absence** of “accept an existing design.md … only lint” *or* assert receipt/digest required when accepting; add tests that load `skills/core/brainstorm.md` + asset files (existence + HARD bans + path strings). |
| F6 | **HIGH** | `tests/project.test.js:650`, `:819–820` | draft-and-ratify businessIntent contract | Alternation `/draft-and-ratify\|drafts the five-field…\|Drafted/` means **any one** token passes. Removing “draft-and-ratify” but leaving “Drafted” somewhere else green-passes. Duplicated weak coverage with the new Stage 6–only test (813–824). | Require all load-bearing tokens (draft-and-ratify **and** Aprovar draft **and** five-field spine) without OR-collapse. |
| F7 | **MEDIUM** | `skills/core/brainstorm.md:31–47` + `interview.md:18–25` | B1 agenda: “B0 decision forks”; Interview is HARD and collects 6 HALT fields | Interview table has Problem / In-scope / Out-of-scope / Done-when / Stakes / Sources — **no Decision forks field**. Old B0 that produced “3–7 decision questions” was removed. B1 has no defined input for “bounded agenda” forks unless the agent invents them (banned for frame, ambiguous for forks). | Add explicit “primary forks / alternatives to debate” to Interview HALT (or a B0→B1 handoff step that derives forks from stakes+scope and ratifies them). |
| F8 | **MEDIUM** | `skills/core/brainstorm.md:47` vs `process-receipt.md:26` | Anti-theater: record `single_approach: true`; receipt schema: `debateGate.singleApproach` | **Schema/field naming drift** (`snake_case` vs camelCase). Future detectors and agents will write inconsistent keys; process receipt will not match prose. | Pick one name in schema and skill body; document in process-receipt as the only wire format. |
| F9 | **MEDIUM** | `skills/shared/brainstorm-assets/process-receipt.md` (whole) + `research.md:26–40` | Interview/research/debate are HARD; weak digest “blocks B1”; receipt proves process | **Discipline-only gates.** No script exists (`find-missing-design-process.js` / `find-weak-design.js` absent — expected later phase, but prose still sells HARD). Agent can forge `interviewAccepted: true` and `status: "ready"` without any spine or digest quality. | Label as “process contract (agent-enforced until F2 detectors)”. Ban status:ready self-attestation without file proofs once detectors land. Do not use HARD as if machine-enforced. |
| F10 | **MEDIUM** | `skills/core/brainstorm.md:85` | “for a usable design: `## Interview` …” after “(and expanding toward Interview / Context / Non-goals as required)” | **Weasel + mandatory collision.** Interview is HARD at B0 and “include `## Interview` when writing” (B3:55) but design-doc section is still “usable” / “expanding toward”, not **(lint-required)**. Agents will drop Interview section under pressure. | Either mark `## Interview` as mandatory process section with a red-flag if missing, or accept it is optional and remove HARD coupling. |
| F11 | **MEDIUM** | `docs/skills/brainstorm.md:17–18` | Multi-phase flow table points at assets | Interview cell uses full path `skills/shared/brainstorm-assets/interview.md`; research cell uses short `brainstorm-assets/research.md` (no `skills/shared/`). Not broken if read from repo knowledge, but **inconsistent internal links** vs skill body absolute-from-repo-root paths. | Use full `skills/shared/brainstorm-assets/{interview,research,process-receipt}.md` in docs. |
| F12 | **LOW** | `docs/skills/brainstorm.md:7` vs Stage 4 | Docs: “PLAN refuses to start without that approved, lint-clean design” after describing Interview+digest+debate | Docs imply the full process is what PLAN refuses without; PLAN actually only refuses lint failure. **Docs/skill/enforcement drift.** | Align docs with true PLAN precondition (lint only today) or change Stage 4. |
| F13 | **LOW** | `project-create-plan.md:110` vs `interview.md:44–45` | Interview: do not invent scope; Stage 6: agent **drafts** five-field businessIntent from design/source | Intentional product shift for F0 businessIntent, but agents can re-apply “draft then ratify” to **Interview** and erase the ban on inventing the frame. Asymmetry is undocumented. | One sentence in both assets: Interview is user-first (no draft); businessIntent is agent-draft-then-ratify. |
| F14 | **LOW** | Range scope | F0 process pack | **No Stage 8 / F2 detector implementation** in product files — good, no scope creep into Stage 8 review-plan. process-receipt **mentions** future `find-missing-design-process.js` by name (stable path promise) — acceptable foreshadowing, not implementation. | Keep detectors out of F0; when F2 lands, wire Stage 4 and tests. |
| F15 | **INFO** | Asset paths | `{{READ_TOOL}} skills/shared/brainstorm-assets/*.md` | Files exist on disk (`interview.md`, `research.md`, `process-receipt.md`). No broken on-disk paths for skill body READ directives. | — |
| F16 | **INFO** | Security | Markdown/skill prose only | No shell interpolation of untrusted input beyond existing `node … lint-design.js` patterns. No new command-injection surface material to this diff. | — |

---

## Checklist results (explicit)

| Checklist item | Result |
|----------------|--------|
| 1. Process contradictions (always X but still allows skip) | **FAIL** — F1, F3, F4, F10 |
| 2. Missing HARD-GATE enforcement that prose claims | **FAIL** — F2, F3, F9 (HARD is agent prose; lint claim false; PLAN gate incomplete) |
| 3. Tests that don’t fail on regression (tautology) | **FAIL** — F5, F6; zero tests for brainstorm skill body / assets |
| 4. Broken internal links / missing asset paths | **PARTIAL** — assets exist (F15); docs path inconsistency (F11) |
| 5. Security (command injection) | **N/A / clean** — F16 |
| 6. Scope creep into F2 detectors / Stage 8 | **PASS** — F14 (mention only, no Stage 8 edits) |
| 7. Docs/skill drift | **FAIL** — F2, F12; skill Closing vs Iron Law (F3) |

---

## Second-pass confirmation

Re-read full current contents of the seven target files plus `scripts/lint-design.js` REQUIRED list and Stage 4/Stage 2 sections of `project-create-plan.md` against the captured diff. Confirmed: (1) skip-ladder removal in brainstorm is real in the skill body, but project-create-plan retains a lint-only “existing design” bypass that nullifies “always”; (2) `## Interview` / digest / design-gates are process prose without deterministic enforcement in this range; (3) `lint-design.js` was **not** changed and still only gates Decisions/Chosen approach; (4) new tests only substring-match `project-create-plan.md` and would stay green if Interview were deleted from Stage 2 as long as the word “Interview” appeared elsewhere; (5) no F2 scripts and no Stage 8 product edits in range. No finding above depends on commit messages or “fixed/safe/tested” labels.

---

## Counts by severity

| Severity | Count |
|----------|------:|
| CRITICAL | 2 |
| HIGH | 4 |
| MEDIUM | 5 |
| LOW | 3 |
| INFO | 2 |
| **Total findings** | **16** |

**Blocking for “process is HARD” marketing:** F1, F2, F3, F4, F5.

**F0 acceptable if reframed as:** agent-facing process contract + asset pack only, with honest “enforcement deferred to detectors / Stage 4 wiring,” escape hatch documented, and non-tautological tests for skill+assets text. As currently written, the product **claims** machine/HARD guarantees it does not implement.
