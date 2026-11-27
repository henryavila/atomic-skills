# Severity rubric

You do not choose a severity. You answer six questions about each finding, with
one word from a closed list, and the runner computes the severity from your
answers. Two reviewers who see the same defect must give the same answers, so
answer only what you observed. When two answers seem to fit, take the one that
comes first in the list.

## The six answers

Answer them in this order for every finding.

### 1. `origin` — `diff` or `base`

- `diff`: the defect is in lines the diff added or changed, or the diff makes
  old code reachable in a new way, or the card asked for this defect to be
  fixed and it was not.
- `base`: the defective lines are the same as before the diff, the diff does
  not call them in a new way, and the card did not ask to fix them.

A `base` finding is listed and is not counted.

### 2. `dup` — `none` or the id of another finding

Give the id of another finding when this one has the same root cause: fixing
that one fixes this one. A documentation line that only describes the wrong
behaviour another finding already reports is a `dup` of it. Otherwise `none`.

### 3. `card` — `none` or a quote

Quote, in at most 15 words copied from the card, the requirement that is not
delivered. Use it only when the card states the requirement: a numbered item, a
rule under "What does not change", a case the card names, a line of "How to
check". A requirement you infer from the goal of the card is `none`. A file
touched outside the card's list counts only when the card says "only" or
"do not" about it.

### 4. `kind` — the first of these that applies

| `kind` | The finding is that… |
|---|---|
| `access` | someone can reach, read or keep something they are not allowed to |
| `data` | stored or transmitted data is lost, corrupted, duplicated or written where it should not be |
| `behaviour` | product code or the gate gives a wrong output, crashes, hangs, or returns a wrong exit code or verdict |
| `test-void` | a test that exists cannot fail for what its name or the card says it proves, or an assertion was removed, skipped or loosened |
| `test-gap` | the behaviour works and no test covers it |
| `doc-false` | documentation, help text, a comment or an agent rule states a command, flag, default, path, exit code or rule, and the code does something else |
| `doc-loose` | documentation is incomplete, vague or out of date, and states nothing false |
| `upkeep` | the code works and costs more to maintain: duplication, dead code, a function that is hard to follow, a misleading name |
| `style` | naming, formatting or wording you would have chosen differently |

A swallowed error is `behaviour`. A missing guard with no way to trigger it
today is `upkeep`. A test whose name promises more than it asserts is
`test-void` only when you show a change to the product code that should break
it and does not; without that it is `test-gap`.

### 5. `reach` — `normal`, `rare`, `error`, `none` or `-`

Only for `access`, `data` and `behaviour`. Every other `kind` takes `-`.

- `normal`: it happens with input or a sequence that a user, a caller or the
  gate produces in ordinary use, or in a case the card names.
- `rare`: it needs unusual input, a race, an exact sequence of steps, or the
  failure of something else first.
- `error`: it happens only while the code is already handling an error (a wrong
  message, a missed cleanup after a failure).
- `none`: nothing calls or reads the defective code today, or it is reached
  only through configuration the team writes itself.

### 6. `proof` — `ran`, `traced` or `none`

- `ran`: you ran a command and you quote the command and the result that shows
  the defect.
- `traced`: you did not run it, and you give the path step by step, with a
  `file:line` for each step.
- `none`: anything else, including "may", "could", "probably" and "I did not
  confirm".

## How the severity is computed

The runner applies the first row that matches.

| Answers | Result |
|---|---|
| `origin=base` | pre-existing, not counted |
| `dup` is another finding | merged into it, not counted |
| `proof=none` and the row below gives `major` | `medium` |
| `card` is a quote | `major` |
| `access` or `data`, `reach` is `normal`, `rare` or `error` | `major` |
| `access` or `data`, `reach=none` | `medium` |
| `behaviour`, `reach=normal` | `major` |
| `behaviour`, `reach=rare` or `reach=error` | `medium` |
| `behaviour`, `reach=none` | `minor` |
| `test-void` | `major` |
| `doc-false` | `major` |
| `test-gap` or `upkeep` | `medium` |
| `doc-loose` or `style` | `minor` |

The size of the fix, how unusual the input is and how many findings you already
have do not change an answer.

## Output

One line per finding, fields separated by ` | `, in this order:

```text
F01 | <file>:<line> | origin=diff | dup=none | card=none | kind=behaviour | reach=normal | proof=ran | <what is wrong, one sentence> | <proof: the command and its result, or the trace>
```

Do not write `major`, `medium` or `minor` anywhere. End with the line
`FINDINGS <number of finding lines>`.
