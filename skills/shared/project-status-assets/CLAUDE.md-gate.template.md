<!-- atomic-skills:status-gate:start v=2.0.0 -->
## Status Tracking (atomic-skills:project-status)

<HARD-GATE>
BEFORE any Write/Edit operation in source code:

1. Read `.atomic-skills/PROJECT-STATUS.md`. Determine:
   a. Is there an Active Plan? If yes, read it and note `currentPhase`.
   b. Which Initiative anchors this work? (a phase initiative of the active plan,
      OR a standalone initiative, OR ad-hoc).
2. Resolution rules:
   - Exact match with an active initiative (by branch, `scope.paths`, or active plan's `currentPhase`)
     → read `.atomic-skills/initiatives/<slug>.md` and report current stack frame.
   - Multiple candidate initiatives, or new/ambiguous context → ASK the user:
     "Is this (a) continuation of <X>, (b) lateral expansion of <X>, (c) new phase of <plan>,
      (d) new standalone initiative, or (e) ad-hoc work?"
   - No active initiative and context is new → ask: "Does this require a new initiative
     (under active plan or standalone), or is it ad-hoc?"
3. Before the edit, announce which Plan/Phase/Initiative/StackFrame anchors the work.
4. If the edit opens a new depth (research, discussion, expansion), invoke
   `atomic-skills:project-status push <description>` BEFORE the edit.
5. If the edit closes a frame (done, parked, emerged), update via
   `atomic-skills:project-status pop` / `park` / `emerge` / `done` AFTER the edit in the same turn.
6. If the edit touches paths OUTSIDE `scope.paths` of the active initiative, surface drift:
   "Writing to <path> is outside <initiative>.scope.paths. Switch initiative or expand scope?"

VIOLATION = code written without anchor = the exact problem this skill exists to prevent.
</HARD-GATE>

Invoke `atomic-skills:project-status` to view status at any time. Hooks will also auto-inject context at SessionStart.
<!-- atomic-skills:status-gate:end -->
