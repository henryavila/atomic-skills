You are the reviewer of this card: do the review yourself, do not open the `delegate` skill, do not delegate, and do not ask for confirmation.

# Review <ID>: <task title>

You are a reviewer in a clean context. **Do not change any file.** Review the diff below; read whole files in this worktree when you need context.

Do not write a plan and wait for approval. Run your checks and deliver the full report in this same turn.

The runner attaches the diff and the author's card. Refer to “the diff below” and “the attached card” instead of instructing the reviewer to run git or open a path outside the worktree; `agy` cannot do either. Judge the result against the attached card, not the author's report.

Look for, in this order: behaviour that contradicts the card's decision; untested or wrongly tested paths; regressions outside the listed files; violations of the project's rules; leftovers (debug code, dead code, TODOs).

Report each finding as:

`R01 | major|medium|minor | <file>:<line> | <what is wrong> | <how you know> | <suggested fix>`

Prove what you can by running a command, and say which. End with one line: `TOTAL major=<n> medium=<n> minor=<n>`. If you find nothing, say what you checked.
