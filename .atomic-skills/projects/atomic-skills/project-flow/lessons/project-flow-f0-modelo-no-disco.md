---
schemaVersion: "0.1"
slug: project-flow-f0-modelo-no-disco
projectId: atomic-skills
parentPlan: project-flow
lessons:
  - id: L-001
    statement: Chained exclusive git ranges that share endpoints (T-N head == T-N+1 base) fail claim-report exclusivity. The overlap detector treats base and head tokens as owned SHAs.
    corrective: Prefer exclusive commitShas[] per task. If using base+head, do not reuse another open claim's commitSha as an endpoint.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/status/automate/project-flow-claims.json
    createdAt: 2026-08-13T21:42:00Z
    validatedAt: 2026-08-13T21:42:00Z
---
