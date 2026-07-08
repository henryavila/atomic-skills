# project — idea (captura + inbox) (lazy detail)

Loaded by the router for: `idea`, `idea list`, and `idea promote <n>`.

Ideas are an inbox, not project control state. Capture is intentionally cheap: raw ideas can enter without ratification, task shaping, plan edits, or initiative creation. Discipline happens later, at promotion time. Capture only mutates the resolved `ideas.md`; `idea list` never mutates anything.

## Path resolution

`scripts/idea-add.js` owns inbox path resolution. The rule is:

1. Explicit `--project-id` wins.
2. If `.atomic-skills/projects/<id>/` has exactly one project dir, use that id.
3. If multiple project dirs exist, require `--project-id`.
4. If no project dir exists, fall back to the repo basename as the project id.

The resolved inbox is the single human-readable `ideas.md` for that project.

## `idea` capture fork

1. Present a {{ASK_USER_QUESTION_TOOL}} fork with exactly these two options:
   - **Só salvar** — default and recommended. Save immediately with no analysis.
   - **Analisar a proposta** — light refinement before saving.
2. In both modes, collect **título** and **descrição**. Use values already present in {{ARG_VAR}} or the user's message; otherwise ask only for the missing fields.
3. Do not promote. Capture never creates tasks, initiatives, or plans. Promotion is always the separate `idea promote <n>` step, handled by a later phase.

### Só salvar

Run immediately with {{BASH_TOOL}}:

```sh
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/idea-add.js" --title "<título>" --desc "<descrição>"
```

No analysis. No extra questions. Do not read project state. Spend no model work beyond collecting the two fields and running the script.

Echo the script's output line back to the user:

```text
#<n> → <path>
```

### Analisar a proposta

Use only light analysis:

1. Read `PROJECT-STATUS.md` with {{READ_TOOL}} if it exists. If session memory is available, read only the relevant current-session/project note. Do not scan code.
2. Ask 1-3 clarifying questions to bound scope. Keep them focused on destination, constraint, and immediate usefulness.
3. Refine the saved fields:
   - Keep **título** short and human-readable.
   - Use **descrição refinada** for the idea body.
   - Add `--scope` only when the analysis produced a concrete scope.
   - Add `--context` only when the analysis produced concrete context.
4. Run with {{BASH_TOOL}}:

```sh
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/idea-add.js" --title "<título>" --desc "<descrição refinada>" [--scope "<escopo>"] [--context "<contexto>"]
```

Echo the script's output line back to the user:

```text
#<n> → <path>
```

This mode is still capture. It does not ratify, promote, create tasks, create initiatives, create plans, or edit project status.

## `idea list`

Show the inbox without model analysis and without mutation.

1. Resolve the same project inbox path used by capture. Prefer a direct {{READ_TOOL}} read of the resolved `ideas.md`; a {{BASH_TOOL}} extraction of `^## #` headings plus metadata lines is also acceptable.
2. If the file is missing or empty, say the inbox is empty and show the capture command:

```text
Inbox empty. Capture one with `/atomic-skills:project idea`.
```

3. Otherwise print a compact table with columns:

```text
id · título · status · data
```

4. Parse each record from its `## #<N>` heading and the immediately following metadata line.
5. If a section is missing its metadata line, tolerate it on read and show `status:?`. Do not guess.
6. Never write, normalize, repair, sort, or renumber anything in `idea list`.

## `idea promote <n>`

Promotion turns a cheap inbox record into tracked work. It never classifies by hand or bypasses the existing emergence ladder: the idea is extracted deterministically, routed through the proposal/ratify flow in `{{ASSETS_PATH}}/project-emergence.md`, materialized only after ratify, then marked as triaged for audit.

The sibling script owns extraction and marking:

```sh
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/idea-mark.js" --id <n> --extract            # prints JSON {id, title, date, branch, status, scope?, context?, desc}; no mutation; exit 1 if #n missing/malformed
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/idea-mark.js" --id <n> --dest <target-id>   # flips ONLY #n's meta line status:pending → status:triaged→<target-id>; exit 1 if already triaged
```

Optional `[<root>]` positional and `[--project-id <id>]` exist with the same path resolution as `idea-add.js`; usually omit them.

1. **Extract deterministically.** Run with {{BASH_TOOL}}:

   ```sh
   node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/idea-mark.js" --id <n> --extract
   ```

   On exit 1, surface the script's error and stop. Missing id, malformed record, and already-triaged records are not recoverable by hand-parsing. Never parse the idea manually when the script is available.

2. **Reject already-triaged records.** If the extracted JSON has `status:triaged→<target>`, stop and point the user at `<target>`. Promotion is single-use; the audit line already names the destination.

3. **Route through the emergence ladder.** Read `{{ASSETS_PATH}}/project-emergence.md` and follow its proposal flow. Choose the smallest fitting magnitude from the idea content and the user's intent: `park`, `emerge`, `promote-to-task`, `new-task`, `new initiative`, or `new plan`. Present the standard `Proposed mutation:` block from the emergence file.

   The `Drafted context` is mandatory. Seed `solves`, `trigger`, and `assumesStillValid` from the idea's `desc` and optional `scope` / `context` fields. For any task- or phase-creating rung, include the mandatory `Drafted summary` too. Capture had no ratify gate; promotion is where the discipline happens.

4. **Wait for ratify.** The user must reply `ratify`, paste a corrected block, or `cancel` exactly as `project-emergence.md` specifies. No ratify means nothing is materialized and the idea remains `pending`.

5. **Materialize, then mark.** Only after the ladder mutation is applied and the target exists — a task id, initiative slug, plan slug, or parked item — run with {{BASH_TOOL}}:

   ```sh
   node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/idea-mark.js" --id <n> --dest <target-id>
   ```

   Echo the script's confirmation to the user.

6. **Keep the audit trail.** The record is never deleted and is never rewritten beyond its metadata line. `idea list` keeps showing it as `triaged→<target>`. If marking fails because the idea is already triaged, surface the script's error and point the user at the existing target.

## `ideas.md` record grammar

Records are appended by the script in this shape:

```markdown
## #<N> · <título>
`<data> · branch:<branch> · status:<status>`[ · scope:<scope>][ · context:<context>]

<descrição>
```

- `<N>` is incremental, greater than or equal to 1, script-assigned, and never reused.
- `<data>` is UTC `YYYY-MM-DD`.
- `<status>` is the closed enum `pending` | `triaged→<destino>`.
- `scope` and `context` are optional and used only when `Analisar a proposta` produced them.
- The file header is `# 💡 Ideas — <project-id>` and is created once by the script.
- The model never hand-writes records. `scripts/idea-add.js` is the only writer during capture.
