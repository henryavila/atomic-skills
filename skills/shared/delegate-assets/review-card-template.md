# Review <ID>: <task title>

You are a reviewer in a clean context. **Do not change any file.** Review the diff `git diff <base>...HEAD` in this worktree; read whole files at HEAD when you need context.

Do not write a plan and wait for approval. Run your checks and deliver the full report in this same turn.

The task the author received: `<path to the task card>`. Judge the result against it, not the author's report.

Look for, in this order: behaviour that contradicts the card's decision; untested or wrongly tested paths; regressions outside the listed files; violations of the project's rules; leftovers (debug code, dead code, TODOs).

Report each finding as:

`R01 | major|medium|minor | <file>:<line> | <what is wrong> | <how you know> | <suggested fix>`

Prove what you can by running a command, and say which. End with one line: `TOTAL major=<n> medium=<n> minor=<n>`. If you find nothing, say what you checked.
