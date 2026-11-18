# F0 review-code --mode=both

- **Range:** `44ed8bac^..3f21c66a` (product docs T-001/T-002)
- **Mode:** both (local + codex)
- **At capture:** 3f21c66adb7537c42bbdc73da5d8ca5b687af53e tip of product commits
- **Plan HEAD at review:** 0919abf

## Local (explore agent)

verdict: approve-with-caveats
counts: blocker 0, critical 1, major 4, minor 2, note 2

| sev | file:line | claim |
|-----|-----------|-------|
| critical | docs/kb/grok-phase-todo-projection.md:139 | missing literal greppable token `anti-proc` (uses anti-race / proc:*) |
| major | docs/kb/grok-build-compatibility.md:293 | overstates host projects phases via todo_write |
| major | docs/kb/grok-phase-todo-projection.md:97 | empty-focus reseed merge:false can wipe proc board |
| major | docs/kb/grok-phase-todo-projection.md:61 | paused vs current precedence unspecified |
| major | skills/core/project.md:134 | instructs runtime helper that F0 says unimplemented |
| minor | docs/kb/grok-phase-todo-projection.md:78 | "read-only projection" wording |
| minor | docs/kb/grok-build-compatibility.md:174 | duplicate ## 6 numbering |

## External codex

| sev | file:line | claim |
|-----|-----------|-------|
| high | skills/core/project.md:134 | run missing project-session-todos.js |
| medium | docs/design/statusline-focus-integration.md:205 | jq join empty string breaks parser example |
| medium | skills/core/project.md:134 | hardcodes todo_write tool name vs template vars |
| medium | docs/kb/grok-phase-todo-projection.md:32 | paused plan empty focus vs paused phase pending map |
| medium | docs/kb/grok-phase-todo-projection.md:97 | merge:false ownership of full checklist |
| low | docs/kb/grok-build-compatibility.md:312 | stray closing parenthesis |

## Disposition (pending fix agent)

All critical/high/major → fix via code-only re-dispatch #1. Minors optional in same pass.
