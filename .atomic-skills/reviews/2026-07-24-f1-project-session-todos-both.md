# F1 review-code --mode=both

Range: 3df6733a^..79983167 (helper+tests+archive fix)
Mode: both (local + codex)

## High (both legs)
- Empty focus returns `{merge:false,todos:[]}` — violates F0 no-wipe; tests lock it green.

## Medium (local/codex)
- Status: current before done|archived
- Initiative status ignored
- Rollup invent (0/0)
- Multi-archive nondeterminism

Disposition: fix high empty-focus merge before phase-done (fix agent #2 of 2).
