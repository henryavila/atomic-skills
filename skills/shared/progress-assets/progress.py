#!/usr/bin/env python3
"""Project progress collector for the aiDeck panel.

Reads each registered project's milestone map from git (never the working
tree), derives the state of every card from merge commits and the delegate
runner, and writes deterministic JSON arrays for the panel.

Python 3.9+, standard library only.
"""

import argparse
import hashlib
import json
import math
import os
import plistlib
import re
import shlex
import shutil
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
TOP_KEYS = {"schemaVersion", "id", "title", "unit", "note", "milestones"}
MILESTONE_KEYS = {"id", "title", "cards"}
CARD_KEYS = {"id", "size", "deps", "match", "weight", "done", "validated"}
OUTPUT_NAMES = ("projetos", "marcos", "execucoes", "alertas")
REF_RE = re.compile(r"[A-Za-z0-9._][A-Za-z0-9._/-]*\Z")
DEFAULT_UNIT = "itens"


class CollectorStopped(Exception):
    """The watcher was signalled while a fetch was running."""


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


def valid_ref(ref):
    """A ref that can never be read as a git option."""
    return isinstance(ref, str) and bool(REF_RE.fullmatch(ref))


def load_registry():
    path = registry_path()
    if not path.exists():
        return {
            "schemaVersion": SCHEMA_VERSION,
            "projects": [],
            "alerts": [],
            "invalid": [],
        }
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("projects"), list):
        raise ValueError("registry is not an object with a projects array")
    projects = []
    alerts = []
    invalid = []
    for index, item in enumerate(data["projects"]):
        path_value = item.get("path") if isinstance(item, dict) else None
        ref = item.get("ref") if isinstance(item, dict) else None
        name = Path(path_value).name if isinstance(path_value, str) and path_value else ""
        if not isinstance(path_value, str) or not path_value:
            alerts.append({
                "projeto": name,
                "tipo": "registro_invalido",
                "detalhe": "projects[%d]: path ausente ou inválido" % index,
            })
            invalid.append((index, item))
            continue
        if not valid_ref(ref):
            alerts.append({
                "projeto": name,
                "tipo": "registro_invalido",
                "detalhe": "projects[%d]: ref inválida %r" % (index, ref),
            })
            invalid.append((index, item))
            continue
        entry = {"path": path_value, "ref": ref}
        stored_id = item.get("id")
        if isinstance(stored_id, str) and ID_RE.fullmatch(stored_id):
            entry["id"] = stored_id
        projects.append(entry)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "projects": projects,
        "alerts": alerts,
        "invalid": invalid,
    }


def save_registry(projects, invalid=()):
    entries = list(projects)
    for index, item in sorted(invalid, key=lambda pair: pair[0]):
        entries.insert(min(index, len(entries)), item)
    write_atomic(
        registry_path(),
        encode_json({"schemaVersion": SCHEMA_VERSION, "projects": entries}),
    )


# --------------------------------------------------------------------------
# Git and repository identity (mirrors the delegate runner)
# --------------------------------------------------------------------------

REPO_PART_RE = re.compile(r"[A-Za-z0-9._-]+\Z")


def run_cmd(args, timeout=30, env=None):
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout,
        encoding="utf-8",
        errors="replace",
        stdin=subprocess.DEVNULL,
        env=env,
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
    """`owner/name` of a remote URL, or None (same rules as delegate.py).

    A local path or a `file:` URL in any form (`file:/path`, `file:path`,
    `file://host/path`, any case) names no owner and gives None.
    """
    url = (url or "").strip()
    if url[:5].lower() == "file:":
        return None
    with_scheme = re.fullmatch(r"([A-Za-z][A-Za-z0-9+.-]*)://([^/?#]*)([^?#]*).*", url, re.S)
    if with_scheme:
        if not with_scheme.group(2):
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


def common_dir_path(cwd):
    """Absolute path of the common git directory of `cwd`; "" outside git.

    Asks for the plain `--git-common-dir`, which git prints relative to `cwd`
    or absolute, and resolves it here. It never asks git for an absolute path:
    a git older than 2.31 does not know that option and, as with any option it
    does not know, prints it back and exits 0, so its answer would be read as
    part of the path.
    """
    common = git(cwd, "rev-parse", "--git-common-dir")
    if not common or "\n" in common:
        return ""
    return str((Path(cwd) / common).resolve())


def repo_identity(cwd):
    """Stable name of the repository `cwd` belongs to; None outside git."""
    try:
        cwd = str(cwd)
        common = common_dir_path(cwd)
        if not common:
            return None
        named = repo_from_url(git(cwd, "remote", "get-url", "origin"))
        if named:
            return named
        common_path = Path(common).resolve()
        if common_path.name == ".git":
            name = common_path.parent.name
        else:
            name = common_path.name[:-4] if common_path.name.endswith(".git") else common_path.name
        return name or None
    except (OSError, RuntimeError, UnicodeError, ValueError):
        return None


def resolve_ref(repo, ref):
    """Resolve `ref` to a commit SHA once; return (sha, error)."""
    try:
        result = run_cmd([
            "git", "-C", str(repo), "rev-parse", "--verify", "--quiet",
            "--end-of-options", "%s^{commit}" % ref,
        ])
    except (OSError, subprocess.SubprocessError) as exc:
        return None, "cannot resolve %s: %s" % (ref, exc)
    sha = (result.stdout or "").strip()
    if result.returncode != 0 or not sha:
        detail = (result.stderr or "").strip().splitlines()
        return None, "cannot resolve %s%s" % (
            ref,
            ": " + detail[-1] if detail else "",
        )
    return sha, None


def merge_subjects(repo, sha):
    """Return (subjects, error); the caller keeps previous rows on error."""
    try:
        result = run_cmd(["git", "-C", str(repo), "log", "--merges", "--format=%s", sha])
    except (OSError, subprocess.SubprocessError) as exc:
        return None, "git log failed: %s" % exc
    if result.returncode != 0:
        detail = (result.stderr or "").strip().splitlines()
        return None, "git log failed%s" % (": " + detail[-1] if detail else "")
    return [line for line in result.stdout.splitlines() if line.strip()], None


def read_map(repo, ref, display=None):
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
            display or ref,
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
        elif not _nonempty_str(data[key]):
            issue("$.%s" % key, "must be a non-empty string")
        elif key == "id" and not ID_RE.fullmatch(data[key]):
            issue("$.id", "must match [A-Za-z0-9._-]{1,64}")

    if "note" in data and not isinstance(data["note"], str):
        issue("$.note", "must be a string")

    milestones = data.get("milestones")
    if "milestones" not in data:
        issue("$.milestones", "required")
        return issues
    if not isinstance(milestones, list):
        issue("$.milestones", "must be an array")
        return issues

    cards_by_id = {}
    milestone_ids = set()
    saw_weighted_card = False
    has_positive_weight = False
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
            if has_weight and (not _is_int(card["weight"]) or card["weight"] < 0):
                issue("%s.weight" % card_base, "must be a non-negative integer")
            weight = None
            if has_weight and _is_int(card["weight"]) and card["weight"] >= 0:
                weight = card["weight"]
            elif (
                has_size
                and isinstance(card["size"], str)
                and card["size"] in SIZE_WEIGHTS
            ):
                weight = SIZE_WEIGHTS[card["size"]]
            if weight is not None:
                saw_weighted_card = True
                if weight > 0:
                    has_positive_weight = True

            if "match" in card:
                match = card["match"]
                if isinstance(match, list):
                    if not match:
                        issue("%s.match" % card_base, "must not be an empty array")
                    for match_index, value in enumerate(match):
                        if not _nonempty_str(value):
                            issue(
                                "%s.match[%d]" % (card_base, match_index),
                                "must be a non-empty string",
                            )
                elif not _nonempty_str(match):
                    issue(
                        "%s.match" % card_base,
                        "must be a non-empty string or a non-empty array of them",
                    )
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

    if saw_weighted_card and not has_positive_weight:
        issue("$.milestones", "all cards weigh 0; at least one card must weigh more than 0")

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
    def __init__(self, path, ref, stored_id=None):
        self.path = path
        self.ref = ref
        self.data = None
        self.issues = []
        if isinstance(stored_id, str) and ID_RE.fullmatch(stored_id):
            self.stored_id = stored_id
        else:
            self.stored_id = None
        self.id = self.stored_id or Path(path).name
        self.map_id = None
        self.title = Path(path).name
        self.unit = DEFAULT_UNIT
        self.note = ""
        self.cards = []
        self.milestones = []
        self.repo = repo_identity(path)

    @property
    def valid(self):
        return not self.issues


def load_project(path, ref, sha=None, stored_id=None):
    view = ProjectView(path, ref, stored_id=stored_id)
    raw, error = read_map(path, sha or ref, display=ref)
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
            view.map_id = data["id"]
            if view.stored_id is None:
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


def card_matches(card, subject):
    """A `match` is a literal substring; a card id is a whole token.

    An id with a hyphen (`D-03`) ignores case, so `app-desktop/d-03` marks it;
    an id without one (`S3`) stays case-sensitive, so prose such as `backup no
    s3` never marks it.
    """
    if "match" in card:
        values = card["match"]
        if isinstance(values, str):
            values = [values]
        lowered = subject.lower()
        return any(value.lower() in lowered for value in values)
    card_id = card["id"]
    return bool(token_regex(re.escape(card_id), "-" in card_id).search(subject))


def card_states(view, active_runs, subjects):
    base = {}
    for card in view.cards:
        card_id = card["id"]
        if has_evidence(card.get("validated")):
            base[card_id] = "validated"
        elif has_evidence(card.get("done")):
            base[card_id] = "integrated"
        elif any(card_matches(card, subject) for subject in subjects):
            base[card_id] = "integrated"
        elif any(run_touches_card(run, card_id, view.repo) for run in active_runs):
            base[card_id] = "running"
        else:
            base[card_id] = "ready"

    deps = {card["id"]: card.get("deps") or [] for card in view.cards}
    states = dict(base)
    for card in view.cards:
        card_id = card["id"]
        if states[card_id] != "ready":
            continue
        if any(states.get(dep) not in ("integrated", "validated")
               for dep in deps[card_id]):
            states[card_id] = "blocked"
    return states


def milestone_caption(prontos, cards, bloqueados, rodando):
    text = "%d de %d prontos" % (prontos, cards)
    if bloqueados > 0:
        text += " · %d %s" % (
            bloqueados, "bloqueado" if bloqueados == 1 else "bloqueados",
        )
    if rodando > 0:
        text += " · %d rodando" % rodando
    return text


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
        if total == 0:
            cards = len(milestone["cards"])
            if cards == 0:
                percentage = 0
                resumo = "sem cartões"
            else:
                percentage = 100 if prontos == cards else 0
                resumo = "sem peso · %d de %d prontos" % (prontos, cards)
        else:
            percentage = pct(done, total)
            resumo = summary(done, total, view.unit, percentage)
        rows.append({
            "projeto": view.id,
            "marco": milestone["id"],
            "titulo": milestone["title"],
            "legenda": milestone_caption(
                prontos, len(milestone["cards"]), bloqueados, rodando,
            ),
            "feito": done,
            "total": total,
            "pct": percentage,
            "resumo": resumo,
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


def card_id_prefixes(cards):
    """The letters and separator of every card id shaped like `AB-12`."""
    prefixes = set()
    for card in cards:
        card_id = card.get("id")
        if not isinstance(card_id, str):
            continue
        match = re.match(r"([A-Za-z]{1,8}-?)\d", card_id)
        if match:
            prefixes.add(match.group(1))
    return sorted(prefixes, key=lambda value: (-len(value), value))


def unknown_card_alerts(view, subjects):
    prefixes = card_id_prefixes(view.cards)
    if not prefixes:
        return []
    token = token_regex(
        "(?:%s)\\d{1,5}[a-z]?"
        % "|".join(re.escape(prefix) for prefix in prefixes)
    )
    known = {card["id"] for card in view.cards}
    seen = set()
    alerts = []
    for subject in subjects:
        for match in token.finditer(subject):
            found = match.group(0)
            if not found or found in known or found in seen:
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
            if isinstance(record, dict) and record.get("kind") in ("run", "pipeline"):
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

def stop_fetch_group(proc):
    """Terminate the process group this fetch created, then kill it."""
    pgid = proc.pid
    try:
        os.killpg(pgid, signal.SIGTERM)
    except ProcessLookupError:
        return
    except OSError:
        pass
    deadline = time.monotonic() + 1
    gone = False
    while time.monotonic() < deadline:
        proc.poll()
        try:
            os.killpg(pgid, 0)
        except ProcessLookupError:
            gone = True
            break
        except OSError:
            break
        time.sleep(0.05)
    if not gone:
        try:
            os.killpg(pgid, signal.SIGKILL)
        except OSError:
            pass
    try:
        proc.wait(timeout=1)
    except subprocess.TimeoutExpired:
        pass


def run_fetch(repo, branch, stop_event=None, timeout=30):
    """Run a contained fetch; return (ok, detail, stopped)."""
    if stop_event is not None and stop_event.is_set():
        return False, "", True
    args = [
        "git", "-C", str(repo),
        "-c", "gc.auto=0", "-c", "maintenance.auto=false",
        "fetch", "--quiet", "--no-recurse-submodules", "--no-write-fetch-head",
        "origin", "--", branch,
    ]
    env = dict(os.environ)
    env["GIT_TERMINAL_PROMPT"] = "0"
    false_path = shutil.which("false")
    if false_path:
        env["GIT_ASKPASS"] = false_path
        env["SSH_ASKPASS"] = false_path
    env["SSH_ASKPASS_REQUIRE"] = "never"
    if (
        not env.get("GIT_SSH_COMMAND")
        and not env.get("GIT_SSH")
        and not git(repo, "config", "--get", "core.sshCommand")
    ):
        env["GIT_SSH_COMMAND"] = "ssh -o BatchMode=yes"
    start = time.monotonic()
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8", errors="replace") as errors:
        try:
            proc = subprocess.Popen(
                args,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=errors,
                env=env,
                start_new_session=True,
            )
        except OSError as exc:
            return False, "git fetch falhou em %s: %s" % (repo, exc), False
        while proc.poll() is None:
            if stop_event is not None and stop_event.is_set():
                stop_fetch_group(proc)
                return False, "git fetch interrompido em %s" % repo, True
            if time.monotonic() - start >= timeout:
                stop_fetch_group(proc)
                return False, "git fetch excedeu %d segundos em %s" % (timeout, repo), False
            time.sleep(0.05)
        errors.seek(0)
        detail = (errors.read() or "").strip().splitlines()
    if proc.returncode != 0:
        return False, "git fetch falhou em %s%s" % (
            repo,
            ": " + detail[-1] if detail else "",
        ), False
    return True, "", False


def fetch_projects(projects, stop_event=None):
    """Fetch `origin/<branch>` refs; return ({path: detail}, attempted paths)."""
    failures = {}
    attempted = set()
    for project in projects:
        path = resolve_project(project["path"])
        ref = project["ref"]
        if not isinstance(ref, str) or not ref.startswith("origin/"):
            continue
        branch = ref[len("origin/"):]
        attempted.add(path)
        if not branch or not REF_RE.fullmatch(branch):
            failures[path] = "branch inválida em %s: %r" % (path, branch)
            continue
        ok, detail, stopped = run_fetch(project["path"], branch, stop_event)
        if stopped:
            raise CollectorStopped()
        if not ok:
            failures[path] = detail
    return failures, attempted


def empty_project_row(view):
    return {
        "id": view.id,
        "nome": view.title,
        "feito": 0,
        "total": 0,
        "pct": 0,
        "validado": 0,
        "validadoPct": 0,
        "resumo": summary(0, 0, view.unit, 0),
        "legenda": view.note,
    }


def previous_rows(out_dir, project_id):
    """Rows of `project_id` from the last panel, or None when there is none."""
    if not out_dir:
        return None
    out = Path(out_dir).expanduser()
    try:
        projetos = json.loads((out / "projetos.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(projetos, list):
        return None
    row = next(
        (item for item in projetos
         if isinstance(item, dict) and item.get("id") == project_id),
        None,
    )
    if row is None:
        return None
    try:
        marcos = json.loads((out / "marcos.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        marcos = []
    if not isinstance(marcos, list):
        marcos = []
    rows = []
    for item in marcos:
        if not (isinstance(item, dict) and item.get("projeto") == project_id):
            continue
        kept = dict(item)
        if not isinstance(kept.get("titulo"), str) or not kept["titulo"]:
            kept["titulo"] = kept.get("marco") if isinstance(kept.get("marco"), str) else ""
        if not isinstance(kept.get("legenda"), str):
            kept["legenda"] = ""
        rows.append(kept)
    return row, rows


def panel_registry(carried_failures):
    carried = dict(carried_failures or {})
    try:
        registry = load_registry()
    except (OSError, ValueError) as exc:
        alert = {"projeto": "", "tipo": "registro_invalido",
                 "detalhe": "projects.json inválido: %s" % exc}
        return None, [alert], carried
    projects = registry["projects"]
    origin_paths = {
        resolve_project(project["path"]) for project in projects
        if isinstance(project.get("ref"), str)
        and project["ref"].startswith("origin/")
    }
    carried = {path: detail for path, detail in carried.items()
               if resolve_project(path) in origin_paths}
    return projects, list(registry.get("alerts", [])), carried


def panel_fetch_failures(projects, carried, fetch=False, stop_event=None):
    if not fetch:
        return carried
    failures, attempted = fetch_projects(projects, stop_event=stop_event)
    kept = {path: detail for path, detail in carried.items()
            if path not in attempted}
    kept.update(failures)
    return kept


def panel_loaded_projects(projects, alerts):
    loaded = []
    for project in projects:
        view = ProjectView(project["path"], project["ref"], project.get("id"))
        try:
            sha, error = resolve_ref(project["path"], project["ref"])
            if sha is None:
                loaded.append({"project": project, "view": view, "sha": None,
                               "log_error": error or "cannot resolve %s" % project["ref"]})
                continue
            view = load_project(project["path"], project["ref"], sha=sha,
                                stored_id=project.get("id"))
            if view.stored_id and view.map_id and view.map_id != view.stored_id:
                detail = ("o id do mapa mudou de %s para %s; rode add %s --ref %s de novo"
                          % (view.stored_id, view.map_id,
                             shlex.quote(project["path"]), project["ref"]))
                alerts.append({"projeto": view.id, "tipo": "id_mapa_mudou",
                               "detalhe": detail})
            loaded.append({"project": project, "view": view, "sha": sha,
                           "log_error": None})
        except Exception as exc:  # one project never stops the others
            loaded.append({"project": project, "view": view, "sha": None,
                           "internal": exc})
    return loaded


def panel_carried_alerts(carried, loaded):
    path_to_id = {resolve_project(item["project"]["path"]): item["view"].id
                  for item in loaded}
    return [{"projeto": path_to_id.get(resolve_project(path), Path(path).name),
             "tipo": "fetch_falhou", "detalhe": detail}
            for path, detail in carried.items()]


def panel_execucoes(active_runs, loaded):
    by_repo = {}
    for item in loaded:
        if item["view"].repo:
            by_repo.setdefault(item["view"].repo, item["view"].id)
    rows = []
    for run in active_runs:
        repo = run.get("repo")
        project_id = by_repo.get(repo) if repo else None
        if project_id is None:
            project_id = run.get("project") or ""
        milestone = run.get("milestone")
        rows.append({
            "projeto": project_id, "repo": repo or "",
            "marco": milestone if isinstance(milestone, str) else "",
            "tarefa": run.get("id") or "", "papel": run.get("role") or "",
            "executor": run.get("profile") or "",
            "equipamento": run.get("machine") or "",
            "remoto": bool(run.get("remote")),
            "minutos": minutes(run.get("age_s")),
        })
    return rows


def panel_log_failure(error, view, out_dir):
    prior = previous_rows(out_dir, view.id)
    if prior is None:
        return ("%s; sem linhas anteriores, %s fica com feito: 0" % (error, view.id),
                empty_project_row(view), [])
    row, rows = prior
    return ("%s; mantidas as linhas anteriores de %s" % (error, view.id), row, rows)


def panel_project_rows(loaded, active_runs, logged_runs, out_dir):
    projetos = []
    marcos = []
    alerts = []
    seen_ids = set()
    for item in loaded:
        view = item["view"]
        if view.id in seen_ids:
            detail = "o id %s já pertence a outro projeto; %s não foi listado" % (
                view.id, item["project"]["path"])
            alerts.append({"projeto": view.id, "tipo": "id_duplicado",
                           "detalhe": detail})
            continue
        seen_ids.add(view.id)
        if "internal" in item:
            detail = "erro ao calcular %s: %s" % (
                item["project"]["path"], item["internal"])
            alerts.append({"projeto": view.id, "tipo": "erro_interno",
                           "detalhe": detail})
            projetos.append(empty_project_row(view))
            continue
        if item["log_error"] is not None:
            detail, row, rows = panel_log_failure(item["log_error"], view, out_dir)
            alerts.append({"projeto": view.id, "tipo": "git_log_falhou",
                           "detalhe": detail})
            projetos.append(row)
            marcos.extend(rows)
            continue
        if not view.valid:
            alerts.append({"projeto": view.id, "tipo": "mapa_invalido",
                           "detalhe": "; ".join(view.issues)})
            projetos.append(empty_project_row(view))
            continue
        try:
            subjects, log_error = merge_subjects(view.path, item["sha"])
            if log_error is not None:
                detail, row, rows = panel_log_failure(log_error, view, out_dir)
                alerts.append({"projeto": view.id, "tipo": "git_log_falhou",
                               "detalhe": detail})
                projetos.append(row)
                marcos.extend(rows)
                continue
            states = card_states(view, active_runs, subjects)
            row = project_row(view, states)
            rows = milestone_rows(view, states)
            projetos.append(row)
            marcos.extend(rows)
            alerts.extend(unknown_card_alerts(view, subjects))
            alerts.extend(unknown_milestone_alerts(view, active_runs, logged_runs))
        except Exception as exc:  # one project never stops the others
            detail = "erro ao calcular %s: %s" % (item["project"]["path"], exc)
            alerts.append({"projeto": view.id, "tipo": "erro_interno",
                           "detalhe": detail})
            projetos.append(empty_project_row(view))
    return projetos, marcos, alerts


def build_panel(fetch=False, delegate_path=None, out_dir=None,
                carried_failures=None, stop_event=None):
    """Return (projetos, marcos, execucoes, alertas, fetch failures)."""
    projects, alerts, carried = panel_registry(carried_failures)
    if projects is None:
        return [], [], [], alerts, carried
    carried = panel_fetch_failures(projects, carried, fetch, stop_event)
    active_runs, delegate_alert = load_active_runs(delegate_path)
    if delegate_alert:
        alerts.append(delegate_alert)
    logged_runs = read_logged_runs()
    loaded = panel_loaded_projects(projects, alerts)
    alerts.extend(panel_carried_alerts(carried, loaded))
    execucoes = panel_execucoes(active_runs, loaded)
    projetos, marcos, project_alerts = panel_project_rows(
        loaded, active_runs, logged_runs, out_dir)
    alerts.extend(project_alerts)
    return projetos, marcos, execucoes, alerts, carried


def write_panel(out_dir, fetch=False, delegate_path=None,
                carried_failures=None, stop_event=None):
    projetos, marcos, execucoes, alertas, carried = build_panel(
        fetch,
        delegate_path,
        out_dir=out_dir,
        carried_failures=carried_failures,
        stop_event=stop_event,
    )
    out = Path(out_dir).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    for name, value in zip(OUTPUT_NAMES, (projetos, marcos, execucoes, alertas)):
        write_json_if_changed(out / ("%s.json" % name), value)
    return projetos, marcos, execucoes, alertas, carried


# --------------------------------------------------------------------------
# Commands
# --------------------------------------------------------------------------

def resolve_project(path):
    return str(Path(path).expanduser().resolve())


def cmd_validate(args):
    repo = resolve_project(args.repo)
    if not valid_ref(args.ref):
        print("$: invalid ref %r" % args.ref, file=sys.stderr)
        return 1
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
    if not valid_ref(args.ref):
        print("$: invalid ref %r" % args.ref, file=sys.stderr)
        return 1
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
    invalid = registry.get("invalid", [])
    new_id = data["id"]
    match_index = next(
        (index for index, project in enumerate(projects)
         if resolve_project(project["path"]) == repo),
        None,
    )
    for index, project in enumerate(projects):
        if index == match_index:
            continue
        if project.get("id") == new_id:
            print(
                "progress: the map id %r already belongs to %s" % (new_id, project["path"]),
                file=sys.stderr,
            )
            return 1
        if not project.get("id"):
            live = load_project(project["path"], project["ref"])
            if live.map_id == new_id:
                print(
                    "progress: the map id %r already belongs to %s" % (new_id, project["path"]),
                    file=sys.stderr,
                )
                return 1
    if match_index is not None:
        project = projects[match_index]
        project["path"] = repo
        project["ref"] = args.ref
        project["id"] = new_id
        save_registry(projects, invalid)
        refresh_manifest()
        print("added: %s (%s)" % (repo, args.ref))
        return 0
    projects.append({"path": repo, "ref": args.ref, "id": new_id})
    save_registry(projects, invalid)
    refresh_manifest()
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
    save_registry(remaining, registry.get("invalid", []))
    refresh_manifest()
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
    projetos, marcos, _, alertas, _ = build_panel(False, args.delegate)
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
    try:
        stat = registry_path().stat()
        signature.append(("registry", stat.st_size, stat.st_mtime_ns))
    except OSError:
        signature.append(("registry", None, None))
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
        sha, _ = resolve_ref(project["path"], project["ref"])
        refs.append((project["path"], project["ref"], sha or ""))
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
    carried = {}
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
                    _, _, _, _, carried = write_panel(
                        args.out,
                        fetch=fetch_due,
                        delegate_path=args.delegate,
                        carried_failures=carried,
                        stop_event=stop,
                    )
                    last_collect = now
                    if fetch_due:
                        last_fetch = now
                    if signature is not None:
                        last_signature = signature
                except CollectorStopped:
                    break
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
# macOS panel service
# --------------------------------------------------------------------------

PANEL_WATCH_LABEL = "com.atomic-skills.progress.watch"
PANEL_SERVICE_LABEL = "com.atomic-skills.progress.panel"
PANEL_SCHEMA_VERSION = 1
DEFAULT_PANEL_PORT = 7777
PANEL_OUTPUT_NAMES = OUTPUT_NAMES


class PanelError(Exception):
    """A panel install/uninstall step failed."""


def panel_home():
    return Path.home() / ".aideck" / "consumers" / "painel"


def panel_manifest_path():
    return panel_home() / "manifest.yaml"


def panel_data_dir():
    return panel_home() / "data"


def panel_progress_dir():
    return atomic_home() / "progress"


def panel_state_path():
    return panel_progress_dir() / "panel.json"


def panel_logs_dir():
    return panel_progress_dir() / "logs"


def panel_launch_agents_dir():
    return Path.home() / "Library" / "LaunchAgents"


def panel_plist_path(label):
    return panel_launch_agents_dir() / ("%s.plist" % label)


def panel_launchctl():
    return os.environ.get("PROGRESS_LAUNCHCTL") or "launchctl"


def panel_platform_error():
    if sys.platform == "darwin" or os.environ.get("PROGRESS_LAUNCHCTL"):
        return None
    return (
        "progress panel: launchd is only available on macOS; "
        "set PROGRESS_LAUNCHCTL to a launchctl path when testing"
    )


def run_launchctl(args, timeout=15):
    command = [panel_launchctl(), *args]
    try:
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace",
            stdin=subprocess.DEVNULL,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise PanelError("cannot run %s: %s" % (command[0], exc))


def panel_label_loaded(label):
    result = run_launchctl(["print", "gui/%d/%s" % (os.getuid(), label)])
    if result.returncode == 0:
        return True
    output = "%s\n%s" % (result.stdout or "", result.stderr or "")
    if result.returncode == 113 or "Could not find service" in output:
        return False
    detail = (result.stderr or result.stdout or "").strip()
    raise PanelError(
        "launchctl print failed for %s%s"
        % (label, ": " + detail if detail else "")
    )


def panel_bootstrap(plist):
    result = run_launchctl(["bootstrap", "gui/%d" % os.getuid(), str(plist)])
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise PanelError(
            "launchctl bootstrap failed for %s%s"
            % (plist, ": " + detail if detail else "")
        )


def panel_bootout(label):
    if not panel_label_loaded(label):
        return False
    result = run_launchctl(["bootout", "gui/%d/%s" % (os.getuid(), label)])
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise PanelError(
            "launchctl bootout failed for %s%s"
            % (label, ": " + detail if detail else "")
        )
    return True


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    return sha256_bytes(Path(path).read_bytes())


def load_panel_state():
    path = panel_state_path()
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise PanelError("cannot read %s: %s" % (path, exc))
    if not isinstance(data, dict):
        raise PanelError("%s is not a JSON object" % path)
    return data


def save_panel_state(state):
    write_atomic(panel_state_path(), encode_json(state))


def _absolute(path):
    return str(Path(path).expanduser().absolute())


def _protected_dir(path):
    """Only the four panel directories may ever be recorded as created."""
    value = _absolute(path)
    recordable = {
        _absolute(panel_home()),
        _absolute(panel_data_dir()),
        _absolute(panel_progress_dir()),
        _absolute(panel_logs_dir()),
    }
    return value not in recordable


def ensure_panel_dir(path, created_dirs):
    path = Path(path)
    if path.exists():
        if not path.is_dir():
            raise PanelError("%s exists and is not a directory" % path)
        return
    missing = []
    probe = path
    while not probe.exists():
        missing.append(probe)
        parent = probe.parent
        if parent == probe:
            break
        probe = parent
    path.mkdir(parents=True, exist_ok=True)
    for created in reversed(missing):
        if not _protected_dir(created):
            created_dirs.append(_absolute(created))


def remove_panel_dirs(created_dirs):
    """Remove the recorded directories; return those that could not go."""
    left = []
    for value in sorted(
        set(created_dirs or []),
        key=lambda item: len(Path(item).parts),
        reverse=True,
    ):
        path = Path(value)
        try:
            path.rmdir()
        except FileNotFoundError:
            continue
        except OSError as exc:
            left.append((path, exc))
    return left


def report_left_dirs(left):
    for path, exc in left:
        print(
            "progress panel: left %s: %s" % (path, exc),
            file=sys.stderr,
        )


def panel_state_file_paths():
    return {
        str(panel_manifest_path()),
        str(panel_plist_path(PANEL_WATCH_LABEL)),
        str(panel_plist_path(PANEL_SERVICE_LABEL)),
    }


def panel_state_dir_paths():
    return {
        str(panel_home()),
        str(panel_data_dir()),
        str(panel_progress_dir()),
        str(panel_logs_dir()),
    }


def validate_panel_state(state):
    """Refuse a state that names anything install did not compute."""
    if not isinstance(state, dict):
        raise PanelError("panel.json is not a JSON object")
    files = state.get("files")
    if not isinstance(files, dict):
        raise PanelError("panel.json: files is not an object")
    allowed_files = panel_state_file_paths()
    for key in files:
        if not isinstance(key, str) or key not in allowed_files:
            raise PanelError(
                "panel.json: files contains an unexpected path: %s" % (key,)
            )
    dirs = state.get("createdDirs")
    if not isinstance(dirs, list):
        raise PanelError("panel.json: createdDirs is not a list")
    allowed_dirs = {_absolute(item) for item in panel_state_dir_paths()}
    for entry in dirs:
        if not isinstance(entry, str):
            raise PanelError(
                "panel.json: createdDirs contains a non-string entry: %r"
                % (entry,)
            )
        if entry not in allowed_dirs:
            raise PanelError(
                "panel.json: createdDirs contains an unexpected directory: %s"
                % entry
            )
    return state


def panel_symlink_refusal():
    candidates = [
        panel_home(),
        panel_data_dir(),
        panel_progress_dir(),
        panel_logs_dir(),
    ]
    candidates.extend(
        panel_data_dir() / ("%s.json" % name) for name in PANEL_OUTPUT_NAMES
    )
    candidates.extend([
        panel_manifest_path(),
        panel_plist_path(PANEL_WATCH_LABEL),
        panel_plist_path(PANEL_SERVICE_LABEL),
    ])
    for item in candidates:
        if item.is_symlink():
            return "%s is a symlink; refusing to touch it" % item
    return None


def panel_bootstrap_command(label):
    return "launchctl bootstrap gui/%d %s" % (
        os.getuid(), panel_plist_path(label),
    )


def panel_views():
    try:
        projects = load_registry()["projects"]
    except (OSError, ValueError):
        return []
    views = []
    for project in projects:
        view = load_project(
            project["path"], project["ref"], stored_id=project.get("id")
        )
        if view.valid and view.data is not None:
            views.append(view)
    return views


_MANIFEST_ESCAPE_RE = re.compile("[\\x7f-\\x9f\\u2028\\u2029\\ud800-\\udfff]")


def manifest_quote(value):
    """JSON-quote a manifest value, escaping characters YAML would misread."""
    text = json.dumps(value, ensure_ascii=False)
    return _MANIFEST_ESCAPE_RE.sub(
        lambda match: "\\u%04x" % ord(match.group(0)), text
    )


def render_manifest():
    lines = [
        "schemaVersion: '0.1'",
        "id: painel",
        "mcpNamespace: painel",
        "title: 'Painel de projetos'",
        "locale: pt-BR",
        "icon: 'mdi:view-dashboard'",
        "dataSources:",
        "  - { id: projetos, path: data/projetos.json, format: json }",
        "  - { id: marcos, path: data/marcos.json, format: json }",
        "  - { id: execucoes, path: data/execucoes.json, format: json }",
        "  - { id: alertas, path: data/alertas.json, format: json }",
        "pages:",
        "  - slug: panorama",
        "    title: Panorama",
        "    icon: 'mdi:view-dashboard'",
        "    default: true",
        "    layout: sections",
        "    sections:",
        "      - title: Projetos",
        "        columns: 12",
        "        widgets:",
        "          - widget: progress-bar",
        "            colSpan: 12",
        "            source: { ref: projetos }",
        "            config: { title: 'Progresso por projeto', labelField: nome, valueField: feito, maxField: total, valueTextField: resumo, captionField: legenda, unit: projetos, footer: false }",
        "      - title: Agora",
        "        columns: 12",
        "        widgets:",
        "          - widget: table",
        "            colSpan: 12",
        "            source: { ref: execucoes }",
        "            config: { title: 'Executores ativos', columns: [projeto, marco, tarefa, papel, executor, equipamento, minutos] }",
        "      - title: Alertas",
        "        columns: 12",
        "        widgets:",
        "          - widget: table",
        "            colSpan: 12",
        "            source: { ref: alertas }",
        "            config: { title: 'Alertas', columns: [projeto, tipo, detalhe] }",
    ]
    for view in panel_views():
        lines.extend([
            "      - title: %s" % manifest_quote(view.title),
            "        columns: 12",
            "        widgets:",
            "          - widget: progress-bar",
            "            colSpan: 12",
            "            source: { ref: marcos, filter: { projeto: %s } }"
            % manifest_quote(view.id),
            "            config: { title: 'Marcos', labelField: titulo, valueField: feito, maxField: total, valueTextField: resumo, captionField: legenda, unit: %s, footer: false }"
            % manifest_quote(view.unit),
        ])
    return "\n".join(lines) + "\n"


def panel_path():
    directories = []
    for executable in (sys.executable, shutil.which("node"), shutil.which("git")):
        if executable:
            directory = str(Path(executable).absolute().parent)
            if directory not in directories:
                directories.append(directory)
    for directory in ("/usr/bin", "/bin"):
        if directory not in directories:
            directories.append(directory)
    return ":".join(directories)


def render_plist(label, program_arguments, progress_dir, logs_dir):
    environment = {"PATH": panel_path()}
    if os.environ.get("ATOMIC_SKILLS_HOME"):
        environment["ATOMIC_SKILLS_HOME"] = os.environ["ATOMIC_SKILLS_HOME"]
    value = {
        "Label": label,
        "ProgramArguments": program_arguments,
        "RunAtLoad": True,
        "KeepAlive": True,
        "ThrottleInterval": 30,
        "WorkingDirectory": str(progress_dir),
        "StandardOutPath": str(Path(logs_dir) / ("%s.log" % label)),
        "StandardErrorPath": str(Path(logs_dir) / ("%s.log" % label)),
        "EnvironmentVariables": environment,
    }
    return plistlib.dumps(value, fmt=plistlib.FMT_XML, sort_keys=True)


def panel_watch_arguments():
    python = sys.executable or "python3"
    arguments = [
        python,
        str(Path(__file__).resolve()),
        "watch",
        "--out",
        str(panel_data_dir()),
        "--interval",
        "2",
        "--fetch-every",
        "120",
    ]
    delegate = find_delegate()
    if delegate:
        delegate = str(Path(delegate).expanduser().absolute())
        if Path(delegate).is_file():
            arguments.extend(["--delegate", delegate])
    return arguments


def panel_client_dir(aideck):
    return Path(aideck).parent / "client"


def panel_service_arguments(aideck, port):
    node = shutil.which("node")
    return [
        node,
        str(aideck),
        "serve",
        "--port=%d" % port,
        "--static-dir=%s" % panel_client_dir(aideck),
    ]


def panel_desired_files(aideck, port):
    manifest = panel_manifest_path()
    watch_plist = panel_plist_path(PANEL_WATCH_LABEL)
    service_plist = panel_plist_path(PANEL_SERVICE_LABEL)
    desired = {
        str(manifest): render_manifest().encode("utf-8"),
        str(watch_plist): render_plist(
            PANEL_WATCH_LABEL,
            panel_watch_arguments(),
            panel_progress_dir(),
            panel_logs_dir(),
        ),
        str(service_plist): render_plist(
            PANEL_SERVICE_LABEL,
            panel_service_arguments(aideck, port),
            panel_progress_dir(),
            panel_logs_dir(),
        ),
    }
    return desired, [watch_plist, service_plist]


def panel_refusal(existing, state):
    """Return a message when an existing file is not ours, else None."""
    recorded = {}
    if isinstance(state, dict) and isinstance(state.get("files"), dict):
        recorded = state["files"]
    for path in existing:
        item = Path(path)
        if item.is_symlink():
            return "%s is a symlink; refusing to replace it" % item
        if not os.path.lexists(item):
            continue
        try:
            current = sha256_file(item)
        except OSError as exc:
            return "%s exists and cannot be hashed: %s" % (item, exc)
        if recorded.get(str(path)) != current:
            return (
                "%s already exists and the panel state does not record it "
                "with the same content" % item
            )
    return None


def refresh_manifest():
    """Regenerate the panel manifest after `add`/`remove`, when still ours."""
    try:
        state = load_panel_state()
        if state is not None:
            validate_panel_state(state)
    except PanelError as exc:
        print("progress: %s" % exc, file=sys.stderr)
        return
    if state is None:
        return
    path = panel_manifest_path()
    recorded = (state.get("files") or {}).get(str(path))
    try:
        if not path.is_file():
            return
        current = sha256_file(path)
    except OSError:
        return
    if recorded != current:
        print(
            "progress: %s foi editado; o manifesto não será regenerado" % path,
            file=sys.stderr,
        )
        return
    try:
        data = render_manifest().encode("utf-8")
        new_hash = sha256_bytes(data)
        if new_hash != current:
            write_atomic(path, data)
        files = dict(state.get("files") or {})
        files[str(path)] = new_hash
        state["files"] = files
        save_panel_state(state)
    except (OSError, PanelError, ValueError) as exc:
        print("progress: cannot regenerate the panel manifest: %s" % exc, file=sys.stderr)


def load_valid_panel_state():
    state = load_panel_state()
    if state is not None:
        validate_panel_state(state)
    return state


def panel_install_target(args):
    try:
        port = int(args.port)
    except (TypeError, ValueError):
        port = None
    if port is None or isinstance(port, bool) or not 1024 <= port <= 65535:
        print("progress panel: invalid port %r (use 1024-65535)" % args.port,
              file=sys.stderr)
        return None
    aideck = Path(args.aideck).expanduser()
    try:
        aideck = aideck.resolve()
    except OSError:
        pass
    if not aideck.is_file():
        print("progress panel: --aideck is not a file: %s" % aideck, file=sys.stderr)
        return None
    client_index = panel_client_dir(aideck) / "index.html"
    if not client_index.is_file():
        print("progress panel: %s is not a file; build the aiDeck with npm run build"
              % client_index, file=sys.stderr)
        return None
    if shutil.which("node") is None:
        print("progress panel: node was not found on PATH", file=sys.stderr)
        return None
    return port, aideck


def panel_install_plan(aideck, port, state):
    desired, plists = panel_desired_files(aideck, port)
    refusal = panel_symlink_refusal() or panel_refusal(desired, state)
    plan = {"port": port, "aideck": aideck, "state": state, "desired": desired,
            "hashes": {path: sha256_bytes(data) for path, data in desired.items()},
            "watch_plist": plists[0], "service_plist": plists[1]}
    return plan, refusal


def panel_data_refusal(plan):
    if plan["state"] is not None:
        return None
    for name in PANEL_OUTPUT_NAMES:
        item = panel_data_dir() / ("%s.json" % name)
        if os.path.lexists(item):
            return ("%s already exists and was not created by panel install; "
                    "move it away and run install again "
                    "(the watch service recreates it)" % item)
    return None


def panel_same_install(plan):
    state = plan["state"]
    if state is None or state.get("files") != plan["hashes"]:
        return False
    for path, digest in plan["hashes"].items():
        if not Path(path).is_file() or sha256_file(path) != digest:
            return False
    return (state.get("port") == plan["port"]
            and state.get("aideck") == str(plan["aideck"]))


def panel_load_missing(plan):
    for label, plist in ((PANEL_WATCH_LABEL, plan["watch_plist"]),
                         (PANEL_SERVICE_LABEL, plan["service_plist"])):
        if not panel_label_loaded(label):
            panel_bootstrap(plist)


def panel_loaded_before(plan):
    if plan["state"] is not None:
        return [label for label in (PANEL_WATCH_LABEL, PANEL_SERVICE_LABEL)
                if panel_label_loaded(label)], None
    for label in (PANEL_WATCH_LABEL, PANEL_SERVICE_LABEL):
        if panel_label_loaded(label):
            return [], ("progress panel: %s is already loaded; refusing to install"
                        % label)
    return [], None


def panel_read_prior(plan):
    prior_files = {}
    for path in plan["desired"]:
        if Path(path).is_file():
            prior_files[path] = Path(path).read_bytes()
    prior_state = None
    if panel_state_path().is_file():
        prior_state = panel_state_path().read_bytes()
    plan["prior_files"] = prior_files
    plan["prior_state"] = prior_state


def panel_stop_old(plan):
    down_old = []
    if plan["state"] is None:
        return down_old, None
    try:
        for label in (PANEL_WATCH_LABEL, PANEL_SERVICE_LABEL):
            if panel_bootout(label):
                down_old.append(label)
    except PanelError as exc:
        return down_old, str(exc)
    return down_old, None


def panel_write_install(plan):
    created_dirs = plan["created_dirs"]
    for directory in (panel_progress_dir(), panel_logs_dir(), panel_home(),
                      panel_data_dir(), panel_launch_agents_dir()):
        ensure_panel_dir(directory, created_dirs)
    for path, data in plan["desired"].items():
        write_atomic(path, data)
    previous_dirs = []
    state = plan["state"]
    if state is not None and isinstance(state.get("createdDirs"), list):
        previous_dirs = [str(item) for item in state["createdDirs"]]
    save_panel_state({"schemaVersion": PANEL_SCHEMA_VERSION, "port": plan["port"],
                      "aideck": str(plan["aideck"]), "files": plan["hashes"],
                      "createdDirs": sorted(set(previous_dirs + created_dirs))})
    for label, plist in ((PANEL_WATCH_LABEL, plan["watch_plist"]),
                         (PANEL_SERVICE_LABEL, plan["service_plist"])):
        panel_bootstrap(plist)
        plan["bootstrapped"].append(label)


def panel_reverse_bootstrapped(bootstrapped):
    rolled_back = set()
    rollback_error = None
    for label in reversed(bootstrapped):
        try:
            panel_bootout(label)
        except PanelError as exc:
            rollback_error = exc
            break
        rolled_back.add(label)
    return rolled_back, rollback_error


def panel_keep_failed_state(plan):
    previous_dirs = []
    state = plan["state"]
    if state is not None and isinstance(state.get("createdDirs"), list):
        previous_dirs = [str(item) for item in state["createdDirs"]]
    try:
        files_now = {}
        for path in plan["desired"]:
            item = Path(path)
            if item.is_file() and not item.is_symlink():
                files_now[path] = sha256_file(item)
        save_panel_state({"schemaVersion": PANEL_SCHEMA_VERSION, "port": plan["port"],
                          "aideck": str(plan["aideck"]), "files": files_now,
                          "createdDirs": sorted(set(previous_dirs + plan["created_dirs"]))})
    except (OSError, PanelError, ValueError) as state_exc:
        print("progress panel: cannot write the panel state: %s" % state_exc,
              file=sys.stderr)


def panel_report_failed_rollback(exc, rollback_error, bootstrapped,
                                 rolled_back, loaded_before):
    print("progress panel: install failed: %s; then bootout failed: %s"
          % (exc, rollback_error), file=sys.stderr)
    for label in bootstrapped:
        if label in rolled_back:
            continue
        print("progress panel: %s is still loaded; run launchctl bootout gui/%d/%s"
              % (label, os.getuid(), label), file=sys.stderr)
    for label in loaded_before:
        try:
            if panel_label_loaded(label):
                continue
        except PanelError:
            continue
        print("progress panel: %s is down; run %s"
              % (label, panel_bootstrap_command(label)), file=sys.stderr)
    print("progress panel: the panel files were kept; run `panel uninstall` afterwards",
          file=sys.stderr)


def panel_restore_install(plan, loaded_before):
    for path, data in plan["prior_files"].items():
        try:
            write_atomic(path, data)
        except OSError:
            pass
    for path in plan["desired"]:
        if path not in plan["prior_files"]:
            try:
                Path(path).unlink()
            except OSError:
                pass
    try:
        if plan["prior_state"] is None:
            panel_state_path().unlink()
        else:
            write_atomic(panel_state_path(), plan["prior_state"])
    except OSError:
        pass
    left = remove_panel_dirs(plan["created_dirs"])
    down = []
    for label in loaded_before:
        try:
            panel_bootstrap(panel_plist_path(label))
        except PanelError:
            down.append(label)
    return down, left


def panel_install_failed(plan, exc, loaded_before):
    bootstrapped = plan["bootstrapped"]
    rolled_back, rollback_error = panel_reverse_bootstrapped(bootstrapped)
    if rollback_error is not None:
        panel_keep_failed_state(plan)
        panel_report_failed_rollback(
            exc, rollback_error, bootstrapped, rolled_back, loaded_before)
        return 1
    down, left = panel_restore_install(plan, loaded_before)
    print("progress panel: install failed: %s" % exc, file=sys.stderr)
    if down:
        print("progress panel: %s down; run %s"
              % (", ".join(down),
                 " and ".join(panel_bootstrap_command(label) for label in down)),
              file=sys.stderr)
    report_left_dirs(left)
    return 1


def cmd_panel_install(args):
    problem = panel_platform_error()
    if problem:
        print(problem, file=sys.stderr)
        return 2
    target = panel_install_target(args)
    if target is None:
        return 1
    port, aideck = target
    try:
        state = load_valid_panel_state()
    except PanelError as exc:
        print("progress panel: %s" % exc, file=sys.stderr)
        return 1
    plan, refusal = panel_install_plan(aideck, port, state)
    refusal = refusal or panel_data_refusal(plan)
    if refusal:
        print("progress panel: %s" % refusal, file=sys.stderr)
        return 1
    if panel_same_install(plan):
        try:
            panel_load_missing(plan)
        except PanelError as exc:
            print("progress panel: %s" % exc, file=sys.stderr)
            return 1
        print("panel already installed on port %d" % port)
        return 0
    try:
        loaded_before, load_error = panel_loaded_before(plan)
    except PanelError as exc:
        print("progress panel: %s" % exc, file=sys.stderr)
        return 1
    if load_error:
        print(load_error, file=sys.stderr)
        return 1
    try:
        panel_read_prior(plan)
    except OSError as exc:
        print("progress panel: cannot read the previous panel files; "
              "nothing was stopped: %s" % exc, file=sys.stderr)
        return 1
    down_old, stop_error = panel_stop_old(plan)
    if stop_error:
        print("progress panel: %s" % stop_error, file=sys.stderr)
        if down_old:
            print("progress panel: %s is down; run %s"
                  % (", ".join(down_old),
                     " and ".join(panel_bootstrap_command(label)
                                  for label in down_old)),
                  file=sys.stderr)
        return 1
    plan["created_dirs"] = []
    plan["bootstrapped"] = []
    try:
        panel_write_install(plan)
    except Exception as exc:
        return panel_install_failed(plan, exc, loaded_before)
    print("panel installed on http://127.0.0.1:%d" % port)
    return 0


def panel_bootout_installed():
    down = []
    try:
        for label in (PANEL_WATCH_LABEL, PANEL_SERVICE_LABEL):
            if panel_bootout(label):
                down.append(label)
    except PanelError as exc:
        return down, str(exc)
    return down, None

def panel_remove_logs():
    failed = False
    for label in (PANEL_WATCH_LABEL, PANEL_SERVICE_LABEL):
        item = panel_logs_dir() / ("%s.log" % label)
        try:
            item.unlink()
        except FileNotFoundError:
            pass
        except OSError as exc:
            print("progress panel: cannot remove %s: %s" % (item, exc),
                  file=sys.stderr)
            failed = True
    return failed

def panel_remove_state_files(files):
    failed = False
    for path, digest in files.items():
        item = Path(path)
        if not os.path.lexists(item):
            continue
        try:
            current = sha256_file(item)
        except OSError as exc:
            print("progress panel: kept %s: %s" % (item, exc), file=sys.stderr)
            failed = True
            continue
        if current != digest:
            print("progress panel: kept %s (its content changed)" % item,
                  file=sys.stderr)
            continue
        try:
            item.unlink()
        except OSError as exc:
            print("progress panel: cannot remove %s: %s" % (item, exc),
                  file=sys.stderr)
            failed = True
    return failed

def panel_remove_data_files():
    failed = False
    for name in PANEL_OUTPUT_NAMES:
        try:
            (panel_data_dir() / ("%s.json" % name)).unlink()
        except FileNotFoundError:
            pass
        except OSError as exc:
            print("progress panel: cannot remove %s: %s" % (name, exc),
                  file=sys.stderr)
            failed = True
    return failed

def panel_remove_state():
    try:
        panel_state_path().unlink()
    except FileNotFoundError:
        return None
    except OSError as exc:
        return "cannot remove %s: %s" % (panel_state_path(), exc)
    return None

def panel_state_created_dirs(state):
    return [str(item) for item in (state.get("createdDirs") or [])]

def cmd_panel_uninstall(args):
    problem = panel_platform_error()
    if problem:
        print(problem, file=sys.stderr)
        return 2
    try:
        state = load_valid_panel_state()
    except PanelError as exc:
        print("progress panel: %s" % exc, file=sys.stderr)
        return 1
    if state is None:
        print("panel: nothing is installed")
        return 0
    refusal = panel_symlink_refusal()
    if refusal:
        print("progress panel: %s" % refusal, file=sys.stderr)
        return 1
    down, stop_error = panel_bootout_installed()
    if stop_error:
        print("progress panel: %s" % stop_error, file=sys.stderr)
        if down:
            print("progress panel: %s is down; the state was kept" % ", ".join(down),
                  file=sys.stderr)
        return 1
    failed = panel_remove_logs()
    files = state.get("files") if isinstance(state.get("files"), dict) else {}
    if panel_remove_state_files(files):
        failed = True
    created_dirs = panel_state_created_dirs(state)
    if str(panel_data_dir()) in created_dirs:
        if panel_remove_data_files():
            failed = True
    if failed:
        print("progress panel: uninstall incomplete; the state was kept",
              file=sys.stderr)
        return 1
    error = panel_remove_state()
    if error:
        print("progress panel: %s" % error, file=sys.stderr)
        return 1
    left = remove_panel_dirs(created_dirs)
    print("panel uninstalled")
    report_left_dirs(left)
    return 0


def cmd_panel_status(args):
    problem = panel_platform_error()
    if problem:
        print(problem, file=sys.stderr)
        return 2
    try:
        state = load_panel_state()
    except PanelError as exc:
        print("progress panel: %s" % exc, file=sys.stderr)
        return 1
    port = state.get("port") if isinstance(state, dict) else None
    url = "http://127.0.0.1:%s" % port if port else None
    try:
        labels = {
            label: {"loaded": panel_label_loaded(label)}
            for label in (PANEL_WATCH_LABEL, PANEL_SERVICE_LABEL)
        }
    except PanelError as exc:
        print("progress panel: %s" % exc, file=sys.stderr)
        return 1
    projetos = panel_data_dir() / "projetos.json"
    try:
        mtime = time.strftime(
            "%Y-%m-%dT%H:%M:%S", time.localtime(projetos.stat().st_mtime)
        )
    except OSError:
        mtime = None
    result = {
        "installed": bool(state),
        "port": port,
        "url": url,
        "labels": labels,
        "projetos": {"path": str(projetos), "mtime": mtime},
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    print("panel: %s" % ("installed" if state else "not installed"))
    if port:
        print("port: %s" % port)
        print("url: %s" % url)
    for label, value in labels.items():
        print("%s: %s" % (label, "loaded" if value["loaded"] else "not loaded"))
    print("projetos.json: %s" % (mtime or "missing"))
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

    panel = sub.add_parser("panel", help="install or inspect the macOS panel service")
    panel_sub = panel.add_subparsers(dest="panel_command", required=True)
    panel_install = panel_sub.add_parser("install", help="install and load the service")
    panel_install.add_argument("--aideck", required=True)
    panel_install.add_argument("--port", default=str(DEFAULT_PANEL_PORT))
    panel_install.set_defaults(func=cmd_panel_install)
    panel_uninstall = panel_sub.add_parser("uninstall", help="unload and remove the service")
    panel_uninstall.set_defaults(func=cmd_panel_uninstall)
    panel_status = panel_sub.add_parser("status", help="print the panel service state")
    panel_status.add_argument("--json", action="store_true")
    panel_status.set_defaults(func=cmd_panel_status)

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
