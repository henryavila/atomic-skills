See one macro view of every project without asking anyone to mark a card done: a short milestone map committed in each repository supplies only what a machine cannot infer (milestones, card sizes, dependencies and human validation), while integration comes from merge commits and running work comes from the delegate runner. The collector derives every percentage. You never compute one by hand.

If {{ARG_VAR}} was provided, treat it as the project or task in scope (a repository path, a milestone id, or a card list). If not, ask which project the user wants to map or read.

## Iron Law

NO PERCENTAGE WITHOUT A COMMITTED MAP AND GIT EVIDENCE.

A number that was typed, estimated, copied from a plan, or counted from a checklist is not progress. Progress is `feito`/`total` computed by `{{ASSETS_PATH}}/progress.py` from the map read with `git show <ref>:.atomic-skills/marcos.json`, the merge subjects on that ref, and the delegate runner's `status --json`. If the map is wrong, fix the map; never touch the percentage.

<HARD-GATE>
About to write "50%" or "done" into a report, plan, dashboard or message by hand? STOP — run the collector and quote its output.
About to start a card that is not in the project's `.atomic-skills/marcos.json`? STOP — add the card and commit the map first, then run the card with `--milestone`.
About to mark a card `validated` without a human gate behind it? STOP — `validated` is evidence, not a mood; leave it empty.
</HARD-GATE>

## What the collector derives

For each card, the first matching state wins:

| State | Evidence |
|---|---|
| `validated` | non-empty `validated` in the map (a human or gate accepted it) |
| `integrated` | non-empty `done`, or a card id as a whole token (or a literal `match` as a substring) in a merge subject on the ref |
| `running` | an active delegate run of this repository whose task id contains the card id as a whole token |
| `blocked` | a dependency is neither `integrated` nor `validated` |
| `ready` | anything else |

`feito` is the weight of `integrated` plus `validated` cards; `validado` is the weight of `validated` cards; `total` is every card. A percentage is rounded and reaches 100% only when every card counts. A milestone is `prontos` (integrated/validated card count), `bloqueados` and `rodando`.

## The map

The map lives at `.atomic-skills/marcos.json` in the project's repository. The collector always reads it through `git show <ref>:.atomic-skills/marcos.json`, never from the working tree, so an uncommitted edit changes nothing.

```json
{
  "schemaVersion": 1,
  "id": "app-do-culto",
  "title": "App do Culto + Informativo",
  "unit": "cartões",
  "note": "optional caption",
  "idPattern": "[A-Z]{1,3}-\\d+[a-z]?",
  "milestones": [
    {
      "id": "fundacao",
      "title": "Fundação",
      "cards": [
        {"id": "F-00", "size": "P", "done": "merged in 1a2b3c4"},
        {"id": "F-01", "size": "M", "deps": ["F-00"]},
        {"id": "F-02", "size": "G", "match": "feature two", "weight": 5},
        {"id": "F-03", "weight": 3, "done": "squashed in 4f2a1c9"},
        {"id": "F-04", "size": "P", "validated": "gate 2026-03-02"}
      ]
    }
  ]
}
```

- `schemaVersion` is `1`. `id`, `title`, `unit` and `milestones` are required; `note` and `idPattern` are optional. `id` fields match `[A-Za-z0-9._-]{1,64}` and card ids are unique across the whole map.
- `size` is `P`, `M` or `G` and weighs 1, 2 and 4. A positive integer `weight` overrides the size. A card needs one of the two.
- `deps` names cards in the same map and must not form a cycle. A card is `blocked` only while one of its deps is neither `integrated` nor `validated`.
- `match` replaces the card id in the merge-subject test when the branch or squash title says something else. It is a non-empty literal string or a non-empty array of them; a card counts as merged when any value is a case-insensitive substring of a merge subject, with no token boundaries. It is not a regular expression.
- `idPattern` is optional. When present it is a compiled regular expression of at most 64 characters that must not contain `(`, `)`, `|` or any backslash escape other than `\d`, and it must not match the empty string. The collector alerts on an id-shaped token in no card, using the same whole-token guard as a card id, so `ABCD-1` never produces `BCD-1`; a token that is a known card id is not an alert.
- `done` is optional evidence for integration that left no merge subject (a squash, a cherry-pick). `validated` is optional evidence of human or gate acceptance. Leave them empty when a machine can derive the state, and never invent them.
- Unknown keys are validation errors. Do not add fields "for later".

## Create the map from a plan

1. {{READ_TOOL}} the project plan, roadmap or milestone document. Group the work into milestones a person would recognize (a phase, a release slice, a deliverable), not one milestone per file or PR.
2. Give every planned card a stable id and put it under its milestone. Use the project's own card ids when it has them; sizes come from the plan or from relative effort.
3. Record `deps` only for real ordering constraints. A dependency that is merely "same milestone" is noise and makes cards falsely `blocked`.
4. Set `unit` to the noun the project counts (`cartões`, `tarefas`, `itens`) and add a one-line `note` when the number needs context.
5. Set `idPattern` when merge subjects carry card ids; add `match` on the rare card whose merge title does not include its id.
6. Validate and commit before registering. The map is only real on the integration ref:

```bash
python3 {{ASSETS_PATH}}/progress.py validate <repo> --ref origin/main
git -C <repo> add .atomic-skills/marcos.json
git -C <repo> commit -m "docs(progress): add the milestone map"
```

Use {{BASH_TOOL}} for the commands. A broken map is refused by `add`; `validate` prints every problem with its JSON path and exits 1. `add` also refuses a second project whose map uses the same `id`.

## Keep it current at the end of each batch

1. Before a card starts, add it to the map with its milestone, size and deps, commit the map on the integration ref, then run the card with `--milestone <id>`. A card that a run works on but the map does not contain is invisible in every number.
2. At the end of the batch, integrate the branch. A merge subject that contains the card id as a whole token (or a literal `match` value) is what marks it `integrated`; do not set `done` as well.
3. Set `validated` only after the human or gate acceptance actually happened, with enough evidence for a reader to find it.
4. If a card was squashed or cherry-picked without a merge subject, set `done` to the commit or PR evidence. Never set `done` to "yes" or "done".
5. Re-run `validate`, commit the map on the integration ref, then read the status. Do not recompute or adjust a percentage by hand.

## Register and read

```bash
python3 {{ASSETS_PATH}}/progress.py add <repo> --ref origin/main
python3 {{ASSETS_PATH}}/progress.py list
python3 {{ASSETS_PATH}}/progress.py remove <repo>
python3 {{ASSETS_PATH}}/progress.py status
python3 {{ASSETS_PATH}}/progress.py status --json
```

The registry is `~/.atomic-skills/progress/projects.json` (`$ATOMIC_SKILLS_HOME` when set). `add` validates the map at the ref and refuses a broken one; the ref is typically `origin/main`, the integration branch. A ref must start with a letter, digit, `.` or `_` and then contain only letters, digits, `.`, `_`, `-` or `/`, so it can never become a git option; an option-like ref is refused by `add`, and a bad entry already in the registry is ignored with a `registro_invalido` alert while the other projects keep working. `status` prints each project's percentage, milestones and alerts; `--json` is for a script or another consumer.

Collect the panel files on demand or keep them fresh:

```bash
python3 {{ASSETS_PATH}}/progress.py collect --fetch --out ~/.aideck/consumers/painel/data
python3 {{ASSETS_PATH}}/progress.py watch --out ~/.aideck/consumers/painel/data --interval 2 --fetch-every 120
```

Only `collect` and `watch` write the panel files. `collect` writes `projetos.json`, `marcos.json`, `execucoes.json` and `alertas.json`, and rewrites a file only when its bytes changed. `watch` repeats the collection when the telemetry log, the running directories or a project ref change, and at least every 60 seconds so `minutos` advances; it fetches at `--fetch-every` and keeps a project's last fetch failure in every cycle's alerts until a fetch for that project succeeds. Active runs come only from `delegate.py status --json`; find it with `--delegate PATH`, `DELEGATE_PY`, beside `progress.py`, or in `../delegate-assets/delegate.py`.

## Alerts

`status` and `alertas.json` report:

| Type | Meaning |
|---|---|
| `mapa_invalido` | the map failed validation; the project stays listed with zeroes and this error |
| `card_desconhecido` | a merge subject on the ref contains an `idPattern` token that is in no card |
| `marco_desconhecido` | an active or logged run of the project names a milestone not in the map |
| `registro_invalido` | `projects.json` is unreadable, or one entry is malformed or has an invalid ref; the other entries still work |
| `git_log_falhou` | `git log` (or resolving the ref) failed; the project keeps its previous `projetos`/`marcos` rows, or lists `feito: 0` when there are none |
| `erro_interno` | an unexpected error while computing one project; the other projects still collect |
| `id_duplicado` | two registered projects use the same map `id`; only the first is listed |
| `fetch_falhou` | `--fetch` could not update the ref; `watch` repeats it until a fetch succeeds |
| `delegate_indisponivel` | `delegate.py status --json` is missing or failed; executions are empty |

Fix the map, the registry entry or the run's `--milestone`, then collect again. Do not silence an alert by deleting the evidence.

## What this skill does not do

- It does not write to a registered repository. `collect` only reads; `--fetch` and `watch` run `git -c gc.auto=0 -c maintenance.auto=false fetch --quiet --no-recurse-submodules --no-write-fetch-head origin -- <branch>` for an `origin/<branch>` ref and nothing else. The `--` keeps the branch from being read as an option, and the fetch has no terminal prompt.
- It does not choose milestones, sizes or dependencies. That judgement belongs in the plan and the map.
- It does not accept a card for you. `validated` is human evidence, not a collector decision.
- It does not install a service or a dashboard. `watch` is a foreground process; the panel consumes the files.
