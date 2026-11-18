---
schemaVersion: "0.2"
slug: real-automate-f2-prototipo
projectId: atomic-skills
parentPlan: real-automate
lessons:
  - id: L-F2-1
    statement: A detector that cites a file path and skips the check when existsSync is false records a silent pass.
    corrective: If the stamp names a path, missing file, directory, empty file, and path-escape are issues. Never treat existsSync false as nothing to verify.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-09-28-real-automate-F2-local.md
    createdAt: 2026-10-02T11:06:37.787Z
    validatedAt: 2026-10-02T11:06:37.787Z
  - id: L-F2-2
    statement: A review-fix for four named findings grew find-missing-ui.js from 281 lines to 2059 and the test file to 4901, with one test still failing.
    corrective: Size-cap the detector. Add one review-fixes suite covering the named findings only. Unclosed-fence CommonMark completeness is out of a keyword-scan detector.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/eval-real-automate-F2.md
    createdAt: 2026-10-02T11:06:37.787Z
    validatedAt: 2026-10-02T11:06:37.787Z
---

# Lessons — F2 Protótipo

Operator-ratified 2026-10-02 (AskUserQuestion: Ratificar as 2 lições).
