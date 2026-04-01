# Implementation Plan: `as-review-code`

## 1. Goal

Implement the `as-review-code` core skill as defined in the design spec.

## 2. Tasks

### Phase 1: Preparation & Scaffolding
- [ ] Create `skills/en/core/review-code.md` with the skill instructions.
- [ ] Create `skills/pt/core/review-code.md` (localized version).
- [ ] Update `meta/skills.yaml` to include the new skill.
- [ ] Update `README.md` skills table.

### Phase 2: Skill Content Development
- [ ] Draft detailed adversarial review instructions in `skills/en/core/review-code.md`.
- [ ] Define the checklist for T1, T2, T3 tiers.
- [ ] Define the output format for findings (Markdown table or list).
- [ ] Add the rationalization table for mental bias control.

### Phase 3: Integration & Testing
- [ ] Test the skill with real git diffs in a controlled scenario.
- [ ] Refine the instructions based on the quality of findings.
- [ ] Verify that it correctly identifies impact (1-hop callers/callees).

## 3. Verification Strategy

### 3.1 Unit Testing
Since skills are primarily markdown-based, "testing" involves verifying the agent follows the instructions.
- Create a sample PR with intentional bugs (e.g., a logic error in an auth path).
- Invoke `as-review-code` on that diff.
- Verify if it catches the intentional bugs.

### 3.2 Regression Testing
- Ensure other skills (like `fix` or `status`) are not affected.

## 4. Rollout
- Update `TODO.md` to reflect the completed implementation.
