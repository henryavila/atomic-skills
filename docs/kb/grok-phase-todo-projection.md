# Grok phase → session TODO projection

Contract for projecting the **active plan's phases** into Grok Build's session
checklist via the Grok session checklist tool (`todo_write`). Prose-only here;
the deterministic helper lands in a later phase. Producers of focus digest remain
`refresh-state` / `emit-focus` — this doc is the **Grok session-todo consumer**
contract, not a second SoT.

**Related:** `docs/design/statusline-focus-integration.md` (focus.json / statusline
producer+consumer); `docs/kb/grok-build-compatibility.md` (Grok-local install and
phase-scaffold note); design package
`.atomic-skills/projects/atomic-skills/grok-phase-todo-projection/design.md`.

## Scope and non-goals

| In scope | Out of scope |
|---|---|
| Phase scaffold on Grok session todos | Projecting tasks `T-00N` into session todos |
| Canonical label, status map, SoT order | Host chrome panel or auto-read of `focus.json` by Grok |
| Helper payload shape (name reserved) | Writing `~/.grok/sessions/.../plan.json` by script |
| **anti-proc**: phase scaffold vs `proc:*` while plan anchored | Multi-IDE mirror (Claude/Codex/Cursor todos) |
| Reseed / merge rules for session checklist tool | Using todo completion to close phase/task (GATE-R2 stays) |

**Grok-local only.** Claude, Codex, and Cursor do **not** receive this mirror.
Portable SoT stays under `.atomic-skills/`.

## Granularity

**Grok session TODO = only phases of the active (pickFocus, tree-relative) plan.**

- One session todo per phase in `plan.phases[]`.
- Tasks `T-00N` stay in initiative YAML, aiDeck, and handoff — never as session todos.
- **Empty focus / paused plan (no pickFocus winner):** empty scaffold (same empty-focus
  discipline as `emit-focus`). A **paused plan** yields no winner ⇒ empty scaffold.
  A **paused phase** on an otherwise active (anchored) plan is still a row: map it
  per the status rules below (`pending` + ` · paused`), not empty focus.

## Canonical label

```
F0 (2/12) — <summary || title>
```

| Segment | Source |
|---|---|
| `F0` | `phase.id` |
| `(2/12)` | `tasksDone/tasksTotal` of the **materialized** initiative (not `phase.index/total`) |
| after `—` | **what the phase does**: prefer `summary`; fallback `title` (required on descriptor). `goal` only as last truncated fallback if both missing |
| stable todo `id` | `<planSlug>:F0` (slug may be long; it is the id, not the primary content text) |

**Descriptor-only** (no initiative file yet — never invent totals):

```
F2 (—) — <title> · not materialized
```

Do **not** ship content that is only `F0 (2/12)` without summary or title.

## Status mapping

Apply in this **precedence order** (first match wins):

1. If phase status is **`paused`** → always session todo **`pending`** and append content suffix **` · paused`** (not `completed`, not omitted).
2. Else if phase is **current / `active`** → **`in_progress`** (even if tasks are 12/12 while gates remain open).
3. Else if phase is **`done` or `archived`** → **`completed`** (`(n/N)` remains informative).
4. Else → **`pending`**.

| Phase / initiative status | Session todo `status` | Content notes |
|---|---|---|
| `paused` | **`pending`** (always) | Append ` · paused` — wins over current/active |
| current / `active` phase | `in_progress` | Only when not paused |
| `done` or `archived` | `completed` | `(n/N)` remains informative |
| other non-done phases | `pending` | |

At most one `in_progress` phase todo for the active plan scaffold.

## SoT order (write-through)

Canonical order after any lifecycle mutation that changes phase/task status or focus:

1. **Mutate** durable YAML under `.atomic-skills/` (skill `project` / `implement` via
   `done` / `phase-done` — the only writers of plan SoT).
2. **`refresh-state`** — rollups, focus markers, `focus.json`.
3. **Projection helper** — deterministic JSON payload for session todos (see below).
4. **Session checklist tool** (`todo_write`) — agent applies the payload to the Grok
   session checklist (**Grok-local**; Atomic Skills / agent owns the write, not the host product).

**Never** mark a session TODO `completed` in order to close a phase or task.
`todo_write` is a **session-local projection only; never close authority** relative
to the plan; GATE-R2 stays on verifiers / `done` / `phase-done`.

## Helper name (F0 reserved; not implemented here)

Preferred script name: **`scripts/project-session-todos.js`**.

- **Role:** zero-token CLI; read plan (pickFocus) + `phases[]` + rollups/initiatives;
  print JSON `{ merge, todos[] }` with stable ids `<planSlug>:Fn` and canonical
  content/status.
- **F0:** document the name and contract only — **do not** implement the script
  in this phase. **Not implemented until F1** (name reserved).
- Open naming alternative (`emit-session-todos.js`) is superseded for prose by
  `project-session-todos.js` unless a later phase renames deliberately.

## Reseed and merge rules

| Moment | Session checklist merge mode | Rule |
|---|---|---|
| Reseed when pickFocus has a **winner** (anchored active plan) after `refresh-state` / implement start / full phase-scaffold write | `merge: false` | **Full replace** so only phase todos remain |
| Empty focus / paused plan (**no pickFocus winner**) | **skip reseed / no-op** | Do **not** full-replace wipe the board; leave existing session todos alone (or emit empty scaffold without `merge: false` wipe) |
| Mid-flight content/status updates for the same anchored plan | `merge: true` | Touch only stable `<planSlug>:Fn` ids |
| SessionStart (plugin Soft) | hint only | May fail-open without hooks-trust; **not** the sole reseed path |
| Skill path (`project` / `implement` start, post-compaction) | reseed when winner | Must reseed independently of SessionStart when a plan is anchored |

**Merge policy summary:**

- **Anchored plan with pickFocus winner** → reseed phase board with `merge: false`.
- **Empty focus / paused plan (no winner)** → do **not** full-replace wipe (skip reseed or no-op).
- Paused **plan** ⇒ empty scaffold (no winner). Paused **phase** on an active plan
  ⇒ still listed as `pending` + ` · paused` (not a contradiction).

**SessionStart = hint only** for phase-scaffold reseed: Soft hooks can miss when
untrusted; the skill path remains authoritative.

## Process scaffold must not compete (**anti-proc**)

**anti-proc:** phase scaffold vs `proc:*` while plan anchored.

While a plan is **anchored** (pickFocus has an active plan for this tree):

- Default under `project` / `implement` is the **phase scaffold**.
- A concurrent **process scaffold** (`proc:*` ids from bundled Grok flows such as
  `/implement` process steps) is **forbidden** as competing session todos.
- If process steps are needed, keep them as narrative in handoff — not as a
  second checklist fighting the phase track.

On reseed (`merge: false`) **when there is a pickFocus winner**, the helper payload
replaces the board so only phase todos remain. Empty focus does not wipe via
`merge: false` (see merge rules).

## Host-local skill-level projection

- **Atomic Skills / the agent** applies the Grok session checklist tool (`todo_write`)
  from the helper payload — **Grok-local** only; the host product does not auto-project.
- **Do not** claim that the Grok host auto-reads `.atomic-skills/focus.json`.
- **Do not** write session `plan.json` under `~/.grok/sessions/` by shell.
- No native Grok chrome panel for this backlog in v1.

## Operator checklist (when wire-up lands — F1+)

1. After `done` / `phase-done` / `switch` / `unblock` / other focus-moving closes:
   mutate → `refresh-state` → `node scripts/project-session-todos.js` (F1+) →
   Grok session checklist tool (`todo_write`).
2. On session / implement start and after context compaction: reseed phase scaffold
   (`merge: false` when replacing a process board **and** pickFocus has a winner).
3. Never close durable state because a session todo is checked.

## Dogfood checklist (Grok session — operator run)

Manual path for one real Grok session. Documents what the operator runs; **do not**
invent PASS without that run. No second helper — only `refresh-state` →
`project-session-todos` → session checklist tool (`todo_write`).

Expected label always carries **identity** text (`summary` preferred, else `title`),
not counts alone. Canonical form:

```
F0 (n/N) — <summary || title>
```

Descriptor-only rows use `F2 (—) — <title> · not materialized`. Reject content that
is only `F0 (2/12)` with nothing after the em-dash.

| Step | When / action | What to verify on the Grok session checklist |
|---|---|---|
| **seed** | Session start, `implement` start, or first phase-scaffold write while pickFocus has a winner | Full phase board via helper with `merge: false`. One row per `plan.phases[]` id (`<planSlug>:Fn`). Current phase `in_progress`; others `pending`/`completed` per map. Labels show `F0 (n/N) — <summary \|\| title>` (identity, not bare counts). No competing `proc:*` rows while plan anchored (**anti-proc**). |
| **after-done** (counter bump) | After task `done`: mutate initiative → `refresh-state` → `node scripts/project-session-todos.js --json` → `todo_write` (mid-flight: same plan → `merge: true` is fine) | Active phase row keeps stable id and **identity** (`summary`/`title`). Progress counts bump: `(n/N)` advances (e.g. `F0 (2/5) — Foundation work` → `F0 (3/5) — Foundation work`). Status stays `in_progress` until the phase itself is `done`/`archived` (even at N/N tasks if gates remain open). |
| **phase-done** (advance) | After durable `phase-done` (initiative + plan phase `status: done`), then shared post-close projection: `refresh-state` → helper → `todo_write` | Closed phase projects `completed` with informative `(n/N)` and identity text. Successor (if advanced) is `in_progress` with its own `summary`/`title`. Never mark the phase todo `completed` to *cause* close — only after durable plan descriptor is `done`. |
| **reseed after compact** | After context compaction (and again on skill-path session/`implement` start when a plan is still anchored) | Reseed phase scaffold with `merge: false` when pickFocus has a winner so only phase todos remain. Labels still include identity (`summary`/`title`), not counts alone. Empty focus / paused plan → **skip reseed** (no full-replace wipe). |

**Operator PASS (manual gate only):** after one real Grok session has walked
seed → after-done counter bump → phase-done advance (when applicable) and at least
one reseed after compact (or skill-path reseed), confirm the checklist behaved as
above. The package does **not** invent that PASS from unit tests alone.

## Greppable contract anchors

- label: `summary` / `title` fallback; descriptor-only `(—)` + `not materialized`
- order: mutate → `refresh-state` → helper → `todo_write`
- `paused` → todo `pending` + suffix ` · paused` (precedence: paused first)
- helper: `project-session-todos` (name reserved; not implemented until F1)
- **anti-proc**: phase scaffold vs `proc:*` while plan anchored (anti-race alias)
- merge: pickFocus winner → `merge: false` reseed; empty focus / paused plan → no wipe
- locality: **Grok-local** session todo projection (session-local projection only; never close authority)
