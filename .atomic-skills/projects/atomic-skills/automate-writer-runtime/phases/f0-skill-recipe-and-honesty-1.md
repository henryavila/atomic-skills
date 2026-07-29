---
schemaVersion: "0.1"
slug: automate-writer-runtime-f0-skill-recipe-and-honesty-1
title: Skill recipe and honesty (#1)
goal: Make Grok (and portable) phase-writer spawn instructions explicit;
  document guarantee limits honestly.
status: active
branch: plan/automate-writer-runtime
started: 2026-07-29T15:42:49.201Z
lastUpdated: 2026-07-29T15:43:53.678Z
nextAction: "Start T-001: Grok phase-writer spawn recipe in implement and maestro"
parentPlan: automate-writer-runtime
phaseId: F0
businessIntent:
  value: Operators running implement under automate get an explicit Grok/portable
    phase-writer spawn recipe and honest docs so the host does not treat
    explore-only or single-threaded coding as permission to edit product source.
  workflow: Edit implement.md, implement-automate-maestro.md,
    implement-phase-writer.md, implement-antipatterns.md, and
    automate-orchestrator-realism.md; verify with shell greps for
    general-purpose spawn and Layer 3 honesty.
  rules: No runner CLI or fence code in F0. No Layer 4 claims. Keep tool-name
    abstraction and ide conditionals. Do not enable concurrent phase writers.
  outOfScope: Layer 3 automate-phase-run CLI, product-source fence helpers, Mode 2
    Codex lane, Layer 4 daemon.
  doneWhen: Grok/portable phase-writer spawn recipe is greppable and
    realism/antipatterns state that prose alone does not force spawn while
    runner+fence are the hard close path.
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-F0-1
    description: Skill and docs name the Grok portable writer spawn path and honesty limits.
    status: pending
    verifier:
      kind: shell
      command: node -e "const fs=require('fs'); const
        p=['skills/core/implement.md','skills/shared/implement-automate-maestro.md','docs/kb/automate-orchestrator-realism.md'];
        for (const f of p){ if(!fs.existsSync(f)) process.exit(1);}
        console.log('ok')"
      expectExitCode: 0
stack:
  - id: 1
    title: Skill recipe and honesty (#1)
    type: task
    openedAt: 2026-07-29T15:42:49.201Z
tasks:
  - id: T-001
    title: Grok phase-writer spawn recipe in implement and maestro
    status: pending
    lastUpdated: 2026-07-29T15:42:49.201Z
    scopeBoundary:
      - Do not implement runner CLI or fence helpers. Do not invent plugin agent
        types beyond general-purpose explore plan. Do not enable concurrent
        phase writers.
    acceptance:
      - Grok block documents general-purpose phase-writer spawn with worktree or
        cwd and constructed brief.
      - Explore is reserved for heavy reads not phase coding.
      - Host product coding under isAutomateActive is listed as forbidden next
        to the spawn recipe.
      - Skill bodies keep tool abstraction via template vars or ide conditionals.
    verifier:
      kind: shell
      command: node -e "const fs=require('fs'); const
        a=fs.readFileSync('skills/core/implement.md','utf8'); const
        b=fs.readFileSync('skills/shared/implement-automate-maestro.md','utf8');
        const
        c=fs.readFileSync('skills/shared/implement-phase-writer.md','utf8');
        if(!/general-purpose/.test(a+b+c)) process.exit(1);
        if(!/spawn_subagent|INVESTIGATOR_TOOL|subagent/.test(a+b))
        process.exit(1); console.log('ok')"
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/shared/implement-phase-writer.md
    summary: Documentar spawn general-purpose no Step C (Grok) e banir host
      product-code sob automate.
    weight: 2
  - id: T-002
    title: Antipatterns and realism honesty for 1+A+B
    status: pending
    lastUpdated: 2026-07-29T15:42:49.201Z
    scopeBoundary:
      - Do not claim Layer 4 is shipped. Do not remove existing Layer 1-2.5
        documentation.
    acceptance:
      - Realism doc describes Layer 3 runner path and names
        scripts/automate-phase-run.js as the CLI entry once introduced.
      - Antipatterns include host product coding under automate and skipping the
        runner when automate stamp is set.
      - Guarantee language states fence blocks close not that spawn is
        process-forced.
    verifier:
      kind: shell
      command: node -e "const fs=require('fs'); const
        r=fs.readFileSync('docs/kb/automate-orchestrator-realism.md','utf8');
        if(!/Layer 3/.test(r)) process.exit(1); const
        a=fs.readFileSync('skills/shared/implement-antipatterns.md','utf8');
        if(!/Mode-1|product source|host/.test(a)) process.exit(1);
        console.log('ok')"
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/implement-antipatterns.md
      - kind: file
        path: docs/kb/automate-orchestrator-realism.md
    summary: "Atualizar antipatterns e realism: prosa ≠ garantia; runner+fence =
      caminho duro."
    weight: 1
parked: []
emerged: []
summary: Receita de spawn Grok/portátil e honestidade Layer 3 (sem runtime ainda).
---

# Narrative / notes

Initiative for phase **F0 — Skill recipe and honesty (#1)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
