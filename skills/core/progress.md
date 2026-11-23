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

`feito` is the weight of `integrated` plus `validated` cards; `validado` is the weight of `validated` cards; `total` is the weight of every card. A percentage is rounded; 100% means every *weighted* card counts, so a zero-weight card can still be pending while the project reads 100%. A milestone whose cards all weigh `0` (`total == 0`) reports `pct` 100 when every card is ready-counted (`prontos == cards`) and `0` otherwise, with `resumo` `sem peso · <prontos> de <cards> prontos`; a milestone with no cards has `total` 0, `pct` 0 and `resumo` `sem cartões`. A milestone is `prontos` (integrated/validated card count), `bloqueados` and `rodando`. A zero-weight card still counts in `prontos`, `bloqueados` and `rodando`, and adds nothing to `feito` or `total`.

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
- No map value is a regular expression. The collector learns unknown-id prefixes from the map's own card ids: an id shaped like `AB-12` (one to eight letters, an optional hyphen, then a digit) contributes the prefix exactly as written (`AB-`; `S3` contributes `S`). It then scans each merge subject for one whole token built from those escaped prefixes and digits (`AB-12`, `S3a`, and so on, case-sensitive) and raises `card_desconhecido` only for a token that is in no card. A hyphenated card id matches a merge subject as a whole token case-insensitively, so `app-desktop/d-03` marks `D-03`; an id without a hyphen stays case-sensitive, so prose such as `backup no s3` never marks `S3`. A token ends at any character other than a letter, digit, `_` or `-`: `feat/F-01` marks `F-01`, `feat/F-01-login` does not. The guard never reads `BCD-1` inside `ABCD-1`, and a map whose card ids teach no prefix produces no `card_desconhecido` alerts.
- `done` is optional evidence for integration that left no merge subject (a squash, a cherry-pick). `validated` is optional evidence of human or gate acceptance. Leave them empty when a machine can derive the state, and never invent them.
- Unknown keys are validation errors. Do not add fields "for later".

## Create the map from a plan

1. {{READ_TOOL}} the project plan, roadmap or milestone document. Group the work into milestones a person would recognize (a phase, a release slice, a deliverable), not one milestone per file or PR.
2. Give every planned card a stable id and put it under its milestone. Use the project's own card ids when it has them; sizes come from the plan or from relative effort.
3. Record `deps` only for real ordering constraints. A dependency that is merely "same milestone" is noise and makes cards falsely `blocked`.
4. Set `unit` to the noun the project counts (`cartões`, `tarefas`, `itens`) and add a one-line `note` when the number needs context.
5. Add `match` when the merge title does not carry the id as a whole token, for example a slugged branch. Unknown-id alerts need no extra field: the collector derives them from the card ids already in the map.
6. Commit, validate, integrate and validate again before registering. `validate` reads the map from git, and the map is only real on the integration ref:

```bash
git -C <repo> add .atomic-skills/marcos.json
git -C <repo> commit -m "docs(progress): add the milestone map"
python3 {{ASSETS_PATH}}/progress.py validate <repo> --ref HEAD
# merge or push that commit to the integration branch, then:
git -C <repo> fetch origin main
python3 {{ASSETS_PATH}}/progress.py validate <repo> --ref origin/main
```

Use {{BASH_TOOL}} for the commands. A broken map is refused by `add`; `validate` prints every problem with its JSON path and exits 1. `add` also refuses a second project whose map uses the same `id`.

## Keep it current at the end of each batch

1. Before a card starts, add it to the map with its milestone, size and deps, commit the map on the integration ref, then run the card with `--milestone <id>`. A card that a run works on but the map does not contain is invisible in every number.
2. At the end of the batch, integrate the branch. A merge subject that contains the card id as a whole token (or a literal `match` value) is what marks it `integrated`; do not set `done` as well.
3. Set `validated` only after the human or gate acceptance actually happened, with enough evidence for a reader to find it.
4. If a card was squashed or cherry-picked without a merge subject, set `done` to the commit or PR evidence. Never set `done` to "yes" or "done".
5. Commit the map, run `validate --ref HEAD`, integrate it, fetch, validate the integration ref, then read the status. Do not recompute or adjust a percentage by hand.

## Register and read

```bash
python3 {{ASSETS_PATH}}/progress.py add <repo> --ref origin/main
python3 {{ASSETS_PATH}}/progress.py list
python3 {{ASSETS_PATH}}/progress.py remove <repo>
python3 {{ASSETS_PATH}}/progress.py status
python3 {{ASSETS_PATH}}/progress.py status --json
```

The registry is `~/.atomic-skills/progress/projects.json` (`$ATOMIC_SKILLS_HOME` when set). `add` validates the map at the ref and refuses a broken one; the ref is typically `origin/main`, the integration branch. It also stores the map's `id`, so a later failed ref still finds that project's previous rows and alerts under the same id; an older entry without a stored id falls back to the folder name. The stored id changes only through `add`: running `add` again on an already registered path updates its ref and stored id, and the duplicate-id check compares it with every other entry's stored id and, for an older entry with none, with the id its live map loads. When a map loads with an id different from the entry's stored id, `status` and `alertas.json` raise `id_mapa_mudou` until you run `add <shell-quoted path> --ref <stored ref>` again; the collector never rewrites the registry. A ref must start with a letter, digit, `.` or `_` and then contain only letters, digits, `.`, `_`, `-` or `/`, so it can never become a git option; an option-like ref is refused by `add`, and a bad entry already in the registry is ignored with a `registro_invalido` alert while the other projects keep working. `add` and `remove` keep such invalid entries with the same content when they save the registry. `status` computes each project's percentage, milestones and alerts live from the current map and refs and keeps no rows of its own; `--json` is for a script or another consumer.

Collect the panel files on demand or keep them fresh:

```bash
python3 {{ASSETS_PATH}}/progress.py collect --fetch --out ~/.aideck/consumers/painel/data
python3 {{ASSETS_PATH}}/progress.py watch --out ~/.aideck/consumers/painel/data --interval 2 --fetch-every 120
```

Only `collect` and `watch` write the panel files. `collect` writes `projetos.json`, `marcos.json`, `execucoes.json` and `alertas.json`, and rewrites a file only when its bytes changed. Each `marcos.json` row also carries the milestone `titulo` and a `legenda` (`<prontos> de <cards> prontos`, then ` · <n> bloqueado` or ` · <n> bloqueados`, then ` · <n> rodando`); rows kept from a previous file after a failure keep their old fields, except that a missing `titulo` is filled from `marco` and a missing `legenda` with an empty string. `watch` repeats the collection when the telemetry log, the running directories, the registry or a project ref change, and at least every 60 seconds so `minutos` advances; it takes that signature before each collection, so a change made while one runs triggers one more collection instead of waiting for the 60-second pass, and a signature that cannot be computed keeps the previous one without stopping the loop. It fetches at `--fetch-every` and keeps a project's last fetch failure in every cycle's alerts until a fetch for that project succeeds, dropping it when the project or its `origin/` ref leaves the registry. Active runs come only from `delegate.py status --json`; find it with `--delegate PATH`, `DELEGATE_PY`, beside `progress.py`, or in `../delegate-assets/delegate.py`.

## Install the macOS panel service

On macOS, `panel install` writes the panel consumer and loads two launchd agents; `panel uninstall` reverses it, and `panel status` reads the result:

```bash
python3 {{ASSETS_PATH}}/progress.py panel install --aideck /path/to/aiDeck/dist/cli.js --port 7777
python3 {{ASSETS_PATH}}/progress.py panel status [--json]
python3 {{ASSETS_PATH}}/progress.py panel uninstall
```

`install` requires `--aideck` to be an existing file and finds `node` and `git` on `PATH`; the port is 1024-65535 (default 7777). `--aideck` must point at a built aiDeck: `client/index.html` must exist in the `client/` directory beside `cli.js` (build it with `npm run build`), otherwise install exits 1 before changing anything. The panel service runs `node <cli.js> serve --port=<port> --static-dir=<directory of cli.js>/client`, so the installed panel serves its page as well as its API. It creates `~/.aideck/consumers/painel/manifest.yaml` and `data/`, both plists (`com.atomic-skills.progress.watch` and `com.atomic-skills.progress.panel`) under `~/Library/LaunchAgents`, the state `~/.atomic-skills/progress/panel.json` and `~/.atomic-skills/progress/logs/`, then loads each plist with `launchctl bootstrap gui/<uid> <plist>`. The plists keep the panel on `127.0.0.1` (never `--expose`) and carry only `PATH`, plus `ATOMIC_SKILLS_HOME` when set, so no secret is copied; `PATH` uses the directory of each unresolved executable, and the watch plist gets an absolute `--delegate` only when the file exists. The manifest is regenerated from the maps' live titles, units and ids, so a changed map title changes the manifest. When nothing changed, running the same install again changes no file: it checks each label and bootstraps only one that is down. New arguments boot the old labels out, rewrite and bootstrap. Before it stops anything, install reads the prior files and state; an unreadable one exits 1 with a message and the old service still running. If a step fails midway, install undoes what that run created, restores the old files and state, and bootstraps again the labels that were loaded before the run; if that fails it names the labels still down and prints the `launchctl bootstrap` command to load them. If booting out a label this run bootstrapped fails during that rollback, install stops undoing: it leaves every file on disk, writes a state that matches them, prints both the original failure and the bootout failure, names each label still loaded with the exact `launchctl bootout gui/<uid>/<label>` command, then names each label that was loaded before the run and is not loaded now with its `launchctl bootstrap gui/<uid> <plist>` command (printed only, never run), says that `panel uninstall` can be run afterwards, and exits 1. A partly successful bootout of the old labels also names the label left down. A manifest or plist that already exists without a matching hash in the state, a symlink at the manifest, a plist, the consumer, `data/`, `progress/`, `progress/logs/` or an output file, a missing `--aideck` file or one whose `client/index.html` is missing, a missing `node`, an invalid port, an output file already in `data/` on a first install, or a label already loaded on a first install is refused with exit 1 and no change. Install never adopts output files it did not create: it names the file, asks you to move it away and run install again, and the watch service recreates it. On a new machine, run `panel install` before any manual `collect` into the panel's `data/`. The shared roots `~/.aideck`, `~/.aideck/consumers`, `~/.atomic-skills` and `~/Library/LaunchAgents` may themselves be symlinks, for example when a user keeps them on another disk; only the final panel paths above are refused. Outside macOS, all three commands exit 2 unless `PROGRESS_LAUNCHCTL` is set (tests only).

`uninstall` validates the recorded state before changing anything (only the three recorded files and the four expected directories are accepted) and refuses a symlink at the manifest, a plist, the consumer, `data/`, `progress/`, `progress/logs/` or an output file, while the shared roots may be symlinks as described above. It boots both labels out when loaded, deletes the two `<label>.log` files named in the plists, deletes each recorded file only while its hash still matches (a changed file is reported and kept), and removes the four panel output files only when `data/` is in the state's created directories. It then removes the state and the empty directories the install created, reporting any directory it cannot remove and why. Because a failed rollback leaves the state matching the files on disk, `uninstall` finishes that install. It never removes the shared roots `~/.aideck`, `~/.aideck/consumers`, `~/.atomic-skills`, `~/Library` or `~/Library/LaunchAgents`, and does not record them as created. A `launchctl print` that fails for any reason other than exit 113 or `Could not find service` stops the uninstall with the state kept. `status` is read-only and reports whether it is installed, the port and URL, each label's `launchctl print` state and the `projetos.json` modification time; a print failure is printed without a traceback.

Run `panel uninstall` before uninstalling Atomic Skills. If the package is already gone, run `launchctl bootout gui/<uid>/com.atomic-skills.progress.watch` and the same for `.panel`, then delete both plists from `~/Library/LaunchAgents`.

`add` and `remove` regenerate the manifest when the state exists and the file still matches its recorded hash, then update the hash; if you edited the manifest they leave it alone and warn on stderr. An invalid state is also warned about and skipped, so `add` and `remove` still finish their work.

## Alerts

`alertas.json` reports every type below. Plain `status` prints them too, except `fetch_falhou`. `status --json` carries only alerts tied to a listed project, so a script must read `alertas.json` for registry and delegate failures:

| Type | Meaning |
|---|---|
| `mapa_invalido` | the map failed validation; the project stays listed with zeroes and this error |
| `card_desconhecido` | a merge subject on the ref contains a whole id-shaped token, using a prefix derived from the map's card ids, that is in no card |
| `marco_desconhecido` | an active or logged run of the project names a milestone not in the map |
| `registro_invalido` | `projects.json` is unreadable, or one entry is malformed or has an invalid ref; the other entries still work |
| `git_log_falhou` | `git log` (or resolving the ref) failed; the project keeps its previous `projetos`/`marcos` rows, or lists `feito: 0` when there are none. `status` keeps no rows, so it shows `feito: 0`; read `projetos.json` for the last collected values |
| `erro_interno` | an unexpected error while computing one project; the other projects still collect |
| `id_duplicado` | two registered projects use the same map `id`; only the first is listed |
| `id_mapa_mudou` | the map at the ref now uses an id different from the entry's stored id; run `add <shell-quoted path> --ref <stored ref>` again |
| `fetch_falhou` | `--fetch` could not update the ref; `watch` repeats it until a fetch succeeds |
| `delegate_indisponivel` | `delegate.py status --json` is missing or failed; executions are empty |

Fix the map, the registry entry or the run's `--milestone`, then collect again. Do not silence an alert by deleting the evidence.

## What this skill does not do

- It does not write to a registered repository. `collect` only reads; `--fetch` and `watch` run `git -c gc.auto=0 -c maintenance.auto=false fetch --quiet --no-recurse-submodules --no-write-fetch-head origin -- <branch>` for an `origin/<branch>` ref and nothing else. The `--` keeps the branch from being read as an option; the fetch has no terminal prompt, and without `GIT_SSH_COMMAND`, `GIT_SSH` or a configured `core.sshCommand`, uses `ssh -o BatchMode=yes`. It runs in its own process group, so a stop or timeout kills the fetch and its children.
- It does not choose milestones, sizes or dependencies. That judgement belongs in the plan and the map.
- It does not accept a card for you. `validated` is human evidence, not a collector decision.
- It does not install aiDeck itself: `--aideck` must point at an existing build. On macOS, `panel install` loads the two launchd agents and `panel uninstall` removes them (see above); `watch` run by hand stays a foreground process.
