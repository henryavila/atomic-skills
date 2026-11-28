You are the reviewer of this card: do the review yourself, do not open the `delegate` skill, do not delegate, and do not ask for confirmation.

# Review <ID>: <task title>

You are a reviewer in a clean context. **Do not change any file.** Review the diff below; read whole files in this worktree when you need context. Stay inside the working directory you were given: do not list or read other worktrees or parent folders.

Do not write a plan and wait for approval. Run your checks and deliver the full report in this same turn.

The diff and the author's card are attached below; judge the result against the attached card, not the author's report. Read whole files in this worktree when you need context. An `agy` reviewer can also read the policy's allowed directories and run the read-only git commands it is given (`git diff`, `git log`, `git show`, `git status`, `git rev-parse`); it cannot write files.

Look for, in this order: behaviour that contradicts the card's decision; untested or wrongly tested paths; regressions outside the listed files; violations of the project's rules; leftovers (debug code, dead code, TODOs).

If the diff touches documentation, verify each statement about behaviour (command, flag, default, file path, exit code) against the code. Also look for code or tests changed only to satisfy the card's own check — renamed fields, reworded output or a weakened assertion that serves the check instead of the behaviour.

For each finding, answer the questions of the severity rubric that the runner appends at the end of this prompt, one line per finding in its format, and end with its `FINDINGS` line (`FINDINGS 0` when you find nothing). Never write a severity: the runner computes it from your answers.

Prove what you can by running a command, and say which. For a change of behaviour, run the tests the author's card names before you answer. If you find nothing, say what you checked.
