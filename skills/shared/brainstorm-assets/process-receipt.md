# brainstorm — process receipt (design-gates) lazy asset

Durable proof that multi-phase DESIGN ran Interview → research → debate →
critic → user approval — not only that a `design.md` file exists.

## Path

```text
.atomic-skills/status/design-gates/<projectId>-<slug>.json
```

Create the directory if needed. One receipt per plan design. Do not invent a
`grandfathered` flag the agent can flip to skip process.

## Schema (v0.1 fields)

```json
{
  "schemaVersion": "0.1",
  "projectId": "<project-id>",
  "slug": "<plan-slug>",
  "interviewAccepted": true,
  "debateGate": {
    "invoked": true,
    "readyForValidation": true,
    "singleApproach": false
  },
  "researchDigest": "projects/<project-id>/<plan-slug>/research-digest.md",
  "criticVerdict": "Approved",
  "userApproved": true,
  "status": "ready",
  "updatedAt": "<ISO-8601>"
}
```

| Field | Meaning |
|-------|---------|
| `interviewAccepted` | `true` only after B0 Interview ratify with a full spine (not bare ok/yes). |
| `debateGate` | Multi-phase always ran `atomic-skills:debate --gate`; record synthesis readiness / single-approach flag. |
| `researchDigest` | Relative path to a non-weak `research-digest.md`. |
| `criticVerdict` | Binary collapse from the critic (`Approved` / Issues-Found path). |
| `userApproved` | Explicit user approval of the design (not panel consensus). |
| `status` | e.g. `pending` → `ready` when process complete; never ready without the above. |

## When to write

| Step | Update |
|------|--------|
| B0 Interview ratified | `interviewAccepted: true` |
| B0b digest acceptable | `researchDigest: <path>` |
| B1 debate closed | `debateGate` filled |
| B4 critic **Approved** | `criticVerdict` |
| B5 user explicit approve + handoff | `userApproved: true`, `status: "ready"` |

## Rules

- Panel agreement is **not** `userApproved` or critic **Approved**.
- Missing `interviewAccepted` or empty `researchDigest` means the process is incomplete.
- Deterministic detectors (future `find-missing-design-process.js`) read this path;
  keep the shape stable.
- Exempt lanes (`adopt`, ad-hoc, single-task) do **not** require this receipt.
