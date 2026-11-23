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

`feito` is the weight of `integrated` plus `validated` cards; `validado` is the weight of `validated` cards; `total` is the weight of every card. A percentage is rounded and reaches 100% only when every card counts. A milestone is `prontos` (integrated/validated card count), `bloqueados` and `rodando`. A zero-weight card still counts in `prontos`, `bloqueados` and `rodando`, and adds nothing to `feito` or `total`.

## The map

The map lives at `.atomic-skills/marcos.json` in the project's repository. The collector always reads it through `git show <ref>:.atomic-skills/marcos.json`, never from the working tree, so an uncommitted edit changes nothing.

```json
{
  "schemaVersion": 1,
  "id": "app-do-culto",
  "title": "App do Culto + Informativo",
  "unit": "cartões",
  "note": "optional caption",
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

- `schemaVersion` is `1`. `id`, `title`, `unit` and `milestones` are required; `note` is optional. `id` fields match `[A-Za-z0-9._-]{1,64}` and card ids are unique across the whole map.
- `size` is `P`, `M` or `G` and weighs 1, 2 and 4. A non-negative integer `weight` overrides the size; `0` is allowed for a card that counts as work but adds nothing. A card needs one of the two, and a map whose cards all weigh `0` is invalid.
- `deps` names cards in the same map and must not form a cycle. A card is `blocked` only while one of its deps is neither `integrated` nor `validated`.
- `match` replaces the card id in the merge-subject test when the branch or squash title says something else. It is a non-empty literal string or a non-empty array of them; a card counts as merged when any value is a case-insensitive substring of a merge subject, with no token boundaries. It is not a regular expression.
- No map value is a regular expression. The collector learns unknown-id prefixes from the map's own card ids: an id shaped like `AB-12` (one to eight letters, an optional hyphen, then a digit) contributes the `AB` prefix. It then scans each merge subject for one whole token with any of those prefixes (`AB-12`, `AB12a`, and so on, case-sensitive) and raises `card_desconhecido` only for a token that is in no card. The guard never reads `BCD-1` inside `ABCD-1`, and a map whose card ids teach no prefix produces no `card_desconhecido` alerts.
- `done` is optional evidence for integration that left no merge subject (a squash, a cherry-pick). `validated` is optional evidence of human or gate acceptance. Leave them empty when a machine can derive the state, and never invent them.
- Unknown keys are validation errors. Do not add fields "for later".

## Create the map from a plan

1. {{READ_TOOL}} the project plan, roadmap or milestone document. Group the work into milestones a person would recognize (a phase, a release slice, a deliverable), not one milestone per file or PR.
2. Give every planned card a stable id and put it under its milestone. Use the project's own card ids when it has them; sizes come from the plan or from relative effort.
3. Record `deps` only for real ordering constraints. A dependency that is merely "same milestone" is noise and makes cards falsely `blocked`.
4. Set `unit` to the noun the project counts (`cartões`, `tarefas`, `itens`) and add a one-line `note` when the number needs context.
5. Add `match` on the rare card whose merge title does not include its id. Unknown-id alerts need no extra field: the collector derives them from the card ids already in the map.
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

The registry is `~/.atomic-skills/progress/projects.json` (`$ATOMIC_SKILLS_HOME` when set). `add` validates the map at the ref and refuses a broken one; the ref is typically `origin/main`, the integration branch. It also stores the map's `id`, so a later failed ref still finds that project's previous rows and alerts under the same id; an older entry without a stored id falls back to the folder name. The stored id changes only through `add`: running `add` again on an already registered path updates its ref and stored id, and the duplicate-id check compares it with every other entry's stored id. When a map loads with an id different from the entry's stored id, `status` and `alertas.json` raise `id_mapa_mudou` until you run `add <repo>` again; the collector never rewrites the registry. A ref must start with a letter, digit, `.` or `_` and then contain only letters, digits, `.`, `_`, `-` or `/`, so it can never become a git option; an option-like ref is refused by `add`, and a bad entry already in the registry is ignored with a `registro_invalido` alert while the other projects keep working. `add` and `remove` keep such invalid entries with the same content when they save the registry. `status` computes each project's percentage, milestones and alerts live from the current map and refs and keeps no rows of its own; `--json` is for a script or another consumer.

Collect the panel files on demand or keep them fresh:

```bash
python3 {{ASSETS_PATH}}/progress.py collect --fetch --out ~/.aideck/consumers/painel/data
python3 {{ASSETS_PATH}}/progress.py watch --out ~/.aideck/consumers/painel/data --interval 2 --fetch-every 120
```

Only `collect` and `watch` write the panel files. `collect` writes `projetos.json`, `marcos.json`, `execucoes.json` and `alertas.json`, and rewrites a file only when its bytes changed. Each `marcos.json` row also carries the milestone `titulo` and a `legenda` (`<prontos> de <cards> prontos`, then ` · <n> bloqueado` or ` · <n> bloqueados`, then ` · <n> rodando`); rows kept from a previous file after a failure keep their old fields. `watch` repeats the collection when the telemetry log, the running directories or a project ref change, and at least every 60 seconds so `minutos` advances; it fetches at `--fetch-every` and keeps a project's last fetch failure in every cycle's alerts until a fetch for that project succeeds, dropping it when the project or its `origin/` ref leaves the registry. Active runs come only from `delegate.py status --json`; find it with `--delegate PATH`, `DELEGATE_PY`, beside `progress.py`, or in `../delegate-assets/delegate.py`.

## Install the macOS panel service

On macOS, `panel install` writes the panel consumer and loads two launchd agents; `panel uninstall` reverses it, and `panel status` reads the result:

```bash
python3 {{ASSETS_PATH}}/progress.py panel install --aideck /path/to/aiDeck/dist/cli.js --port 7777
python3 {{ASSETS_PATH}}/progress.py panel status [--json]
python3 {{ASSETS_PATH}}/progress.py panel uninstall
```

`install` requires `--aideck` to be an existing file and finds `node` and `git` on `PATH`; the port is 1024-65535 (default 7777). It creates `~/.aideck/consumers/painel/manifest.yaml` and `data/`, both plists (`com.atomic-skills.progress.watch` and `com.atomic-skills.progress.panel`) under `~/Library/LaunchAgents`, the state `~/.atomic-skills/progress/panel.json` and `~/.atomic-skills/progress/logs/`, then loads each plist with `launchctl bootstrap gui/<uid> <plist>`. The plists keep the panel on `127.0.0.1` (never `--expose`) and carry only `PATH`, plus `ATOMIC_SKILLS_HOME` when set, so no secret is copied. Running the same install again changes nothing and reloads nothing; new arguments boot the old labels out, rewrite and bootstrap. If a step fails midway, install undoes what that run created. A manifest or plist that already exists without a matching hash in the state, a missing `--aideck` file, a missing `node` or an invalid port is refused with exit 1 and no change. Outside macOS, all three commands exit 2 unless `PROGRESS_LAUNCHCTL` is set (tests only).

`uninstall` boots both labels out when loaded, deletes each recorded file only while its hash still matches (a changed file is reported and kept), removes only the four panel output files in `data/`, removes the state and then the empty directories the install created. A failed bootout keeps the state so a retry can finish. It never touches the project registry, other consumers, or `~/.aideck` itself. `status` is read-only and reports whether it is installed, the port and URL, each label's `launchctl print` state and the `projetos.json` modification time.

`add` and `remove` regenerate the manifest when the state exists and the file still matches its recorded hash, then update the hash; if you edited the manifest they leave it alone and warn on stderr.

## Alerts

`status` and `alertas.json` report:

| Type | Meaning |
|---|---|
| `mapa_invalido` | the map failed validation; the project stays listed with zeroes and this error |
| `card_desconhecido` | a merge subject on the ref contains a whole id-shaped token, using a prefix derived from the map's card ids, that is in no card |
| `marco_desconhecido` | an active or logged run of the project names a milestone not in the map |
| `registro_invalido` | `projects.json` is unreadable, or one entry is malformed or has an invalid ref; the other entries still work |
| `git_log_falhou` | `git log` (or resolving the ref) failed; the project keeps its previous `projetos`/`marcos` rows, or lists `feito: 0` when there are none |
| `erro_interno` | an unexpected error while computing one project; the other projects still collect |
| `id_duplicado` | two registered projects use the same map `id`; only the first is listed |
| `id_mapa_mudou` | the map at the ref now uses an id different from the entry's stored id; run `add <repo>` again |
| `fetch_falhou` | `--fetch` could not update the ref; `watch` repeats it until a fetch succeeds |
| `delegate_indisponivel` | `delegate.py status --json` is missing or failed; executions are empty |

Fix the map, the registry entry or the run's `--milestone`, then collect again. Do not silence an alert by deleting the evidence.

## What this skill does not do

- It does not write to a registered repository. `collect` only reads; `--fetch` and `watch` run `git -c gc.auto=0 -c maintenance.auto=false fetch --quiet --no-recurse-submodules --no-write-fetch-head origin -- <branch>` for an `origin/<branch>` ref and nothing else. The `--` keeps the branch from being read as an option; the fetch has no terminal prompt, and without `GIT_SSH_COMMAND`, `GIT_SSH` or a configured `core.sshCommand`, uses `ssh -o BatchMode=yes`. It runs in its own process group, so a stop or timeout kills the fetch and its children.
- It does not choose milestones, sizes or dependencies. That judgement belongs in the plan and the map.
- It does not accept a card for you. `validated` is human evidence, not a collector decision.
- It installs no dashboard and no foreground service: on macOS, `panel install` loads the two launchd agents and `panel uninstall` removes them (see above); `watch` itself stays a foreground process.
