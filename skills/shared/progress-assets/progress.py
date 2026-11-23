#!/usr/bin/env python3
"""Project progress collector for the aiDeck panel.

Reads each registered project's milestone map from git (never the working
tree), derives the state of every card from merge commits and the delegate
runner, and writes deterministic JSON arrays for the panel.

Python 3.9+, standard library only.
"""

import argparse
import json
import math
import os
import re
import signal
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

SCHEMA_VERSION = 1
SIZE_WEIGHTS = {"P": 1, "M": 2, "G": 4}
ID_RE = re.compile(r"[A-Za-z0-9._-]{1,64}\Z")
TOP_KEYS = {"schemaVersion", "id", "title", "unit", "note", "idPattern", "milestones"}
MILESTONE_KEYS = {"id", "title", "cards"}
CARD_KEYS = {"id", "size", "deps", "match", "weight", "done", "validated"}
OUTPUT_NAMES = ("projetos", "marcos", "execucoes", "alertas")
REF_RE = re.compile(r"[A-Za-z0-9._/-]+")
DEFAULT_UNIT = "itens"


# --------------------------------------------------------------------------
# Paths, registry and atomic files
# --------------------------------------------------------------------------

def atomic_home():
    value = os.environ.get("ATOMIC_SKILLS_HOME")
    return Path(value) if value else Path.home() / ".atomic-skills"


def registry_path():
    return atomic_home() / "progress" / "projects.json"


def default_out_dir():
    return Path.home() / ".aideck" / "consumers" / "painel" / "data"


def telemetry_log():
    return atomic_home() / "delegate" / "runs.jsonl"


def write_atomic(path, data):
    """Write bytes to `path` through a temp file in the same directory."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def encode_json(value, indent=2):
    return (json.dumps(value, ensure_ascii=False, indent=indent) + "\n").encode("utf-8")


def write_json_if_changed(path, value):
    """Write `value` only when its bytes differ; return True when written."""
    path = Path(path)
    data = encode_json(value)
    try:
        if path.read_bytes() == data:
            return False
    except OSError:
        pass
    write_atomic(path, data)
    return True


def load_registry():
    path = registry_path()
    if not path.exists():
        return {"schemaVersion": SCHEMA_VERSION, "projects": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("projects"), list):
        raise ValueError("registry is not an object with a projects array")
    projects = []
    for item in data["projects"]:
        if not isinstance(item, dict):
            continue
        path_value = item.get("path")
        ref = item.get("ref")
        if isinstance(path_value, str) and path_value and isinstance(ref, str) and ref:
            projects.append({"path": path_value, "ref": ref})
    return {"schemaVersion": SCHEMA_VERSION, "projects": projects}


def save_registry(projects):
    write_atomic(
        registry_path(),
        encode_json({"schemaVersion": SCHEMA_VERSION, "projects": projects}),
    )


# --------------------------------------------------------------------------
# Git and repository identity (mirrors the delegate runner)
# --------------------------------------------------------------------------

REPO_PART_RE = re.compile(r"[A-Za-z0-9._-]+\Z")


def run_cmd(args, timeout=30):
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout,
        encoding="utf-8",
        errors="replace",
    )


def git(cwd, *args, timeout=30):
    try:
        result = run_cmd(["git", "-C", str(cwd), *args], timeout=timeout)
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def repo_from_url(url):
    """`owner/name` of a remote URL, or None (same rules as delegate.py)."""
    url = (url or "").strip()
    with_scheme = re.fullmatch(r"([A-Za-z][A-Za-z0-9+.-]*)://([^/?#]*)([^?#]*).*", url, re.S)
    if with_scheme:
        if with_scheme.group(1).lower() == "file" or not with_scheme.group(2):
            return None
        path = with_scheme.group(3)
    else:
        scp = re.fullmatch(r"(?:[^@/:]+@)?([^@/:]+):(.+)", url, re.S)
        if not scp or len(scp.group(1)) < 2:
            return None
        path = scp.group(2)
    parts = [part for part in path.split("/") if part]
    if len(parts) < 2:
        return None
    owner, name = parts[-2], parts[-1]
    if name.endswith(".git"):
        name = name[:-4]
    for part in (owner, name):
        if not REPO_PART_RE.fullmatch(part) or part in (".", ".."):
            return None
    return "%s/%s" % (owner, name)


def repo_identity(cwd):
    """Stable name of the repository `cwd` belongs to; None outside git."""
    try:
        cwd = str(cwd)
        common = git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir")
        if not common:
            common = git(cwd, "rev-parse", "--git-common-dir")
            if not common:
                return None
            common = str(Path(cwd) / common)
        named = repo_from_url(git(cwd, "remote", "get-url", "origin"))
        if named:
            return named
        common_path = Path(common).resolve()
        if common_path.name == ".git":
            name = common_path.parent.name
        else:
            name = common_path.name[:-4] if common_path.name.endswith(".git") else common_path.name
        return name or None
    except Exception:
        return None


def merge_subjects(repo, ref):
    try:
        result = run_cmd(["git", "-C", str(repo), "log", "--merges", "--format=%s", ref])
    except (OSError, subprocess.SubprocessError):
        return []
    if result.returncode != 0:
        return []
    return [line for line in result.stdout.splitlines() if line.strip()]


def read_map(repo, ref):
    """Return (raw_text, error). Always reads through `git show`, never disk."""
    try:
        result = run_cmd(
            ["git", "-C", str(repo), "show", "%s:.atomic-skills/marcos.json" % ref]
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return None, "cannot run git show: %s" % exc
    if result.returncode != 0:
        detail = (result.stderr or "").strip().splitlines()
        return None, "cannot read .atomic-skills/marcos.json at %s%s" % (
            ref,
            ": " + detail[-1] if detail else "",
        )
    return result.stdout, None


# --------------------------------------------------------------------------
# Map validation
# --------------------------------------------------------------------------

def _is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def _nonempty_str(value):
    return isinstance(value, str) and value.strip() != ""


def validate_map(data):
    """Return every problem as `"<json path>: <message>"` (empty when valid)."""
    issues = []
    if not isinstance(data, dict):
        return ["$: the map must be a JSON object"]

    def issue(path, message):
        issues.append("%s: %s" % (path, message))

    for key in data:
        if key not in TOP_KEYS:
            issue("$.%s" % key, "unknown key")

    if "schemaVersion" not in data:
        issue("$.schemaVersion", "required")
    elif not _is_int(data["schemaVersion"]) or data["schemaVersion"] != SCHEMA_VERSION:
        issue("$.schemaVersion", "must be the integer %d" % SCHEMA_VERSION)

    for key in ("id", "title", "unit"):
        if key not in data:
            issue("$.%s" % key, "required")
        elif key != "unit" and not _nonempty_str(data[key]):
            issue("$.%s" % key, "must be a non-empty string")
        elif key == "unit" and not _nonempty_str(data[key]):
            issue("$.unit", "must be a non-empty string")
        elif key == "id" and not ID_RE.fullmatch(data[key]):
            issue("$.id", "must match [A-Za-z0-9._-]{1,64}")

    if "note" in data and not isinstance(data["note"], str):
        issue("$.note", "must be a string")

    id_pattern = data.get("idPattern")
    if "idPattern" in data:
        if not isinstance(id_pattern, str):
            issue("$.idPattern", "must be a string")
        else:
            try:
                re.compile(id_pattern)
            except re.error as exc:
                issue("$.idPattern", "invalid regular expression: %s" % exc)

    milestones = data.get("milestones")
    if "milestones" not in data:
        issue("$.milestones", "required")
        return issues
    if not isinstance(milestones, list):
        issue("$.milestones", "must be an array")
        return issues

    cards_by_id = {}
    milestone_ids = set()
    for index, milestone in enumerate(milestones):
        base = "$.milestones[%d]" % index
        if not isinstance(milestone, dict):
            issue(base, "must be an object")
            continue
        for key in milestone:
            if key not in MILESTONE_KEYS:
                issue("%s.%s" % (base, key), "unknown key")
        for key in ("id", "title"):
            if key not in milestone:
                issue("%s.%s" % (base, key), "required")
            elif not _nonempty_str(milestone[key]):
                issue("%s.%s" % (base, key), "must be a non-empty string")
            elif key == "id":
                if not ID_RE.fullmatch(milestone[key]):
                    issue("%s.id" % base, "must match [A-Za-z0-9._-]{1,64}")
                elif milestone[key] in milestone_ids:
                    issue("%s.id" % base, "duplicate milestone id %r" % milestone[key])
                else:
                    milestone_ids.add(milestone[key])
        cards = milestone.get("cards")
        if "cards" not in milestone:
            issue("%s.cards" % base, "required")
            continue
        if not isinstance(cards, list):
            issue("%s.cards" % base, "must be an array")
            continue
        for card_index, card in enumerate(cards):
            card_base = "%s.cards[%d]" % (base, card_index)
            if not isinstance(card, dict):
                issue(card_base, "must be an object")
                continue
            for key in card:
                if key not in CARD_KEYS:
                    issue("%s.%s" % (card_base, key), "unknown key")
            card_id = card.get("id")
            if "id" not in card:
                issue("%s.id" % card_base, "required")
            elif not _nonempty_str(card_id):
                issue("%s.id" % card_base, "must be a non-empty string")
            elif not ID_RE.fullmatch(card_id):
                issue("%s.id" % card_base, "must match [A-Za-z0-9._-]{1,64}")
            elif card_id in cards_by_id:
                issue("%s.id" % card_base, "duplicate card id %r" % card_id)
            else:
                cards_by_id[card_id] = card_base

            has_size = "size" in card
            has_weight = "weight" in card
            if not has_size and not has_weight:
                issue(card_base, "card needs a size or a weight")
            if has_size and (
                not isinstance(card["size"], str) or card["size"] not in SIZE_WEIGHTS
            ):
                issue("%s.size" % card_base, "must be one of P, M or G")
            if has_weight and (not _is_int(card["weight"]) or card["weight"] <= 0):
                issue("%s.weight" % card_base, "must be a positive integer")

            if "match" in card:
                if not isinstance(card["match"], str):
                    issue("%s.match" % card_base, "must be a string")
                else:
                    try:
                        re.compile(card["match"])
                    except re.error as exc:
                        issue("%s.match" % card_base, "invalid regular expression: %s" % exc)
            for key in ("done", "validated"):
                if key in card and not isinstance(card[key], str):
                    issue("%s.%s" % (card_base, key), "must be a string")
            if "deps" in card:
                deps = card["deps"]
                if not isinstance(deps, list):
                    issue("%s.deps" % card_base, "must be an array")
                else:
                    for dep_index, dep in enumerate(deps):
                        if not isinstance(dep, str) or not dep:
                            issue(
                                "%s.deps[%d]" % (card_base, dep_index),
                                "must be a non-empty string",
                            )

    # Every dep names a card in the map.
    for card_id, card_base in cards_by_id.items():
        card = None
        for milestone in milestones:
            if not isinstance(milestone, dict):
                continue
            for candidate in milestone.get("cards") or []:
                if isinstance(candidate, dict) and candidate.get("id") == card_id:
                    card = candidate
                    break
        deps = card.get("deps") if isinstance(card, dict) else None
        if not isinstance(deps, list):
            continue
        for dep in deps:
            if isinstance(dep, str) and dep not in cards_by_id:
                issue("%s.deps" % card_base, "unknown dependency %r" % dep)

    # No dependency cycle.
    graph = {}
    for card_id in cards_by_id:
        graph[card_id] = []
    for milestone in milestones:
        if not isinstance(milestone, dict):
            continue
        for card in milestone.get("cards") or []:
            if not isinstance(card, dict) or not isinstance(card.get("id"), str):
                continue
            deps = card.get("deps")
            if isinstance(deps, list):
                graph[card["id"]] = [d for d in deps if isinstance(d, str) and d in graph]

    state = {}
    stack = []
    reported = set()

    def visit(node):
        state[node] = 1
        stack.append(node)
        for dep in graph.get(node, []):
            if state.get(dep) == 1:
                cycle = stack[stack.index(dep):] + [dep]
                key = tuple(sorted(set(cycle)))
                if key not in reported:
                    reported.add(key)
                    issue(
                        "%s.deps" % cards_by_id[node],
                        "dependency cycle: %s" % " -> ".join(cycle),
                    )
            elif state.get(dep, 0) == 0:
                visit(dep)
        stack.pop()
        state[node] = 2

    for card_id in graph:
        if state.get(card_id, 0) == 0:
            visit(card_id)

    return issues


# --------------------------------------------------------------------------
# Project model
# --------------------------------------------------------------------------

class ProjectView:
    def __init__(self, path, ref):
        self.path = path
        self.ref = ref
        self.data = None
        self.issues = []
        self.id = Path(path).name
        self.title = Path(path).name
        self.unit = DEFAULT_UNIT
        self.note = ""
        self.cards = []
        self.milestones = []
        self.repo = repo_identity(path)

    @property
    def valid(self):
        return not self.issues


def fallback_id(path):
    name = Path(path).name
    return name if ID_RE.fullmatch(name) else "projeto"


def load_project(path, ref):
    view = ProjectView(path, ref)
    raw, error = read_map(path, ref)
    if error:
        view.issues = ["$: %s" % error]
        return view
    try:
        data = json.loads(raw)
    except ValueError as exc:
        view.issues = ["$: invalid JSON in .atomic-skills/marcos.json: %s" % exc]
        return view
    view.data = data
    if isinstance(data, dict):
        if _nonempty_str(data.get("id")) and ID_RE.fullmatch(data["id"]):
            view.id = data["id"]
        if _nonempty_str(data.get("title")):
            view.title = data["title"]
        if _nonempty_str(data.get("unit")):
            view.unit = data["unit"]
        if isinstance(data.get("note"), str):
            view.note = data["note"]

    issues = validate_map(data)
    if issues:
        view.issues = issues
        return view

    view.milestones = data["milestones"]
    for milestone in view.milestones:
        for card in milestone["cards"]:
            view.cards.append(card)
    return view


def card_weight(card):
    if "weight" in card:
        return card["weight"]
    return SIZE_WEIGHTS[card["size"]]


def pct(done, total):
    if total <= 0:
        return 0
    value = int(math.floor(done * 100.0 / total + 0.5))
    if value >= 100 and done < total:
        value = 99
    return min(max(value, 0), 100)


def summary(done, total, unit, percentage):
    return "%d/%d %s · %d%%" % (done, total, unit, percentage)


def token_regex(pattern, case_insensitive=False):
    return re.compile(
        r"(?<![\w-])(?:%s)(?![\w-])" % pattern,
        re.IGNORECASE if case_insensitive else 0,
    )


def has_evidence(value):
    return isinstance(value, str) and value.strip() != ""


def run_touches_card(run, card_id, expected_repo):
    if expected_repo is None or run.get("repo") != expected_repo:
        return False
    task_id = run.get("id")
    if not isinstance(task_id, str):
        return False
    return bool(token_regex(re.escape(card_id)).search(task_id))


def card_states(view, active_runs):
    subjects = merge_subjects(view.path, view.ref)
    regexes = {}
    for card in view.cards:
        if "match" in card:
            regexes[card["id"]] = token_regex(card["match"], case_insensitive=True)
        else:
            regexes[card["id"]] = token_regex(re.escape(card["id"]))

    base = {}
    for card in view.cards:
        card_id = card["id"]
        if has_evidence(card.get("validated")):
            base[card_id] = "validated"
        elif has_evidence(card.get("done")):
            base[card_id] = "integrated"
        elif any(regexes[card_id].search(subject) for subject in subjects):
            base[card_id] = "integrated"
        elif any(run_touches_card(run, card_id, view.repo) for run in active_runs):
            base[card_id] = "running"
        else:
            base[card_id] = "ready"

    deps = {card["id"]: card.get("deps") or [] for card in view.cards}
    states = {}
    for card in view.cards:
        card_id = card["id"]
        state = base[card_id]
        if state == "ready":
            if any(deps[card_id] and other not in ("integrated", "validated")
                   for other in deps[card_id]):
                state = "blocked"
        states[card_id] = state
    return states, subjects


def milestone_rows(view, states):
    rows = []
    for milestone in view.milestones:
        total = 0
        done = 0
        validated = 0
        prontos = 0
        bloqueados = 0
        rodando = 0
        for card in milestone["cards"]:
            weight = card_weight(card)
            total += weight
            state = states[card["id"]]
            if state in ("integrated", "validated"):
                done += weight
                prontos += 1
            if state == "validated":
                validated += weight
            elif state == "blocked":
                bloqueados += 1
            elif state == "running":
                rodando += 1
        percentage = pct(done, total)
        rows.append({
            "projeto": view.id,
            "marco": milestone["id"],
            "feito": done,
            "total": total,
            "pct": percentage,
            "resumo": summary(done, total, view.unit, percentage),
            "prontos": prontos,
            "bloqueados": bloqueados,
            "rodando": rodando,
        })
    return rows


def project_row(view, states):
    total = done = validated = 0
    for card in view.cards:
        weight = card_weight(card)
        total += weight
        state = states[card["id"]]
        if state in ("integrated", "validated"):
            done += weight
        if state == "validated":
            validated += weight
    percentage = pct(done, total)
    return {
        "id": view.id,
        "nome": view.title,
        "feito": done,
        "total": total,
        "pct": percentage,
        "validado": validated,
        "validadoPct": pct(validated, total),
        "resumo": summary(done, total, view.unit, percentage),
        "legenda": view.note,
    }


def unknown_card_alerts(view, subjects):
    pattern = view.data.get("idPattern") if isinstance(view.data, dict) else None
    if not isinstance(pattern, str):
        return []
    try:
        token = re.compile(pattern)
    except re.error:
        return []
    known = {card["id"] for card in view.cards}
    seen = set()
    alerts = []
    for subject in subjects:
        for match in token.finditer(subject):
            found = match.group(0)
            if found in known or found in seen:
                continue
            seen.add(found)
            alerts.append({
                "projeto": view.id,
                "tipo": "card_desconhecido",
                "detalhe": "%s aparece num merge e não está no mapa: %s" % (found, subject),
            })
    return alerts


def read_logged_runs():
    path = telemetry_log()
    if not path.exists():
        return []
    runs = []
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except ValueError:
                continue
            if isinstance(record, dict) and record.get("kind") == "run":
                runs.append(record)
    except OSError:
        return []
    return runs


def unknown_milestone_alerts(view, active_runs, logged_runs):
    if not view.valid or view.repo is None:
        return []
    known = {milestone["id"] for milestone in view.milestones}
    seen = set()
    alerts = []
    for run in list(active_runs) + list(logged_runs):
        if not isinstance(run, dict) or run.get("repo") != view.repo:
            continue
        milestone = run.get("milestone")
        if not isinstance(milestone, str) or not milestone or milestone in known:
            continue
        if milestone in seen:
            continue
        seen.add(milestone)
        alerts.append({
            "projeto": view.id,
            "tipo": "marco_desconhecido",
            "detalhe": "execução %s usa o marco desconhecido %s" % (run.get("id", "?"), milestone),
        })
    return alerts


# --------------------------------------------------------------------------
# Delegate status
# --------------------------------------------------------------------------

def find_delegate(explicit=None):
    # An explicit path or DELEGATE_PY is honoured even when it is wrong: the
    # failure must be reported, never hidden by silently falling back.
    if explicit:
        return str(Path(explicit).expanduser())
    if os.environ.get("DELEGATE_PY"):
        return str(Path(os.environ["DELEGATE_PY"]).expanduser())
    here = Path(__file__).resolve().parent
    for candidate in (here / "delegate.py", here.parent / "delegate-assets" / "delegate.py"):
        if candidate.is_file():
            return str(candidate)
    return None


def load_active_runs(delegate_path=None):
    path = find_delegate(delegate_path)
    if not path:
        return [], {
            "projeto": "",
            "tipo": "delegate_indisponivel",
            "detalhe": "delegate.py não encontrado",
        }
    try:
        result = run_cmd([sys.executable or "python3", path, "status", "--json"], timeout=60)
    except (OSError, subprocess.SubprocessError) as exc:
        return [], {
            "projeto": "",
            "tipo": "delegate_indisponivel",
            "detalhe": "delegate.py status --json falhou: %s" % exc,
        }
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "exit %d" % result.returncode).strip()
        detail = detail.splitlines()[-1] if detail else "exit %d" % result.returncode
        return [], {
            "projeto": "",
            "tipo": "delegate_indisponivel",
            "detalhe": "delegate.py status --json falhou: %s" % detail,
        }
    try:
        data = json.loads(result.stdout)
    except ValueError as exc:
        return [], {
            "projeto": "",
            "tipo": "delegate_indisponivel",
            "detalhe": "delegate.py status --json devolveu saída inválida: %s" % exc,
        }
    active = data.get("active") if isinstance(data, dict) else None
    if not isinstance(active, list):
        return [], {
            "projeto": "",
            "tipo": "delegate_indisponivel",
            "detalhe": "delegate.py status --json não devolveu a lista active",
        }
    return [run for run in active if isinstance(run, dict)], None


def minutes(age_s):
    try:
        return max(0, int(age_s) // 60)
    except (TypeError, ValueError):
        return 0


# --------------------------------------------------------------------------
# Collection
# --------------------------------------------------------------------------

def fetch_projects(projects):
    """Fetch `origin/<branch>` refs; return failure details with their path."""
    failures = []
    for project in projects:
        path = project["path"]
        ref = project["ref"]
        if not ref.startswith("origin/"):
            continue
        branch = ref[len("origin/"):]
        if not branch or not REF_RE.fullmatch(branch):
            continue
        try:
            result = run_cmd(
                ["git", "-C", path, "fetch", "--quiet", "origin", branch], timeout=30
            )
        except subprocess.TimeoutExpired:
            failures.append({
                "path": path,
                "detalhe": "git fetch excedeu 30 segundos em %s" % path,
            })
            continue
        except (OSError, subprocess.SubprocessError) as exc:
            failures.append({
                "path": path,
                "detalhe": "git fetch falhou em %s: %s" % (path, exc),
            })
            continue
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip().splitlines()
            failures.append({
                "path": path,
                "detalhe": "git fetch falhou em %s%s" % (
                    path,
                    ": " + detail[-1] if detail else "",
                ),
            })
    return failures


def build_panel(fetch=False, delegate_path=None):
    """Return (projetos, marcos, execucoes, alertas)."""
    try:
        projects = load_registry()["projects"]
    except (OSError, ValueError) as exc:
        return [], [], [], [{
            "projeto": "",
            "tipo": "registro_invalido",
            "detalhe": "projects.json inválido: %s" % exc,
        }]

    fetch_failures = fetch_projects(projects) if fetch else []
    alerts = []
    active_runs, delegate_alert = load_active_runs(delegate_path)
    if delegate_alert:
        alerts.append(delegate_alert)

    views = [load_project(project["path"], project["ref"]) for project in projects]
    logged_runs = read_logged_runs()

    path_to_id = {
        resolve_project(project["path"]): view.id
        for project, view in zip(projects, views)
    }
    for failure in fetch_failures:
        alerts.append({
            "projeto": path_to_id.get(resolve_project(failure["path"]), Path(failure["path"]).name),
            "tipo": "fetch_falhou",
            "detalhe": failure["detalhe"],
        })

    for view in views:
        if not view.valid:
            alerts.append({
                "projeto": view.id,
                "tipo": "mapa_invalido",
                "detalhe": "; ".join(view.issues),
            })

    by_repo = {}
    for view in views:
        if view.repo:
            by_repo[view.repo] = view.id

    execucoes = []
    for run in active_runs:
        repo = run.get("repo")
        project_id = by_repo.get(repo) if repo else None
        if project_id is None:
            project_id = run.get("project") or ""
        milestone = run.get("milestone")
        execucoes.append({
            "projeto": project_id,
            "repo": repo or "",
            "marco": milestone if isinstance(milestone, str) else "",
            "tarefa": run.get("id") or "",
            "papel": run.get("role") or "",
            "executor": run.get("profile") or "",
            "equipamento": run.get("machine") or "",
            "remoto": bool(run.get("remote")),
            "minutos": minutes(run.get("age_s")),
        })

    projetos = []
    marcos = []
    for view in views:
        if not view.valid:
            projetos.append({
                "id": view.id,
                "nome": view.title,
                "feito": 0,
                "total": 0,
                "pct": 0,
                "validado": 0,
                "validadoPct": 0,
                "resumo": summary(0, 0, view.unit, 0),
                "legenda": view.note,
            })
            continue
        states, subjects = card_states(view, active_runs)
        projetos.append(project_row(view, states))
        marcos.extend(milestone_rows(view, states))
        alerts.extend(unknown_card_alerts(view, subjects))
        alerts.extend(unknown_milestone_alerts(view, active_runs, logged_runs))

    return projetos, marcos, execucoes, alerts


def write_panel(out_dir, fetch=False, delegate_path=None):
    projetos, marcos, execucoes, alertas = build_panel(fetch, delegate_path)
    out = Path(out_dir).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    for name, value in zip(OUTPUT_NAMES, (projetos, marcos, execucoes, alertas)):
        write_json_if_changed(out / ("%s.json" % name), value)
    return projetos, marcos, execucoes, alertas


# --------------------------------------------------------------------------
# Commands
# --------------------------------------------------------------------------

def resolve_project(path):
    return str(Path(path).expanduser().resolve())


def cmd_validate(args):
    repo = resolve_project(args.repo)
    raw, error = read_map(repo, args.ref)
    if error:
        print("$: %s" % error, file=sys.stderr)
        return 1
    try:
        data = json.loads(raw)
    except ValueError as exc:
        print("$: invalid JSON in .atomic-skills/marcos.json: %s" % exc, file=sys.stderr)
        return 1
    issues = validate_map(data)
    if issues:
        for issue in issues:
            print(issue, file=sys.stderr)
        return 1
    print("ok: %s (%s)" % (repo, args.ref))
    return 0


def cmd_add(args):
    repo = resolve_project(args.repo)
    raw, error = read_map(repo, args.ref)
    if error:
        print("$: %s" % error, file=sys.stderr)
        return 1
    try:
        data = json.loads(raw)
    except ValueError as exc:
        print("$: invalid JSON in .atomic-skills/marcos.json: %s" % exc, file=sys.stderr)
        return 1
    issues = validate_map(data)
    if issues:
        for issue in issues:
            print(issue, file=sys.stderr)
        return 1
    try:
        registry = load_registry()
    except (OSError, ValueError) as exc:
        print("progress: cannot read the registry: %s" % exc, file=sys.stderr)
        return 1
    projects = registry["projects"]
    for project in projects:
        if resolve_project(project["path"]) == repo:
            project["path"] = repo
            project["ref"] = args.ref
            break
    else:
        projects.append({"path": repo, "ref": args.ref})
    save_registry(projects)
    print("added: %s (%s)" % (repo, args.ref))
    return 0


def cmd_remove(args):
    repo = resolve_project(args.repo)
    try:
        registry = load_registry()
    except (OSError, ValueError) as exc:
        print("progress: cannot read the registry: %s" % exc, file=sys.stderr)
        return 1
    remaining = [
        project for project in registry["projects"]
        if resolve_project(project["path"]) != repo
    ]
    if len(remaining) == len(registry["projects"]):
        print("not registered: %s" % repo, file=sys.stderr)
        return 1
    save_registry(remaining)
    print("removed: %s" % repo)
    return 0


def cmd_list(args):
    try:
        projects = load_registry()["projects"]
    except (OSError, ValueError) as exc:
        print("progress: cannot read the registry: %s" % exc, file=sys.stderr)
        return 1
    if not projects:
        print("nenhum projeto registrado")
        return 0
    for project in projects:
        print("%s\t%s" % (project["path"], project["ref"]))
    return 0


def cmd_collect(args):
    write_panel(args.out, fetch=args.fetch, delegate_path=args.delegate)
    return 0


def cmd_status(args):
    projetos, marcos, _, alertas = build_panel(False, args.delegate)
    rows = []
    for project in projetos:
        project_alerts = [a for a in alertas if a.get("projeto") == project["id"]]
        rows.append({
            **project,
            "milestones": [m for m in marcos if m["projeto"] == project["id"]],
            "alertas": project_alerts,
        })
    if args.json:
        print(json.dumps({"projects": rows}, ensure_ascii=False, indent=2))
        return 0
    if not rows:
        print("nenhum projeto registrado")
    for project in rows:
        print("%s — %s: %d%% (%s; validado %d%%)" % (
            project["id"], project["nome"], project["pct"], project["resumo"],
            project["validadoPct"],
        ))
        for milestone in project["milestones"]:
            print("  %s: %d%% (%s) · %d prontos, %d bloqueados, %d rodando" % (
                milestone["marco"], milestone["pct"], milestone["resumo"],
                milestone["prontos"], milestone["bloqueados"], milestone["rodando"],
            ))
        for alert in project["alertas"]:
            print("  alerta [%s]: %s" % (alert["tipo"], alert["detalhe"]))
    for alert in alertas:
        if not any(alert is row_alert for row in rows for row_alert in row["alertas"]):
            print("alerta [%s]: %s" % (alert["tipo"], alert["detalhe"]))
    return 0


def watch_signature():
    signature = []
    log = telemetry_log()
    try:
        stat = log.stat()
        signature.append(("log", stat.st_size, stat.st_mtime_ns))
    except OSError:
        signature.append(("log", None, None))
    for directory in ("running", "running-remote"):
        base = atomic_home() / "delegate" / directory
        try:
            names = sorted(path.name for path in base.iterdir())
        except OSError:
            names = []
        signature.append((directory, tuple(names)))
    try:
        projects = load_registry()["projects"]
    except (OSError, ValueError):
        projects = []
    refs = []
    for project in projects:
        refs.append((project["path"], project["ref"], git(project["path"], "rev-parse", project["ref"]) or ""))
    signature.append(("refs", tuple(refs)))
    return tuple(signature)


def cmd_watch(args):
    stop = threading.Event()

    def handle(signum, _frame):
        stop.set()

    previous = {}
    try:
        for signum in (signal.SIGTERM, signal.SIGINT):
            previous[signum] = signal.signal(signum, handle)
    except (ValueError, OSError):
        previous = {}

    interval = args.interval if args.interval and args.interval > 0 else 2.0
    fetch_every = args.fetch_every if args.fetch_every is not None else 120.0
    now = time.monotonic()
    last_collect = 0.0
    last_fetch = now  # the first fetch happens after one period
    last_signature = None
    try:
        while not stop.is_set():
            now = time.monotonic()
            fetch_due = fetch_every > 0 and (now - last_fetch) >= fetch_every
            try:
                signature = watch_signature()
            except Exception as exc:  # a bad cycle never ends the loop
                print("progress: watch signature failed: %s" % exc, file=sys.stderr)
                signature = None
            due = (
                last_signature is None
                or signature != last_signature
                or (now - last_collect) >= 60
                or fetch_due
            )
            if due:
                try:
                    write_panel(args.out, fetch=fetch_due, delegate_path=args.delegate)
                    last_collect = now
                    if fetch_due:
                        last_fetch = now
                    try:
                        last_signature = watch_signature()
                    except Exception:
                        last_signature = signature
                except Exception as exc:
                    print("progress: collect failed: %s" % exc, file=sys.stderr)
            stop.wait(interval)
    finally:
        for signum, handler in previous.items():
            try:
                signal.signal(signum, handler)
            except (ValueError, OSError):
                pass
    return 0


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def build_parser():
    parser = argparse.ArgumentParser(prog="progress.py", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    validate = sub.add_parser("validate", help="validate a project's milestone map")
    validate.add_argument("repo")
    validate.add_argument("--ref", required=True)
    validate.set_defaults(func=cmd_validate)

    add = sub.add_parser("add", help="register a project")
    add.add_argument("repo")
    add.add_argument("--ref", required=True)
    add.set_defaults(func=cmd_add)

    remove = sub.add_parser("remove", help="remove a registered project")
    remove.add_argument("repo")
    remove.set_defaults(func=cmd_remove)

    listing = sub.add_parser("list", help="list registered projects")
    listing.set_defaults(func=cmd_list)

    collect = sub.add_parser("collect", help="write panel data")
    collect.add_argument("--out")
    collect.add_argument("--fetch", action="store_true")
    collect.add_argument("--delegate")
    collect.set_defaults(func=cmd_collect)

    watch = sub.add_parser("watch", help="collect when something changed")
    watch.add_argument("--out")
    watch.add_argument("--interval", type=float, default=2.0)
    watch.add_argument("--fetch-every", type=float, default=120.0, dest="fetch_every")
    watch.add_argument("--delegate")
    watch.set_defaults(func=cmd_watch)

    status = sub.add_parser("status", help="print each project's progress")
    status.add_argument("--json", action="store_true")
    status.add_argument("--delegate")
    status.set_defaults(func=cmd_status)
    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if hasattr(args, "out") and not args.out:
        args.out = str(default_out_dir())
    try:
        return args.func(args)
    except BrokenPipeError:
        return 0


if __name__ == "__main__":
    sys.exit(main())
