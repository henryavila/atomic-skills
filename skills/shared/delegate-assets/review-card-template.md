You are the reviewer of this card: do the review yourself, do not open the `delegate` skill, do not delegate, and do not ask for confirmation.

# Review <ID>: <task title>

You are a reviewer in a clean context. **Do not change any file.** Review the diff below; read whole files in this worktree when you need context.

Do not write a plan and wait for approval. Run your checks and deliver the full report in this same turn.

The diff and the author's card are attached below; judge the result against the attached card, not the author's report. Read whole files in this worktree when you need context. An `agy` reviewer can also read the policy's allowed directories and run the read-only git commands it is given (`git diff`, `git log`, `git show`, `git status`, `git rev-parse`); it cannot write files.

Look for, in this order: behaviour that contradicts the card's decision; untested or wrongly tested paths; regressions outside the listed files; violations of the project's rules; leftovers (debug code, dead code, TODOs).

If the diff touches documentation, verify each statement about behaviour (command, flag, default, file path, exit code) against the code and report every contradicted statement as `major`. Also look for code or tests changed only to satisfy the card's own check — renamed fields, reworded output or a weakened assertion that serves the check instead of the behaviour.

Report each finding as:

`R01 | major|medium|minor | <file>:<line> | <what is wrong> | <how you know> | <suggested fix>`

Prove what you can by running a command, and say which. End with one line: `TOTAL major=<n> medium=<n> minor=<n>`. If you find nothing, say what you checked.
