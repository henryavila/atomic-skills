# Debug techniques — a lazy reference asset

The shared debugging-technique reference for `skills/core/fix.md` (Phase 1 boundary instrumentation, Phase 2 root-cause tracing, Phase 3 defense-in-depth) and `skills/core/hunt.md` (condition-based waiting for time-sensitive tests). It is a **reference, not a runnable skill** — like `docs/kb/code-quality-gates.md` it is injected by reference, is not in `meta/catalog.yaml`, and carries no Iron Law of its own. The discipline (the 3-failed-fixes circuit-breaker, the no-fix-without-root-cause law) lives in `fix.md`; this file is the *how* those phases reach for.

Every technique here is language-neutral and uses tool-abstraction variables. Use the {{BASH_TOOL}} / {{READ_TOOL}} / {{GREP_TOOL}} forms, never a hard-coded tool name.

---

## 1. Root-cause tracing — follow the data to its origin

**The technique.** A symptom appears at a *site* (the line that threw, the wrong value a user saw); the *cause* is almost always upstream. Trace backward along the chain — the call stack, then the data's provenance — asking at each hop "is the value already wrong when it arrives here?" The cause is the **first** hop where the value is wrong; everything downstream is a propagated symptom. Fixing a downstream site (clamping the bad value, catching the exception) hides the cause and grows a second bug.

**How to trace:**
- Start at the symptom site; read the actual values (a debugger, a one-shot print, or {{GREP_TOOL}} for where the field is set). Do not infer from names (G1).
- Walk one hop upstream. Re-ask: wrong-on-arrival, or wrong-here? Wrong-on-arrival ⇒ keep walking. Wrong-here ⇒ you found the origin.
- For a value with no obvious caller (config, DB row, external input), trace its **provenance**: where was it written, by what, from what source. A "corrupt" value is often correct data the consumer misreads.

**Bisection — when the chain is long or the regression is recent.** Halve the search space instead of reading it linearly:
- In history: `git bisect start / bad / good <ref>` to find the introducing commit, then read that diff — it names the cause directly.
- In code: disable/short-circuit half the pipeline; the half that changes the symptom contains the cause. Repeat on that half.
- In input: shrink the failing input to the minimal reproducer (delete half, re-run; keep the half that still fails). A 3-line reproducer points at the cause far faster than the 3000-line original.

## 2. Boundary instrumentation — localize a cross-module bug before hypothesizing

**The technique (fix.md Phase 1, conditional).** When a bug spans ≥2 modules/components and you cannot yet say which side is wrong, **instrument the seams** before forming the next hypothesis. At each boundary the data crosses (function call, module API, network/IPC, serialization), capture the value entering and leaving. The boundary where input is correct but output is wrong is the module that owns the bug — now you have a localized target instead of a guess across the whole system.

**How to instrument:**
- Identify the boundaries on the path from input to symptom (list them explicitly — A→B→C→D).
- At each, log or assert the crossing value (one-shot prints, a temporary log line, or a debugger watch). Label each with its boundary so the trace reads as a sequence.
- Run the reproducer once. Read the trace: the first boundary where `in` is right and `out` is wrong is the culprit module. Narrow there.
- **Remove the instrumentation before committing** — it is scaffolding, not the fix. A left-in debug print is its own defect.

This is the antidote to the "guess which module, patch it, re-run, guess again" loop — it replaces N blind hypotheses with one evidence-localized target.

## 3. Defense-in-depth — once you know the cause, ask where else it lives

**The technique (fix.md Phase 3, after the root cause is fixed).** A confirmed root cause is a *class*, not an instance — the same mistake usually recurs wherever the same shape appears (defect clustering). After fixing the instance, ask: "what is the cheapest layer at which this whole class becomes impossible?" and add the guard there, not just at the one site.

**Where the guard goes (cheapest-enforceable layer wins):**
- **At the boundary** — validate/normalize untrusted input once, at the edge, so every downstream consumer is relieved of the check (a parse-don't-validate boundary).
- **At construction** — make the illegal state unrepresentable (a type/constructor that cannot hold the bad value) so the bug cannot be reintroduced.
- **At the invariant** — one assertion at the chokepoint every path flows through, rather than a scattered check at each call site.

**The discipline limit (G7, fix.md).** Defense-in-depth is *not* a license to refactor the module. Add the **one** guard at the **one** cheapest layer for the class you actually found; three independent sites with the same root cause is the floor before you abstract a shared guard. A speculative guard "for related cases" you did not observe is premature abstraction — skip it.

## 4. Condition-based waiting — never sleep-and-hope in a time-sensitive test

**The technique (hunt.md, time-sensitive/async tests).** A test that waits a fixed duration for an async result is flaky by construction: too short and it fails on a slow machine; too long and the suite crawls and it still fails under load. **Wait on the condition, not the clock.** Poll the actual predicate (the file exists, the row is written, the element rendered, the queue drained) up to a timeout, and proceed the instant it holds.

**How to wait correctly:**
- Identify the real post-condition you are waiting for — the observable fact that means "ready", not "probably ready by now".
- Poll that predicate on a short interval with a generous **upper-bound** timeout; succeed on first-true, fail with a clear message on timeout. The happy path is fast; only a real hang pays the full timeout.
- Never assert immediately after a fixed `sleep` — that is the flaky pattern this technique replaces. If the framework offers `waitFor`/`eventually`/`poll`, use it; otherwise wrap a predicate poll via {{BASH_TOOL}}.
- Make the timeout failure diagnostic: on timeout, capture *what the predicate saw* (the last value/state), so a real failure is debuggable and not just "timed out".

---

## How fix.md and hunt.md reach for this

- `fix.md` **Phase 1 (Observe)** → §2 boundary instrumentation when the symptom crosses modules, before forming hypotheses.
- `fix.md` **Phase 2 (Diagnose)** → §1 root-cause tracing + bisection to confirm the origin, not a symptom site.
- `fix.md` **Phase 3 (Fix)** → §3 defense-in-depth to close the class, bounded by G7.
- `hunt.md` **time-sensitive cases** → §4 condition-based waiting instead of fixed sleeps.

None of these techniques overrides the owning skill's gates — `fix.md`'s `NO FIX WITHOUT ROOT CAUSE` and the red-phase HARD-GATE still bind. This file only supplies the method each phase uses.
