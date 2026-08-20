# Decision package — project-flow F2

1. Reuse only flowPathsForPlan + buildFlowRatification from 86c1c2d4.
2. Ready without flow remains legal; implement without flow does not.
3. process-map leftover remaps to reviews; reader file kept.
4. Local review override.

Operator evaluates the whole plan at plan-end (`userValidatedAt`). decisionReview pending.
