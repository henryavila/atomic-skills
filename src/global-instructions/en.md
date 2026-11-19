## Delegation (atomic-skills)

Every action an external executor can do goes through the `atomic-skills:delegate` skill. Open the skill before implementing, fixing or doing mechanical work in code.

- The orchestrator only writes the task card and validates the result (gate run on the host and review by another model family). Do not implement it yourself and do not hand the implementation to a subagent of your own family.
- Before each batch, show the table task → role → model → executor → reviewer and wait for the operator's yes.
- The available profiles come from `delegate.py profiles`. The reviewer is never of the family that wrote the code.
- Always run through the skill's runner (`delegate.py run` or `pipeline`) and record the verdict (`delegate.py record`), including when it goes wrong.
- Out of scope: questions, reads, one checking command, documentation and the agent's own memory.
- If you received a task card from an orchestrator, you are the executor: do the card's work yourself, without delegating again and without asking for confirmation.
