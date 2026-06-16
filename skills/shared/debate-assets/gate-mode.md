# debate — gate-mode (`--gate`) lazy asset

Read only when `debate` is invoked with `--gate` (a debate feeding a lifecycle
stage gate, e.g. `atomic-skills:brainstorm`'s DESIGN gate). Without `--gate`, the
skill body is unchanged and this file is never read. The Iron Law (every voice a
separately-spawned subagent) holds in full — gate-mode adds rigor, not shortcuts.

## Gate-mode (`--gate`) — actor for a stage gate, never the judge

Gate-mode is an **opt-in** variant for when a debate feeds a lifecycle stage gate
(e.g. `atomic-skills:brainstorm`'s DESIGN gate). It is purely additive: without
`--gate`, everything above is unchanged. In gate-mode `debate` is the **ACTOR** —
it produces divergence and a structured record. **It does not decide.** A
separate fresh critic (`skills/shared/debate-assets/critic.md`) emits the binary
verdict; gate-pass is read from the critic, **never from panel agreement**. A
unanimous panel is not a pass — it can be a panel that conformed.

The Iron Law still holds in full: every voice is a separately-spawned subagent.
Gate-mode adds rigor, it does not add shortcuts.

What `--gate` changes:

1. **Bounded agenda.** Take the agenda from the `--gate` argument, or elicit it
   up front as a short list of decision questions, and announce it. Rounds stay
   on the agenda — gate-mode is not open chat. When every agenda item has been
   argued, the debate is ready to close.
2. **Mandatory contrarian every round.** Each round MUST include at least one
   voice spawned with an explicit contrarian framing — argue against the
   emerging consensus, surface the strongest objection. This is proactive every
   round, not the reactive "all agents agree → bring in a contrarian" of normal
   mode. Heterogeneity is required: pull voices from different domains, never the
   same two.
3. **Machine-readable Synthesis verdict block at close.** Instead of (or after)
   the prose Orchestrator Synthesis, emit this fenced block so the gate can parse
   one shape:

   ```yaml
   ready_for_validation: <yes | no>
   agenda:
     - <decision question 1>
   positions:
     - voice: <name>
       stance: <one line — the position this voice settled on>
   dissent:
     - voice: <name>
       objection: <one line — preserved, not smoothed over>
   open_questions:
     - <what the panel could not resolve, and what evidence would>
   ```

   `ready_for_validation: yes` means only that the divergence is exhausted and
   the artifact is ready to be **handed to the critic** — it is NOT an approval.
   `no` means a round is still owed (an agenda item unargued, or new dissent that
   reframes the decision).

**Handoff (R-SP-31).** Gate-mode's Orchestrator-Synthesis hands off to the critic
as the verdict authority: present the Synthesis verdict block + the artifact under
review to `skills/shared/debate-assets/critic.md`, which returns the binary
`Approved | Issues-Found`. Do not compute a pass here. Non-gate synthesis behavior
(the prose closing on demand or at exit) is unchanged.
