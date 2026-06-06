---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The unification leaves several installed surfaces pointing at commands or asset paths that no longer exist. The most serious issue is first-time setup: the new lazy setup file tells the agent to copy hook scripts from `_assets/hooks/`, but the installer still copies only top-level asset files and explicitly skips directories, so Soft/Strict setup cannot install the enforcement hooks.

Static review also found stale installed templates that still instruct users to run `project-status` / `project-plan`, plus a catalog shape that renders the new nested `status verify` command as an invalid `status-verify status verify ...` command in generated help. Test execution was attempted, but this read-only sandbox denied `mkdtemp` under `/tmp`, so the review is based on file inspection.

## Findings

### F-001 [major] wiring — src/install.js:273-279

**Evidence:**
```js
        for (const f of assetFiles) {
          if (!f.isFile()) continue;
          const sourceFile = join(assetsSourceDir, f.name);
          const raw = readFileSync(sourceFile, 'utf8');
          const rendered = renderTemplate(raw, vars, moduleFlags, ideId);
          const destFile = join(destBase, f.name);
          writeFileSync(destFile, rendered, 'utf8');
```

**Claim:** The installer skips the nested `project-assets/hooks/` directory, but `project-setup.md` instructs Soft/Strict setup to copy `session-start.sh`, `stop.sh`, and `pre-write.sh` from `{{ASSETS_PATH}}/hooks/`.

**Impact:** Fresh installs render a setup flow that cannot find the hook scripts it tells the agent to install, so SessionStart, Stop, and PreToolUse enforcement silently fail at the first-time setup path.

**Recommendation:** Either recursively copy asset subdirectories into `_assets/` and add an install test asserting `_assets/hooks/{session-start.sh,stop.sh,pre-write.sh,config.json}` exists, or flatten those hook files into `project-assets/` and update `project-setup.md` to reference the actual installed paths.

**Confidence:** high

---

### F-002 [major] stale-command — skills/shared/project-assets/CLAUDE.md-gate.template.md:30

**Evidence:**
```md
Invoke `atomic-skills:project-status` to view status at any time. Hooks will also auto-inject context at SessionStart.
```

**Claim:** The installed CLAUDE hard-gate still tells agents to invoke the deleted `project-status` skill.

**Impact:** Repos initialized after this change receive persistent agent instructions that point to a command the installer no longer ships, breaking the status-view escape hatch in the code-write hard gate.

**Recommendation:** Replace this with the new command, e.g. `atomic-skills:project` for the compact summary or `atomic-skills:project status` for the full status view, and add a test that installed project templates contain no `atomic-skills:project-status` or `atomic-skills:project-plan` command references except the aiDeck domain contract.

**Confidence:** high

---

### F-003 [major] stale-command — skills/shared/project-assets/PROJECT-STATUS.md.template.md:23-25

**Evidence:**
```md
_(none yet — run `atomic-skills:project-plan <slug>` to bootstrap interactively,
`atomic-skills:project-plan adopt <plan-file.md>` to capture an existing plan,
or `atomic-skills:project-plan discover` to scan repo for in-flight work)_
```

**Claim:** The fresh `.atomic-skills/PROJECT-STATUS.md` template still directs users to the removed `project-plan` skill.

**Impact:** First-time setup creates the canonical status index with invalid bootstrap/adopt/discover commands, so an empty project immediately sends users down a dead path for creating their first plan.

**Recommendation:** Update the template to `atomic-skills:project new plan <slug>`, `atomic-skills:project adopt <plan-file.md>`, and `atomic-skills:project discover`, then add the same no-old-command assertion for this template.

**Confidence:** high

---

### F-004 [minor] catalog — meta/catalog.yaml:284-288

**Evidence:**
```yaml
      - name: status-verify
        group: 'View'
        signature: 'status verify [--fix] [--slug <slug>]'
        description: 'Reconcile .atomic-skills/ against the repo: schema, branch match, scope coverage, orphans, aiDeck coherence (read-only unless --fix)'
        example: '/atomic-skills:project status verify'
```

**Claim:** The catalog encodes `status verify` as a synthetic `status-verify` subcommand while also putting `status verify` in the signature, which renders as `status-verify status verify [--fix] [--slug <slug>]` in `docs/skills/project.md`.

**Impact:** Generated reference docs and dashboard help expose an invalid command for the new verify workflow, reducing discoverability of the one new reconciliation command added by the unification.

**Recommendation:** Add a catalog/rendering representation for nested subcommands that renders the exact command string `status verify [--fix] [--slug <slug>]`, then regenerate `docs/skills/project.md` and `src/dashboard/data/skills.generated.ts`.

**Confidence:** high

## Questions (non-findings)

- None.

## Out of scope

- Existing aiDeck and schema references that intentionally keep the `project-status` state-domain string.
---
## Consolidated (mode=both) — operator notes

LOCAL pass (clean-context agent): 0 blocker/critical/major, 2 minor.
- m1 src/scope-drift.js:3 stale comment → FIXED.
- m2 catalog version_added 1.5.0 (lineage) → left as author decision.

CODEX pass (gpt-5-codex, blind): 0B/0C/3M/1m. Verified each against files (codex ran static-only).
- F-001 install.js skips hooks subdir vs project-setup.md {{ASSETS_PATH}}/hooks → FIXED (recursive asset copy + install.test counts 42/43/83/47→47/48/93/47 + 32-entry assert + hooks-exist guard).
- F-002 CLAUDE.md-gate.template:30 stale project-status → FIXED.
- F-003 PROJECT-STATUS.md.template:11,23-25 stale project-plan → FIXED.
- F-004 status-verify double-render → FIXED by promoting `status verify` → top-level `verify` (per user decision): catalog/router/project-verify/CHANGELOG + regen.

Post-fix gate: npm test 539/539 pass; validate-catalog exit 0.
