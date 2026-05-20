# Feature Contracts (v0.1)

For each feature shipping in v0.1, this document declares:

- **Contract**: what the feature guarantees and what it does NOT.
- **Success gate**: verifiable criteria for "done". Same discipline as exit gates in plans.

If a feature ships without all gate criteria met, it is NOT v0.1-done. Partial features either get descoped or block release.

The reference test target is **sda-v2 v3-redesign**: 9 phases, 61 sub-phases, ~12 initiatives. If aiDeck renders that real plan correctly, it can render anything realistic.

---

## F1. Canonical-data parser

**Contract**

- aiDeck reads YAML frontmatter + markdown body from `.atomic-skills/<consumer>/**` files.
- aiDeck never writes to entity files. Only writes go to `annotations/`, `highlights/`, `inbox/` subdirectories.
- All payloads validated against `@henryavila/aideck/schemas`. Mismatch returns structured error.
- Supports YAML (entity definition) + MD (narrative body) coexisting in the same file.

**Success gate**

- [ ] Parses `sda-v2/.atomic-skills/initiatives/v3-f0-foundation-repair.md` (hypothetical real file) without errors
- [ ] Parses the v3-redesign master plan (843 lines narrative + structured frontmatter) and exposes both
- [ ] Rejects payload with `schemaVersion` ≠ `0.1` with `schema_version_mismatch` error including suggestion
- [ ] Round-trip: parse → re-serialize → byte-equal frontmatter (narrative body untouched)
- [ ] Handles all field types in schemas: nested objects, arrays, enums, optional fields
- [ ] Unit tests cover: 12 happy paths, 8 error paths
- [ ] Performance: parse a 1000-line file in < 50ms

---

## F2. File watcher + SSE

**Contract**

- chokidar watches `.atomic-skills/**/*.{md,yaml,jsonl}` recursively.
- File change → SSE event pushed to all connected browser clients within 200ms.
- Event payload includes: target path, change type (add/change/unlink), parsed entity (if applicable).
- Clients can subscribe per consumer or all.
- Disconnect/reconnect handled with `Last-Event-ID` (SSE standard).

**Success gate**

- [ ] Edit an entity file → SSE event arrives in browser < 200ms (measured)
- [ ] Multiple browser tabs receive same event
- [ ] Add a new file → `add` event with full entity payload
- [ ] Delete a file → `unlink` event with target path
- [ ] Reconnect after 5s offline → backfills missed events via `Last-Event-ID`
- [ ] Schema validation failure on watched file → emits `error` event (not silent)
- [ ] Watcher initializes on `aideck serve` startup; clean shutdown on SIGINT

---

## F3. HTTP REST API

**Contract**

- Endpoints serve JSON only (Content-Type: `application/json`). 
- All responses include `schemaVersion`.
- CORS allows `http://localhost:*` only.
- Errors follow `ErrorResponse` shape.

**Endpoints (v0.1)**:

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/health` | runtime status, uptime, consumer count |
| GET | `/api/consumers` | list of registered consumers |
| GET | `/api/state/:consumer` | full state for consumer |
| GET | `/api/state/:consumer/:slug` | scoped state (single plan/initiative) |
| GET | `/api/help` | atomic-skills metadata for help page |
| GET | `/api/inbox` | aggregate inbox across consumers |
| POST | `/api/annotate` | write annotation (same as MCP `annotate`) |
| POST | `/api/highlight` | write highlight |
| POST | `/api/decision` | write decision |
| GET | `/sse` | SSE event stream |

**Success gate**

- [ ] All endpoints return correct status codes (200/400/404/500)
- [ ] CORS validates origin (rejects non-localhost)
- [ ] Invalid input returns `400` with `ErrorResponse` body, never throws
- [ ] Endpoints documented with OpenAPI 3.1 spec (in `docs/openapi.yaml`)
- [ ] Integration tests cover each endpoint
- [ ] No endpoint mutates entity files (only annotations/highlights/decisions)

---

## F4. MCP server

**Contract**

- Exposes 18 tools via stdio MCP transport.
- All tools discoverable via MCP `tools/list`.
- Input validated against TypeScript schema; invalid input returns structured error.
- Mutation tools write via the same code path as REST endpoints (no logic duplication).
- Stateless protocol — each call independently authoritative.

**Success gate**

- [ ] 18 tools (per `docs/mcp-tools.md`) discoverable via Claude Code's MCP integration
- [ ] Each tool has TypeScript-validated input + output
- [ ] `aideck_get_state` returns parseable `ProjectStatusState` for a real consumer
- [ ] `aideck_mark_task_done` mutates file; subsequent `aideck_get_state` reflects change
- [ ] `aideck_inbox` cursor pagination works (call twice with `nextCursor`)
- [ ] Error responses are structured (`ErrorResponse`), not string throws
- [ ] MCP-only mode (`aideck mcp`) runs without HTTP server
- [ ] All 18 tools have working integration tests

---

## F5. Project-status renderer — Plan bird's-eye view

**Contract**

- Renders a Plan with all phases as visual tree.
- Phases grouped by track (Trilho A-H).
- Phase dependencies shown as graph or arrows.
- `currentPhase` has distinct visual highlight.
- Parallel-allowed phases visibly indicated.
- Principles + glossary collapsible panels.
- Click on phase → opens Initiative zoom view.
- Cross-document references rendered as clickable links (gitignored marked).

**Success gate**

- [ ] Renders v3-redesign (9 phases, 8 tracks, complex deps) without truncation or overflow
- [ ] Phase tracks visually grouped (color or layout)
- [ ] Phase dependency graph readable (Mermaid or custom SVG)
- [ ] Current phase has unmistakable highlight (color + icon + breadcrumb)
- [ ] F4∥F5 parallel exception shown explicitly
- [ ] All 6 principles + 8 glossary terms accessible
- [ ] 12+ cross-doc references clickable; gitignored items badged
- [ ] Phase exit gate criteria visible per phase (collapsible)
- [ ] Sub-phase count badge per phase
- [ ] Renders in < 500ms after data load

---

## F6. Project-status renderer — Initiative zoom view

**Contract**

- Renders one Initiative with full detail.
- Breadcrumb: `<phaseId>/<total> · plan: <planSlug>`.
- Tasks rendered as table with status icon + last_updated.
- Stack rendered as nested tree.
- Exit gates list with verifier-aware status indicators.
- Parked + emerged side-by-side panels.
- Scope:paths shown (if declared).
- Cross-task refs (e.g., F4.T-006 → F3.T-003) rendered as in-app links.
- External imports and references as clickable links.
- Markdown body rendered (rationale, decisions).

**Success gate**

- [ ] Renders all 8 tasks of v3-f0-foundation-repair correctly
- [ ] Breadcrumb shows `F0/9 · plan: v3-redesign`
- [ ] Task status icons: ✓ done, ◉ active, · pending, ⊘ blocked
- [ ] Stack frames colored by type (task/research/validation/discussion)
- [ ] Exit gates show verifier type (shell/query/test/manual) per criterion
- [ ] Met gates have ✓ + `metAt` timestamp
- [ ] Deferred gates show deferred reason
- [ ] Parked items count + listing; emerged items + promoted flag
- [ ] scope:paths rendered as code chips
- [ ] Cross-task ref clicks navigate to target task in target initiative
- [ ] Markdown body rendered (headings, code, links)

---

## F7. Help page (atomic-skills discovery)

**Contract**

- Lists all skills from `@henryavila/atomic-skills`.
- Per skill: name, purpose, when_to_use, when_not_to_use, examples, related.
- Search/filter by name, tag, or use case.
- Metadata loaded from skill frontmatter (or fallback static manifest if frontmatter not yet migrated).
- Click-to-copy slash command.

**Success gate**

- [ ] All 12 atomic-skills listed
- [ ] Each skill card shows: name, purpose, when-to-use (at least 1), example (at least 1)
- [ ] Search filters in real time (< 50ms for 12 items)
- [ ] "Related skills" cross-link works (clicking shows target skill)
- [ ] Copy-command button copies `/atomic-skills:<name>` to clipboard
- [ ] If frontmatter missing for a skill, falls back to first-paragraph extraction (graceful)
- [ ] Help page accessible from main nav even when no consumer state exists

---

## F8. Demo mode

**Contract**

- `aideck demo` runs without requiring real `.atomic-skills/` data.
- Seeds fixtures into temporary directory (cleaned on exit).
- Demo content clearly marked as demo (banner + watermark).
- MCP tools work against demo data.
- Demo includes one Plan, one standalone Initiative, sample annotations + highlights.

**Success gate**

- [ ] `npx @henryavila/aideck demo` runs without prior install
- [ ] Demo plan has ≥ 3 phases with mixed statuses (done / active / pending)
- [ ] Demo initiative has ≥ 5 tasks with mixed statuses
- [ ] Demo annotations ≥ 3, highlights ≥ 2
- [ ] Banner "DEMO MODE — seeded fixtures, not your data" visible at all times
- [ ] Demo cleanup on Ctrl+C: temporary dir removed
- [ ] MCP tools queryable against demo data
- [ ] Demo opens browser automatically

---

## F9. Dark theme

**Contract**

- Default theme is dark; CSS variables expose all tokens.
- WCAG AA contrast ratios (4.5:1 normal text, 3:1 large/UI).
- No "white flash" on initial load.
- Light theme stub present (vars defined) but not toggleable in v0.1.

**Success gate**

- [ ] All text passes WCAG AA (verified with axe DevTools)
- [ ] Initial paint is dark (no FOUC)
- [ ] CSS custom properties for every color (bg, fg, accent, success, warn, error, muted)
- [ ] Status icons readable in dark (no near-bg colors)
- [ ] Mermaid graphs themed for dark
- [ ] Tested in Chrome, Safari, Firefox

---

## F10. CLI

**Contract**

- `aideck` invocation patterns: `serve`, `demo`, `mcp`, `--help`, `--version`.
- Flags: `--port=N`, `--no-mcp`, `--config=path`.
- Port collision = exit code 1 + clear suggestion.
- No subcommand = `--help`.

**Success gate**

- [ ] `aideck --help` lists all subcommands + flags
- [ ] `aideck --version` prints package version
- [ ] `aideck serve --port=9999` binds to 9999 or exits with suggestion
- [ ] `aideck demo` works on fresh install (no prior config)
- [ ] `aideck mcp` runs MCP-only (no browser open, no HTTP server)
- [ ] Invalid flag = exit 1 + usage hint
- [ ] CLI completes in < 100ms for `--help` / `--version`

---

## F11. Annotation panel

**Contract**

- Annotations persist as JSONL appended to `<consumer-root>/annotations/<YYYY-MM-DD>.jsonl`.
- Rendered in side panel grouped by target.
- Each entry: author badge (human/ai), body, timestamp.
- Mark resolved → updates `resolved: true` in JSONL.
- New annotations push to panel via SSE.

**Success gate**

- [ ] Annotation created via MCP appears in panel < 200ms
- [ ] Author badge correctly distinguishes human/ai
- [ ] Click "Resolve" updates JSONL and visually marks resolved
- [ ] Annotations grouped by target with collapsible sections
- [ ] Empty state shows "No annotations yet" placeholder
- [ ] Inbox cursor advances when annotation marked consumed

---

## F12. Highlight indicators

**Contract**

- Highlights persist as JSONL appended to `<consumer-root>/highlights/<YYYY-MM-DD>.jsonl`.
- Rendered as colored dot/badge on the highlighted entity in any view.
- Severity-colored: info (blue), warn (amber), critical (red).
- Hover shows reason text.
- Acknowledge → updates `acknowledged: true`.

**Success gate**

- [ ] Highlight created via MCP appears as dot on target entity < 200ms
- [ ] Color matches severity (info/warn/critical)
- [ ] Hover tooltip shows reason
- [ ] Acknowledge updates JSONL + removes dot
- [ ] Multiple highlights on same target stack visually
- [ ] Highlight on plan-level entity vs task-level entity render in correct places

---

## F13. Exit-gate verifier execution

**Contract**

- Verifier kinds: `shell`, `query`, `test`, `manual`.
- aiDeck runs shell/query/test verifiers in a sandboxed child process.
- Output captured and stored in evidence field.
- Manual verifiers require explicit `result` parameter.
- Verifier execution is opt-in per call (not automatic on parsing).

**Success gate**

- [ ] Shell verifier: command runs, exit code captured, stdout/stderr stored
- [ ] Query verifier: requires DB connection config (deferred to v0.2 — schema present, execution stubbed)
- [ ] Test verifier: invokes test runner with pattern, parses pass/fail (deferred to v0.2 — schema present)
- [ ] Manual verifier: requires `result` arg, refuses execution
- [ ] Timeout enforced (default 30s, configurable)
- [ ] Evidence stored in criterion's frontmatter on update
- [ ] Failed verifier → criterion stays `pending`, error surfaces in response

NOTE: full execution of `query` + `test` verifiers ships in v0.2. v0.1 includes the schema and shell + manual paths.

---

## v0.1 Definition of Done (composite gate)

All of:

- [ ] F1-F13 individual gates met
- [ ] README accurate
- [ ] `npx @henryavila/aideck demo` works from clean machine
- [ ] aiDeck can render real sda-v2 v3-redesign plan (10 initiatives, 70+ tasks)
- [ ] No TypeScript errors (`npm run typecheck` passes)
- [ ] Unit test coverage ≥ 70% on schemas + server + mcp
- [ ] Integration test suite passes
- [ ] Manual smoke test: real `.atomic-skills/` repo + MCP from Claude Code
- [ ] License + package.json metadata correct for npm publish
- [ ] Demo screencast/GIF in README (v0.1.1 nice-to-have)

---

## Out of v0.1 (explicit)

- Custom consumer registration (third-party tools) — v0.2
- parallel-dispatch / parallel-dispatch-audit renderers — v0.2
- hunt / review renderers — v0.3
- Cross-cutting views (home, timeline, repo health) — v0.4
- Dashboard-side mutation UI (click-to-mark-done) — v0.2+
- Light theme — v0.2
- `query` and `test` verifier execution — v0.2 (schema lands in v0.1)
- Multi-user / cloud sync — never
