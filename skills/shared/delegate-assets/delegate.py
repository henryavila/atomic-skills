#!/usr/bin/env python3
"""delegate.py — run an external executor on a task card and keep the audit trail.

Requires Python 3.9 or later on macOS or Linux.

Subcommands:
  run       launch one executor (opencode/DeepSeek, codex, or agy) on a card, headless,
            with a hard timeout; capture output; append a `run` record with measured facts.
  pipeline  run executor, auto-commit if uncommitted, run host gate, run review,
            and output summary in one call.
  record    append what only the orchestrator knows (host gate, review, rework) to the
            same task id.
  report    summarise the log (per executor/model: gate pass rate, review findings, time).
  status    print active/paused, running slots, and recent provider limits with reset times.
  pause     pause all runner executions across the machine.
  resume    resume runner executions.
  kill      kill running executor process group for a given task id.
  peak      say whether now is inside the DeepSeek peak window.
  review-pending  list the pipelines whose review could not run for lack of
            quota or a free slot, or finish one (--id).
  route     print the executor route and the review routes for a role, with the
            profiles that can run now first and the limits still in force.
  profiles  list configured profiles and whether each executor CLI is available.
  remote-clean  remove a remote task checkout, its kept copies and run files (with --host).

The log is one JSONL file shared by every project and agent on this machine:
  ${ATOMIC_SKILLS_HOME:-~/.atomic-skills}/delegate/runs.jsonl
Records are append-only. Values are enums, never free text, so the log can be audited.
"""
import argparse, dataclasses, datetime as dt, errno, fcntl, getpass, hashlib, json, os, re, shlex, shutil, signal, socket, subprocess, sys, time, tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

HOME = Path(os.environ.get("ATOMIC_SKILLS_HOME", Path.home() / ".atomic-skills"))
LOG = HOME / "delegate" / "runs.jsonl"
RUNNING = HOME / "delegate" / "running"
# One file per active --host run, for `status` and the progress panel. These are
# not slots: nothing here counts against a local limit or is ever signalled.
RUNNING_REMOTE = HOME / "delegate" / "running-remote"
# An active file that names no runner identity and no limit of its own ends
# this long after it was written.
REMOTE_ACTIVE_FALLBACK_S = 24 * 3600
PAUSED = HOME / "delegate" / "PAUSED"
# One file per pipeline whose review could not run yet: <project>/<id>.json.
PENDING = HOME / "delegate" / "pending"
# A review attempt that ended this way says nothing about the work: the reviewer
# never read it. A route that ends only in these is pending, not failed.
NO_CAPACITY = ("provider_limit", "slot_timeout")

# DeepSeek's published peak windows in UTC, Monday-Friday only, end minute
# excluded; OpenCode Go follows them. Base price is the low one and peak costs
# double. DeepSeek also bills Chinese public holidays as off-peak; the runner
# does not know them and treats such a day as a normal weekday.
DEFAULT_PEAK_WINDOWS = "01:00-04:00,06:00-10:00"
CODEX_MODEL = os.environ.get("DELEGATE_CODEX_MODEL") or "gpt-6.1-sol"
# OpenCode runs two models: Flash, and Muse Spark as the executor during peak
# hours and a reviewer of Flash work. The variable can only pin Flash to its own
# value; with any other value check_model_allowed refuses the Flash profiles
# before anything is launched. Nothing overrides the Muse model.
FLASH_MODEL = "opencode-go/deepseek-v4.1-flash"
MUSE_MODEL = "opencode-go/muse-spark-1.3-contributor"
OPENCODE_MODELS = (FLASH_MODEL, MUSE_MODEL)
# The family of an OpenCode model, whatever profile or override named it.
OPENCODE_FAMILIES = {FLASH_MODEL: "deepseek", MUSE_MODEL: "meta"}
# Models whose provider trains on request data, and who: Muse answers only
# while the OpenCode console allows paid endpoints that train on it.
TRAINS_ON_REQUESTS = {MUSE_MODEL: "Meta"}
OPENCODE_MODEL = os.environ.get("DELEGATE_OPENCODE_MODEL") or FLASH_MODEL
LIMIT_RE = re.compile(r"usage limit|rate limit|quota|too many requests|\b429\b", re.IGNORECASE)
# Antigravity's stderr line when print mode denied a tool it could not ask about.
AGY_DENIED_RE = re.compile(r"required the \W*([\w-]+)\W* permission that headless mode cannot prompt for"
                           r".{0,40}?auto-denied")
# The last line of an old-format review, where the reviewer chose each severity.
TOTAL_RE = re.compile(r"^[ \t`*]*TOTAL major=(\d+) medium=(\d+) minor=(\d+)[ \t`*]*$")
# The last line of a review in the format of severity-rubric.md.
FINDINGS_RE = re.compile(r"^[ \t`*]*FINDINGS (\d+)[ \t`*]*$")
# A finding line, with leading markdown decoration tolerated as TOTAL_RE does:
# `F01 |`, `- F01 |`, `**F01** |`, `` `F01` | ``.
FINDING_LINE_RE = re.compile(r"^\W*([FR]\d+)[\s`*_]*\|(.*)$")
FINDING_ID_RE = re.compile(r"[FR]\d+")

# severity-rubric.md, the file every review prompt ends with, as data. The
# reviewer never writes a severity: it answers six questions per finding and
# compute_severity applies this table. The document and this structure must
# say the same thing; tests/delegate-runner-severity.test.js reads the document
# and compares. To tune the rubric, change both.
ANOTHER_FINDING = "another finding"  # dup: the id of another finding of the review
A_QUOTE = "a quote"                  # card: a quote of the requirement not delivered
SEVERITY_RUBRIC = {
    # The allowed words of each answer, in the order the reviewer gives them.
    "answers": {
        "origin": ("diff", "base"),
        "dup": ("none", ANOTHER_FINDING),
        "card": ("none", A_QUOTE),
        "kind": ("access", "data", "behaviour", "test-void", "test-gap",
                 "doc-false", "doc-loose", "upkeep", "style"),
        "reach": ("none", "edge", "normal", "-"),
        "proof": ("shown", "none"),
    },
    # Only these kinds answer reach; every other kind answers "-".
    "reach_kinds": ("access", "data", "behaviour"),
    # The first row whose answers all match gives the result. The row with
    # "lowers" applies the rows below it and replaces that result when it is
    # the "lowers" value.
    "table": (
        {"when": {"origin": ("base",)}, "result": "pre-existing"},
        {"when": {"dup": (ANOTHER_FINDING,)}, "result": "merged"},
        {"when": {"proof": ("none",)}, "lowers": "major", "result": "medium"},
        {"when": {"card": (A_QUOTE,)}, "result": "major"},
        {"when": {"kind": ("access", "data"), "reach": ("normal", "edge")}, "result": "major"},
        {"when": {"kind": ("access", "data"), "reach": ("none",)}, "result": "medium"},
        {"when": {"kind": ("behaviour",), "reach": ("normal",)}, "result": "major"},
        {"when": {"kind": ("behaviour",), "reach": ("edge",)}, "result": "medium"},
        {"when": {"kind": ("behaviour",), "reach": ("none",)}, "result": "minor"},
        {"when": {"kind": ("test-void",)}, "result": "major"},
        {"when": {"kind": ("doc-false",)}, "result": "major"},
        {"when": {"kind": ("test-gap", "upkeep")}, "result": "medium"},
        {"when": {"kind": ("doc-loose", "style")}, "result": "minor"},
    ),
}
COUNTED = ("major", "medium", "minor")
ANSWER_RE = re.compile(r"^(" + "|".join(SEVERITY_RUBRIC["answers"]) + r")\s*=(.*)$", re.S)
QUOTE_MARKS = {'"': '"', "'": "'", "“": "”", "‘": "’", "«": "»", "`": "`"}

# The fallback reviewer. It is used only when the operator said yes to it
# (--allow-claude-review) and never for work written by a Claude model.
CLAUDE_MODEL = os.environ.get("DELEGATE_CLAUDE_MODEL") or "claude-sonnet-5-5"
CLAUDE_REVIEW = "claude-review"
# Claude Code prints its session limit on stdout and exits 0:
#   "You've hit your session limit · resets 5:10pm (America/Sao_Paulo)"
CLAUDE_LIMIT_RE = re.compile(
    r"hit\s+your\s+(?:session|usage|weekly)\s+limit|session\s+limit\s*\S?\s*resets"
    r"|insufficient\s+balance|credit\s+balance\s+is\s+too\s+low", re.IGNORECASE)
RESET_ZONE_RE = re.compile(r"resets(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*([ap]m)\s*\(([\w/+-]+)\)", re.IGNORECASE)

MODELS = {
    "flash": ("opencode", OPENCODE_MODEL, "deepseek"),
    "flash-review": ("opencode", OPENCODE_MODEL, "deepseek"),
    "muse": ("opencode", MUSE_MODEL, "meta"),
    "muse-review": ("opencode", MUSE_MODEL, "meta"),
    "codex": ("codex", CODEX_MODEL, "openai"),
    "codex-review": ("codex", CODEX_MODEL, "openai"),
    "agy": ("agy", "gemini-4-hydrogen-high", "gemini"),
    "agy-review": ("agy", "gemini-4-hydrogen-xhigh", "gemini"),
    # Antigravity's two other quota groups. Claude models there only review: the
    # orchestrator is usually Claude and never hands implementation to its family.
    "agy-argon": ("agy", "gemini-4-argon-high", "gemini"),
    "agy-argon-review": ("agy", "gemini-4-argon-high", "gemini"),
    "agy-sonnet-review": ("agy", "claude-sonnet-5-5-medium", "anthropic"),
    "agy-opus-review": ("agy", "claude-opus-5-5-medium", "anthropic"),
    CLAUDE_REVIEW: ("claude", CLAUDE_MODEL, "anthropic"),
}
# Antigravity's independent quota groups, as `agy -p /quota` lists them. Models of
# a group share its limits; a model outside this list keeps a limit of its own.
AGY_POOLS = ("gemini", "claude-gpt", "argon")
AGY_POOL_PREFIXES = (
    ("gemini-4-argon-", "argon"),
    ("claude-", "claude-gpt"),
    ("gpt-oss-", "claude-gpt"),
    ("gemini-4-neon-", "gemini"),
    ("gemini-4-hydrogen-", "gemini"),
    ("gemini-3.8-flash-", "gemini"),
    ("gemini-pro-orchestrator-neon", "gemini"),
)
# Bucket ids in the same output; the Argon prefix has to be tried before Gemini's.
AGY_BUCKET_POOLS = (("gemini-argon-", "argon"), ("3p-", "claude-gpt"), ("gemini-", "gemini"))
AGY_QUOTA_TIMEOUT_S = 15
# Opus is for validating small items: above this prompt size it is not launched.
AGY_OPUS_MAX_INPUT_BYTES = 40 * 1024
OVER_MODEL_CAP = "review_over_model_cap"
# Executor capabilities shared by every profile using that CLI.
EXECUTOR_FLAGS = {
    "opencode": {"requires_review_diff": False},
    "codex": {"requires_review_diff": False},
    "agy": {"requires_review_diff": True},
    # No shell and no git: the diff has to arrive in the prompt.
    "claude": {"requires_review_diff": True},
}
MAX_REVIEW_INPUT_BYTES = 600 * 1024
# Remote runs use the separate `remote-runner` CLI (PATH or DELEGATE_REMOTE_RUNNER).
# The per-task checkout lives under the remote user's home by default. Policy paths
# are placeholders the shipped wrapper expands; the root is never opened directly.
REMOTE_BASE_DEFAULT = "~/.atomic-skills/delegate/remote"
REMOTE_POLICY_ROOT = "/__DELEGATE_REMOTE_BASE__"
REMOTE_BASE_PLACEHOLDER = "__DELEGATE_REMOTE_BASE__"
REMOTE_RESULT_PREFIX = ".delegate-remote-"
# Linux rejects any single argv element above MAX_ARG_STRLEN (131072 bytes).
# OpenCode takes the prompt as an argv element (`opencode run --help`:
# "[<message...>]"; `--file` only attaches a file to that message), so it is
# capped at this measured limit. Codex (`codex exec --help`: PROMPT "read from
# stdin" when absent or "-") and Antigravity (print mode reads the prompt from
# stdin when `-p` has no prompt argument) receive it on stdin instead.
MAX_ARG_BYTES = 131072
ARGV_PROMPT_EXECUTORS = {"opencode"}
# Approval/sandbox bypass flags. The runner never places one in an argv, in any
# mode; guard_argv enforces that invariant before a child is launched.
FORBIDDEN_ARGV_FLAGS = (
    "--auto",
    "--dangerously-skip-permissions",
    "--danger-full-access",
    "--dangerously-bypass-approvals-and-sandbox",
    "--yolo",
    "--allow-dangerously-skip-permissions",
)
# TERM grace before an orphaned executor group is killed.
ORPHAN_GRACE_S = 2.0
# Poll intervals for the executor's descendant tree: fast while a child is
# likely to detach, then a slow watch for the rest of a long run.
ORPHAN_POLL_S = 0.5
ORPHAN_POLL_WINDOW_S = 10.0
ORPHAN_POLL_SLOW_S = 3.0
# A `ps` call must never hold up the timeout or a signal handler.
ORPHAN_PS_TIMEOUT_S = 3.0
# Linux prctl(2) name for the child-subreaper bit.
PR_SET_CHILD_SUBREAPER = 36
PR_GET_CHILD_SUBREAPER = 37
# Commands kept in the `orphans.sample` of a run record.
ORPHAN_SAMPLE = 5
ORPHAN_SAMPLE_CHARS = 80
# Output names that belong to one run round; a repeated id or a later attempt
# must never overwrite them.
# Defaults for the two limits of a run, in seconds: the cap on the whole run and
# the longest stretch without any sign of progress.
DEFAULT_TIMEOUT_S = 240 * 60
DEFAULT_IDLE_TIMEOUT_S = 20 * 60
MIN_TIMEOUT_S = 60
# How often the runner looks for progress (output size, HEAD, working tree).
try:
    PROGRESS_POLL_S = min(10.0, max(0.05, float(os.environ.get("DELEGATE_PROGRESS_POLL_S") or 10.0)))
except ValueError:
    PROGRESS_POLL_S = 10.0
RESUME_TAIL_LINES = 60
CHECKPOINT_SUFFIX = "work in progress (checkpoint by the delegate runner)"
STOP_REASONS = {
    "stalled": "no progress for {idle} s (the idle limit, --idle-timeout)",
    "timeout": "the run reached its time cap of {cap} s (--timeout)",
    "interrupted": "the runner received a stop signal",
    "orphaned": "the process that started the runner went away",
}
RUN_OUTPUT_SUFFIXES = (".out.md", ".err", ".last.md", ".prompt.md")
ALIASES = {
    "deepseek-light": "flash",
}
# A reviewer route that names `flash` means `flash-review`, and `muse` means
# `muse-review`: the only rule for a
# reviewer is that it is not of the family that wrote the code.
REVIEW_PROFILES = {"flash": "flash-review", "muse": "muse-review"}
FLASH_PROFILES = ("flash", "flash-review")
FAMILIES = ["deepseek", "meta", "openai", "gemini", "anthropic"]
FAMILIES_TEXT = ", ".join(FAMILIES[:-1]) + " or " + FAMILIES[-1]
# Removed on 2026-11-18, when OpenCode ran a single model (Flash). Old log lines may
# still name these profiles, their models and their families; readers must keep
# showing them, but no new run may be launched with one.
REMOVED_PROFILES = ("hy4-review", "glm-flash", "kimi")
REMOVED_PROFILE_MESSAGE = ("delegate: profile {name} was removed; valid profiles: "
                           "flash, flash-review, codex, codex-review, agy, agy-review, agy-argon, "
                           "agy-argon-review, agy-sonnet-review, agy-opus-review, claude-review, "
                           "muse, muse-review")
# Fixed routes, the same as the skill's "Routing by role" table. `route` and
# `pipeline` only reorder them by availability; they never add a profile.
EXECUTOR_ROUTES = {
    "mechanical": ["flash", "codex", "agy-argon"],
    "test": ["flash", "codex", "agy-argon"],
    "implement": ["flash", "codex", "agy-argon"],
    "fix": ["flash", "codex", "agy-argon"],
}
# Implement or fix with open design decisions, concurrency, security or migrations.
OPEN_DESIGN_ROUTE = ["codex", "agy-argon", "agy"]
# Goes in front of an EXECUTOR_ROUTES route while in_peak() is true: DeepSeek
# costs double then.
PEAK_EXECUTOR = "muse"
# Reviewers by the family that wrote the code; never that family itself. Opus is
# in no fixed route: it is named for a small item, with the operator's yes.
REVIEW_ROUTES = {
    "deepseek": ["muse-review", "codex-review", "agy-sonnet-review", "agy-argon-review", "agy-review"],
    # Muse writes code during peak hours, when a Flash review costs double.
    "meta": ["codex-review", "agy-sonnet-review", "agy-argon-review", "agy-review", "flash-review"],
    "openai": ["flash-review", "agy-sonnet-review", "agy-argon-review", "agy-review"],
    "gemini": ["codex-review", "flash-review", "agy-sonnet-review"],
}
# Provider limit messages, as printed by the CLIs (read from real run outputs):
#   Codex:       "... or try again at 12:28 PM."   (wall-clock time, machine time zone)
#   Codex:       "... or try again at Nov 25th, 2026 7:44 AM."   (same, with a date)
#   Antigravity: "... Resets in 107h24m20s."
RESET_AT_RE = re.compile(r"try again at (\d{1,2}):(\d{2})\s*([AP]M)", re.IGNORECASE)
RESET_AT_DATE_RE = re.compile(
    r"try again at ([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*([AP]M)",
    re.IGNORECASE)
MONTHS = ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec")
RESET_IN_RE = re.compile(r"Resets in ((?:\d+[hms])+)", re.IGNORECASE)
# Used when a limit message carries no reset time; DELEGATE_COOLDOWN_<EXECUTOR> changes it.
DEFAULT_COOLDOWN_S = 60 * 60
# A later run with one of these results reached the provider, so the limit is over.
LIMIT_CLEARED_BY = ("none", "review_wrote", "incomplete_review", "timeout", "stalled")
ROLES = ["implement", "fix", "review", "mechanical", "test"]
GATE = ["pass", "fail", "not_run"]
DELIVERED = ["yes", "partial", "no"]

DEFAULT_MAX_SLOTS = {
    "opencode": 10,
    "codex": 1,
    "agy": 2,
    "claude": 1,
}


def now():
    raw = os.environ.get("DELEGATE_NOW")
    if raw:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        parsed = dt.datetime.fromisoformat(raw)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc)
    return dt.datetime.now(dt.timezone.utc)


def parse_peak_windows(raw):
    windows = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        start, end = part.split("-", 1)
        windows.append((start.strip(), end.strip()))
    return windows


def in_peak(t=None):
    raw = os.environ.get("DELEGATE_PEAK_WINDOWS", DEFAULT_PEAK_WINDOWS)
    windows = parse_peak_windows(raw)
    if not windows:
        return False
    utc_t = (t or now()).astimezone(dt.timezone.utc)
    if utc_t.weekday() >= 5:
        return False
    hhmm = utc_t.strftime("%H:%M")
    for start, end in windows:
        if start <= end:
            if start <= hhmm < end:
                return True
        elif hhmm >= start or hhmm < end:
            return True
    return False


def local_machine():
    """Short name of the machine this runner is on."""
    return socket.gethostname().split(".")[0]


# What the command in this process works for: the repository of its --cwd and
# the --milestone it was given. Set once by `run`, `pipeline` and
# `review-pending`, before anything is launched or logged.
ATTRIBUTION = {"repo": None, "milestone": None}

MILESTONE_RE = re.compile(r"[A-Za-z0-9._-]{1,64}")
REPO_PART_RE = re.compile(r"[A-Za-z0-9._-]+")


def milestone_arg(text):
    if not MILESTONE_RE.fullmatch(text):
        raise argparse.ArgumentTypeError(
            "invalid milestone id: use 1 to 64 letters, digits, dots, underscores or hyphens")
    return text


def repo_from_url(url):
    """`owner/name` of a remote URL, or None when it has no such shape.

    Reads `scheme://[user[:password]@]host[:port]/owner/name[.git]` and the
    scp-like `[user@]host:owner/name[.git]`. Only the last two path segments
    are returned, so the host and any credentials in the URL are never part of
    the answer. A local path or a `file:` URL in any form (`file:/path`,
    `file:path`, `file://host/path`, any case) names no owner and gives None.
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
        # scp-like: a host before the first colon, and no slash before it.
        scp = re.fullmatch(r"(?:[^@/:]+@)?([^@/:]+):(.+)", url, re.S)
        if not scp or len(scp.group(1)) < 2:  # one letter is a Windows drive
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
    return f"{owner}/{name}"


def common_dir_path(cwd):
    """Absolute path of the common git directory of `cwd`; "" outside git.

    Asks for the plain `--git-common-dir`, which git prints relative to `cwd`
    or absolute, and resolves it here. `rev-parse --path-format=absolute` is
    not used: a git older than 2.31 does not know that option and, as with any
    option it does not know, prints it back and exits 0, so its answer would
    be read as part of the path.
    """
    common = git(cwd, "rev-parse", "--git-common-dir")
    if not common or "\n" in common:
        return ""
    return str((Path(cwd) / common).resolve())


def repo_identity(cwd):
    """Stable name of the repository `cwd` belongs to; None outside git.

    The same from the main checkout and from every linked worktree: `owner/name`
    of the origin remote, else the name of the directory that holds the main
    repository (found through the git common directory, never the worktree's
    own folder). It never raises: a run must not fail because of it.
    """
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
        else:  # a bare repository, or the git directory of a submodule
            name = common_path.name[:-4] if common_path.name.endswith(".git") else common_path.name
        return name or None
    except (OSError, RuntimeError, UnicodeError, ValueError):
        return None


def set_attribution(cwd, milestone):
    ATTRIBUTION.update(repo=repo_identity(cwd), milestone=milestone)


def append(rec):
    if rec.get("kind") in ("run", "pipeline"):
        # Every run says where its executor ran: the --host name, or this machine.
        if not rec.get("machine"):
            rec["machine"] = rec.get("host") or local_machine()
        # And what it worked for; a record that names its own keeps them.
        for key, value in ATTRIBUTION.items():
            rec.setdefault(key, value)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG, "a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def git(cwd, *a):
    try:
        r = subprocess.run(["git", "-C", cwd, *a], capture_output=True, text=True)
    except OSError:
        return ""
    return r.stdout.strip() if r.returncode == 0 else ""


def git_bytes(cwd, *a):
    try:
        r = subprocess.run(["git", "-C", cwd, *a], capture_output=True)
    except OSError:
        return b""
    return r.stdout if r.returncode == 0 else b""


def tree_snapshot(cwd):
    head = git(cwd, "rev-parse", "HEAD")
    status = git_bytes(cwd, "status", "--porcelain=v1", "-z", "--untracked-files=all").decode(
        "utf-8", errors="surrogateescape"
    )
    diff_hash = hashlib.sha256(git_bytes(cwd, "diff", "HEAD")).hexdigest()
    return (head, status, diff_hash)


def find_optional(binary):
    p = shutil.which(binary)
    if p or os.environ.get("DELEGATE_NO_FALLBACK_PATHS") == "1":
        return p
    for d in ("~/.npm-global/bin", "~/.local/bin", "~/.opencode/bin", "/opt/homebrew/bin"):
        c = Path(d).expanduser() / binary
        if c.exists():
            return str(c)
    if binary == "opencode":
        # The desktop app ships the CLI inside the bundle and does not add it to PATH.
        apps = [Path("/Applications"), Path("~/Applications").expanduser(),
                *Path("/Volumes").glob("*/Applications")]
        for app in apps:
            c = app / "OpenCode.app/Contents/Resources/opencode-cli"
            if c.exists():
                return str(c)
    return None


def find(binary):
    p = find_optional(binary)
    if p:
        return p
    sys.exit(f"delegate: `{binary}` not found on PATH, in the usual bin folders, or (opencode) inside "
             "OpenCode.app; install it or add it to PATH")


def git_common_dir(cwd):
    """Absolute common git directory, also for a linked worktree.

    `git rev-parse --git-common-dir` resolves to the main checkout's `.git`
    directory (`<repo>/.git`) for both a plain checkout and a linked worktree;
    a linked worktree's own metadata lives under `.git/worktrees/<name>`, which
    is not this directory. The resolved path is validated before it is trusted
    or made writable.
    """
    common = common_dir_path(cwd)
    if not common:
        return ""
    resolved = Path(common)
    if not (resolved / "HEAD").is_file() or not (resolved / "objects").is_dir():
        usage_error(f"git common directory {str(resolved)!r} has no HEAD file and objects directory; "
                    "refusing to run against it")
    return str(resolved)


def is_within(path, parent):
    try:
        Path(path).resolve().relative_to(Path(parent).resolve())
        return True
    except ValueError:
        return False


def unique_paths(paths):
    seen, result = set(), []
    for raw in paths:
        if not raw:
            continue
        path = str(Path(raw).resolve())
        if path not in seen:
            seen.add(path)
            result.append(path)
    return result


def access_policy(executor, role, cwd, out_path=None, strict=False, common_dir=None,
                  home_dirs=None):
    """Build the flags and the audit description for one executor and role.

    One policy by role; each branch below quotes the CLI help or config
    reference line that justifies the flag used. A CLI that cannot express a
    grant records it under `limits` instead of dropping the sandbox.

    `common_dir` and `home_dirs` are supplied by the remote path: its checkout
    and per-run directory are not local paths, so they must not be discovered
    with local git or the local runner home.
    """
    review = role == "review"
    common = git_common_dir(cwd) if common_dir is None else common_dir
    home_dirs = ([HOME / "delegate" / "cards", HOME / "delegate" / "out"]
                 if home_dirs is None else list(home_dirs))
    if out_path:
        home_dirs.append(out_path)
    extra_read = unique_paths([common, *home_dirs])
    git_common_limit = ("git write includes the main repository's config, hooks "
                        "and other worktrees' refs")

    # codex --help: "--add-dir <DIR> Additional directories that should be
    #   writable alongside the primary workspace"
    # codex config reference: "sandbox_workspace_write.network_access boolean
    #   Allow outbound network access inside the workspace-write sandbox."
    if executor == "claude":
        # claude --help: "--tools <tools...> Specify the list of available tools
        #   from the built-in set"; "--permission-mode <mode>" (choices include
        #   "dontAsk"). With only the three read tools there is no shell, no
        #   edit tool and no network to remove, so strict is the same policy.
        return {"argv": ["--tools", "Read,Grep,Glob", "--permission-mode", "dontAsk"], "env": {}, "access": {
            "mode": "strict" if strict else "policy", "network": False, "git_write": False,
            "extra_read": [], "limits": [
                "claude has only the Read, Grep and Glob tools: no shell, no git command and "
                "no network; the diff and the cards arrive in the prompt",
                "claude has no sandbox: what it may read is decided by Claude Code's own "
                "permission rules, and review_wrote still checks the tree"]}}
    if strict:
        # Strict removes grants from the default role policy; it never adds a
        # CLI's factory bypass. Every branch below is therefore a subset of the
        # same executor and role in the policy branch.
        argv, env, limits = [], {}, []
        if executor == "codex":
            # build_argv keeps the per-role sandbox (workspace-write for
            # implement, read-only for review). Strict only removes the
            # workspace-write network switch and the extra writable directory.
            limits.append("strict: no network and no --add-dir; "
                          "the codex sandbox mode is unchanged")
            return {"argv": [], "env": {}, "access": {
                "mode": "strict", "network": False, "git_write": False,
                "extra_read": [], "limits": limits}}
        elif executor == "opencode":
            # Same role rules as the default, minus web access and every grant
            # outside the worktree. No approval bypass: the explicit permission
            # rules and the private server remain in place.
            rules = [
                {"action": "external_directory", "resource": "*", "effect": "deny"},
                {"action": "read", "resource": "*", "effect": "allow"},
                {"action": "shell", "resource": "*", "effect": "allow"},
                {"action": "webfetch", "resource": "*", "effect": "deny"},
                {"action": "websearch", "resource": "*", "effect": "deny"},
                {"action": "edit", "resource": "*", "effect": "deny"},
            ]
            if not review:
                rules.append({"action": "edit", "resource": "*", "effect": "allow"})
                for path in ("..", "../*"):
                    rules.append({"action": "edit", "resource": path, "effect": "deny"})
                for path in unique_paths([common, *home_dirs]):
                    if path and not is_within(path, cwd):
                        rules.append({"action": "edit", "resource": f"{path}/*",
                                      "effect": "deny"})
            env["OPENCODE_CONFIG_CONTENT"] = json.dumps({"permissions": rules})
            limits.append("OpenCode has no sandbox: shell runs with the host user's "
                          "filesystem and network authority")
            limits.append("strict: webfetch and websearch are denied and only the "
                          "worktree is editable; shell can still reach the network "
                          "and write elsewhere")
            network = git_write = True
            if review:
                limits.append("reviewer can still write through the shell; "
                              "only the edit tool is denied")
            else:
                limits.append("edit tool is limited to the worktree; shell can "
                              "still write elsewhere")
            return {"argv": [], "env": env, "access": {
                "mode": "strict", "network": network, "git_write": git_write,
                "extra_read": [], "limits": limits}}
        elif executor == "agy":
            # Review inputs (cards and outputs) are the only outside-worktree
            # reads strict keeps; the git common directory and read_url go away.
            strict_extra = unique_paths(home_dirs) if review else []
            allow = [f"read_file({cwd})"]
            allow += [f"read_file({path})" for path in strict_extra if path != cwd]
            deny = []
            if review:
                allow += [f"command({command})" for command in (
                    "git diff", "git log", "git show", "git status", "git rev-parse")]
                deny = [f"write_file({path})" for path in unique_paths([cwd, *strict_extra])]
                limits.append("agy keeps the worktree read-write on its sandbox mount; "
                              "write_file is denied and review_wrote still checks the tree")
            else:
                allow += [f"write_file({cwd})", "command(git)"]
            limits.append("strict: no read_url, no git common directory and no "
                          "directory outside the worktree except attached review inputs")
            settings = {
                "toolPermission": "proceed-in-sandbox",
                "allowNonWorkspaceAccess": bool(strict_extra),
                "permissions": {"allow": allow, "deny": deny},
            }
            argv += ["--sandbox", "--settings", json.dumps(settings, separators=(",", ":"))]
            return {"argv": argv, "env": {}, "access": {
                "mode": "strict", "network": False, "git_write": False,
                "extra_read": strict_extra, "limits": limits}}
        else:
            sys.exit(f"delegate: unknown executor {executor}")

    argv, env, limits = [], {}, []
    network = True
    git_write = not review

    if executor == "codex":
        if review:
            # Read-only is the reviewer guarantee. The network switch is
            # workspace-write only, so network cannot be added without also
            # allowing writes in the worktree.
            network = False
            limits.append("codex read-only sandbox cannot enable network; "
                          "sandbox_workspace_write.network_access needs --sandbox workspace-write")
        else:
            argv += ["-c", "sandbox_workspace_write.network_access=true"]
            if common:
                # Codex protects <workspace>/.git as read-only; adding the
                # common directory is what lets the executor commit.
                argv += ["--add-dir", common]

    elif executor == "opencode":
        # opencode run --help: "--auto Auto-approve permissions that are not
        #   explicitly denied"; the policy does not use it. The installed CLI
        #   (v2.3.2) reads OPENCODE_CONFIG_CONTENT as a JSON config document;
        #   V2 uses "permissions" (plural), "shell" (not "bash") and
        #   {action, resource, effect} rules, documented at
        #   https://opencode.ai/docs/permissions. path rules are supported.
        # It has no sandbox or network switch; shell keeps host authority.
        rules = [
            {"action": "external_directory", "resource": "*", "effect": "deny"},
            {"action": "read", "resource": "*", "effect": "allow"},
            {"action": "shell", "resource": "*", "effect": "allow"},
            {"action": "webfetch", "resource": "*", "effect": "allow"},
            # Web Search under "allow" asks for input that a headless run cannot
            # give; OpenCode v2.3.2 then exits 1 ("Cancelled a request for input
            # this run cannot answer: Web Search") even when the work is done.
            # Under "deny" the tool is refused and the run ends with exit 0.
            {"action": "websearch", "resource": "*", "effect": "deny"},
            {"action": "edit", "resource": "*", "effect": "deny"},
        ]
        limits.append("websearch is denied: OpenCode's Web Search asks for input a "
                      "headless run cannot answer; webfetch and the shell keep network access")
        # External reads are checked before read/edit; allow only the git
        # common directory, cards and outputs, never every directory.
        for path in extra_read:
            rules.append({"action": "external_directory", "resource": f"{path}/*",
                          "effect": "allow"})
        # FileAccess.resolve gives an internal path relative to the location
        # (e.g. "src/a.py") and an external path as an absolute path. So "*"
        # covers the worktree, the absolute common path covers a linked
        # worktree's git directory, and the external_directory grants above
        # bound the rest. Deny project-parent paths and the read-only outputs.
        if not review:
            rules.append({"action": "edit", "resource": "*", "effect": "allow"})
            if common:
                rules.append({"action": "edit", "resource": f"{common}/*",
                              "effect": "allow"})
            for path in ("..", "../*"):
                rules.append({"action": "edit", "resource": path, "effect": "deny"})
            for path in unique_paths(home_dirs):
                if not is_within(path, cwd):
                    rules.append({"action": "edit", "resource": f"{path}/*",
                                  "effect": "deny"})
        env["OPENCODE_CONFIG_CONTENT"] = json.dumps({"permissions": rules})
        limits.append("OpenCode has no sandbox: shell runs with the host user's "
                      "filesystem and network authority")
        if review:
            # Reviewers need shell for read-only git and tests, but shell keeps
            # host write authority even though the edit tool is denied.
            git_write = True
            limits.append("reviewer can still write through the shell; "
                          "only the edit tool is denied")
        else:
            limits.append("edit tool is limited to the worktree and git common "
                          "directory; shell can still write elsewhere")

    elif executor == "agy":
        # agy --help: "--sandbox Run in a sandbox with terminal restrictions
        #   enabled"; "--settings Settings for this session only, never saved:
        #   a JSON object of settings.json keys, inline or as a file path";
        #   "--add-dir Add a directory to the workspace (repeatable)".
        # settings.json schema: permissions {allow, ask, deny}, toolPermission,
        # allowNonWorkspaceAccess. Permission rules use command(<prefix>) for
        # commands, e.g. "command(git status)".
        allow = ["read_url(*)", "read_file(" + cwd + ")"]
        allow += [f"read_file({path})" for path in extra_read if path != cwd]
        deny = []
        if review:
            allow += [f"command({command})" for command in (
                "git diff", "git log", "git show", "git status", "git rev-parse")]
            deny = [f"write_file({path})" for path in unique_paths([cwd, common, *home_dirs])]
            limits.append("agy keeps the worktree read-write on its sandbox mount; "
                          "write_file is denied and review_wrote still checks the tree")
        else:
            allow += [f"write_file({cwd})", "command(git)"]
            if common:
                allow.append(f"write_file({common})")
            if common and not is_within(common, cwd):
                argv += ["--add-dir", common]
        settings = {
            "toolPermission": "proceed-in-sandbox",
            "allowNonWorkspaceAccess": True,
            "permissions": {"allow": allow, "deny": deny},
        }
        argv += ["--sandbox", "--settings", json.dumps(settings, separators=(",", ":"))]

    else:
        sys.exit(f"delegate: unknown executor {executor}")

    if git_write and common:
        limits.append(git_common_limit)
    return {"argv": argv, "env": env, "access": {
        "mode": "policy", "network": network, "git_write": git_write,
        "extra_read": extra_read, "limits": limits}}


AGY_GIT_GLOBAL_LIMIT = ("agy: git reads a runner-made copy of the global git config "
                        "(GIT_CONFIG_GLOBAL) because the terminal sandbox cannot read "
                        "the files that config includes")


def flatten_git_global(cwd, task_id):
    """Write the global git config, includes resolved, into the git directory.

    Antigravity's terminal sandbox lets git read ~/.gitconfig but not a file it
    includes (seen with agy 1.5.13 on macOS: "fatal: unable to access
    '~/.gitconfig.local': Operation not permitted"). Every git command then
    fails, the model asks to leave the sandbox, and print mode auto-denies that
    request and prints nothing. The copy lives in the worktree's git directory:
    git must already read that place, and it never shows in `git status`.

    Returns the path, or None when the global config includes nothing or the
    copy cannot be made (the run then starts as before).
    """
    def run(*args):
        return subprocess.run(["git", "-C", cwd, *args], capture_output=True)

    dest = None
    try:
        probe = run("config", "--global", "--get-regexp", r"^include(if)?\.")
        if probe.returncode or not probe.stdout.strip():
            return None
        listing = run("config", "--global", "--includes", "--list", "-z")
        git_dir = run("rev-parse", "--absolute-git-dir")
        if listing.returncode or git_dir.returncode:
            return None
        name = re.sub(r"[^A-Za-z0-9._-]", "_", task_id)
        dest = Path(os.fsdecode(git_dir.stdout).strip()) / f"delegate-{name}-{os.getpid()}.gitconfig"
        dest.unlink(missing_ok=True)
        os.close(os.open(dest, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600))
        for entry in listing.stdout.split(b"\0"):
            if not entry:
                continue
            # "key\nvalue"; a key with no value at all is a boolean true.
            key, has_value, value = entry.partition(b"\n")
            if re.match(rb"include(if)?\.", key):
                continue
            subprocess.run(["git", "config", "--file", str(dest), "--add",
                            key, value if has_value else b"true"],
                           capture_output=True, check=True)
        return dest
    except (OSError, subprocess.SubprocessError):
        if dest is not None:
            try:
                dest.unlink(missing_ok=True)
            except OSError:
                pass
        return None


def guard_argv(argv, executor):
    """Refuse an approval/sandbox bypass flag; never let one reach a child."""
    for arg in argv:
        # Only flag-shaped elements; a card or path may legitimately contain the
        # text of one of these names.
        if not str(arg).startswith("-"):
            continue
        for flag in FORBIDDEN_ARGV_FLAGS:
            if flag in str(arg):
                sys.exit(f"delegate: refusing {executor} argv containing {flag}")
    return argv


def build_argv(executor, model, role, cwd, card, last_msg, policy=None):
    policy = policy or access_policy(executor, role, cwd)
    if executor == "opencode":
        # opencode run --help: "--archived Create the session archived";
        # global "--standalone Run with a private server instead of the
        # background service". The policy needs its own server so the
        # OPENCODE_CONFIG_CONTENT permission rules are read; a background
        # service started earlier would ignore them. The message stays an argv
        # element: the CLI has no stdin prompt, only "--file File to attach to
        # the message". The runner never passes an auto-approve flag.
        return guard_argv(
            [find("opencode"), "run", "--standalone", "--archived", "-m", model, card],
            executor)
    if executor == "claude":
        # The shape proven for external reviews in
        # skills/shared/codex-bridge-assets/providers/claude/invocation-canonical.txt:
        # claude --help: "-p, --print Print response and exit"; "--safe-mode
        #   Start with all customizations (CLAUDE.md, skills, installed plugins,
        #   hooks, MCP servers, ...) disabled"; "--no-session-persistence";
        #   "--disable-slash-commands Disable all skills and commands";
        #   "--effort <level>". The prompt is read from stdin.
        # "--setting-sources <sources> Comma-separated list of setting sources
        #   to load (user, project, local)". The empty list loads none, so an
        #   apiKeyHelper or endpoint in a settings file cannot route the
        #   review through an API: only the CLI's own login is left.
        argv = [find("claude"), "--safe-mode", "-p", "--setting-sources", "",
                "--model", model, "--effort", "high"]
        return guard_argv(argv + policy["argv"] + [
            "--no-session-persistence", "--disable-slash-commands", "--output-format", "text"], executor)
    if executor == "agy":
        # The runner writes the prompt on stdin, so a composed prompt is not
        # an argv element. With stdin not a terminal agy runs the prompt once
        # and prints the answer ("--output-format Output format for print
        # mode"). No -p: since agy 1.5.13 it takes the next argument as its
        # prompt ("-p took --model as its prompt") and no longer reads stdin.
        # Checked on 1.5.12 (macOS) and 1.5.13 (Linux).
        argv = [find("agy"), "--model", model, "--output-format", "text"]
        return guard_argv(argv + policy["argv"], executor)
    if executor == "codex":
        effort = "high" if role == "review" else "medium"
        sandbox = "read-only" if role == "review" else "workspace-write"
        argv = [
            find("codex"), "-a", "never", "exec",
            "--model", model,
            "-c", f"model_reasoning_effort={effort}",
            "--sandbox", sandbox,
            "--skip-git-repo-check",
            "--ephemeral",
            "-C", cwd,
        ]
        argv += policy["argv"]
        return guard_argv(argv + ["-o", str(last_msg), "-"], executor)
    sys.exit(f"delegate: unknown executor {executor}")


def has_provider_limit(stdout, stderr):
    for path in (stderr, stdout):
        try:
            tail = path.read_text(errors="replace")[-4000:]
        except OSError:
            continue
        if LIMIT_RE.search(tail):
            return True
    return False


CLAUDE_LOGIN_RE = re.compile(
    r"failed\s+to\s+authenticate|oauth\s+session\s+expired|not\s+logged\s+in|invalid\s+api\s+key|/login",
    re.IGNORECASE)


def claude_login_help(reason):
    """Everything the operator needs to fix the login, with nothing to look up:
    the machine, the user, the exact command, what it does and how to check."""
    cli = find_optional("claude") or "claude"
    machine = socket.gethostname().split(".")[0]
    try:
        user = getpass.getuser()
    except (OSError, KeyError):
        user = "the user who runs the runner"
    return "\n".join([
        f"{CLAUDE_REVIEW} cannot run: {reason}.",
        f"  {CLAUDE_REVIEW} uses the Claude Code login of the machine where the runner runs, "
        "never an API key, a token or another endpoint.",
        f"  Where: a terminal on this machine ({machine}), as user {user}; not on a remote host, "
        "not in WSL, and not inside an agent session.",
        f"  Command: {cli} auth login --claudeai",
        "  How: it opens the browser; sign in with the claude.ai account that has the subscription "
        "and authorize. With no browser (over SSH) it prints a URL: open it on any device and "
        "paste the code it shows back into the terminal.",
        f'  Check: {cli} --setting-sources "" auth status   '
        '(expect "loggedIn": true and "authMethod": "claude.ai")',
        "  ~/.claude/settings.json is not used by this review and needs no change; then run the "
        "same delegate command again.",
    ])


def claude_login():
    """State of the local Claude Code login: (state, detail).

    ok: a claude.ai subscription login; missing: no login; api: a login that
    bills an API; unknown: the CLI is absent or its answer cannot be read.
    """
    cli = find_optional("claude")
    if not cli:
        return "unknown", "the claude CLI was not found"
    try:
        res = subprocess.run([cli, "--setting-sources", "", "auth", "status"], capture_output=True,
                             text=True, timeout=30, stdin=subprocess.DEVNULL,
                             env=child_environment("claude", os.environ, {}))
        data = json.loads(res.stdout)
    except (OSError, subprocess.SubprocessError, ValueError):
        return "unknown", "the login state could not be read"
    if not isinstance(data, dict) or "loggedIn" not in data:
        return "unknown", "the login state could not be read"
    if not data["loggedIn"]:
        return "missing", ""
    method = str(data.get("authMethod") or "unknown")
    if method != "claude.ai":
        return "api", method
    kind = data.get("subscriptionType")
    return "ok", f"claude.ai ({kind})" if kind else "claude.ai"


def claude_login_problem(state, detail):
    if state == "missing":
        return "this machine has no Claude Code login, or it expired"
    if state == "api":
        return f'the local login is "{detail}", not a claude.ai subscription'
    return None


def check_claude_login():
    """Refuse before launching when the review could only fail or bill an API."""
    reason = claude_login_problem(*claude_login())
    if reason:
        usage_error(claude_login_help(reason))


def child_environment(executor, environ, policy_env):
    """The environment of the executor process.

    The Claude reviewer runs on the CLI's own login and never through an API.
    Every variable that could carry a key, a token, another endpoint or the
    state of the Claude Code session the runner was started from is removed.
    """
    env = dict(environ)
    if executor == "claude":
        env = {k: v for k, v in env.items()
               if k == "CLAUDE_CONFIG_DIR" or not k.startswith(("CLAUDE", "ANTHROPIC_"))}
    env.update(policy_env)
    return env


def claude_login_missing(stdout):
    try:
        return bool(CLAUDE_LOGIN_RE.search(stdout.read_text(errors="replace")[:2048]))
    except OSError:
        return False


def claude_limit(stdout):
    """Claude Code reports a session limit on stdout with exit code 0, and an
    exhausted balance on stdout with exit code 1."""
    try:
        text = stdout.read_text(errors="replace")
    except OSError:
        return False
    # A finished review that quotes the banner is a review, not a limit.
    return bool(CLAUDE_LIMIT_RE.search(text[:2048])) and not review_complete(text)


def review_complete(text):
    """A review answer is complete when it has its closing line (see parse_review)."""
    return parse_review(text)["complete"]


def review_severity_fields(review_output):
    """What a finished review run records: who chose the severities, the counts
    the runner computed, each finding with its answers, and whether the
    reviewer's own closing number agreed with its lines."""
    review = parse_review(Path(review_output).read_text(errors="replace"))
    fields = {"severity_source": review["severity_source"], "severity_counts": review["counts"],
              "findings": review["findings"], "findings_mismatch": review["findings_mismatch"]}
    if review["findings_mismatch"]:
        fields["findings_claimed"] = review["findings_claimed"]
    return fields


def agy_denied_permission(stderr):
    """The permission an Antigravity print-mode run had auto-denied, read from
    its stderr line ("a tool required the "command" permission that headless
    mode cannot prompt for, so it was auto-denied"); None when there is none."""
    try:
        text = Path(stderr).read_text(errors="replace")
    except OSError:
        return None
    match = AGY_DENIED_RE.search(text)
    return match.group(1) if match else None


def classify_failure(timed_out, code, stdout, stderr, review_wrote, review_output=None, executor=None):
    if timed_out:
        return "timeout"
    if code != 0 and has_provider_limit(stdout, stderr):
        return "provider_limit"
    if executor == "claude" and claude_limit(stdout):
        return "provider_limit"
    if review_wrote:
        return "review_wrote"
    if code != 0:
        return "error"
    if review_output is not None:
        try:
            review_text = review_output.read_text(errors="replace")
        except FileNotFoundError:
            review_text = ""
        if not review_text.strip():
            # Antigravity in print mode denies a tool it cannot ask about and
            # loses the whole answer: that is the cause, not an empty review.
            if executor == "agy" and agy_denied_permission(stderr):
                return "permission_denied"
            return "empty_output"
        if not review_complete(review_text):
            return "incomplete_review"
    return "none"


def get_max_slots(executor):
    env_var = f"DELEGATE_MAX_{executor.upper()}"
    val = os.environ.get(env_var)
    if val is not None:
        try:
            return int(val)
        except ValueError:
            pass
    return DEFAULT_MAX_SLOTS.get(executor, 1)


def is_pid_alive(pid):
    if not isinstance(pid, int) or not 0 < pid <= 2 ** 31 - 1:  # pid_t is a C int
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False


def process_identity(pid):
    """Kernel start time, independent of the runner's wall clock."""
    if not isinstance(pid, int) or not 0 < pid <= 2 ** 31 - 1:  # pid_t is a C int
        return None
    try:
        if sys.platform == "darwin":
            import ctypes
            import struct
            # Darwin proc_bsdinfo ends with uint64 start_tvsec/start_tvusec.
            info = ctypes.create_string_buffer(136)
            libproc = ctypes.CDLL("/usr/lib/libproc.dylib", use_errno=True)
            size = libproc.proc_pidinfo(pid, 3, 0, info, len(info))  # PROC_PIDTBSDINFO
            if size != len(info):
                return None
            return "darwin:%s:%s" % struct.unpack_from("QQ", info.raw, 120)
        stat = Path(f"/proc/{pid}/stat").read_text()
        start = stat[stat.rfind(")") + 2:].split()[19]
        boot = Path("/proc/sys/kernel/random/boot_id").read_text().strip()
        return f"linux:{boot}:{start}"
    except (OSError, ValueError, IndexError):
        return None


def slot_owned(slot):
    pid = slot.get("pid")
    identity = slot.get("process_start")
    if not identity:
        # Legacy slots must still name a live group leader; never signal them.
        if slot.get("pgid") != pid or not is_pid_alive(pid):
            return False
        try:
            return os.getpgid(pid) == pid
        except (ProcessLookupError, PermissionError):
            return False
    if slot.get("pgid") != pid:
        return False
    if identity.startswith("unreaped:"):
        # This marker is not a kernel identity. Require both runner and child;
        # a reaped child must not leave a slot pinned by a long-lived runner.
        runner_start = slot.get("runner_start")
        if not runner_start or process_identity(slot.get("runner_pid")) != runner_start:
            return False
        try:
            return os.getpgid(pid) == pid
        except (ProcessLookupError, PermissionError):
            return False
    current = process_identity(pid)
    if current is None:
        # Darwin hides zombie identities. The live runner reserves its child until
        # it reaps AND removes this slot under SlotLock, so this interval is owned.
        runner = slot.get("runner_pid")
        runner_start = slot.get("runner_start")
        return bool(runner_start and process_identity(runner) == runner_start)
    try:
        return current == identity and os.getpgid(pid) == pid
    except (ProcessLookupError, PermissionError):
        return False


def runner_gone(slot):
    """True when the runner that owns this slot is no longer running."""
    runner_start = slot.get("runner_start")
    return bool(runner_start) and process_identity(slot.get("runner_pid")) != runner_start


def record_lost_runner(path, slot, remote=False):
    """Log a run whose runner died before it could write its own record.

    A runner that is killed outright (SIGKILL, a crash) cannot end its executor
    or log anything: the executor works on alone and its slot is all that is
    left. When that slot is finally cleared, this record is the only trace of
    the run in the log. For a --host run the trace is its active file, and the
    work is on the host, out of this machine's reach.
    """
    started = slot.get("started")
    if not started:
        return
    token = slot.get("token") if remote else None
    if token:
        # The record of a --host run carries the token of its active file, so
        # this is exact: its `started` is later than the file's and proves nothing.
        def same_run(r):
            return r.get("active_token") == token
    else:
        def same_run(r):
            return r.get("id") == slot.get("id") and r.get("started") == started
    try:
        if LOG.exists() and any(
                r.get("kind") == "run" and same_run(r)
                for r in map(json.loads, filter(None, LOG.read_text().splitlines()))):
            return
    except (OSError, ValueError):
        pass
    completed = now()
    try:
        duration = max(0, round((completed - dt.datetime.fromisoformat(started)).total_seconds()))
    except (TypeError, ValueError):
        duration = 0
    profile = slot.get("profile")
    model, family = (MODELS[profile][1:] if profile in MODELS else (None, None))
    rec = {
        "kind": "run", "id": slot.get("id"), "project": slot.get("project"),
        "role": slot.get("role"), "profile": profile,
        "executor": path.name.split("-")[0], "model": model, "family": family,
        "started": started, "completed": completed.isoformat(timespec="microseconds"),
        "duration_s": duration, "exit_code": None, "timed_out": False,
        "failure": "runner_lost",
        "note": "the runner process died before writing a record; the executor kept "
                "working without it, so check the worktree for commits and changes",
    }
    machine = slot.get("machine")
    if remote:
        host = machine or "the host"
        rec["host"] = machine
        rec["note"] = ("the runner process died before writing a record; the work may still be "
                       f"running on {host}, and nothing was fetched back: check "
                       f"`remote-runner runs --host {host}` and the task's checkout there")
    if token:
        rec["active_token"] = token
    if machine:
        rec["machine"] = machine
    # The lost run's own, never those of the command that found it.
    rec.update(repo=slot.get("repo"), milestone=slot.get("milestone"))
    append({key: value for key, value in rec.items() if key != "host" or value})


def _clean_stale_slots():
    RUNNING.mkdir(parents=True, exist_ok=True)
    for p in RUNNING.glob("*.tmp"):
        if time.time() - p.stat().st_mtime > 60:
            p.unlink(missing_ok=True)
    for p in list(RUNNING.glob("*.json")):
        try:
            data = json.loads(p.read_text())
            if not slot_owned(data):
                p.unlink(missing_ok=True)
                if runner_gone(data):
                    record_lost_runner(p, data)
        except (OSError, ValueError, TypeError, AttributeError, OverflowError):
            p.unlink(missing_ok=True)
    try:
        _clean_stale_remote()
    except (OSError, ValueError, TypeError, AttributeError, OverflowError):
        pass  # the remote list is for display; it never blocks a local slot


def remote_active_state(path, data):
    """Say whether an active file is `live`, `lost` (its runner is gone) or `invalid`."""
    if not isinstance(data, dict) or not isinstance(data.get("runner_pid"), int):
        return "invalid"  # nothing names a runner; this runner never writes one
    if data.get("runner_start"):
        return "lost" if runner_gone(data) else "live"
    # No kernel identity was recorded, so a live pid may be the runner or a
    # reuse of its number: that proves nothing either way. A dead pid does,
    # and so does the run's own limit, which no runner outlives.
    if not is_pid_alive(data["runner_pid"]):
        return "lost"
    try:
        expires = dt.datetime.fromisoformat(data["expires"])
    except (KeyError, TypeError, ValueError):
        try:
            expires = dt.datetime.fromtimestamp(path.stat().st_mtime + REMOTE_ACTIVE_FALLBACK_S,
                                                dt.timezone.utc)
        except OSError:
            return "live"
    try:
        return "lost" if now() > expires else "live"
    except TypeError:  # a time without a zone
        return "lost"


def _clean_stale_remote():
    """Drop the active file of a --host run whose runner is gone.

    A runner publishes and removes its own file under the same lock, so what
    is read here cannot change before it is judged and unlinked, and a
    temporary file seen here belongs to no writer still at work.
    """
    if not RUNNING_REMOTE.is_dir():
        return
    with RemoteActiveLock():
        for p in RUNNING_REMOTE.glob("*.tmp"):
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass
        for p in list(RUNNING_REMOTE.glob("*.json")):
            try:
                data = json.loads(p.read_text())
            except FileNotFoundError:
                continue
            except (OSError, ValueError):
                data = None
            state = remote_active_state(p, data)
            if state == "live":
                continue
            p.unlink(missing_ok=True)
            if state == "lost":
                record_lost_runner(p, data, remote=True)


def get_active_remote():
    """Active --host runs started from this machine, as (path, data) pairs."""
    active = []
    if not RUNNING_REMOTE.is_dir():
        return active
    _clean_stale_remote()
    for p in list(RUNNING_REMOTE.glob("*.json")):
        try:
            data = json.loads(p.read_text())
        except (OSError, ValueError):
            continue
        if isinstance(data, dict):
            active.append((p, data))
    return active


def new_remote_active(executor, task_id, project, profile, role, host, limit_s):
    """Path and content of the active file of one --host run; writes nothing.

    The token makes the name this run's alone and is copied into its record
    (`active_token`), which is how a leftover file is matched to a finished run.
    `limit_s` bounds the whole run; it only decides when the file ends if the
    runner's identity could not be read.
    """
    token = os.urandom(8).hex()
    started = now()
    data = {
        "id": task_id, "project": project, "profile": profile, "role": role,
        "machine": host, **ATTRIBUTION,
        "started": started.isoformat(timespec="microseconds"),
        "runner_pid": os.getpid(), "runner_start": process_identity(os.getpid()),
        "token": token,
        "expires": (started + dt.timedelta(seconds=limit_s)).isoformat(timespec="seconds"),
    }
    return RUNNING_REMOTE / f"{executor}-{task_id}-{token}.json", data


def publish_remote_active(path, data):
    """Write the active file atomically, under the lock every cleaner takes."""
    try:
        with RemoteActiveLock():
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(data, ensure_ascii=False))
            os.replace(tmp, path)
        return True
    except OSError:
        return False  # the list is for display; the run goes on without it


def remove_remote_active(path):
    def drop():
        for target in (path, path.with_suffix(".tmp")):
            try:
                target.unlink(missing_ok=True)
            except OSError:
                pass

    try:
        # Under the lock a reader never sees this file after its runner exited.
        with RemoteActiveLock():
            drop()
    except OSError:
        drop()
    except BaseException:
        # A stop signal landed here: the file must go all the same.
        drop()
        raise


def _get_active_slots(executor=None):
    _clean_stale_slots()
    active = []
    for p in list(RUNNING.glob("*.json")):
        try:
            data = json.loads(p.read_text())
            ex = p.name.split("-")[0]
            if executor is None or ex == executor:
                active.append((p, data))
        except (OSError, ValueError):
            continue
    return active


def clean_stale_slots():
    with SlotLock():
        _clean_stale_slots()


def get_active_slots(executor=None):
    with SlotLock():
        return _get_active_slots(executor)


def group_alive(pgid):
    if not pgid or pgid <= 0:
        return False
    try:
        os.killpg(pgid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def child_exited(pid):
    """Non-reaping ownership/exit probe; ECHILD means the PID is no longer ours."""
    if hasattr(os, "waitid"):
        return os.waitid(os.P_PID, pid, os.WEXITED | os.WNOHANG | os.WNOWAIT) is not None

    # macOS libc has waitid even on Python 3.9, which does not expose os.waitid
    # or its constants. Use the same WNOWAIT contract, never waitpid/poll here:
    # reaping early would release the PID/PGID before we finish signalling it.
    import ctypes
    if sys.platform == "darwin":
        p_pid, options = 1, 0x04 | 0x01 | 0x20  # WEXITED | WNOHANG | WNOWAIT
    elif sys.platform.startswith("linux"):
        p_pid, options = 1, 0x04 | 0x01 | 0x01000000
    else:
        raise RuntimeError("non-reaping child observation requires macOS or Linux")
    waitid = ctypes.CDLL(None, use_errno=True).waitid
    waitid.argtypes = [ctypes.c_int, ctypes.c_uint, ctypes.c_void_p, ctypes.c_int]
    waitid.restype = ctypes.c_int
    # siginfo_t is <=128 bytes on these platforms. Overallocate with native long
    # alignment; only the common first int (si_signo) is needed. The zero-filled
    # buffer remains zero when WNOHANG finds no exit; an exit reports SIGCHLD.
    info = (ctypes.c_long * 32)()
    while waitid(p_pid, pid, ctypes.byref(info), options) != 0:
        error = ctypes.get_errno()
        if error == errno.EINTR:
            continue
        raise OSError(error, os.strerror(error))
    return ctypes.c_int.from_buffer(info).value == signal.SIGCHLD


class ParentGone(Exception):
    """The runner was reparented: its original parent exited or was killed."""


class Stalled(Exception):
    """The executor showed no progress for the whole idle limit."""


def duration_arg(text):
    """A time option: bare seconds, or a number with s, m or h (300, 300s, 90m, 2h)."""
    match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*([smh]?)", str(text).strip().lower())
    if not match:
        raise argparse.ArgumentTypeError(
            f"invalid time {text!r}: give seconds, or a number with a unit (300, 300s, 90m, 2h)")
    value = float(match.group(1)) * {"": 1, "s": 1, "m": 60, "h": 3600}[match.group(2)]
    return int(value) if value.is_integer() else value


class ProgressWatch:
    """Tell a working executor from a stuck one.

    Progress is any change in: the size of the captured stdout or stderr (and of
    Antigravity's own log, since it prints only at the end of a turn), the branch
    HEAD, or the working tree (the `git status` entries and the size and
    modification time of each listed path). The check runs at a modest interval;
    `idle_timeout` 0 keeps the bookkeeping for `status` and never stops the run.
    """

    def __init__(self, cwd, files, idle_timeout, slot_file=None, slot_data=None):
        self.cwd, self.files, self.idle_timeout = cwd, files, idle_timeout
        self.slot_file, self.slot_data = slot_file, slot_data
        self.interval = PROGRESS_POLL_S if idle_timeout <= 0 else min(
            PROGRESS_POLL_S, max(0.1, idle_timeout / 5))
        self.last = time.monotonic()
        self.next_check = self.last
        self.signature = self._signature()

    def _signature(self):
        sizes = []
        for path in self.files:
            try:
                sizes.append(os.stat(path).st_size)
            except OSError:
                sizes.append(-1)
        # --no-optional-locks: a plain `git status` refreshes the index under
        # index.lock, and the executor's own `git add` or `git commit` would
        # then fail now and then with "index.lock exists".
        status = git_bytes(self.cwd, "--no-optional-locks", "status", "--porcelain=v1", "-z",
                           "--untracked-files=all")
        touched = []
        for entry in status.split(b"\0")[:400]:
            # Entries are "XY path"; a rename adds a bare path entry. Stat both
            # readings and keep whichever exists.
            for name in {entry[3:], entry}:
                if not name:
                    continue
                try:
                    st = os.lstat(os.path.join(os.fsencode(self.cwd), name))
                except OSError:
                    continue
                touched.append((name, st.st_size, st.st_mtime_ns))
        return (tuple(sizes), git(self.cwd, "rev-parse", "HEAD"), status, tuple(sorted(touched)))

    def idle_s(self):
        return time.monotonic() - self.last

    def stalled(self):
        moment = time.monotonic()
        if moment < self.next_check:
            return False
        self.next_check = moment + self.interval
        signature = self._signature()
        if signature != self.signature:
            self.signature, self.last = signature, moment
            self._publish()
            return False
        return self.idle_timeout > 0 and moment - self.last >= self.idle_timeout

    def _publish(self):
        # `status` reads this to show how long each run has been quiet.
        if not self.slot_file or self.slot_data is None:
            return
        self.slot_data["last_progress"] = now().isoformat(timespec="seconds")
        try:
            tmp = self.slot_file.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.slot_data, ensure_ascii=False))
            os.replace(tmp, self.slot_file)
        except OSError:
            pass


def wait_for_exit(process, timeout, parent_pid=None, tracker=None, progress=None):
    """Observe exit without reaping: the zombie reserves PID/PGID until cleanup.

    With parent_pid, also notice the runner losing its original parent (a
    portable getppid() check, not Linux-only prctl) and stop the child. With a
    tracker, keep walking the child's descendant tree while it runs, so a
    detached grandchild is remembered before the executor exits.
    """
    deadline = time.monotonic() + timeout
    while True:
        if parent_pid is not None and os.getppid() != parent_pid:
            if tracker is not None:
                tracker.poll(force=True)
            raise ParentGone()
        if tracker is not None:
            tracker.poll()
        if child_exited(process.pid):
            if tracker is not None:
                # The last chance to see a child detached just before exit.
                tracker.poll(force=True)
            return
        if time.monotonic() >= deadline:
            if tracker is not None:
                tracker.poll(force=True)
            raise subprocess.TimeoutExpired(process.args, timeout)
        if progress is not None and progress.stalled():
            if tracker is not None:
                tracker.poll(force=True)
            raise Stalled()
        time.sleep(0.02)


def terminate_process(process, grace=ORPHAN_GRACE_S):
    """TERM the executor's process group, wait briefly, then KILL and reap it."""
    try:
        if process.returncode is None:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass
    finally:
        deadline = time.monotonic() + grace
        while group_alive(process.pid) and time.monotonic() < deadline:
            time.sleep(0.05)
        stop_process(process)


def stop_process(process):
    """Signal an unreaped child even if interrupted during ownership proof."""
    try:
        if process.returncode is None and not getattr(process, "_group_stopped", False):
            owned = True  # Popen owns this unreaped child until the probe says otherwise.
            try:
                try:
                    child_exited(process.pid)
                except ChildProcessError:
                    owned = False
            finally:
                if owned:
                    try:
                        try:
                            os.killpg(process.pid, signal.SIGKILL)
                        except (ProcessLookupError, PermissionError):
                            pass
                        except BaseException:
                            # A raising signal handler can land at the call itself.
                            # Complete the signal before propagating that exception.
                            try:
                                os.killpg(process.pid, signal.SIGKILL)
                            except (ProcessLookupError, PermissionError):
                                pass
                            raise
                    finally:
                        process._group_stopped = True
    finally:
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            pass


class ProcessTracker:
    """Remember the executor's descendants and end whatever survives the run.

    The runner signals only the executor's process group, so a descendant that
    changed group (setsid, a daemonized server, a test that detaches a busy
    loop) escapes it. While the executor runs, this tracker polls the process
    table, walks the tree below the executor and remembers each descendant's
    pid together with its kernel start time (`process_identity`). It also
    remembers every session and process group it saw the executor create. On
    Linux it makes the runner a child subreaper for the run, so an orphan of
    the executor is reparented to the runner instead of pid 1. A reused pid
    never matches its remembered start time, so it is never signalled. At the
    end, `sweep()` ends the remembered processes that are still alive with
    TERM, a short grace and KILL, then reaps the ones that became the runner's
    children.

    Nothing outside `seen` is ever signalled: no name or path match, no process
    group. A remote (`--host`) runner would apply the same rule on the host in
    its own cleanup and skip this tracker locally.
    """

    def __init__(self, interval=None, slow_interval=None, grace=None):
        self.interval = ORPHAN_POLL_S if interval is None else interval
        self.slow_interval = ORPHAN_POLL_SLOW_S if slow_interval is None else slow_interval
        self.grace = ORPHAN_GRACE_S if grace is None else grace
        self.runner_pid = os.getpid()
        self.runner_pgid = os.getpgrp()
        self.roots = set()
        self.own_children = set()
        self.seen = {}
        self.pgids = set()
        self.sessions = set()
        self.last_poll = 0.0
        self.started = None
        self.polls = 0
        self.method = "poll"
        self._subreaper = False
        self._previous_subreaper = None
        self._closed = False
        self._enable_subreaper()

    def _enable_subreaper(self):
        """Ask Linux to reparent the executor's orphans to this runner."""
        if not sys.platform.startswith("linux"):
            return
        try:
            import ctypes
            libc = ctypes.CDLL(None, use_errno=True)
            previous = ctypes.c_int(0)
            if libc.prctl(PR_GET_CHILD_SUBREAPER, ctypes.byref(previous), 0, 0, 0) == 0:
                self._previous_subreaper = previous.value
            if libc.prctl(PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0) == 0:
                self._subreaper = True
                self.method = "subreaper+poll"
        except (ImportError, OSError, AttributeError):
            # No prctl in this libc or sandbox: polling is still safe.
            return

    def _restore_subreaper(self):
        if not self._subreaper:
            return
        self._subreaper = False
        try:
            import ctypes
            libc = ctypes.CDLL(None, use_errno=True)
            previous = 0 if self._previous_subreaper is None else self._previous_subreaper
            libc.prctl(PR_SET_CHILD_SUBREAPER, previous, 0, 0, 0)
        except (ImportError, OSError, AttributeError):
            return

    @staticmethod
    def _proc_table():
        table = {}
        try:
            names = os.listdir("/proc")
        except OSError:
            return None
        for name in names:
            if not name.isdigit():
                continue
            try:
                raw = Path(f"/proc/{name}/stat").read_text()
            except OSError:
                continue
            try:
                end = raw.rfind(")")
                fields = raw[end + 2:].split()
                state = fields[0]
                ppid, pgid, sid = int(fields[1]), int(fields[2]), int(fields[3])
            except (IndexError, ValueError):
                continue
            table[int(name)] = (ppid, pgid, sid, state[:1])
        return table or None

    @staticmethod
    def _ps_table():
        try:
            result = subprocess.run(
                ["ps", "-axo", "pid=,ppid=,pgid=,state="],
                capture_output=True, text=True, timeout=ORPHAN_PS_TIMEOUT_S)
        except (OSError, subprocess.SubprocessError):
            return None
        if result.returncode != 0:
            return None
        table = {}
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) < 4:
                continue
            try:
                pid, ppid, pgid = int(parts[0]), int(parts[1]), int(parts[2])
            except ValueError:
                continue
            table[pid] = (ppid, pgid, 0, parts[3][:1])
        return table

    @classmethod
    def _table(cls):
        if sys.platform.startswith("linux"):
            table = cls._proc_table()
            if table is not None:
                return table
        return cls._ps_table()

    @classmethod
    def _commands(cls, pids):
        if not pids:
            return {}
        if sys.platform.startswith("linux") and Path("/proc").is_dir():
            commands = {}
            for pid in pids:
                try:
                    data = Path(f"/proc/{pid}/cmdline").read_bytes()
                except OSError:
                    continue
                if not data:
                    continue
                commands[pid] = data.replace(b"\0", b" ").decode(
                    "utf-8", errors="replace").strip()
            return commands
        try:
            result = subprocess.run(
                ["ps", "-p", ",".join(str(pid) for pid in pids), "-o", "pid=,command="],
                capture_output=True, text=True, timeout=ORPHAN_PS_TIMEOUT_S)
        except (OSError, subprocess.SubprocessError):
            return {}
        commands = {}
        for line in result.stdout.splitlines():
            parts = line.strip().split(None, 1)
            if len(parts) != 2:
                continue
            try:
                commands[int(parts[0])] = parts[1]
            except ValueError:
                continue
        return commands

    def watch(self, pid):
        """Start tracking the descendants of the executor's group leader."""
        if not isinstance(pid, int) or pid <= 0:
            return
        self.roots.add(pid)
        self.own_children.add(pid)
        if self.started is None:
            self.started = time.monotonic()
        # Poll now: a run shorter than one interval still gets a tree snapshot.
        self.last_poll = 0.0
        self.poll(force=True)

    @staticmethod
    def _zombie(pid):
        """A zombie is gone for cleanup purposes even before it is reaped."""
        if not sys.platform.startswith("linux"):
            return False
        try:
            raw = Path(f"/proc/{pid}/stat").read_text()
        except OSError:
            return True
        end = raw.rfind(")")
        if end < 0:
            return True
        return raw[end + 2:end + 3] in ("Z", "X")

    def _remember(self, pid, table):
        row = table.get(pid)
        if not row:
            return False
        _ppid, pgid, sid, state = row
        if state in ("Z", "X"):
            return False
        if pid == self.runner_pid or pid in self.roots or pid in self.own_children:
            return False
        identity = process_identity(pid)
        if not identity:
            return False
        before = (len(self.seen), len(self.pgids), len(self.sessions))
        # A reused pid gets the new identity; _owned will never signal the old
        # identity at a pid that now carries another process.
        self.seen[pid] = identity
        if pgid > 1:
            self.pgids.add(pgid)
        if sid > 0:
            self.sessions.add(sid)
        return (len(self.seen), len(self.pgids), len(self.sessions)) != before

    def _in_scope(self, row):
        ppid, pgid, sid, state = row
        if state in ("Z", "X"):
            return False
        if ppid == self.runner_pid:
            # Only a subreaper adopts the executor's orphans this way; the
            # runner's own helper processes share its process group.
            return self._subreaper and pgid != self.runner_pgid
        return pgid in self.pgids or (sid > 0 and sid in self.sessions)

    def poll(self, force=False):
        """Walk the current tree below the roots and remember new descendants."""
        if not self.roots:
            return
        current = time.monotonic()
        interval = self.interval if (self.started is None or
                                     current - self.started < ORPHAN_POLL_WINDOW_S) else self.slow_interval
        if not force and self.last_poll and current - self.last_poll < interval:
            return
        self.last_poll = current
        table = self._table()
        self.polls += 1
        if not table:
            return
        for root in self.roots:
            self._remember_root(root, table)
        visited = self._walk_descendants(table)
        self._adopt_scope(table, visited)

    def _remember_root(self, root, table):
        """Remember a root's process group and session as well as its identity."""
        row = table.get(root)
        if not row:
            return
        self._remember(root, table)
        _ppid, pgid, sid, _state = row
        if pgid > 1:
            self.pgids.add(pgid)
        if sid > 0:
            self.sessions.add(sid)

    def _walk_descendants(self, table):
        """Remember and return every pid below a root in the ppid tree."""
        children = {}
        for pid, (ppid, _pgid, _sid, _state) in table.items():
            children.setdefault(ppid, []).append(pid)
        stack = [pid for pid in self.roots if pid in table]
        visited = set(stack)
        while stack:
            parent = stack.pop()
            for child in children.get(parent, ()):
                if child in visited:
                    continue
                visited.add(child)
                stack.append(child)
                self._remember(child, table)
        return visited

    def _adopt_scope(self, table, visited):
        """Add adopted orphans and new group/session members until the scope stops growing."""
        # They may have left the ppid tree, so the remembered group and session
        # are what keeps them in scope.
        changed = True
        while changed:
            changed = False
            for pid, row in table.items():
                if pid in visited or pid in self.roots or pid == self.runner_pid:
                    continue
                if self._in_scope(row):
                    visited.add(pid)
                    if self._remember(pid, table):
                        changed = True

    def _alive(self, pid):
        identity = self.seen.get(pid)
        if not identity or pid == self.runner_pid or pid in self.roots:
            return False
        if pid in self.own_children or self._zombie(pid):
            return False
        return process_identity(pid) == identity

    def _owned(self, pid, table=None):
        """True only while the pid still carries its remembered identity."""
        if not self._alive(pid):
            return False
        if table is None:
            table = self._table() or {}
        row = table.get(pid)
        if not row:
            return False
        ppid, pgid, sid, state = row
        if state in ("Z", "X"):
            return False
        if ppid == self.runner_pid:
            return self._subreaper and pgid != self.runner_pgid
        if ppid in self.roots or ppid in self.seen:
            return True
        return pgid in self.pgids or (sid > 0 and sid in self.sessions)

    def _signal(self, pids, sig):
        table = self._table() or {}
        sent = []
        for pid in pids:
            if not self._owned(pid, table):
                continue
            try:
                os.kill(pid, sig)
            except (ProcessLookupError, PermissionError, OSError):
                continue
            sent.append(pid)
        return sent

    def _wait_gone(self, pids, timeout):
        pids = [pid for pid in pids if self._alive(pid)]
        deadline = time.monotonic() + timeout
        while pids and time.monotonic() < deadline:
            time.sleep(0.05)
            pids = [pid for pid in pids if self._alive(pid)]
        return pids

    @staticmethod
    def _reap(pids):
        for pid in pids:
            try:
                os.waitpid(pid, os.WNOHANG)
            except (ChildProcessError, OSError):
                pass

    def sweep(self, force_poll=True):
        """TERM, grace, KILL every remembered descendant still alive."""
        try:
            self.poll(force=force_poll)
            found = [pid for pid in list(self.seen) if self._alive(pid)]
            if not found:
                result = {"found": 0, "killed": 0, "sample": []}
            else:
                commands = self._commands(found)
                sample = [commands.get(pid, f"pid {pid}").strip()[:ORPHAN_SAMPLE_CHARS]
                          for pid in found[:ORPHAN_SAMPLE]]
                survivor = self._wait_gone(self._signal(found, signal.SIGTERM), self.grace)
                survivor = self._wait_gone(self._signal(survivor, signal.SIGKILL), 2.0)
                result = {"found": len(found), "killed": len(found) - len(survivor),
                          "sample": sample}
        finally:
            self._reap(list(self.seen))
            self._restore_subreaper()
            self._closed = True
        result.update(tracked=bool(self.roots) and self.polls > 0,
                      polls=self.polls, method=self.method)
        return result


def run_output_paths(out_path, task_id, attempt, reserve=True):
    """Output paths that never overwrite an earlier round of the same id.

    The first attempt of a fresh id keeps `<id>.<ext>`. A repeated id or an
    attempt above 1 gets `<id>.attempt<N>.<ext>`; when that name is taken too,
    the next free number is used. With `reserve`, the prompt file is created
    with O_EXCL before the stem is chosen, so two concurrent runs of one id
    take different stems. The record names the paths chosen here.
    """
    def free(stem):
        return not any((out_path / f"{stem}{suffix}").exists()
                       for suffix in RUN_OUTPUT_SUFFIXES)

    first = attempt <= 1
    number = max(2, attempt)
    while True:
        if first:
            stem = task_id
        else:
            while not free(f"{task_id}.attempt{number}"):
                number += 1
            stem = f"{task_id}.attempt{number}"
        if not reserve:
            break
        prompt = out_path / f"{stem}.prompt.md"
        try:
            fd = os.open(prompt, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
        except FileExistsError:
            first = False
            if stem != task_id:
                number += 1
            continue
        os.close(fd)
        break
    base = out_path / stem
    return (Path(f"{base}.out.md"), Path(f"{base}.err"),
            Path(f"{base}.last.md"), Path(f"{base}.prompt.md"))


def parse_reset(text, limit_time):
    """The UTC time a provider limit ends, read from the CLI's own message, or None."""
    found = None
    for found in RESET_IN_RE.finditer(text):
        pass
    if found:
        seconds = sum(int(n) * {"h": 3600, "m": 60, "s": 1}[unit.lower()]
                      for n, unit in re.findall(r"(\d+)([hms])", found.group(1), re.IGNORECASE))
        return limit_time + dt.timedelta(seconds=seconds)
    for found in RESET_AT_DATE_RE.finditer(text):
        pass
    if found:
        month = found.group(1)[:3].lower()
        hour, minute = int(found.group(4)), int(found.group(5))
        if month not in MONTHS or not 1 <= hour <= 12 or minute > 59:
            return None
        hour = hour % 12 + (12 if found.group(6).upper() == "PM" else 0)
        try:
            # A naive time read as the machine's own zone, as the CLI prints it.
            local = dt.datetime(int(found.group(3)), MONTHS.index(month) + 1, int(found.group(2)),
                                hour, minute).astimezone()
        except (ValueError, OverflowError, OSError):
            return None
        return local.astimezone(dt.timezone.utc)
    zone = None
    for found in RESET_ZONE_RE.finditer(text):
        pass
    if found:
        try:
            from zoneinfo import ZoneInfo
            zone = ZoneInfo(found.group(4))
        except (ImportError, KeyError, OSError, ValueError, TypeError):
            return None
    else:
        for found in RESET_AT_RE.finditer(text):
            pass
    if not found:
        return None
    hour, minute, half = int(found.group(1)), int(found.group(2) or 0), found.group(3).upper()
    if not 1 <= hour <= 12 or minute > 59:
        return None
    hour = hour % 12 + (12 if half == "PM" else 0)
    # The message has a clock time and no date: it is the next time a clock in
    # that zone (the machine's, when the message names none) shows it, counted
    # from the moment of the limit.
    local = limit_time.astimezone(zone)
    reset = local.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if reset < local - dt.timedelta(minutes=5):
        reset += dt.timedelta(days=1)
    return reset.astimezone(dt.timezone.utc)


def cooldown_s(executor):
    raw = os.environ.get(f"DELEGATE_COOLDOWN_{executor.upper()}")
    if raw:
        try:
            return duration_arg(raw)
        except argparse.ArgumentTypeError:
            pass
    return DEFAULT_COOLDOWN_S


def run_end(rec):
    """When a run record ended, as an aware UTC time, or None."""
    raw = rec.get("completed") or rec.get("started")
    if not raw:
        return None
    try:
        end = dt.datetime.fromisoformat(raw)
    except (TypeError, ValueError):
        return None
    if end.tzinfo is None:
        end = end.replace(tzinfo=dt.timezone.utc)
    if not rec.get("completed"):
        try:
            end += dt.timedelta(seconds=rec.get("duration_s") or 0)
        except TypeError:
            return None
    return end.astimezone(dt.timezone.utc)


def agy_pool(model):
    """The Antigravity quota group of a model, or None for a model outside them."""
    for prefix, pool in AGY_POOL_PREFIXES:
        if model.startswith(prefix):
            return pool
    return None


def limit_key(executor, model):
    """What a provider limit belongs to: the quota group on Antigravity, else the model."""
    if executor == "agy":
        return (executor, agy_pool(model) or model)
    return (executor, model)


def agy_claude_model(executor, model):
    return executor == "agy" and str(model).startswith("claude-")


def parse_utc(raw):
    """An ISO time as aware UTC, or None."""
    if not isinstance(raw, str):
        return None
    try:
        parsed = dt.datetime.fromisoformat(raw[:-1] + "+00:00" if raw.endswith("Z") else raw)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def agy_quota(now_dt=None):
    """Antigravity's own quota per group: {pool: {"remaining", "until"}}, or {}.

    `/quota` is answered by the CLI without a model call, so it spends no quota.
    Any failure returns {} and the caller keeps what the run log says.
    """
    exe = find_optional("agy")
    if not exe:
        return {}
    now_dt = now_dt or now()
    try:
        done = subprocess.run([exe, "-p", "/quota", "--output-format", "json"],
                              stdin=subprocess.DEVNULL, capture_output=True, text=True, errors="replace",
                              cwd=tempfile.gettempdir(), timeout=AGY_QUOTA_TIMEOUT_S)
        if done.returncode != 0:
            return {}
        pools = {}
        for group in json.loads(done.stdout)["command"]["data"]["groups"]:
            for bucket in group.get("buckets") or []:
                bucket_id = str(bucket.get("id") or "")
                pool = next((p for prefix, p in AGY_BUCKET_POOLS if bucket_id.startswith(prefix)), None)
                fraction = bucket.get("remaining_fraction")
                if (pool is None or bucket.get("disabled") or isinstance(fraction, bool)
                        or not isinstance(fraction, (int, float))):
                    continue
                state = pools.setdefault(pool, {"remaining": 1.0, "until": None})
                if fraction <= 0:
                    reset = parse_utc(bucket.get("reset_time"))
                    if reset is None:
                        reset = now_dt + dt.timedelta(seconds=cooldown_s("agy"))
                    # A reset already past means the bucket has refreshed.
                    if reset <= now_dt:
                        continue
                    if state["until"] is None or reset > state["until"]:
                        state["until"] = reset
                state["remaining"] = min(state["remaining"], float(fraction))
        return pools
    except (OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.SubprocessError):
        return {}


def provider_limits(now_dt=None):
    """Limits still in force: {limit_key: {"until", "source", "at"}}.

    A limit belongs to the executor and model of the run that hit it, or to the
    model's quota group on Antigravity. It holds until the reset the provider
    printed, or for the default cooldown when the message has none, and ends
    early when a later run under the same key reached the provider.
    """
    now_dt = now_dt or now()
    latest = {}
    if LOG.exists():
        for line in LOG.read_text(errors="replace").splitlines():
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            if not isinstance(rec, dict) or rec.get("kind") != "run":
                continue
            failure = rec.get("failure")
            if failure != "provider_limit" and failure not in LIMIT_CLEARED_BY:
                continue
            executor, model, end = rec.get("executor"), rec.get("model"), run_end(rec)
            if executor is None or model is None or end is None or end > now_dt:
                continue
            key = limit_key(executor, str(model))
            if key not in latest or end > latest[key][0]:
                latest[key] = (end, rec)
    limits = {}
    for key, (end, rec) in latest.items():
        if rec.get("failure") != "provider_limit":
            continue
        until = None
        for name in ("stderr", "stdout"):
            try:
                until = parse_reset(Path(rec[name]).read_text(errors="replace")[-4000:], end)
            except (KeyError, TypeError, OSError):
                continue
            if until:
                break
        source = "provider" if until else "default"
        until = until or end + dt.timedelta(seconds=cooldown_s(key[0]))
        if until > now_dt:
            limits[key] = {"until": until, "source": source, "at": end}
    return limits


def availability(now_dt=None):
    """What each profile can do now: CLI found, free slots, and a limit in force."""
    now_dt = now_dt or now()
    limits = provider_limits(now_dt)
    quota = agy_quota(now_dt)
    out = {}
    for name, (executor, model, family) in MODELS.items():
        pool = agy_pool(model) if executor == "agy" else None
        live = quota.get(pool)
        limit = limits.get(limit_key(executor, model))
        if live is not None:
            # What Antigravity reports now replaces what the log inferred.
            limit = {"until": live["until"], "source": "quota"} if live["until"] else None
        out[name] = {
            "executor": executor, "model": model, "family": family, "pool": pool,
            "found": bool(find_optional(executor)),
            "slots_free": max(0, get_max_slots(executor) - len(get_active_slots(executor))),
            "cooling_until": limit["until"].isoformat(timespec="seconds") if limit else None,
            "reset_source": limit["source"] if limit else None,
            "quota_remaining": live["remaining"] if live is not None else None,
        }
    return out


def quota_summary(avail):
    """Antigravity's groups in the CLI's order: {pool: {"remaining", "until"}}."""
    pools = {}
    for state in avail.values():
        if state["quota_remaining"] is not None:
            pools[state["pool"]] = {
                "remaining": state["quota_remaining"],
                "until": state["cooling_until"] if state["reset_source"] == "quota" else None,
            }
    return {pool: pools[pool] for pool in AGY_POOLS if pool in pools}


def usable(profile, avail):
    return avail[profile]["found"] and not avail[profile]["cooling_until"]


def order_route(route, avail):
    """Usable profiles first, in their given order; nothing is removed."""
    ready = [p for p in route if usable(p, avail)]
    return ready + [p for p in route if p not in ready]


def review_warning(profile, avail):
    """One line when the work of `profile` would have no reviewer now, else None."""
    reviewers = REVIEW_ROUTES[MODELS[profile][2]]
    if any(usable(r, avail) for r in reviewers):
        return None
    back = sorted((avail[r]["cooling_until"], r) for r in reviewers
                  if avail[r]["found"] and avail[r]["cooling_until"])
    first = f"first back: {back[0][1]} at {back[0][0]}" if back else "no reviewer CLI was found"
    fallback = (f"; {CLAUDE_REVIEW} can review with the operator's yes (--allow-claude-review)"
                if usable(CLAUDE_REVIEW, avail) else "")
    return f"{profile}: no reviewer usable now; {first}{fallback}"


def executor_route(role, open_design=False):
    """The fixed route for a role; Muse goes first while DeepSeek is in peak hours."""
    if open_design:
        return list(OPEN_DESIGN_ROUTE)
    fixed = list(EXECUTOR_ROUTES[role])
    return [PEAK_EXECUTOR] + fixed if in_peak() else fixed


def cmd_route(a):
    avail = availability()
    peak = in_peak()
    route = order_route(executor_route(a.role, a.open_design), avail)
    review_routes = {family: order_route(profiles, avail) for family, profiles in REVIEW_ROUTES.items()}
    warnings = [w for w in (review_warning(p, avail) for p in route) if w]
    if warnings and avail[CLAUDE_REVIEW]["found"]:
        # Claude is the way out of that warning, so say now whether it can run.
        state, detail = claude_login()
        avail[CLAUDE_REVIEW]["login"] = detail if state == "ok" else state
        reason = claude_login_problem(state, detail)
        if reason:
            warnings.append(claude_login_help(reason))
    quota = quota_summary(avail)
    if a.json:
        print(json.dumps({"role": a.role, "route": route, "peak": peak, "review_routes": review_routes,
                          "profiles": avail, "quota": quota, "warnings": warnings}, indent=2))
        return
    print("route: " + ",".join(route))
    if peak and not a.open_design:
        print(f"peak: {PEAK_EXECUTOR} first (DeepSeek peak hours)" if usable(PEAK_EXECUTOR, avail)
              else f"peak: {PEAK_EXECUTOR} is not usable now (DeepSeek peak hours)")
    if quota:
        print("agy quota: " + ", ".join(
            f"{pool} {state['remaining'] * 100:.0f}%" + (f" until {state['until']}" if state["until"] else "")
            for pool, state in quota.items()))
    for profile in route:
        family = MODELS[profile][2]
        print(f"review route after {profile} ({family}): " + ",".join(review_routes[family]))
    groups = {}
    for name, state in avail.items():
        if state["cooling_until"]:
            groups.setdefault((state["cooling_until"], state["reset_source"]), []).append(name)
    for (until, source), names in sorted(groups.items()):
        print(f"cooling: {', '.join(names)} until {until} ({source})")
    missing = sorted({state["executor"] for state in avail.values() if not state["found"]})
    if missing:
        print("missing CLI: " + ", ".join(missing))
    for warning in warnings:
        print(f"warning: {warning}")


class PausedError(Exception):
    pass


class SlotTimeoutError(Exception):
    def __init__(self, executor):
        self.executor = executor
        super().__init__(f"slot wait timed out: no free {executor} slot")


def exception_reason(exc):
    if isinstance(exc, KeyboardInterrupt) or (isinstance(exc, SystemExit) and exc.code in (130, 143)):
        return "interrupted"
    return str(exc) or type(exc).__name__


def check_paused():
    if PAUSED.exists():
        raise PausedError("paused")


def is_paused():
    return PAUSED.exists()


class SlotLock:
    def directory(self):
        return RUNNING

    def __enter__(self):
        directory = self.directory()
        directory.mkdir(parents=True, exist_ok=True)
        self.lock_path = directory / ".lock"
        self.f = open(self.lock_path, "w")
        fcntl.flock(self.f, fcntl.LOCK_EX)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            fcntl.flock(self.f, fcntl.LOCK_UN)
            self.f.close()
        except (OSError, ValueError):
            pass


class RemoteActiveLock(SlotLock):
    """Guards RUNNING_REMOTE alone, so a --host run never touches RUNNING."""

    def directory(self):
        return RUNNING_REMOTE


def check_model_allowed(role, executor, model, profile=None):
    """The one check for the OpenCode rule.

    OpenCode runs DeepSeek Flash and Muse Spark only, and DELEGATE_OPENCODE_MODEL
    may name nothing but Flash: a Flash profile it points at another model, Muse
    included, is refused, while the Muse profiles keep their fixed model. The
    reviewer rule lives in check_review_family and in the pipeline family check,
    not here. Called after every alias, profile, flag and environment override
    is resolved, and before anything is launched or any slot is taken.
    """
    if executor != "opencode":
        return
    if model not in OPENCODE_MODELS or (profile in FLASH_PROFILES and model != FLASH_MODEL):
        print(f"delegate: OpenCode runs only {FLASH_MODEL} and {MUSE_MODEL}; "
              "use codex or agy for another model",
              file=sys.stderr)
        sys.exit(2)


def check_review_family(role, executor, model, family, author_family):
    """A standalone review names the author's family; it is never the reviewer's own."""
    if role != "review" or not author_family:
        return
    if executor == "opencode":
        family = OPENCODE_FAMILIES.get(model, family)
    elif family is None:
        family = next((f for e, m, f in MODELS.values() if e == executor and m == model), None)
    if family == author_family:
        usage_error("the reviewer is never of the family that wrote the code: "
                    f"{model} is {family} and cannot review {author_family} work")


def check_claude_review(executor, role, allowed, author_family, host=None):
    """The rules of the fallback reviewer, checked before anything is launched."""
    if executor != "claude":
        return
    if role != "review":
        usage_error(f"{CLAUDE_REVIEW} only reviews; there is no Claude executor profile")
    if not allowed:
        usage_error(f"{CLAUDE_REVIEW} needs --allow-claude-review: pass it only after the operator "
                    "said yes to a Claude review for this task")
    if not author_family:
        usage_error(f"{CLAUDE_REVIEW} needs --author-family <family of the model that wrote the code> "
                    f"({FAMILIES_TEXT})")
    if author_family == "anthropic":
        usage_error("the reviewer is never of the family that wrote the code: "
                    f"{CLAUDE_REVIEW} cannot review work written by a Claude model")
    if host:
        usage_error(f"{CLAUDE_REVIEW} does not run on a remote host; drop --host for this review")


def check_agy_claude(executor, model, role, author_family):
    """A Claude model on Antigravity only reviews, and never a Claude model's code."""
    if not agy_claude_model(executor, model):
        return
    if role != "review":
        usage_error(f"Claude models on Antigravity only review; {model} cannot take the role {role}")
    if not author_family:
        usage_error(f"{model} on Antigravity needs --author-family <family of the model that wrote "
                    f"the code> ({FAMILIES_TEXT})")
    if author_family == "anthropic":
        usage_error("the reviewer is never of the family that wrote the code: "
                    f"{model} cannot review work written by a Claude model")


def claude_last(route):
    """The fallback reviewer goes after every other reviewer, wherever it was named."""
    return [p for p in route if p != CLAUDE_REVIEW] + [p for p in route if p == CLAUDE_REVIEW]


def usage_error(message):
    print(f"delegate: {message}", file=sys.stderr)
    sys.exit(2)


def fenced(content):
    fence = "`" * max(3, 1 + max((len(run) for run in re.findall(r"`+", content)), default=0))
    return f"{fence}\n{content}" + ("" if content.endswith("\n") else "\n") + f"{fence}\n"


def read_attachment(filename):
    path = Path(filename)
    # The basename is interpolated into the prompt outside any fence. A newline
    # or other control character would inject prompt structure, so refuse it.
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in path.name):
        usage_error(f"attachment name contains control characters: {str(path)!r}")
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        usage_error(f"cannot attach {filename}: {exc}")


def severity_rubric_path():
    """severity-rubric.md beside this file, in the repository and in an install."""
    return Path(__file__).resolve().parent / "severity-rubric.md"


def read_severity_rubric():
    """The rubric every review prompt ends with; a review is refused without it."""
    path = severity_rubric_path()
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        usage_error(f"the severity rubric is missing: {path}; a review needs it beside "
                    "delegate.py (reinstall atomic-skills)")
    except (OSError, UnicodeError) as exc:
        usage_error(f"cannot read the severity rubric {path}: {exc}")
    if not text.strip():
        usage_error(f"the severity rubric is empty: {path}")
    return text if text.endswith("\n") else text + "\n"


def diff_exclude_arg(text):
    """A pathspec for --diff-exclude: not empty and on one line."""
    if not text.strip() or any(ord(ch) < 32 or ord(ch) == 127 for ch in text):
        raise argparse.ArgumentTypeError("a pathspec on one line, such as package-lock.json or 'dist/*'")
    return text


def compose_prompt(card, attachments, diff_range, cwd, diff_exclude=None):
    content = Path(card).read_text(encoding="utf-8")
    if diff_range:
        # Standalone runs get the same placeholder substitution as pipeline.
        content = content.replace("{{DIFF_RANGE}}", diff_range)
    card_bytes = len(content.encode("utf-8"))
    attached, attached_bytes = [], 0
    for filename in attachments or []:
        path = Path(filename)
        attachment = read_attachment(filename)
        attached.append(path.name)
        attached_bytes += len(attachment.encode("utf-8"))
        content += f"\n## Attached: {path.name}\n" + fenced(attachment)
    diff_bytes = 0
    diff_decoded_replaced = False
    failure = None
    if diff_range:
        if not re.fullmatch(r"[^.\s-][^\s]*\.{2,3}[^.\s-][^\s]*", diff_range) or diff_range.startswith("-"):
            usage_error("--diff-range must be <base>...<head> or <base>..<head>")
        # The whole tree (":/"), less each excluded pathspec, read from cwd.
        pathspecs = [":/", *(f":(exclude){p}" for p in diff_exclude)] if diff_exclude else []
        result = subprocess.run(["git", "-C", cwd, "diff", "--no-ext-diff", diff_range, "--", *pathspecs],
                                capture_output=True)
        if result.returncode:
            usage_error("cannot read --diff-range: " + result.stderr.decode("utf-8", errors="replace").strip())
        diff_bytes = len(result.stdout)
        try:
            diff = result.stdout.decode("utf-8")
        except UnicodeDecodeError:
            diff = result.stdout.decode("utf-8", errors="replace")
            diff_decoded_replaced = True
        if diff_decoded_replaced:
            content += ("\n> Note: the diff contains bytes that are not valid UTF-8; "
                        "they appear as U+FFFD in this prompt.\n")
        left_out = f" (left out: {', '.join(diff_exclude)})" if diff_exclude else ""
        content += f"\n## Diff {diff_range}{left_out}\n" + fenced(diff)
        if not diff_bytes:
            failure = "empty_diff"
    sizes = {"diff_bytes": diff_bytes, "diff_decoded_replaced": diff_decoded_replaced,
             "attached": attached, "attached_bytes": attached_bytes,
             "card_bytes": card_bytes, "prompt_bytes": len(content.encode("utf-8"))}
    if diff_range and diff_exclude:
        sizes["diff_excluded"] = list(diff_exclude)
    return content, sizes, failure


class RemoteError(Exception):
    """A remote-runner precondition failed before an executor was launched."""

    def __init__(self, failure, detail):
        self.failure = failure
        self.detail = detail
        super().__init__(detail)


def remote_runner_cmd():
    raw = os.environ.get("DELEGATE_REMOTE_RUNNER")
    if raw:
        return raw
    return shutil.which("remote-runner")


def remote_cli(args, timeout=120, timeout_failure="remote_not_ready"):
    exe = remote_runner_cmd()
    if not exe:
        raise RemoteError("remote_not_ready",
                          "remote-runner not found; install it or set DELEGATE_REMOTE_RUNNER")
    try:
        return subprocess.run([exe, *args], capture_output=True, text=True, timeout=timeout)
    except OSError as exc:
        raise RemoteError("remote_not_ready", f"cannot run remote-runner: {exc}")
    except subprocess.TimeoutExpired:
        raise RemoteError(timeout_failure, "remote-runner timed out")


def remote_doctor(host):
    result = remote_cli(["doctor", "--host", host, "--json"])
    raw = result.stdout.strip()
    try:
        data = json.loads(raw.splitlines()[-1] if raw else "")
    except (ValueError, IndexError):
        detail = (result.stderr.strip().splitlines() or
                  ["remote-runner doctor did not return JSON"])[-1]
        raise RemoteError("remote_not_ready", detail)
    if not isinstance(data, dict):
        raise RemoteError("remote_not_ready", "remote-runner doctor returned an invalid report")
    return data


def remote_checks(host):
    data = remote_doctor(host)
    return {check.get("id"): check for check in data.get("checks", [])
            if isinstance(check, dict) and check.get("id")}


# remote-runner's catalogue ids are not the executor binary names: Antigravity
# is installed as `agy` but its integration id (and every check id) is
# `antigravity`.
REMOTE_INTEGRATION_IDS = {
    "opencode": "opencode",
    "codex": "codex",
    "agy": "antigravity",
}


def remote_integration_id(executor):
    return REMOTE_INTEGRATION_IDS.get(executor, executor)


def remote_ready(checks, host, executor):
    """Return the one-line fix when the executor is unusable on the host."""
    integration_id = remote_integration_id(executor)
    connection = checks.get("connection")
    if connection and connection.get("status") != "ok":
        return connection.get("detail") or f"host {host} is unreachable"
    integration = checks.get(f"integration-{integration_id}")
    if not integration:
        return (f"{executor} is not an enabled integration on {host}; add "
                f"\"{integration_id}\" to that host's \"integrations\" in the remote-runner "
                f"config, then run remote-runner provision --host {host} --apply")
    if integration.get("status") == "fail":
        return integration.get("detail") or f"{executor} is not installed on {host}"
    auth = checks.get(f"integration-{integration_id}-auth")
    if auth and auth.get("status") in ("fail", "warn"):
        detail = auth.get("detail") or ""
        if auth.get("status") == "fail" or "not signed in" in detail:
            fix = f"run remote-runner auth {integration_id} --host {host} --login"
            if "remote-runner auth" in detail:
                return detail
            return f"{detail or executor + ' is not signed in'}; {fix}"
    for check_id, check in checks.items():
        if check.get("status") != "fail":
            continue
        # Another integration's problem does not block this executor; missing
        # remote tools, roots or state do.
        if check_id.startswith("remote-") or check_id.startswith("local-root"):
            return check.get("detail") or f"{check_id} failed on {host}"
    return None


def remoteify(value):
    if isinstance(value, str):
        # The resolved form guards a root reached through a symlink.
        resolved = str(Path(REMOTE_POLICY_ROOT).resolve())
        return value.replace(resolved, REMOTE_BASE_PLACEHOLDER).replace(
            REMOTE_POLICY_ROOT, REMOTE_BASE_PLACEHOLDER)
    if isinstance(value, list):
        return [remoteify(item) for item in value]
    if isinstance(value, dict):
        return {key: remoteify(item) for key, item in value.items()}
    return value


def remote_access_policy(executor, role, strict=False):
    policy = access_policy(
        executor, role, REMOTE_POLICY_ROOT + "/tree",
        out_path=REMOTE_POLICY_ROOT + "/run", strict=strict,
        common_dir=REMOTE_POLICY_ROOT + "/tree/.git",
        home_dirs=[REMOTE_POLICY_ROOT + "/run"])
    policy["argv"] = remoteify(policy["argv"])
    policy["env"] = remoteify(policy["env"])
    policy["access"] = remoteify(policy["access"])
    return policy


def resolve_remote_access(access, remote_base):
    if not remote_base:
        return remoteify(access)
    text = json.dumps(access, ensure_ascii=False).replace(REMOTE_BASE_PLACEHOLDER, remote_base)
    return json.loads(text)


def safe_remote_name(value):
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", str(value or "task")).strip("._") or "task"
    return name[:120]


def remote_task_dir(task_id):
    """Stable per-id directory; sanitized ids that collide stay separate."""
    raw = str(task_id or "")
    return f"{safe_remote_name(raw)}-{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:8]}"


def remote_base_rel(project, task_id):
    return f"{REMOTE_BASE_DEFAULT}/{safe_remote_name(project)}/{remote_task_dir(task_id)}"


def remote_delegate_ref(task_id):
    name = re.sub(r"[^A-Za-z0-9._/-]+", "-", str(task_id))
    name = re.sub(r"\.{2,}", ".", name).strip("/.")
    if name.endswith(".lock"):
        name += "-ref"
    return ("refs/delegate/" + name) if name else "refs/delegate/task"


def _shell_remote_var(name, value):
    return (f"{name}={shlex.quote(value)}\n"
            f"{name}=\"${{{name}//{REMOTE_BASE_PLACEHOLDER}/$R}}\"\n")


def remote_exec_script(executor, model, role, policy):
    """Shell wrapper that runs one executor inside the remote checkout.

    `R` is the absolute remote per-task directory exported by the driver. The
    composed prompt is a file under `$R/run`; it reaches the executor from that
    file, never from this wrapper's argv or the remote-runner argv.
    """
    lines = ["set -e"]
    variables = []

    def shell_arg(value):
        if REMOTE_BASE_PLACEHOLDER not in value:
            return shlex.quote(value)
        if value.startswith(REMOTE_BASE_PLACEHOLDER):
            suffix = value[len(REMOTE_BASE_PLACEHOLDER):]
            return '"$R' + suffix + '"'
        name = f"DELEGATE_ARG_{len(variables)}"
        variables.append(_shell_remote_var(name, value))
        return f'"${name}"'

    if executor == "opencode":
        for key, value in policy["env"].items():
            name = "DELEGATE_ENV_" + re.sub(r"[^A-Za-z0-9_]", "_", key)
            variables.append(_shell_remote_var(name, value))
            lines.append(f'export {key}="${{{name}}}"')
        lines.append('PROMPT=$(cat "$R/run/prompt.md"; printf x)')
        lines.append('PROMPT=${PROMPT%x}')
        argv = ["opencode", "run", "--standalone", "--archived", "-m", model]
        guard_argv(argv, executor)
        lines.append("exec " + " ".join(shlex.quote(arg) for arg in argv) + ' "$PROMPT"')
    elif executor == "agy":
        argv = ["agy", "--model", model, "--output-format", "text"] + policy["argv"]
        guard_argv(argv, executor)
        lines.append("exec " + " ".join(shell_arg(arg) for arg in argv) +
                     ' < "$R/run/prompt.md"')
    elif executor == "codex":
        effort = "high" if role == "review" else "medium"
        sandbox = "read-only" if role == "review" else "workspace-write"
        argv = [
            "codex", "-a", "never", "exec", "--model", model,
            "-c", f"model_reasoning_effort={effort}", "--sandbox", sandbox,
            "--skip-git-repo-check", "--ephemeral", "-C", REMOTE_BASE_PLACEHOLDER + "/tree",
        ] + policy["argv"] + ["-o", REMOTE_BASE_PLACEHOLDER + "/run/last.md", "-"]
        guard_argv(argv, executor)
        lines.append("exec " + " ".join(shell_arg(arg) for arg in argv) +
                     ' < "$R/run/prompt.md"')
    else:
        raise RemoteError("remote_error", f"unknown executor {executor}")
    return "\n".join(variables + lines) + "\n"


@dataclass
class RemoteDriverScript:
    """The inputs of one remote-run driver script, named so the caller cannot swap them."""
    task_id: str
    task: str
    role: str
    branch: str
    sent: str
    project: str
    digest: str
    token: str


def _driver_header(driver):
    """Set every shell variable and the failure traps the rest of the driver uses."""
    q = shlex.quote
    project_dir = safe_remote_name(driver.project)
    task_dir = remote_task_dir(driver.task_id)
    return f"""#!/bin/bash
set -u
id={q(driver.task_id)}
branch={q(driver.branch)}
sent={q(driver.sent)}
role={q(driver.role)}
msg={q(f"{driver.task_id}: {driver.task} (committed by the delegate runner)")}
token={q(driver.token)}
common=$(git rev-parse --path-format=absolute --git-common-dir)
stage="$common/delegate/{driver.digest}"
R="$HOME/.atomic-skills/delegate/remote/{project_dir}/{task_dir}"
tree="$R/tree"
run="$R/run"
res="$PWD/{REMOTE_RESULT_PREFIX}{driver.digest}"
cleanup() {{
  [ -n "${{run:-}}" ] && rm -rf "$run"
  [ -n "${{stage:-}}" ] && rm -rf "$stage"
}}
trap 'cleanup; exit 143' TERM INT HUP
trap cleanup EXIT
rm -rf "$run" "$res"
mkdir -p "$R"
"""


def _driver_run_id(driver):
    """Find and announce the remote-runner run id this script belongs to."""
    q = shlex.quote
    token = driver.token
    return f"""# Identify this run exactly. remote-runner writes a record whose first line is
# the pid of the session leader it started; this script runs below it (under
# `timeout` and a login shell), so that pid is this script or one of its
# ancestors. The stderr line lets the local runner read the id without ever
# guessing from a list of new ids.
state="${{REMOTE_RUNNER_REMOTE_STATE:-$HOME/.local/state/remote-runner}}"
run_id="${{REMOTE_RUNNER_RUN_ID:-}}"
if [ -z "$run_id" ] && [ -d "$state/runs" ]; then
  ancestors=" $$ "
  pid=$$
  depth=0
  while [ "$depth" -lt 16 ]; do
    pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    case "$pid" in ''|0|1|*[!0-9]*) break ;; esac
    ancestors="$ancestors$pid "
    depth=$((depth + 1))
  done
  # Newest first: a stale record for a reused pid must never win over the one
  # remote-runner wrote for this run immediately before starting it.
  for name in $(ls -1t "$state/runs" 2>/dev/null); do
    case "$name" in .*|*.env|*.cancel|*.gate|*.owner) continue ;; esac
    rec="$state/runs/$name"
    [ -f "$rec" ] || continue
    leader=$(sed -n '1p' "$rec" 2>/dev/null)
    case "$leader" in ''|*[!0-9]*) continue ;; esac
    case "$ancestors" in *" $leader "*) run_id="$name"; break ;; esac
  done
fi
if [ -n "$run_id" ]; then
  printf '%s alive pgid=%s\\n' "$run_id" "$$" > "$R/.delegate-run-$token"
  printf '__DELEGATE_REMOTE_RUN__ %s %s\\n' "$token" "$run_id" >&2
fi
"""


def _driver_checkout(driver):
    """Reuse or create the checkout and publish the run directory the executor reads."""
    token = driver.token
    return f"""# Reuse only a checkout that is exactly the commit being sent and clean.
# Anything else is remote work that never reached the local branch: keep it
# under a timestamped name instead of deleting it.
reuse=0
kept=""
kept_head=""
if [ -d "$tree/.git" ]; then
  kept_head=$(git -C "$tree" rev-parse HEAD 2>/dev/null || true)
  if [ -n "$kept_head" ] && [ "$kept_head" = "$sent" ] && \
      [ "$(git -C "$tree" symbolic-ref --short -q HEAD)" = "$branch" ] && \
      [ -z "$(git -C "$tree" status --porcelain 2>/dev/null)" ]; then
    reuse=1
  elif [ -n "$kept_head" ] && \
      [ "$(git -C "$tree" symbolic-ref --short -q HEAD)" = "$branch" ] && \
      [ -z "$(git -C "$tree" status --porcelain 2>/dev/null)" ] && \
      git -C "$tree" fetch -q "$stage/code.bundle" "$sent" 2>/dev/null && \
      git -C "$tree" merge-base --is-ancestor "$kept_head" "$sent" 2>/dev/null && \
      git -C "$tree" reset -q --hard "$sent"; then
    # A clean checkout whose commit is already part of what is being sent
    # holds nothing unfetched: move it forward in place.
    reuse=1
    kept_head=""
  else
    stamp=$(date -u +%Y%m%dT%H%M%SZ)
    kept="$R/kept-$stamp"
    n=1
    while [ -e "$kept" ]; do kept="$R/kept-$stamp-$n"; n=$((n+1)); done
    mv "$tree" "$kept" || exit 70
  fi
fi
if [ "$reuse" != 1 ]; then
  git init -q "$tree" || exit 70
  git -C "$tree" fetch -q "$stage/code.bundle" "$sent:refs/heads/$branch" || exit 70
  git -C "$tree" symbolic-ref HEAD "refs/heads/$branch" || exit 70
  git -C "$tree" reset -q --hard "$sent" || exit 70
fi
mkdir -p "$run"
cp "$stage/prompt.md" "$run/prompt.md"
if [ -d "$stage/attachments" ]; then cp -a "$stage/attachments" "$run/attachments"; fi
if [ -f "$stage/diff.txt" ]; then cp "$stage/diff.txt" "$run/diff.txt"; fi
cp "$stage/exec.sh" "$run/exec.sh"
printf '__DELEGATE_REMOTE_WORK__\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\n' \
  "$token" "$tree" "$branch" "$sent" "${{kept:--}}" "${{kept:+$kept_head}}" >&2
"""


def _driver_execute(driver):
    """Run the executor, commit its work on an implement run, and collect the result."""
    q = shlex.quote
    review = driver.role == "review"
    return f"""export R
cd "$tree" || exit 70
bash "$run/exec.sh" >"$run/stdout" 2>"$run/stderr"
code=$?
received=$(git -C "$tree" rev-parse HEAD)
dirty=0
if [ -n "$(git -C "$tree" status --porcelain)" ]; then dirty=1; fi
commit_rc=0
if [ {q('1' if not review else '0')} = 1 ] && {{ [ "$dirty" = 1 ] || [ "$received" != "$sent" ]; }}; then
  if [ "$dirty" = 1 ]; then
    git -C "$tree" add -A
    git -C "$tree" -c user.name="Delegate Runner" -c user.email="delegate@localhost" \
        commit -q -m "$msg" >>"$run/commit.log" 2>&1
    commit_rc=$?
  fi
  received=$(git -C "$tree" rev-parse HEAD)
fi
if [ "$received" != "$sent" ]; then
  git -C "$tree" bundle create "$run/result.bundle" "$branch" >/dev/null 2>&1 || true
fi
{{
  printf 'token=%s\\n' "$token"
  printf 'exit=%s\\n' "$code"
  printf 'received=%s\\n' "$received"
  printf 'dirty=%s\\n' "$dirty"
  printf 'commit_rc=%s\\n' "${{commit_rc:-}}"
  printf 'remote_base=%s\\n' "$R"
  printf 'tree=%s\\n' "$tree"
}} > "$run/meta.txt"
mkdir -p "$res"
cp "$run/stdout" "$run/stderr" "$run/meta.txt" "$res/"
for f in last.md result.bundle commit.log; do
  if [ -f "$run/$f" ]; then cp "$run/$f" "$res/"; fi
done
exit 0
"""


def remote_driver_script(driver):
    """The shell script that runs one executor inside the remote checkout."""
    return "".join([
        _driver_header(driver),
        _driver_run_id(driver),
        _driver_checkout(driver),
        _driver_execute(driver),
    ])


REMOTE_RUN_MARKER = "__DELEGATE_REMOTE_RUN__"
REMOTE_WORK_MARKER = "__DELEGATE_REMOTE_WORK__"


def remote_run_marker(path, token):
    """Return the run id this driver reported, from its stderr marker line."""
    try:
        text = Path(path).read_text(errors="replace")
    except OSError:
        return None
    run_id = None
    for line in text.splitlines():
        parts = line.split()
        if len(parts) == 3 and parts[0] == REMOTE_RUN_MARKER and parts[1] == token:
            if re.fullmatch(r"[0-9a-fA-F-]{36}", parts[2]):
                run_id = parts[2]
    return run_id


def remote_work_marker(path, token):
    """Return where this run kept the remote work, from its stderr marker line."""
    try:
        text = Path(path).read_text(errors="replace")
    except OSError:
        return None
    work = None
    for line in text.splitlines():
        parts = line.split("\t")
        if len(parts) == 7 and parts[0] == REMOTE_WORK_MARKER and parts[1] == token:
            work = {"dir": parts[2], "branch": parts[3], "head": parts[4]}
            if parts[5] != "-":
                # An earlier checkout that held work never fetched back.
                work["previous"] = {"dir": parts[5], "head": parts[6]}
    return work


def remote_kill(host, run_id):
    if not run_id:
        return False
    try:
        result = remote_cli(["kill", "--host", host, run_id], timeout=60)
        return result.returncode == 0
    except RemoteError:
        return False


def remote_stop(host, run_id):
    """Stop exactly one run; say whether the stop was confirmed."""
    if not run_id:
        return "no_id"
    return "ok" if remote_kill(host, run_id) else "failed"


def _kill_limit(pending, kill_result):
    if kill_result in ("failed", "no_id"):
        access = pending.get("access")
        if isinstance(access, dict):
            access.setdefault("limits", []).append(
                f"remote-runner kill did not confirm a stop ({kill_result}); "
                f"check `remote-runner runs --host {pending.get('host')}` on the host")


def _remote_record_failure(pending, failure, detail=None, **extra):
    kill_result = extra.get("remote_kill") or pending.pop("_remote_kill", None)
    if kill_result:
        extra["remote_kill"] = kill_result
        _kill_limit(pending, kill_result)
    work = extra.get("remote_work_kept") or pending.pop("_remote_work", None)
    if work and failure != "none":
        extra["remote_work_kept"] = work
    for key in [key for key in pending if key.startswith("_")]:
        pending.pop(key)
    pending.update(failure=failure, completed=now().isoformat(timespec="microseconds"), **extra)
    if detail:
        pending["remote_error"] = detail
    append(pending)
    return pending


def _copy_result(src, dest):
    try:
        if Path(src).is_file():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dest)
    except OSError:
        pass


@dataclass
class RemoteRunRequest:
    """The run a --host dispatch carries from the local command into the remote path."""
    task_id: str
    task: str
    role: str
    executor: str
    model: str
    family: Optional[str]
    profile: Optional[str]
    cwd: str
    project: str
    out_path: Path
    card_content: str
    input_sizes: dict
    pending: dict
    timeout: float
    wait_s: float
    attempt: int
    confirmed: bool
    allow_peak: bool
    diff_range: Optional[str]
    attachments: Optional[list]
    access_mode: str
    host: str
    prompt: Path
    stdout: Path
    stderr: Path
    last_msg: Path


def execute_remote_run(request):
    """Run remotely and always leave a record, even for an unhandled error.

    The run is listed in RUNNING_REMOTE from here until this function returns
    or raises, whatever the path. It takes no local slot.
    """
    (task_id, task, role, executor, model, family, profile, cwd, project, out_path,
     card_content, input_sizes, pending, timeout, wait_s, attempt, confirmed, allow_peak,
     diff_range, attachments, access_mode, host, prompt, stdout, stderr, last_msg) = (
        request.task_id, request.task, request.role, request.executor, request.model,
        request.family, request.profile, request.cwd, request.project, request.out_path,
        request.card_content, request.input_sizes, request.pending, request.timeout,
        request.wait_s, request.attempt, request.confirmed, request.allow_peak,
        request.diff_range, request.attachments, request.access_mode, request.host,
        request.prompt, request.stdout, request.stderr, request.last_msg)
    # Checks, sync and pull are each bounded by the timeout plus two minutes.
    active_file, active = new_remote_active(
        executor, task_id, project, profile, role, host,
        limit_s=wait_s + 3 * (timeout + 120) + 600)
    pending["active_token"] = active["token"]
    try:
        publish_remote_active(active_file, active)
        try:
            return _execute_remote_run(request)
        except (KeyboardInterrupt, SystemExit):
            raise
        except BaseException as exc:
            if "completed" in pending:
                raise
            return _remote_record_failure(
                pending, "remote_error", f"remote run failed: {exception_reason(exc)}",
                host=host)
    finally:
        remove_remote_active(active_file)


@dataclass
class MergeOutcome:
    """What the local side did with the returned bundle."""
    diverged: bool
    diverged_reason: Optional[str]
    fetched_ref: Optional[str]
    fetch_error: Optional[str]


@dataclass
class RemoteOutcome:
    """The pulled result of a remote run, before its record is built."""
    received: str
    remote_exit: int
    remote_dirty: bool
    commit_failed: bool
    commit_error: Optional[str]
    review_wrote: bool
    merge: MergeOutcome
    failure: str
    head1: str
    dirty_after: bool
    uncommitted: bool
    commits: str
    files: str
    review_output: Optional[object]


@dataclass
class RemoteRun:
    """The mutable state of one --host run from staging to the pulled result."""
    request: RemoteRunRequest
    snap0: tuple
    branch: str
    policy: dict
    default_base: str
    peak: bool
    sent: str
    digest: str
    staging: Path
    stage: Path
    local_res: Path
    bundle: Path
    started: str
    remote_out: str
    remote_err: str
    run_token: str
    process: Optional[subprocess.Popen] = None
    timed_out: bool = False
    local_slot_timeout: bool = False
    orphan_failure: Optional[str] = None
    interrupted_exc: Optional[BaseException] = None
    remote_id: Optional[str] = None
    kill_result: Optional[str] = None
    run_s: float = 0.0
    send_s: float = 0.0
    fetch_s: float = 0.0
    fetch_t0: float = 0.0
    remote_code: Optional[int] = None
    last_line: str = ""
    work_info: Optional[dict] = None
    meta: Optional[dict] = None
    deadline: Optional[float] = None
    result: Optional[dict] = None


def _execute_remote_run(request):
    """Run the executor on a remote host through the remote-runner CLI.

    Code is shipped as a git bundle inside a dedicated staging repository that
    holds no worktree files and is fetched into a per-task checkout. Results
    return as a git bundle written in the remote staging directory and pulled
    back before a local fast-forward fetch.
    """
    run = _prepare_remote(request)
    if isinstance(run, dict):
        return run
    if not _send_remote(run):
        return run.result
    _read_remote_outcome(run)
    return _remote_result(run)


def _discover_remote_id(run):
    """Read this run's id from the marker once; never guess another run's id."""
    if not run.remote_id:
        run.remote_id = remote_run_marker(run.remote_err, run.run_token)
    return run.remote_id


def _stop_remote_process(run):
    """Stop the remote run this process knows, and remember whether the stop was confirmed."""
    _discover_remote_id(run)
    run.kill_result = remote_stop(run.request.host, run.remote_id)
    run.request.pending["_remote_kill"] = run.kill_result
    if run.process is not None:
        _terminate_remote_process(run.process)


def _prepare_remote(request):
    """Check the host and build the staging repository, or return the refusal record."""
    snap0 = tree_snapshot(request.cwd)
    branch = git(request.cwd, "rev-parse", "--abbrev-ref", "HEAD")
    policy = remote_access_policy(request.executor, request.role,
                                  strict=request.access_mode == "strict")
    default_base = remote_base_rel(request.project, request.task_id)
    request.pending.update(host=request.host, remote_dir=default_base,
                           access=resolve_remote_access(policy["access"], default_base))
    if snap0[1]:
        return _remote_record_failure(request.pending, "dirty_worktree", wait_s=0)
    if not branch or branch == "HEAD":
        return _remote_record_failure(
            request.pending, "remote_error",
            "remote runs need a named branch; check out the task branch first")
    if not remote_runner_cmd():
        return _remote_record_failure(
            request.pending, "remote_not_ready",
            "remote-runner not found; install it or set DELEGATE_REMOTE_RUNNER")
    try:
        checks = remote_checks(request.host)
    except RemoteError as exc:
        return _remote_record_failure(request.pending, exc.failure, exc.detail)
    fix = remote_ready(checks, request.host, request.executor)
    if fix:
        return _remote_record_failure(request.pending, "remote_not_ready", fix)

    peak = in_peak() and request.family == "deepseek"
    if peak:
        print("delegate: OpenCode Go peak window (UTC); DeepSeek on OpenCode Go costs double now — proceeding",
              file=sys.stderr)
    if request.executor == "codex":
        request.last_msg.unlink(missing_ok=True)

    sent = snap0[0]
    digest = hashlib.sha256(f"{request.task_id}\0{sent}".encode("utf-8")).hexdigest()[:16]
    # Ship a dedicated repository that holds only the bundle and the run files.
    # Syncing the worktree would also send every untracked and ignored file,
    # including .env* (remote-runner's includeIgnored default).
    staging = Path(request.cwd) / f".delegate-remote-stage-{digest}"
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir(parents=True)
    try:
        subprocess.run(["git", "init", "-q", str(staging)], check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError) as exc:
        shutil.rmtree(staging, ignore_errors=True)
        return _remote_record_failure(
            request.pending, "remote_error",
            f"cannot prepare the remote staging repository: {exc}")
    stage = staging / ".git" / "delegate" / digest
    local_res = staging / f"{REMOTE_RESULT_PREFIX}{digest}"
    stage.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(stage, 0o700)
    except OSError:
        pass
    bundle = stage / "code.bundle"
    request.out_path.mkdir(parents=True, exist_ok=True)
    request.stdout.write_text("", encoding="utf-8")
    request.stderr.write_text("", encoding="utf-8")
    started = now().isoformat(timespec="microseconds")
    remote_out = tempfile.NamedTemporaryFile(prefix="delegate-remote-", suffix=".out", delete=False)
    remote_err = tempfile.NamedTemporaryFile(prefix="delegate-remote-", suffix=".err", delete=False)
    remote_out_name, remote_err_name = remote_out.name, remote_err.name
    remote_out.close()
    remote_err.close()
    return RemoteRun(request=request, snap0=snap0, branch=branch, policy=policy,
                     default_base=default_base, peak=peak, sent=sent, digest=digest,
                     staging=staging, stage=stage, local_res=local_res, bundle=bundle,
                     started=started, remote_out=remote_out_name, remote_err=remote_err_name,
                     run_token=os.urandom(8).hex())


def _stage_remote_payload(run):
    """Put the bundle, prompt, executor script and attachments in the staging repository."""
    request = run.request
    try:
        subprocess.run(["git", "-C", request.cwd, "bundle", "create", str(run.bundle), run.branch],
                       check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError) as exc:
        detail = getattr(exc, "stderr", b"")
        if isinstance(detail, bytes):
            detail = detail.decode("utf-8", errors="replace")
        raise RemoteError("remote_error", f"cannot create git bundle: {detail or exc}")
    (run.stage / "prompt.md").write_text(request.card_content, encoding="utf-8")
    exec_script = remote_exec_script(request.executor, request.model, request.role, run.policy)
    (run.stage / "exec.sh").write_text(exec_script, encoding="utf-8")
    (run.stage / "remote-run.sh").write_text(
        remote_driver_script(RemoteDriverScript(
            request.task_id, request.task, request.role, run.branch, run.sent,
            request.project, run.digest, run.run_token)),
        encoding="utf-8")
    if request.attachments:
        attach_dir = run.stage / "attachments"
        attach_dir.mkdir(exist_ok=True)
        for filename in request.attachments:
            source = Path(filename)
            _copy_result(source, attach_dir / source.name)
    if request.diff_range:
        diff_result = subprocess.run(
            ["git", "-C", request.cwd, "diff", "--no-ext-diff", request.diff_range, "--"],
            capture_output=True)
        if diff_result.returncode == 0:
            (run.stage / "diff.txt").write_bytes(diff_result.stdout)


def _sync_remote_payload(run):
    """Send the staging repository to the host."""
    request = run.request
    send_t0 = time.monotonic()
    sync_result = remote_cli(["sync", "--host", request.host, str(run.staging)],
                             timeout=max(120, request.timeout + 120),
                             timeout_failure="remote_error")
    run.send_s = time.monotonic() - send_t0
    if sync_result.returncode != 0:
        detail = (sync_result.stderr.strip().splitlines() or
                  ["remote-runner sync failed"])[-1]
        raise RemoteError("remote_error", detail)


def _start_remote_process(run):
    """Start the remote-runner child and wait for it, the queue or a stop."""
    request = run.request
    snippet = (f'exec bash "$(git rev-parse --path-format=absolute '
               f'--git-common-dir)/delegate/{run.digest}/remote-run.sh"')
    argv = [remote_runner_cmd(), "run", "-n", "--host", request.host, "-C", str(run.staging),
            "--wait", str(request.wait_s), "--timeout", str(max(1, request.timeout + 30)),
            "--", snippet]
    run_t0 = time.monotonic()
    # The queue is bounded by --wait; the executor timeout starts only when
    # the run reports that it is active (its marker), never while queued.
    queue_deadline = run_t0 + request.wait_s + 2
    with open(run.remote_out, "w") as so, open(run.remote_err, "w") as se:
        run.process = subprocess.Popen(argv, stdout=so, stderr=se, start_new_session=True)
    parent_pid = os.getppid()
    next_probe = time.monotonic()
    while True:
        code_now = run.process.poll()
        if code_now is not None:
            break
        if os.getppid() != parent_pid:
            raise ParentGone()
        now_s = time.monotonic()
        if run.deadline is not None and now_s >= run.deadline:
            run.timed_out = True
            _stop_remote_process(run)
            break
        if run.deadline is None and now_s >= queue_deadline:
            run.local_slot_timeout = True
            _stop_remote_process(run)
            break
        if now_s >= next_probe:
            if _discover_remote_id(run) and run.deadline is None:
                run.deadline = time.monotonic() + request.timeout
            next_probe = time.monotonic() + 0.25
        time.sleep(0.05)
    run.run_s = time.monotonic() - run_t0


def _send_remote(run):
    """Stage, sync and start the remote run; say whether it reached the result phase."""
    request = run.request
    try:
        _stage_remote_payload(run)
        _sync_remote_payload(run)
        _start_remote_process(run)
    except ParentGone:
        run.orphan_failure = "orphaned"
        _stop_remote_process(run)
    except (KeyboardInterrupt, SystemExit) as exc:
        run.orphan_failure = "interrupted"
        run.interrupted_exc = exc
        _stop_remote_process(run)
    except RemoteError as exc:
        _cleanup_remote_local(run.staging)
        _cleanup_temp(run.remote_out, run.remote_err)
        run.result = _remote_record_failure(
            request.pending, exc.failure, exc.detail,
            send_s=round(run.send_s, 3), run_s=round(run.run_s, 3),
            fetch_s=round(run.fetch_s, 3))
        return False
    finally:
        if run.process is not None and run.process.poll() is None:
            _terminate_remote_process(run.process)
    return True


def _read_remote_outcome(run):
    """Read the child's exit, the last real stderr cause and the work marker."""
    run.remote_code = run.process.returncode if run.process is not None else None
    remote_stderr = ""
    try:
        remote_stderr = Path(run.remote_err).read_text(errors="replace").strip()
    except OSError:
        pass
    causes = [line for line in remote_stderr.splitlines()
              if line.strip() and not line.startswith(("remote-runner: result=", REMOTE_RUN_MARKER,
                                                       REMOTE_WORK_MARKER))]
    run.last_line = (causes or [""])[-1]
    work_info = remote_work_marker(run.remote_err, run.run_token)
    if work_info:
        run.work_info = dict(work_info)
        run.request.pending["_remote_work"] = dict(work_info)


def _remote_kept_record(run, extra=None):
    """The kept-work record this run can report, or None when no marker was found."""
    if not run.work_info:
        return None
    kept = dict(run.work_info)
    if extra:
        kept.update(extra)
    return kept


def _remote_early_stop(run):
    """Record a stopped or unsent run before any pull, or return None to continue."""
    request = run.request
    if run.orphan_failure:
        rec = _remote_record_failure(
            request.pending, run.orphan_failure, wait_s=round(run.run_s, 3),
            send_s=round(run.send_s, 3), run_s=round(run.run_s, 3),
            fetch_s=round(run.fetch_s, 3), exit_code=run.remote_code)
        if run.interrupted_exc is not None:
            raise run.interrupted_exc
        return rec
    if run.local_slot_timeout:
        extra = {"remote_kill": run.kill_result} if run.kill_result else {}
        return _remote_record_failure(
            request.pending, "slot_timeout",
            run.last_line or "no free capacity on the host within --wait", host=request.host,
            wait_s=round(run.run_s, 3), send_s=round(run.send_s, 3),
            run_s=round(run.run_s, 3), fetch_s=round(run.fetch_s, 3),
            exit_code=run.remote_code, **extra)
    if run.remote_code == 74:
        return _remote_record_failure(
            request.pending, "slot_timeout", run.last_line or None, host=request.host,
            wait_s=round(run.run_s, 3), send_s=round(run.send_s, 3),
            run_s=round(run.run_s, 3), fetch_s=round(run.fetch_s, 3))
    return None


def _read_remote_meta(path):
    """Read the key=value meta file the driver wrote for this run."""
    meta = {}
    if path.is_file():
        for line in path.read_text(errors="replace").splitlines():
            key, sep, value = line.partition("=")
            if sep:
                meta[key] = value
    return meta


def _pull_remote_result(run):
    """Pull the result and say whether it belongs to this run; record a refusal otherwise."""
    request = run.request
    run.fetch_t0 = time.monotonic()
    shutil.rmtree(run.local_res, ignore_errors=True)
    pull = remote_cli(["pull", "--host", request.host, str(run.local_res)],
                      timeout=max(120, request.timeout + 120))
    meta = _read_remote_meta(run.local_res / "meta.txt")
    if meta.get("token") != run.run_token:
        run.fetch_s = time.monotonic() - run.fetch_t0
        _cleanup_remote_local(run.staging)
        if run.timed_out:
            extra = {"remote_work_kept": _remote_kept_record(run)} if _remote_kept_record(run) else {}
            if run.kill_result:
                extra["remote_kill"] = run.kill_result
            run.result = _remote_record_failure(
                request.pending, "timeout", wait_s=round(run.run_s, 3), timed_out=True,
                send_s=round(run.send_s, 3), run_s=round(run.run_s, 3),
                fetch_s=round(run.fetch_s, 3), exit_code=run.remote_code, **extra)
            return False
        detail = run.last_line or (pull.stderr.strip().splitlines() or [""])[-1]
        run.result = _remote_record_failure(
            request.pending, "remote_error", detail or "remote run produced no result",
            send_s=round(run.send_s, 3), run_s=round(run.run_s, 3),
            fetch_s=round(run.fetch_s, 3), exit_code=run.remote_code)
        return False
    run.meta = meta
    return True


def _merge_remote_result(run, meta):
    """Fetch the returned bundle; fast-forward the branch or keep the ref and say why."""
    request = run.request
    received = meta.get("received") or run.sent
    diverged, diverged_reason = False, None
    fetched_ref, fetch_error = None, None
    if request.role != "review" and received != run.sent and not run.timed_out and not run.orphan_failure:
        fetched_ref = remote_delegate_ref(request.task_id)
        current_branch = git(request.cwd, "rev-parse", "--abbrev-ref", "HEAD")
        fetch = subprocess.run(
            ["git", "-C", request.cwd, "fetch", "--no-tags", str(run.local_res / "result.bundle"),
             f"+refs/heads/{run.branch}:{fetched_ref}"], capture_output=True, text=True)
        if fetch.returncode != 0:
            fetch_error = fetch.stderr.strip() or "cannot fetch the result bundle"
        elif current_branch != run.branch:
            diverged = True
            diverged_reason = (f"the worktree moved to {current_branch or 'a detached HEAD'}, "
                               f"not {run.branch}; the result is kept at {fetched_ref}")
        elif subprocess.run(["git", "-C", request.cwd, "merge-base", "--is-ancestor",
                             "HEAD", fetched_ref], capture_output=True).returncode != 0:
            diverged = True
            diverged_reason = ("the local branch and the remote result diverge; "
                               f"the result is kept at {fetched_ref}")
        else:
            merge = subprocess.run(["git", "-C", request.cwd, "merge", "--ff-only", fetched_ref],
                                   capture_output=True, text=True)
            if merge.returncode != 0:
                diverged = True
                detail = (merge.stderr.strip().splitlines() or
                          ["git refused the fast-forward"])[-1]
                diverged_reason = ("a local change overlaps the remote result and the "
                                   f"fast-forward was refused ({detail}); commit or stash "
                                   f"it, then merge {fetched_ref}")
            else:
                subprocess.run(["git", "-C", request.cwd, "update-ref", "-d", fetched_ref],
                               capture_output=True)
    return MergeOutcome(diverged, diverged_reason, fetched_ref, fetch_error)


def _remote_commit_error(run, meta):
    """Turn the driver's commit exit into a reason the record can show."""
    commit_rc = meta.get("commit_rc") or ""
    if commit_rc in ("", "0"):
        return False, None
    commit_error = f"remote auto-commit failed (git exit {commit_rc})"
    try:
        tail = [line for line in (run.local_res / "commit.log").read_text(
            errors="replace").splitlines() if line.strip()]
    except OSError:
        tail = []
    if tail:
        commit_error += ": " + tail[-1]
    return True, commit_error


def _remote_failure(run, meta, merge, review_wrote, commit_failed):
    """Pick the record's failure from the facts of the returned run."""
    request = run.request
    if run.orphan_failure:
        return run.orphan_failure
    if run.timed_out:
        return "timeout"
    if merge.diverged:
        return "diverged"
    if merge.fetch_error:
        return "remote_error"
    if review_wrote:
        return "review_wrote"
    if commit_failed:
        return "remote_error"
    review_output = None
    if request.role == "review":
        review_output = request.last_msg if request.executor == "codex" else request.stdout
    return classify_failure(False, int(meta.get("exit") or 0), request.stdout, request.stderr,
                            review_wrote, review_output, request.executor)


def _remote_outcome(run, meta):
    """Copy the result files, merge the bundle and classify what the run produced."""
    request = run.request
    received = meta.get("received") or run.sent
    remote_dirty = meta.get("dirty") == "1"
    commit_failed, commit_error = _remote_commit_error(run, meta)
    _copy_result(run.local_res / "stdout", request.stdout)
    _copy_result(run.local_res / "stderr", request.stderr)
    if request.executor == "codex":
        _copy_result(run.local_res / "last.md", request.last_msg)
    review_wrote = request.role == "review" and (remote_dirty or received != run.sent)
    merge = _merge_remote_result(run, meta)
    run.fetch_s = time.monotonic() - run.fetch_t0
    # The pulled result directory lives in the synced staging repository;
    # remove it before snapshotting, or it would look like executor dirt.
    _cleanup_remote_local(run.staging)
    snap1 = tree_snapshot(request.cwd)
    head1 = snap1[0]
    review_output = None
    if request.role == "review":
        review_output = request.last_msg if request.executor == "codex" else request.stdout
    commits = git(request.cwd, "rev-list", "--count", f"{run.sent}..{head1}") if run.sent and head1 else ""
    files = git(request.cwd, "diff", "--name-only", f"{run.sent}..{head1}") if run.sent and head1 else ""
    return RemoteOutcome(
        received, int(meta.get("exit") or 0), remote_dirty, commit_failed, commit_error,
        review_wrote, merge,
        _remote_failure(run, meta, merge, review_wrote, commit_failed),
        head1, bool(snap1[1]), bool(remote_dirty and request.role != "review"),
        commits, files, review_output)


def _remote_run_record(run, meta, outcome):
    """Build the run record of a pulled remote run, in the log's key order."""
    request = run.request
    remote_base = meta.get("remote_base") or run.default_base
    access = resolve_remote_access(run.policy["access"], remote_base)
    access.setdefault("limits", []).append(
        "leftover-process cleanup on the host is only what remote-runner kill guarantees")
    if run.kill_result in ("failed", "no_id"):
        access.setdefault("limits", []).append(
            f"remote-runner kill did not confirm a stop ({run.kill_result}); "
            f"check `remote-runner runs --host {request.host}` on the host")
    rec = {
        "kind": "run", "id": request.task_id, "project": request.project,
        "task": request.task, "role": request.role, "executor": request.executor,
        "model": request.model, "family": request.family,
        "user_confirmed": bool(request.confirmed), "started": run.started,
        "duration_s": round(run.run_s), "exit_code": outcome.remote_exit,
        "timed_out": run.timed_out, "completed": now().isoformat(timespec="microseconds"),
        "wait_s": round(run.run_s if run.remote_code == 74 else 0, 3),
        "failure": outcome.failure, "peak": run.peak, "base": run.sent[:10],
        "head": outcome.head1[:10],
        "commits": int(outcome.commits) if outcome.commits.isdigit() else 0,
        "files_changed": len([f for f in outcome.files.splitlines() if f]),
        "dirty_before": False, "dirty_after": outcome.dirty_after,
        "uncommitted": outcome.uncommitted,
        "card": str(Path(request.pending["card"]).resolve()), "stdout": str(request.stdout),
        "stderr": str(request.stderr), "attempt": request.attempt, "prompt": str(request.prompt),
        "access": access, "host": request.host, "remote_dir": remote_base,
        "sync": {"sent": run.sent, "received": outcome.received},
        "orphans": {"found": 0, "killed": 0, "sample": []},
        "send_s": round(run.send_s, 3), "run_s": round(run.run_s, 3),
        "fetch_s": round(run.fetch_s, 3), **request.input_sizes,
    }
    if request.pending.get("active_token"):
        rec["active_token"] = request.pending["active_token"]
    if outcome.failure == "permission_denied":
        rec["denied_permission"] = agy_denied_permission(request.stderr)
    if outcome.merge.fetch_error:
        rec["remote_error"] = outcome.merge.fetch_error
    elif outcome.commit_error:
        rec["remote_error"] = outcome.commit_error
    elif outcome.merge.diverged_reason:
        rec["remote_error"] = outcome.merge.diverged_reason
    if run.kill_result:
        rec["remote_kill"] = run.kill_result
    if outcome.merge.diverged and outcome.merge.fetched_ref:
        rec["remote_ref"] = outcome.merge.fetched_ref
    if outcome.failure != "none":
        kept = _remote_kept_record(
            run, {"ref": outcome.merge.fetched_ref}
            if outcome.merge.diverged and outcome.merge.fetched_ref else None)
        if kept:
            rec["remote_work_kept"] = kept
    if request.executor == "codex":
        rec["last_message"] = str(request.last_msg)
    if request.role == "review" and outcome.failure == "none":
        rec.update(review_severity_fields(outcome.review_output))
    return rec


def _cleanup_remote_run(run):
    """Remove the local staging repository and the child's capture files."""
    _cleanup_remote_local(run.staging)
    _cleanup_temp(run.remote_out, run.remote_err)


def _remote_result(run):
    """Pull the result, merge it and append the record; every exit cleans up."""
    try:
        early = _remote_early_stop(run)
        if early is not None:
            return early
        if not _pull_remote_result(run):
            return run.result
        outcome = _remote_outcome(run, run.meta or {})
        rec = _remote_run_record(run, run.meta or {}, outcome)
        append(rec)
        if run.interrupted_exc is not None:
            raise run.interrupted_exc
        return rec
    finally:
        _cleanup_remote_run(run)

def _terminate_remote_process(process):
    """Stop the local remote-runner child; it owns the remote process group."""
    try:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    process.kill()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    pass
    except (OSError, ProcessLookupError):
        pass


def _cleanup_remote_local(staging):
    shutil.rmtree(staging, ignore_errors=True)


def _cleanup_temp(*paths):
    for path in paths:
        try:
            Path(path).unlink(missing_ok=True)
        except OSError:
            pass


def output_tail(paths, limit=RESUME_TAIL_LINES):
    """The last non-empty lines of the first capture that has any, with its path."""
    for path in paths:
        try:
            lines = [line for line in Path(path).read_text(errors="replace").splitlines() if line.strip()]
        except OSError:
            continue
        if lines:
            return path, lines[-limit:]
    return None, []


@dataclass
class CheckpointSpec:
    """Everything a stopped local run keeps: where it ran, why, and its output."""
    task_id: str
    cwd: str
    out_path: Path
    base: Optional[str]
    failure: str
    timeout: float
    idle_timeout: float
    captures: tuple


def write_checkpoint(spec):
    """Keep the work of a stopped run: commit a dirty tree and write the resume note.

    Called after the executor's processes are gone. The commit uses the
    repository's own identity and hooks, like the pipeline's runner commit; a
    refused commit leaves the files in the tree and is written in the note.
    """
    task_id, cwd, out_path, base = spec.task_id, spec.cwd, spec.out_path, spec.base
    failure, timeout, idle_timeout = spec.failure, spec.timeout, spec.idle_timeout
    captures = spec.captures
    reason = STOP_REASONS[failure].format(idle=idle_timeout, cap=timeout)
    commits = git(cwd, "log", "--oneline", f"{base}..HEAD") if base else ""
    status = git(cwd, "status", "--short", "--untracked-files=all")
    commit, commit_line = None, "nothing to commit: the working tree was clean"
    if status:
        message = f"{task_id}: {CHECKPOINT_SUFFIX}"
        identity = [] if git(cwd, "config", "user.email") else [
            "-c", "user.name=Delegate Runner", "-c", "user.email=delegate@localhost"]
        detail = ""
        for args in (["add", "-A"], [*identity, "commit", "-q", "-m", message]):
            try:
                done = subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True)
            except OSError as exc:
                detail = str(exc)
                break
            if done.returncode != 0:
                detail = " ".join((done.stderr or done.stdout).split())[:300]
                break
        if not detail and not git(cwd, "status", "--short", "--untracked-files=all"):
            commit = git(cwd, "rev-parse", "HEAD")
            commit_line = f"{commit[:10]} {message}"
        else:
            commit_line = ("the checkpoint commit failed, the changes are still in the working tree"
                           + (f": {detail}" if detail else ""))
    source, tail = output_tail(captures)
    note = out_path / f"{task_id}.resume.md"
    text = "\n".join([
        f"# Resume note for {task_id}",
        "",
        f"- Stopped because: {reason}.",
        f"- Worktree: {cwd}",
        f"- Base of the run: {base[:10] if base else 'unknown'}",
        "",
        "## Commits made in this run",
        "",
        fenced(commits or "(none)"),
        "## Working tree when it stopped",
        "",
        fenced(status or "(clean)"),
        "## Checkpoint",
        "",
        commit_line,
        "",
        f"## Last lines of the executor's output ({source})" if source
        else "## Last lines of the executor's output",
        "",
        fenced("\n".join(tail) if tail else "(no output)"),
    ])
    note.write_text(text, encoding="utf-8")
    return {"commit": commit, "resume": str(note)}


def find_resume(task_id, project):
    """The resume note of the last run of this id, or the reason there is none."""
    last = None
    if LOG.exists():
        for line in LOG.read_text().splitlines():
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            if (isinstance(rec, dict) and rec.get("kind") == "run" and rec.get("id") == task_id
                    and rec.get("project") == project):
                last = rec
    if last is None:
        return None, f"no resume note for {task_id}: no run of that id is recorded for project {project}"
    note = (last.get("checkpoint") or {}).get("resume")
    if not note:
        return None, (f"no resume note for {task_id}: its last run ended with "
                      f"failure={last.get('failure')} and left no checkpoint")
    try:
        text = Path(note).read_text(encoding="utf-8")
    except OSError as exc:
        return None, f"no resume note for {task_id}: cannot read {note}: {exc}"
    return {"text": text, "path": note, "completed": last.get("completed"),
            "attempt": last.get("attempt") or 1}, None


RESUME_SECTION = """
## You are resuming an interrupted run

An earlier run of this same task was stopped before it finished. Its commits are
on this branch, and anything it had not committed is in the checkpoint commit
named below. Read those commits first (`git log`, `git show`), then continue from
where it stopped. Do not redo work that is already committed, and do not revert
the checkpoint commit: build on it. The note the runner wrote when it stopped:

"""


@dataclass
class RunOptions:
    """The optional inputs of one run, with the defaults the command line uses."""
    profile: Optional[str] = None
    executor: Optional[str] = None
    model: Optional[str] = None
    cwd: Optional[str] = None
    card: Optional[str] = None
    out: Optional[str] = None
    project: Optional[str] = None
    timeout: float = DEFAULT_TIMEOUT_S
    wait_s: float = 3600
    attempt: int = 1
    confirmed: bool = False
    allow_peak: bool = False
    diff_range: Optional[str] = None
    attachments: Optional[list] = None
    access_mode: str = "policy"
    host: Optional[str] = None
    idle_timeout: float = DEFAULT_IDLE_TIMEOUT_S
    resume: bool = False
    allow_claude_review: bool = False
    author_family: Optional[str] = None
    diff_exclude: Optional[str] = None


@dataclass
class RunIdentity:
    """The profile and the executor/model/family a run resolved to."""
    profile: Optional[str]
    executor: str
    model: str
    family: Optional[str]


@dataclass
class PromptSetup:
    """The composed prompt and the facts the run paths need from it."""
    task_id: str
    cwd: str
    project: str
    card_content: str
    input_sizes: dict
    input_failure: Optional[str]
    too_large: Optional[str]
    resumed_from: Optional[str]
    attempt: int


@dataclass
class RunSetup:
    """Everything one run knows before it starts: identity, prompt, paths and pending record."""
    task_id: str
    task: str
    role: str
    options: RunOptions
    identity: RunIdentity
    cwd: str
    project: str
    card_content: str
    input_sizes: dict
    input_failure: Optional[str]
    too_large: Optional[str]
    resumed_from: Optional[str]
    attempt: int
    out_path: Path
    policy: dict
    stdout: Path
    stderr: Path
    last_msg: Path
    prompt: Path
    tracker: ProcessTracker
    pending: dict


@dataclass
class LocalRun:
    """The mutable state of one local slot acquisition and executor wait."""
    setup: RunSetup
    argv: list
    progress_files: tuple
    agy_log: Optional[Path]
    peak: bool
    deadline: float
    max_slots: int
    si: Optional[object] = None
    git_global: Optional[Path] = None
    p: Optional[subprocess.Popen] = None
    slot_file: Optional[Path] = None
    slot_data: Optional[dict] = None
    queued_at: float = 0.0
    timed_out: bool = False
    stalled: bool = False
    orphan_failure: Optional[str] = None
    interrupted_exc: Optional[BaseException] = None
    exit_seen: bool = False
    pending_return: bool = False
    pending_error: Optional[SlotTimeoutError] = None
    snap0: tuple = ()
    head0: str = ""
    dirty_before: bool = False
    started: str = ""
    t0: float = 0.0
    wait_duration_s: float = 0.0
    progress: Optional[ProgressWatch] = None


@dataclass
class LocalOutcome:
    """The tree and failure a finished local run produced, before the record is built."""
    head1: str
    dirty_after: bool
    failure: str
    uncommitted: bool
    commits: str
    files: str


def _resolve_run_identity(role, options):
    """Turn the profile/executor/model options into a runnable identity and check the route rules."""
    alias_notice = None
    profile = options.profile
    if profile in ALIASES:
        target = ALIASES[profile]
        alias_notice = f"delegate: profile {profile} is deprecated; use --profile {target}"
        profile = target
    if profile in REMOVED_PROFILES:
        print(REMOVED_PROFILE_MESSAGE.format(name=profile), file=sys.stderr)
        sys.exit(2)
    if role == "review" and profile in REVIEW_PROFILES:
        profile = REVIEW_PROFILES[profile]
    if profile:
        executor, model, family = MODELS[profile]
    else:
        executor, model = options.executor, options.model
        family = "anthropic" if agy_claude_model(executor, model) else None
    if not executor or not model:
        sys.exit("delegate: give --profile, or both --executor and --model")
    check_model_allowed(role, executor, model, profile)
    check_claude_review(executor, role, options.allow_claude_review, options.author_family,
                        options.host)
    check_review_family(role, executor, model, family, options.author_family)
    check_agy_claude(executor, model, role, options.author_family)
    if alias_notice:
        print(alias_notice, file=sys.stderr)
    return RunIdentity(profile, executor, model, family)


def _prepare_prompt(task_id, role, options, identity):
    """Compose the card prompt, attach the review rubric or resume note, and check its size."""
    cwd = str(Path(options.cwd).resolve())
    if (role == "review" and EXECUTOR_FLAGS.get(identity.executor, {}).get("requires_review_diff")
            and not options.diff_range):
        usage_error(f"{identity.executor} review requires --diff-range; the runner attaches the exact diff")
    card_content, input_sizes, input_failure = compose_prompt(
        options.card, options.attachments, options.diff_range, cwd, options.diff_exclude)
    if role == "review" and not options.diff_range and "{{DIFF_RANGE}}" in Path(options.card).read_text(encoding="utf-8"):
        usage_error("review card contains {{DIFF_RANGE}} but no --diff-range was given; "
                    "pass --diff-range <base>...<head>")
    if role == "review":
        # The reviewer answers the rubric's questions; the runner computes the severity.
        card_content += "\n" + read_severity_rubric()
        input_sizes["prompt_bytes"] = len(card_content.encode("utf-8"))
    top = git(cwd, "rev-parse", "--show-toplevel") or cwd
    project = options.project or Path(top).name
    resumed_from = None
    attempt = options.attempt
    if options.resume:
        previous, problem = find_resume(task_id, project)
        if problem:
            usage_error(problem)
        card_content += RESUME_SECTION + fenced(previous["text"])
        input_sizes["prompt_bytes"] = len(card_content.encode("utf-8"))
        input_sizes["resume_note"] = previous["path"]
        resumed_from = previous["completed"]
        attempt = max(attempt, previous["attempt"] + 1)
    size_failure = "review_input_too_large" if role == "review" else "input_too_large"
    too_large = None
    if input_sizes["prompt_bytes"] > MAX_REVIEW_INPUT_BYTES:
        input_failure, too_large = size_failure, f"the {MAX_REVIEW_INPUT_BYTES} bytes a review input may have"
    elif identity.executor in ARGV_PROMPT_EXECUTORS and input_sizes["prompt_bytes"] >= MAX_ARG_BYTES:
        # OpenCode takes the prompt as one argv element and would fail with
        # E2BIG at or above the kernel limit; it has no stdin prompt.
        input_failure, too_large = size_failure, f"the {MAX_ARG_BYTES} bytes OpenCode takes"
    elif (not input_failure and role == "review" and identity.executor == "agy"
          and str(identity.model).startswith("claude-opus")
          and input_sizes["prompt_bytes"] > AGY_OPUS_MAX_INPUT_BYTES):
        input_failure = OVER_MODEL_CAP
    return PromptSetup(task_id, cwd, project, card_content, input_sizes, input_failure,
                       too_large, resumed_from, attempt)


def _prepare_run_paths(task, role, options, identity, prompt):
    """Resolve the output paths and policy and build the pending record the run starts from."""
    task_id = prompt.task_id
    out_path = Path(options.out or HOME / "delegate" / "out" / prompt.project).resolve()
    out_path.mkdir(parents=True, exist_ok=True)
    policy = access_policy(identity.executor, role, prompt.cwd, out_path,
                           strict=options.access_mode == "strict")
    stdout, stderr, last_msg, prompt_path = run_output_paths(out_path, task_id, prompt.attempt)
    prompt_path.write_text(prompt.card_content, encoding="utf-8")
    tracker = ProcessTracker()
    orphans = {"found": 0, "killed": 0, "sample": [],
               "tracked": False, "polls": 0, "method": tracker.method}
    # A refused input or a queue timeout has an audit record, but no child snapshot.
    pending = {
        "kind": "run", "id": task_id, "project": prompt.project, "task": task, "role": role,
        "executor": identity.executor, "model": identity.model, "family": identity.family,
        "attempt": prompt.attempt, "user_confirmed": bool(options.confirmed),
        "duration_s": 0, "exit_code": None, "timed_out": False,
        "card": str(Path(options.card).resolve()), "prompt": str(prompt_path),
        "stdout": str(stdout), "stderr": str(stderr), "access": policy["access"],
        "orphans": orphans, **prompt.input_sizes, "machine": options.host or local_machine(),
    }
    if options.resume:
        pending["resumed_from"] = prompt.resumed_from
    return RunSetup(task_id, task, role, options, identity, prompt.cwd, prompt.project,
                    prompt.card_content, prompt.input_sizes, prompt.input_failure,
                    prompt.too_large, prompt.resumed_from, prompt.attempt, out_path, policy,
                    stdout, stderr, last_msg, prompt_path, tracker, pending)


def _record_input_failure(setup):
    """Write the record of a run refused before any executor starts."""
    pending = setup.pending
    pending["orphans"] = setup.tracker.sweep()
    pending.update(failure=setup.input_failure,
                   completed=now().isoformat(timespec="microseconds"))
    if setup.input_failure == "review_input_too_large":
        pending["hint"] = (
            f"the review prompt is {setup.input_sizes['prompt_bytes']} bytes, above {setup.too_large}; "
            "leave lockfiles and generated files out of the review diff with "
            "--diff-exclude <pathspec> (repeatable)")
        print(f"delegate: {pending['hint']}", file=sys.stderr)
    append(pending)
    return pending


def _dispatch_remote(task, role, setup):
    """Hand a prepared run to the remote path."""
    options = setup.options
    identity = setup.identity
    return execute_remote_run(RemoteRunRequest(
        setup.task_id, task, role, identity.executor, identity.model, identity.family,
        identity.profile, setup.cwd, setup.project, setup.out_path, setup.card_content,
        setup.input_sizes, setup.pending, options.timeout, options.wait_s, setup.attempt,
        options.confirmed, options.allow_peak, options.diff_range, options.attachments,
        options.access_mode, options.host, setup.prompt, setup.stdout, setup.stderr,
        setup.last_msg))


def _prepare_local_run(setup):
    """Build the executor argv and the local slot state, before any process starts."""
    executor = setup.identity.executor
    argv = build_argv(executor, setup.identity.model, setup.role, setup.cwd,
                      setup.card_content, setup.last_msg, setup.policy)
    progress_files = (setup.stdout, setup.stderr)
    agy_log = None
    if executor == "agy":
        # In text mode agy prints nothing until the turn ends, so a long review
        # changes no output and no file; its log is what shows it is working.
        agy_log = setup.stderr.with_suffix(".agy.log")
        argv += ["--log-file", str(agy_log)]
        progress_files += (agy_log,)
    peak = in_peak() and setup.identity.family == "deepseek"
    if peak:
        print("delegate: OpenCode Go peak window (UTC); DeepSeek on OpenCode Go costs double now — proceeding",
              file=sys.stderr)
    if executor == "codex":
        setup.last_msg.unlink(missing_ok=True)
    # Codex and Antigravity read the prompt from stdin; OpenCode takes it as an
    # argv element (see ARGV_PROMPT_EXECUTORS).
    si = open(setup.prompt, "rb") if executor in ("codex", "agy", "claude") else None
    return LocalRun(setup=setup, argv=argv, progress_files=progress_files, agy_log=agy_log,
                    peak=peak, deadline=time.time() + setup.options.wait_s,
                    max_slots=get_max_slots(executor), queued_at=time.monotonic(), si=si)


def _publish_slot(run):
    """Write this run's slot file atomically under the caller's slot lock."""
    setup, identity = run.setup, run.setup.identity
    run.slot_file = RUNNING / f"{identity.executor}-{setup.task_id}-{run.p.pid}.json"
    run.slot_data = {
        "id": setup.task_id,
        "project": setup.project,
        "profile": identity.profile,
        "role": setup.role,
        "machine": local_machine(),
        **ATTRIBUTION,
        "pid": run.p.pid,
        "pgid": run.p.pid,
        "started": run.started,
        "process_start": process_identity(run.p.pid) or f"unreaped:{os.getpid()}:{run.p.pid}",
        "runner_pid": os.getpid(),
        "runner_start": process_identity(os.getpid()),
    }
    slot_tmp = run.slot_file.with_suffix(".tmp")
    slot_tmp.write_text(json.dumps(run.slot_data, ensure_ascii=False))
    os.replace(slot_tmp, run.slot_file)


def _acquire_and_wait(run):
    """Poll for a free slot, start the executor under it, and wait for its exit or a stop."""
    setup, options, identity = run.setup, run.setup.options, run.setup.identity
    executor, cwd, task_id = identity.executor, setup.cwd, setup.task_id
    parent_pid = os.getppid()
    if executor == "agy":
        run.git_global = flatten_git_global(cwd, task_id)
        if run.git_global is not None:
            setup.policy["env"]["GIT_CONFIG_GLOBAL"] = str(run.git_global)
            setup.policy["access"]["limits"].append(AGY_GIT_GLOBAL_LIMIT)
    with open(setup.stdout, "w") as so, open(setup.stderr, "w") as se:
        while True:
            check_paused()
            if os.getppid() != parent_pid:
                raise ParentGone()
            with SlotLock():
                active = _get_active_slots(executor)
                if len(active) < run.max_slots:
                    check_paused()
                    run.snap0 = tree_snapshot(cwd)
                    run.head0 = run.snap0[0]
                    run.dirty_before = bool(run.snap0[1])
                    run.started = now().isoformat(timespec="microseconds")
                    run.t0 = time.monotonic()
                    run.wait_duration_s = run.t0 - run.queued_at
                    child_env = child_environment(executor, os.environ, setup.policy["env"])
                    run.p = subprocess.Popen(
                        run.argv, cwd=cwd, stdout=so, stderr=se,
                        stdin=run.si if run.si is not None else subprocess.DEVNULL,
                        start_new_session=True, env=child_env,
                    )
                    setup.tracker.watch(run.p.pid)
                    _publish_slot(run)
                    break

            if time.time() >= run.deadline:
                raise SlotTimeoutError(executor)
            remaining = run.deadline - time.time()
            time.sleep(min(5.0, max(0.05, remaining)))

        try:
            # Built inside the try: it runs git, and a stop signal that lands
            # there must still end the executor and write the record.
            run.progress = ProgressWatch(cwd, run.progress_files, options.idle_timeout,
                                         run.slot_file, run.slot_data)
            wait_for_exit(run.p, options.timeout, parent_pid=parent_pid,
                          tracker=setup.tracker, progress=run.progress)
            run.exit_seen = True
        except ParentGone:
            # The orchestrator's background task (or the parent shell) went
            # away. Poll before TERM so the last detached child is known.
            run.orphan_failure = "orphaned"
            setup.tracker.poll(force=True)
            terminate_process(run.p)
        except (KeyboardInterrupt, SystemExit) as exc:
            run.orphan_failure = "interrupted"
            run.interrupted_exc = exc
            setup.tracker.poll(force=True)
            terminate_process(run.p)
        except (subprocess.TimeoutExpired, Stalled) as stop:
            run.stalled = isinstance(stop, Stalled)
            run.timed_out = not run.stalled
            setup.tracker.poll(force=True)
            try:
                os.killpg(run.p.pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass
            try:
                wait_for_exit(run.p, 10, tracker=setup.tracker)
                run.exit_seen = True
            except subprocess.TimeoutExpired:
                pass


def _cleanup_local_run(run):
    """Reap the executor, drop its slot and sweep every descendant it left."""
    setup = run.setup
    # Reap and removal are one locked transition: kill can trust the runner
    # identity while Darwin hides the unreaped zombie's start time.
    try:
        with SlotLock():
            try:
                if run.p is not None:
                    # The normal exit already forced its snapshot in
                    # wait_for_exit; the stalled paths force one here
                    # before the group kill.
                    if not run.exit_seen:
                        setup.tracker.poll(force=True)
                    stop_process(run.p)
            finally:
                if run.slot_file and (run.p is None or run.p.returncode is not None):
                    run.slot_file.unlink(missing_ok=True)
                    run.slot_file.with_suffix(".tmp").unlink(missing_ok=True)
    finally:
        try:
            # Runs on success, failure, timeout, stop and the orphan watcher:
            # whatever the executor left outside its group ends here. The
            # sweep result is part of every record, including pending ones.
            # A normal exit already forced its poll; the other paths need
            # one more snapshot here before the sweep acts.
            setup.pending["orphans"] = setup.tracker.sweep(force_poll=not run.exit_seen)
        finally:
            if run.si is not None:
                run.si.close()
            if run.git_global is not None:
                try:
                    run.git_global.unlink(missing_ok=True)
                except OSError:
                    pass


def _run_local_executor(task, role, setup):
    """Acquire a slot, run the executor locally and turn every stop into a record."""
    run = _prepare_local_run(setup)
    try:
        _acquire_and_wait(run)
    except ParentGone:
        setup.pending.update(failure="orphaned", wait_s=round(time.monotonic() - run.queued_at, 3),
                             completed=now().isoformat(timespec="microseconds"))
        run.pending_return = True
    except SlotTimeoutError as exc:
        setup.pending.update(failure="slot_timeout", wait_s=round(time.monotonic() - run.queued_at, 3),
                             completed=now().isoformat(timespec="microseconds"))
        run.pending_return = True
        run.pending_error = exc
        exc.record = setup.pending
    except (KeyboardInterrupt, SystemExit) as exc:
        if run.p is None:
            raise
        run.orphan_failure = "interrupted"
        run.interrupted_exc = exc
    finally:
        _cleanup_local_run(run)
    if run.pending_return:
        append(setup.pending)
        if run.pending_error is not None:
            raise run.pending_error
        return setup.pending
    return _complete_local_run(task, role, run)


def _checkpoint_stopped_run(role, run):
    """Commit and note the work of a stopped implement run; a review keeps nothing."""
    stop_failure = run.orphan_failure or (
        "stalled" if run.stalled else "timeout" if run.timed_out else None)
    if not stop_failure or role == "review":
        return None
    spec = CheckpointSpec(run.setup.task_id, run.setup.cwd, run.setup.out_path, run.head0,
                          stop_failure, run.setup.options.timeout,
                          run.setup.options.idle_timeout, (run.setup.stdout, run.setup.stderr))
    try:
        return write_checkpoint(spec)
    except Exception as exc:  # the record must still be written
        return {"commit": None, "resume": None, "error": str(exc)[:300]}


def _local_outcome(run, role, snap1):
    """Classify the finished local run from the tree before and after it."""
    setup = run.setup
    head1 = snap1[0]
    review_wrote = role == "review" and snap1 != run.snap0
    review_output = ((setup.last_msg if setup.identity.executor == "codex" else setup.stdout)
                     if role == "review" else None)
    failure = run.orphan_failure or ("stalled" if run.stalled else classify_failure(
        run.timed_out, run.p.returncode, setup.stdout, setup.stderr, review_wrote,
        review_output, setup.identity.executor))
    commits = (git(setup.cwd, "rev-list", "--count", f"{run.head0}..{head1}")
               if run.head0 and head1 else "")
    files = (git(setup.cwd, "diff", "--name-only", f"{run.head0}..{head1}")
             if run.head0 and head1 else "")
    return LocalOutcome(head1, bool(snap1[1]), failure,
                        role != "review" and head1 == run.head0 and snap1 != run.snap0,
                        commits, files)


def _local_run_record(task, role, run, outcome):
    """Build the run record of a finished local run, in the log's key order."""
    setup, identity, options = run.setup, run.setup.identity, run.setup.options
    rec = {
        "kind": "run", "id": setup.task_id, "project": setup.project,
        "task": task, "role": role, "executor": identity.executor, "model": identity.model,
        "family": identity.family, "user_confirmed": bool(options.confirmed),
        "started": run.started, "duration_s": round(time.monotonic() - run.t0),
        "exit_code": run.p.returncode, "timed_out": run.timed_out,
        "completed": now().isoformat(timespec="microseconds"),
        "wait_s": round(run.wait_duration_s, 3), "failure": outcome.failure,
        "peak": run.peak, "base": run.head0[:10], "head": outcome.head1[:10],
        "commits": int(outcome.commits) if outcome.commits.isdigit() else 0,
        "files_changed": len([f for f in outcome.files.splitlines() if f]),
        "dirty_before": run.dirty_before, "dirty_after": outcome.dirty_after,
        "uncommitted": outcome.uncommitted,
        "card": str(Path(options.card).resolve()), "stdout": str(setup.stdout),
        "stderr": str(setup.stderr), "attempt": setup.attempt, "prompt": str(setup.prompt),
        "access": setup.policy["access"], **setup.input_sizes,
        "orphans": setup.pending["orphans"],
    }
    if identity.executor == "codex":
        rec["last_message"] = str(setup.last_msg)
    if role == "review" and outcome.failure == "none":
        review_output = (setup.last_msg if identity.executor == "codex" else setup.stdout)
        rec.update(review_severity_fields(review_output))
    if run.agy_log is not None:
        rec["agy_log"] = str(run.agy_log)
    if outcome.failure == "permission_denied":
        rec["denied_permission"] = agy_denied_permission(setup.stderr)
    if identity.executor == "claude":
        rec["fallback_reviewer"] = True
        rec["author_family"] = options.author_family
        if rec["failure"] == "error" and claude_login_missing(setup.stdout):
            rec["hint"] = claude_login_help("Claude Code refused the local login")
            print(f"delegate: {rec['hint']}", file=sys.stderr)
    if run.stalled:
        rec["idle_s"] = round(run.progress.idle_s())
    if options.resume:
        rec["resumed_from"] = setup.resumed_from
    return rec


def _complete_local_run(task, role, run):
    """Write the record of a finished local run and keep the signal exit semantics."""
    checkpoint = _checkpoint_stopped_run(role, run)
    outcome = _local_outcome(run, role, tree_snapshot(run.setup.cwd))
    rec = _local_run_record(task, role, run, outcome)
    if checkpoint is not None:
        rec["checkpoint"] = checkpoint
    append(rec)
    if run.interrupted_exc is not None:
        # The record and slot cleanup are complete; keep the runner's normal
        # signal exit semantics.
        raise run.interrupted_exc
    return rec


def execute_run(task_id, task, role, options=None, **fields):
    """Run one executor and append its audit record; keyword fields build the options."""
    if options is None:
        options = RunOptions(**fields)
    elif fields:
        raise TypeError("execute_run takes RunOptions or keyword fields, not both")
    check_paused()
    identity = _resolve_run_identity(role, options)
    prompt = _prepare_prompt(task_id, role, options, identity)
    setup = _prepare_run_paths(task, role, options, identity, prompt)
    if setup.input_failure:
        return _record_input_failure(setup)
    if options.host:
        return _dispatch_remote(task, role, setup)
    return _run_local_executor(task, role, setup)


def cmd_run(a):
    if (a.profile == CLAUDE_REVIEW and a.role == "review" and a.allow_claude_review and not a.host
            and a.author_family not in (None, "anthropic")):
        check_claude_login()
    set_attribution(a.cwd, a.milestone)
    rec = execute_run(
        task_id=a.id, task=a.task, role=a.role, profile=a.profile,
        executor=a.executor, model=a.model, cwd=a.cwd, card=a.card,
        out=a.out, project=a.project, timeout=a.timeout,
        wait_s=getattr(a, "wait", 3600), attempt=a.attempt,
        confirmed=a.confirmed, allow_peak=a.allow_peak, diff_range=a.diff_range, attachments=a.attach,
        access_mode=a.access, host=a.host, idle_timeout=a.idle_timeout, resume=a.resume,
        allow_claude_review=a.allow_claude_review, author_family=a.author_family,
        diff_exclude=a.diff_exclude,
    )
    print(json.dumps(rec, ensure_ascii=False, indent=1))
    sys.exit(0 if rec["failure"] == "none" else 1)


def review_findings(review_file):
    """The runner's reading of a reviewer's answer file (see parse_review)."""
    return parse_review(Path(review_file).read_text(errors="replace"))


def review_summary(review, review_file, lines, closing=None, reserve=0):
    """Append a review to the summary `lines`: how the severities were found,
    the unclassified and mismatch notes, the finding lines (at most 59 summary
    lines in all, less `reserve` kept for what follows) and last `closing`, by
    default the TOTAL line the runner computed, which is the one every later
    step reads."""
    if review["severity_source"] == "reviewer":
        lines.append("- severity: chosen by the reviewer (old review format), counted from its finding lines")
    else:
        lines.append("- severity: computed by the runner from the answers to severity-rubric.md")
    unclassified = review["counts"]["unclassified"]
    if unclassified:
        lines.append(f"- unclassified findings: {unclassified}, counted as medium (an answer outside "
                     f"the rubric's words, or missing); full review: {review_file}")
    if review["findings_mismatch"]:
        claimed = review["findings_claimed"]
        said = (f"FINDINGS {claimed}" if isinstance(claimed, int) else
                "major={major} medium={medium} minor={minor}".format(**claimed))
        lines.append(f"- findings mismatch: the reviewer wrote {said}, its {len(review['findings'])} "
                     f"finding lines give the TOTAL below; full review: {review_file}")
    finding_lines = review["summary_lines"]
    budget = max(0, 59 - len(lines) - 2 - reserve)  # TOTAL and explicit overflow link
    lines.extend(finding_lines[:budget])
    if len(finding_lines) > budget:
        lines.append(f"- {len(finding_lines) - budget} findings omitted; full review: {review_file}")
    lines.append(review["total_line"] if closing is None else closing)


def review_pipeline_fields(review):
    """The computed counts a pipeline record carries for a finished review."""
    return {"severity_source": review["severity_source"],
            "findings_unclassified": review["counts"]["unclassified"],
            "findings_mismatch": review["findings_mismatch"]}


def compute_severity(answers, table=None):
    """The class of one finding from its six answers, by the first matching
    row of SEVERITY_RUBRIC["table"]: major, medium, minor, pre-existing or
    merged; None when no row matches. The answers are not checked here
    (answer_problems does that): dup and card match as "another finding" and
    "a quote" for any value other than "none"."""
    table = SEVERITY_RUBRIC["table"] if table is None else table
    seen = dict(answers)
    for key, any_value in (("dup", ANOTHER_FINDING), ("card", A_QUOTE)):
        if key in seen and seen[key] != "none":
            seen[key] = any_value
    for i, row in enumerate(table):
        if all(seen.get(key) in values for key, values in row["when"].items()):
            if "lowers" in row:
                below = compute_severity(answers, table[i + 1:])
                return row["result"] if below == row["lowers"] else below
            return row["result"]
    return None


def answer_problems(answers):
    """Why a finding's answers cannot be classified: a missing answer, a word
    outside the rubric's list (compared exactly, never guessed), a dup that is
    neither "none" nor a finding id, or a reach that does not fit the kind.
    Whether a dup merges is decided over the whole answer (classify_findings)."""
    words = SEVERITY_RUBRIC["answers"]
    problems = []
    for key, allowed in words.items():
        if key not in answers:
            problems.append(f"{key} is missing")
            continue
        value = answers[key]
        if key == "dup":
            ok = value == "none" or bool(FINDING_ID_RE.fullmatch(value))
        elif key == "card":
            ok = value == "none" or (value.lower() != "none" and any(ch.isalnum() for ch in value))
        else:
            ok = value in allowed
        if not ok:
            problems.append(f"{key}={value} is not an allowed answer")
    kind, reach = answers.get("kind"), answers.get("reach")
    if kind in words["kind"] and reach in words["reach"]:
        if kind in SEVERITY_RUBRIC["reach_kinds"] and reach == "-":
            problems.append(f"kind={kind} needs reach " + ", ".join(w for w in words["reach"] if w != "-"))
        elif kind not in SEVERITY_RUBRIC["reach_kinds"] and reach != "-":
            problems.append(f"kind={kind} takes reach=-")
    return problems


def card_answer(value):
    """A card answer without its quote marks; an empty quote is "none"."""
    value = value.strip()
    closer = QUOTE_MARKS.get(value[:1])
    if closer and len(value) > 1 and value.endswith(closer):
        value = value[1:-1].strip()
    return "none" if value in ("", "none") else value


def answers_summary(answers, dup_not_merged=None):
    """The answers of a finding in the summary: the ones that are not the
    default, then kind, reach and proof."""
    bits = []
    for key, default in (("origin", "diff"), ("dup", "none"), ("card", "none")):
        if key in answers and answers[key] != default:
            if key == "card":
                bits.append(f'card="{answers[key]}"')
            elif key == "dup" and dup_not_merged:
                bits.append(f"dup={answers[key]} (not merged: {dup_not_merged})")
            else:
                bits.append(f"{key}={answers[key]}")
    bits += [f"{key}={answers[key]}" for key in ("kind", "reach", "proof") if key in answers]
    return " ".join(bits)


def read_answers(parts):
    """(file:line, answers, what is wrong) of a finding line in the rubric's format:
    `F01 | file:line | origin=… | dup=… | card=… | kind=… | reach=… | proof=… | what | proof`."""
    i, location = 0, ""
    if parts and not ANSWER_RE.match(parts[0]):
        location, i = parts[0], 1
    answers = {}
    while i < len(parts):
        match = ANSWER_RE.match(parts[i])
        if not match or match.group(1) in answers:
            break
        key, value = match.group(1), match.group(2).strip()
        i += 1
        if key == "card":
            # A quote may hold a "|": it runs to its closing mark.
            closer = QUOTE_MARKS.get(value[:1])
            while (closer and not (len(value) > 1 and value.endswith(closer))
                   and i < len(parts) and not ANSWER_RE.match(parts[i])):
                value += " | " + parts[i]
                i += 1
            value = card_answer(value)
        answers[key] = value
    return location, answers, parts[i] if i < len(parts) else ""


def finding_dup_target(findings, i):
    """The finding id this finding's dup points to, or None."""
    dup = findings[i]["answers"].get("dup", "none")
    return dup if dup != "none" and FINDING_ID_RE.fullmatch(dup) else None


def finding_dup_circular(findings, first, i):
    """Whether this finding's dup chain goes round and names it again."""
    seen, dup = set(), finding_dup_target(findings, i)
    while dup in first and dup not in seen:
        if dup == findings[i]["id"]:
            return True
        seen.add(dup)
        dup = finding_dup_target(findings, first[dup])
    return False


def finding_dup_reason(findings, first, i):
    """Why this finding's dup merges nothing, or None when it does merge."""
    dup = finding_dup_target(findings, i)
    if dup is None:
        return None
    if dup == findings[i]["id"]:
        return "names itself"
    if dup not in first:
        return "no such finding"
    if finding_dup_circular(findings, first, i):
        return "circular"
    if classify_finding(findings, first, first[dup]) == "merged":
        return f"{dup} is merged itself"
    return None


def classify_finding(findings, first, i):
    """Set the severity and problems of one finding, and return the severity."""
    finding = findings[i]
    if "severity" in finding:
        return finding["severity"]
    finding["severity"] = "unclassified"  # never merged into while it is being decided
    answers, problems, dup = finding["answers"], answer_problems(finding["answers"]), finding_dup_target(findings, i)
    if not problems and dup is not None:
        reason = finding_dup_reason(findings, first, i)
        if reason:
            answers = dict(answers, dup="none")
            finding["dup_not_merged"] = reason
    severity = None if problems else compute_severity(answers)
    if severity is None and not problems:
        problems = ["no row of the table matches these answers"]
    if problems:
        finding["problems"] = problems
    finding["severity"] = severity or "unclassified"
    return finding["severity"]


def classify_findings(findings):
    """Set "severity" (and "problems", "dup_not_merged") on each finding of a
    rubric-format answer, each a dict with "id" and "answers".

    A dup merges a finding only into another finding of the same answer that
    is not merged itself. A dup that names the finding itself, names no
    finding of the answer, goes round in a circle (F01 -> F02 -> F01) or
    points to a merged finding merges nothing: that finding is classified by
    its other answers, and its answers are kept as given."""
    first = {}
    for i, finding in enumerate(findings):
        first.setdefault(finding["id"], i)
    for i in range(len(findings)):
        classify_finding(findings, first, i)


def computed_summary(finding, what):
    """The summary line of a classified finding: its severity first."""
    fields = [finding["severity"], finding["id"], finding["location"],
              answers_summary(finding["answers"], finding.get("dup_not_merged"))]
    if finding.get("problems"):
        fields.append("; ".join(finding["problems"]))
    return " | ".join(fields + [what])


def reviewer_finding(fid, parts, line):
    """(record, summary line) of an old-format line, `R01 | major | file:line | …`,
    whose severity the reviewer chose. The line is shown as written."""
    label = parts[0] if parts else ""
    severity = label.lower() if label.lower() in COUNTED else "unclassified"
    finding = {"id": fid, "location": parts[1] if len(parts) > 1 else "", "severity": severity}
    if severity == "unclassified":
        finding["problems"] = [f"severity {label or '(empty)'} is not major, medium or minor"]
    return finding, line


def parse_review(text):
    """The runner's reading of a reviewer's answer.

    An answer in the format of severity-rubric.md (a FINDINGS line, or finding
    lines that carry answers) has each severity computed from the answers:
    severity_source "computed". An old-format answer (`R01 | major | …` and a
    TOTAL line) keeps the reviewer's labels: severity_source "reviewer". Either
    way the counts come from the finding lines, never from a number the
    reviewer wrote: FINDINGS <n> or TOTAL only says the answer is complete
    (FINDINGS above 0 needs at least one finding line), and findings_mismatch
    says when it disagrees with the lines. A finding
    that cannot be classified is "unclassified" and counted as medium.
    """
    lines = text.splitlines()
    rows = []
    for line in lines:
        match = FINDING_LINE_RE.match(line)
        if match:
            parts = [part.strip() for part in match.group(2).split("|")]
            while parts and not parts[-1]:
                parts.pop()
            rows.append((match.group(1), parts, line))
    marks = [int(m.group(1)) for m in map(FINDINGS_RE.match, lines) if m]
    totals = [dict(zip(COUNTED, map(int, m.groups()))) for m in map(TOTAL_RE.match, lines) if m]
    computed = bool(marks) or any(ANSWER_RE.match(part) for _, parts, _ in rows for part in parts)
    findings, summary = [], []
    if computed:
        texts = []
        for fid, parts, _ in rows:
            location, answers, what = read_answers(parts)
            findings.append({"id": fid, "location": location, "answers": answers})
            texts.append(what)
        classify_findings(findings)
        summary = [computed_summary(finding, what) for finding, what in zip(findings, texts)]
    else:
        for fid, parts, line in rows:
            finding, summary_line = reviewer_finding(fid, parts, line)
            findings.append(finding)
            summary.append(summary_line)
    counts = dict.fromkeys(("major", "medium", "minor", "pre_existing", "merged", "unclassified"), 0)
    for finding in findings:
        counts[finding["severity"].replace("-", "_")] += 1
        if finding["severity"] == "unclassified":
            counts["medium"] += 1
    if marks:
        claimed = marks[-1]
        mismatch = claimed != len(findings)
    elif totals:
        claimed = totals[-1]
        mismatch = claimed != {key: counts[key] for key in COUNTED}
    else:
        claimed, mismatch = None, False
    # The last FINDINGS line decides, a TOTAL line only for the old format.
    # FINDINGS above 0 with no finding line the runner can read is not a clean
    # review: it is incomplete, like an answer without its closing line.
    complete = (marks[-1] == 0 or bool(rows)) if marks else bool(totals)
    review = {
        "severity_source": "computed" if computed else "reviewer",
        "complete": complete,
        "findings": findings, "counts": counts, "findings_mismatch": mismatch,
        "summary_lines": summary,
        "total_line": "TOTAL major={major} medium={medium} minor={minor}".format(**counts),
    }
    if mismatch:
        review["findings_claimed"] = claimed
    return review


def pending_files(task_id=None, project=None):
    if not PENDING.is_dir():
        return []
    return sorted(p for p in PENDING.glob("*/*.json")
                  if (task_id is None or p.stem == safe_remote_name(task_id))
                  and (project is None or p.parent.name == safe_remote_name(project)))


def first_reviewer_back(executor_family, review_route, avail):
    """Text for a pending review: who can review now, or who returns first."""
    reviewers = [p for p in review_route if MODELS[p][2] != executor_family]
    if any(usable(p, avail) for p in reviewers):
        return "a reviewer is usable now"
    back = sorted((avail[p]["cooling_until"], p) for p in reviewers
                  if avail[p]["found"] and avail[p]["cooling_until"])
    return f"first back: {back[0][1]} at {back[0][0]}" if back else "no reviewer CLI was found"


def canonical_route(raw):
    route = [ALIASES.get(p.strip(), p.strip()) for p in raw.split(",") if p.strip()]
    for p in route:
        if p in REMOVED_PROFILES:
            raise ValueError(REMOVED_PROFILE_MESSAGE.format(name=p))
    if not route or any(p not in MODELS for p in route):
        raise ValueError(f"invalid route: {raw}")
    return route


# The first sentence of every card (card-template.md, review-card-template.md),
# and of the cards the runner writes itself for the fix round.
EXECUTOR_SENTENCE = ("You are the executor of this card: do the work yourself, do not open the "
                     "`delegate` skill, do not delegate, and do not ask for confirmation.")
REVIEWER_SENTENCE = ("You are the reviewer of this card: do the review yourself, do not open the "
                     "`delegate` skill, do not delegate, and do not ask for confirmation.")
# A review attempt that ended this way never gave a usable answer: the next
# reviewer of the route takes the review.
REVIEW_RETRY = ("provider_limit", "slot_timeout", "empty_output", "permission_denied",
                "incomplete_review", OVER_MODEL_CAP)
# A follow-up review answers each major of the first review on one line:
# `MAJOR F01 fixed | what shows it` or `MAJOR F01 open | what is still wrong`.
MAJOR_VERDICT_RE = re.compile(
    r"^[\s`*_>-]*MAJOR[\s`*_]+([FR]\d+)[\s`*_]*[|:=]?[\s`*_]*(fixed|open)\b[\s`*_]*\|?\s*(.*)$")
# Why a major of the first review is still open when the follow-up review gave
# no answer for it, by how the fix round ended.
NOT_CLOSED = {
    "no_fixer": ("not fixed", "no executor of the route could take the fix"),
    "no_changes": ("not fixed", "the fix run changed nothing"),
    "fix_failed": ("not fixed", "the fix run failed"),
    "gate_failed": ("not fixed", "the gate failed after the fix"),
    "not_reviewed": ("not verified", "no follow-up review read the fix"),
    "reviewed": ("not answered", "the follow-up review did not answer it"),
}


def run_gate(command, cwd, timeout, log, result):
    """Run the host gate in cwd with bash and no startup files, its output in
    `log`. `result` (ran, exit, timed_out, duration_s, log) is filled in as it
    goes, so a stop signal still leaves what happened."""
    t0 = time.monotonic()
    result.update(ran=False, exit=None, timed_out=False, duration_s=0, log=str(log))
    with open(log, "w") as gf:
        result["ran"] = True
        process = subprocess.Popen(["bash", "--noprofile", "--norc", "-p", "-c", command], cwd=cwd,
                                   stdout=gf, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            wait_for_exit(process, timeout)
        except subprocess.TimeoutExpired:
            result["timed_out"] = True
        finally:
            try:
                stop_process(process)
                result["exit"] = process.returncode
            finally:
                result["duration_s"] = round(time.monotonic() - t0)
    return result


def observed_gate(gate):
    """The gate result the runner saw: pass, fail or not_run."""
    if not gate or not gate.get("ran"):
        return "not_run"
    return "pass" if gate.get("exit") == 0 and not gate.get("timed_out") else "fail"


def runner_commit(cwd, message, log):
    """Commit everything an executor left uncommitted; raise unless the result
    is a new commit and a clean tree."""
    before = git(cwd, "rev-parse", "HEAD")
    with open(log, "w") as cf:
        for args in (("add", "-A"), ("commit", "-m", message)):
            result = subprocess.run(["git", "-C", cwd, *args], stdout=cf, stderr=subprocess.STDOUT)
            if result.returncode != 0:
                raise RuntimeError(f"commit {args[0]} failed (exit {result.returncode})")
    if git(cwd, "rev-parse", "HEAD") == before or tree_snapshot(cwd)[1]:
        raise RuntimeError("commit failed to produce a clean committed tree")


def fix_card_text(task_id, task, majors):
    """The card of the one fix round: the majors of the review and nothing else."""
    lines = [EXECUTOR_SENTENCE, "", f"# Fix {task_id}: {task}", "",
             "The review of your work found the major findings below. Fix each of them and nothing else: "
             "the review's mediums and minors are recorded for later, not for this card. The task card is "
             "attached for context and its rules still hold: work only inside this worktree, commit as you "
             "go, never push, never change remotes, never touch another worktree, and do not run "
             "`git stash`, `reset --hard`, `checkout --` or `clean`.",
             "", "## Major findings", ""]
    lines += [f"- {line}" for line in majors]
    lines += ["", "## How to work", "",
              "For a change of behaviour, write the failing test first, then the code. Run the tests of the "
              "area you touch while you work and the project's full suite once at the end.",
              "",
              "This is the only fix round. The runner runs the host gate again and one follow-up review of "
              "your fix commits; whatever is still open after that is recorded for the operator, and no "
              "other round follows.",
              "", "## Delivery", "",
              "Small commits in the repository's commit style, no co-author line. End with a report: commits "
              "(short hash and subject), what you checked and its output, and any finding you did not fix "
              "and why."]
    return "\n".join(lines) + "\n"


def followup_card_text(task_id, task, majors, next_id):
    """The card of the follow-up review: the majors of the first review, judged
    on the fix commits alone."""
    lines = [REVIEWER_SENTENCE, "", f"# Follow-up review {task_id}: {task}", "",
             "You are a reviewer in a clean context. **Do not change any file.** Stay inside the working "
             "directory you were given: do not list or read other worktrees or parent folders.",
             "",
             "The first review of this task found the major findings below. The author made one fix round, "
             "and the diff below holds only its commits. This is the last review of the task: no other fix "
             "round follows, so judge these findings and this diff only.",
             "", "## Major findings of the first review", ""]
    lines += [f"- {line}" for line in majors]
    lines += ["", "## Your answer", "",
              "1. For each finding above, one line: `MAJOR <id> fixed | <what shows it is fixed>` or "
              "`MAJOR <id> open | <what is still wrong>`. A finding the diff does not address is open.",
              f"2. Then each new problem that the fix diff itself introduces, answered with the severity "
              f"rubric at the end of this prompt and numbered from {next_id}, and the rubric's `FINDINGS <n>` "
              "line, which counts only these new findings (`FINDINGS 0` when the fix adds none). Do not "
              "repeat the findings above, and do not report what lies outside the fix diff.",
              "",
              "Prove what you can by running a command, and say which; for a change of behaviour, run the "
              "tests the fix touches before you answer."]
    return "\n".join(lines) + "\n"


def major_verdicts(text, ids):
    """Each first-review major the follow-up review answered: id -> (fixed or
    open, the reviewer's reason). An id answered both ways is open."""
    found = {}
    for line in text.splitlines():
        match = MAJOR_VERDICT_RE.match(line)
        if match and match.group(1) in ids and found.get(match.group(1), ("fixed",))[0] == "fixed":
            found[match.group(1)] = (match.group(2), match.group(3).strip())
    return found


@dataclasses.dataclass
class StepRequest:
    """One run a pipeline step asks for: the arguments `run_step` receives."""
    profile: str
    role: str
    card: str
    diff_range: object = None
    attachments: object = None
    author_family: object = None


def fix_round(fix, run_step, *, task_id, task, cwd, out, attempt_root, card, route, executor_profile,
              gate, gate_timeout, review_route, first, first_reviewer):
    """The one fix round of a pipeline, opened by a computed major and never
    repeated: the majors alone go to the executor that wrote the code (then the
    rest of the approved route, on a capacity failure only), the runner commits
    what it left, the host gate runs again, and one follow-up review reads only
    the fix commits. Nothing follows it, whatever that review says. `fix` is
    filled in as the round goes, so a stop signal still leaves what was done.
    `run_step(StepRequest(profile, role, card, diff_range, attachments, author_family))`
    launches one run of the pipeline."""
    majors = [{"id": f["id"], "location": f["location"], "line": line}
              for f, line in zip(first["findings"], first["summary_lines"]) if f["severity"] == "major"]
    fix.update(state="started", stage="executor", majors=majors, base=git(cwd, "rev-parse", "HEAD"))
    fix_card = attempt_root / "fix-card.md"
    fix_card.write_text(fix_card_text(task_id, task, [m["line"] for m in majors]), encoding="utf-8")
    fix["card"] = str(fix_card)
    tried = []
    for profile in dict.fromkeys([executor_profile, *route]):
        check_paused()
        rec = run_step(StepRequest(profile, "fix", str(fix_card), attachments=[card] if card else []))
        tried.append(rec)
        if rec["failure"] in ("provider_limit", "slot_timeout", "input_too_large"):
            continue
        fix.update(profile=profile, failure=rec["failure"])
        break
    else:
        fix.update(state="no_fixer", error="fix route exhausted: " + ", ".join(
            f"{r['profile']} ({r['failure']})" for r in tried))
        return fix

    fix["stage"] = "commit"
    check_paused()
    snapshot = tree_snapshot(cwd)
    if snapshot[1] and rec["failure"] == "none":
        runner_commit(cwd, f"{task_id}: fix the majors of the review (committed by the delegate runner)",
                      attempt_root / "fix-commit.log")
        fix["auto_committed"] = True
        snapshot = tree_snapshot(cwd)
    if snapshot[1]:
        fix.update(state="fix_failed",
                   error=f"the fix run ended {rec['failure']} and left uncommitted changes")
        return fix
    if snapshot[0] == fix["base"]:
        fix["state"] = "no_changes"
        if rec["failure"] != "none":
            fix["error"] = f"the fix run ended {rec['failure']}"
        return fix
    fix["head"] = snapshot[0]
    if rec["failure"] != "none":
        fix["note"] = (f"the fix run ended {rec['failure']} after committing; "
                       "the gate and the follow-up review judge its commits")

    fix["stage"] = "gate"
    check_paused()
    fix["gate"] = {}
    run_gate(gate, cwd, gate_timeout, out / f"{task_id}.fix-gate.log", fix["gate"])
    if fix["gate"]["exit"] != 0 or fix["gate"]["timed_out"]:
        fix.update(state="gate_failed", error="gate timed out after the fix" if fix["gate"]["timed_out"]
                   else f"gate exit {fix['gate']['exit']} after the fix")
        return fix

    fix["stage"] = "review"
    check_paused()
    gated = tree_snapshot(cwd)
    numbers = [int(f["id"][1:]) for f in first["findings"]]
    followup = attempt_root / "follow-up-review-card.md"
    followup.write_text(followup_card_text(task_id, task, [m["line"] for m in majors],
                                           f"F{max(numbers, default=0) + 1:02d}"), encoding="utf-8")
    fix["review_card"] = str(followup)
    fix_family = MODELS[fix["profile"]][2]
    # The reviewer is never of the family of either author.
    authors = {MODELS[executor_profile][2], fix_family}
    reviewers = [p for p in claude_last(list(dict.fromkeys([first_reviewer, *review_route])))
                 if MODELS[p][2] not in authors]
    tried = []
    for profile in reviewers:
        check_paused()
        rec = run_step(StepRequest(profile, "review", str(followup), diff_range=f"{fix['base']}...{gated[0]}",
                                   attachments=[], author_family=fix_family))
        tried.append(rec)
        if tree_snapshot(cwd) != gated:
            fix.update(state="not_reviewed", error="review_wrote: tree changed after the fix gate")
            return fix
        if rec["failure"] in REVIEW_RETRY:
            continue
        if rec["failure"] == "none":
            review_file = rec.get("last_message") or rec["stdout"]
            text = Path(review_file).read_text(errors="replace")
            fix.update(state="reviewed", reviewer=profile, review_file=review_file,
                       review=parse_review(text), verdicts=major_verdicts(text, [m["id"] for m in majors]))
        else:
            fix.update(state="not_reviewed", error=rec["failure"])
        return fix
    fix.update(state="not_reviewed", error="follow-up review route exhausted: " + ", ".join(
        f"{r['profile']} ({r['failure']})" for r in tried) if tried
        else "no reviewer outside the families of the authors")
    return fix


def conclude(outcome, first, fix):
    """What a pipeline leaves for the operator: its outcome after the fix round,
    the final state (clean, delivered_with_findings, gate_failed,
    review_pending, not_reviewed or not_delivered), the counts every later step
    reads, the majors still open and the mediums and minors left."""
    counts = dict.fromkeys(COUNTED, 0)
    open_majors, reviews = [], []
    if first is not None:
        counts = {key: first["counts"][key] for key in COUNTED}
        reviews.append(first)
    if fix:
        state = fix.get("state")
        verdicts = fix.get("verdicts") or {}
        for m in fix.get("majors", []):
            word, reason = verdicts.get(m["id"], (None, ""))
            if word == "fixed":
                continue
            if word == "open":
                status, said = "open", "open" + (f": {reason}" if reason else "")
            else:
                status, said = NOT_CLOSED.get(state, ("not verified", "the fix round stopped"))
                said = f"{status}: {said}" + (f" ({fix['error']})" if fix.get("error") else "")
            open_majors.append({"id": m["id"], "location": m["location"], "status": status,
                                "said": said, "line": m["line"]})
        followup = fix.get("review")
        if followup:
            reviews.append(followup)
            for f, line in zip(followup["findings"], followup["summary_lines"]):
                if f["severity"] == "major":
                    open_majors.append({"id": f["id"], "location": f["location"], "status": "new",
                                        "said": "new in the fix diff", "line": line})
            counts["medium"] += followup["counts"]["medium"]
            counts["minor"] += followup["counts"]["minor"]
        counts["major"] = len(open_majors)
        if outcome == "reviewed":
            outcome = {"gate_failed": "gate_failed", "fix_failed": "fix_failed", "paused": "paused",
                       "stopped": "fix_failed"}.get(state) or ("open_majors" if open_majors else "fixed")
    left = [f"{f['severity']} {f['id']} {f['location']}".strip() for review in reviews
            for f in review["findings"] if f["severity"] in ("medium", "minor", "unclassified")]
    if outcome in ("reviewed", "fixed", "open_majors"):
        final = "delivered_with_findings" if open_majors or counts["medium"] or counts["minor"] else "clean"
    else:
        final = {"gate_failed": "gate_failed", "review_pending": "review_pending",
                 "no_reviewer": "not_reviewed"}.get(outcome, "not_delivered")
    deviation = None
    if open_majors:
        deviation = "open majors after the fix round, for the operator: " + "; ".join(
            f"{m['id']} {m['location']} ({m['said']})" for m in open_majors)
        deviation = deviation if len(deviation) <= 600 else deviation[:599] + "…"
    return {"outcome": outcome, "final": final, "counts": counts, "open_majors": open_majors,
            "left": left, "rounds": len(reviews), "deviation": deviation}


def final_lines(c, fix):
    """The first lines of a summary: the final state, the majors still open,
    and the mediums and minors left for the batch's cleanup card."""
    final, counts = c["final"], c["counts"]
    if final == "delivered_with_findings":
        n = len(c["open_majors"])
        text = (f"delivered with findings recorded: {n} open major{'' if n == 1 else 's'}"
                + (" (for you to decide)" if n else "") + f", {counts['medium']} medium, {counts['minor']} minor")
        if fix:
            text += "; the one fix round ran and no other follows"
    elif final == "clean":
        text = ("clean: the fix round closed every major and nothing else was found" if fix
                else "clean: the review found nothing")
    elif final == "gate_failed":
        text = "gate failed after the fix round" if fix and fix.get("state") == "gate_failed" else "gate failed"
    elif final == "review_pending":
        text = "review pending: no reviewer had quota or a free slot"
    elif final == "not_reviewed":
        text = "not reviewed: no reviewer could read the work"
    else:
        text = f"not delivered ({c['outcome']})"
    lines = [f"- final: {text}"]
    for m in c["open_majors"][:10]:
        said = m["line"]
        repeated = f"major | {m['id']} | {m['location']} | "
        if said.startswith(repeated):
            said = said[len(repeated):]
        lines.append(f"- open major {m['id']} | {m['location']} | {m['said']} | {said}")
    if len(c["open_majors"]) > 10:
        lines.append(f"- {len(c['open_majors']) - 10} more open majors: see open_majors in the pipeline record")
    if c["left"]:
        left = "; ".join(c["left"])
        lines.append("- mediums and minors recorded (one cleanup card at the end of the batch): "
                     + (left if len(left) <= 300 else left[:299] + "…"))
    return lines


def fix_step_lines(fix, gate):
    """The summary lines of the fix round's steps."""
    if not fix:
        return []
    line = f"- fix round: {fix.get('profile') or 'no executor'} | {fix.get('state')}"
    for key in ("error", "note"):
        if fix.get(key):
            line += f" | {fix[key]}"
    if fix.get("card"):
        line += f" | card: {fix['card']}"
    lines = [line]
    result = fix.get("gate")
    if result and result.get("ran"):
        said = f"timed out (exit {result['exit']})" if result["timed_out"] else f"exit {result['exit']}"
        lines.append(f"- gate after the fix: `{gate}` | {said} | {result['duration_s']}s | log: {result['log']}")
    return lines


def reviews_summary(first, first_file, fix, c, lines):
    """Append the reviews to the summary: the first review's finding lines and,
    after a fix round, the follow-up review's answers and new findings. The last
    line is always the TOTAL the runner computed for what is left."""
    total = "TOTAL major={major} medium={medium} minor={minor}".format(**c["counts"])
    followup = fix.get("review") if fix else None
    if not followup:
        if first:
            review_summary(first, first_file, lines, closing=total)
        return
    majors = fix.get("majors", [])
    review_summary(first, first_file, lines, closing="- first review: " + first["total_line"],
                   reserve=5 + len(majors) + min(len(followup["findings"]), 10))
    lines.append("Follow-up review of the fix commits:")
    verdicts = fix.get("verdicts") or {}
    for m in majors:
        word, reason = verdicts.get(m["id"], ("not answered", ""))
        lines.append(f"- {m['id']}: {word}" + (f" | {reason}" if reason else ""))
    review_summary(followup, fix["review_file"], lines, closing=total)


def fix_record(fix):
    """The fix round as the pipeline record carries it."""
    gate = fix.get("gate") or {}
    review = fix.get("review")
    rec = {"profile": fix.get("profile"), "state": fix.get("state"), "failure": fix.get("failure"),
           "base": fix.get("base"), "head": fix.get("head"), "auto_committed": fix.get("auto_committed", False),
           "card": fix.get("card"), "gate_exit": gate.get("exit"), "gate_timed_out": gate.get("timed_out", False),
           "gate_duration_s": gate.get("duration_s", 0), "reviewer_profile": fix.get("reviewer"),
           "verdicts": {key: word for key, (word, _) in (fix.get("verdicts") or {}).items()},
           "new_findings": {key: review["counts"][key] for key in COUNTED} if review else None,
           "error": fix.get("error")}
    return {key: value for key, value in rec.items() if value is not None}


@dataclasses.dataclass
class VerdictInput:
    """The facts a pipeline verdict records, grouped to keep the call short."""
    task_id: str
    c: dict
    gate_host: str
    reviewer: object
    fix: object
    host: object


def pipeline_verdict(v):
    """The verdict record a pipeline writes when it ends: what `record` writes,
    with the gate as the runner observed it and the counts it computed."""
    task_id, c, gate_host, reviewer, fix, host = v.task_id, v.c, v.gate_host, v.reviewer, v.fix, v.host
    final = c["final"]
    delivered = ("yes" if final == "clean" or (final == "delivered_with_findings" and not c["open_majors"])
                 else "partial" if final in ("delivered_with_findings", "not_reviewed") else "no")
    rec = {"kind": "verdict", "id": task_id, "at": now().isoformat(timespec="seconds"),
           "written_by": "pipeline", "gate_host": gate_host, "delivered": delivered,
           "review_by": reviewer, "review_rounds": c["rounds"],
           "findings_major": c["counts"]["major"], "findings_medium": c["counts"]["medium"],
           "findings_minor": c["counts"]["minor"], "orchestrator_rework": "none",
           "deviation": c["deviation"], "note": f"{final} ({c['outcome']})", "final": final}
    if fix and fix.get("reviewer") and fix["reviewer"] != reviewer:
        rec["followup_review_by"] = fix["reviewer"]
    rec = {key: value for key, value in rec.items() if value is not None}
    rec["machine"] = host or local_machine()
    rec.update(ATTRIBUTION)
    return rec


@dataclasses.dataclass
class PipelineState:
    """The state of one `pipeline` invocation, as its steps fill it in."""
    a: object
    task_id: str
    task: str
    role: str
    cwd: str
    project: str
    out: Path
    attempt_root: Path
    base_commit: str
    route: list
    review_route: list
    given: list
    reordered: list
    t0: float
    gate_log: Path
    commit_log: Path
    attempts: list = dataclasses.field(default_factory=list)
    outcome: object = None
    error: str = ""
    step: str = "executor"
    executor_profile: object = None
    reviewer_profile: object = None
    executor_rec: object = None
    review_rec: object = None
    auto_committed: bool = False
    pending_file: object = None
    executor_error_after_commit: bool = False
    gate_exit: object = None
    gate_duration_s: int = 0
    gate_timed_out: bool = False
    gate_ran: bool = False
    commit_result: str = "not_run"
    commit_duration_s: int = 0
    review: object = None
    review_file: object = None
    fix: object = None


def pipeline_route_pair(a):
    """The route and the review route as the operator wrote them."""
    try:
        route, review_route = canonical_route(a.route), canonical_route(a.review_route)
        review_route = [REVIEW_PROFILES.get(p, p) for p in review_route]
    except ValueError as exc:
        message = str(exc)
        sys.exit(message if message.startswith("delegate:") else f"delegate: {message}")
    return route, review_route


def check_pipeline_routes(a, role, route, review_route):
    """Refuse a profile in either route before outputs, slots or runs."""
    for profile in route:
        check_model_allowed(role, *MODELS[profile][:2], profile)
        check_claude_review(MODELS[profile][0], role, a.allow_claude_review, None)
        check_agy_claude(*MODELS[profile][:2], role, None)
    for profile in review_route:
        check_model_allowed("review", *MODELS[profile][:2], profile)
        # The author is one of the executors in the route; none of them is Claude.
        check_claude_review(MODELS[profile][0], "review", a.allow_claude_review,
                            MODELS[route[0]][2], a.host)
        check_agy_claude(*MODELS[profile][:2], "review", MODELS[route[0]][2])
    if CLAUDE_REVIEW in review_route:
        check_claude_login()


def order_pipeline_routes(route, review_route):
    """The two routes with the profiles that can run now first."""
    # Profiles under a provider limit, or whose CLI is missing, are tried last.
    # Nothing is dropped, so a wrong guess costs one refused run, as before.
    avail = availability()
    given = route + review_route
    route, review_route = order_route(route, avail), claude_last(order_route(review_route, avail))
    reordered = ([p for p in given if not usable(p, avail) and p != CLAUDE_REVIEW]
                 if [p for p in route + review_route if p != CLAUDE_REVIEW]
                 != [p for p in given if p != CLAUDE_REVIEW] else [])
    return route, review_route, given, reordered


def build_pipeline_state(a):
    """Validate the pipeline and create the outputs each attempt will own."""
    if not a.confirmed:
        sys.exit("delegate: --confirmed required")
    t0 = time.monotonic()
    task_id, task, role = a.id, a.task, a.role
    cwd = str(Path(a.cwd).resolve())
    set_attribution(cwd, a.milestone)
    top = git(cwd, "rev-parse", "--show-toplevel") or cwd
    project = a.project or Path(top).name
    out = Path(a.out or HOME / "delegate" / "out" / project).resolve()
    out.mkdir(parents=True, exist_ok=True)
    route, review_route = pipeline_route_pair(a)
    check_pipeline_routes(a, role, route, review_route)
    # The review needs the rubric: refuse now rather than after the executor ran.
    read_severity_rubric()
    route, review_route, given, reordered = order_pipeline_routes(route, review_route)
    for filename in a.review_attach:
        read_attachment(filename)
    # Each invocation and attempt owns its outputs, even when the same ID is reused.
    attempt_root = Path(tempfile.mkdtemp(prefix=f"{task_id}-", dir=out))
    base_commit = git(cwd, "rev-parse", "HEAD")
    return PipelineState(a=a, task_id=task_id, task=task, role=role, cwd=cwd, project=project,
                         out=out, attempt_root=attempt_root, base_commit=base_commit,
                         route=route, review_route=review_route, given=given, reordered=reordered,
                         t0=t0, gate_log=out / f"{task_id}.gate.log",
                         commit_log=attempt_root / "commit.log")


def pipeline_attempt(st, request):
    """Run one attempt of the pipeline and return its record."""
    profile, run_role, card = request.profile, request.role, request.card
    author_family = request.author_family
    attempt_number = len(st.attempts) + 1
    if author_family is None and st.executor_profile:
        author_family = MODELS[st.executor_profile][2]
    step_out = st.attempt_root / f"{attempt_number}-{run_role}-{profile}"
    default_stdout, default_stderr, _, _ = run_output_paths(
        step_out, st.task_id, attempt_number, reserve=False)
    # Include pending attempts as well: a pause/slot exhaustion/exception has paths.
    rec = {"profile": profile, "role": run_role, "failure": "interrupted", "duration_s": 0,
           "stdout": str(default_stdout),
           "stderr": str(default_stderr)}
    st.attempts.append(rec)
    started = time.monotonic()
    try:
        rec.update(execute_run(
            task_id=st.task_id, task=st.task, role=run_role, profile=profile,
            cwd=st.cwd, card=card, out=str(step_out), project=st.project,
            timeout=(st.a.review_timeout if st.a.review_timeout is not None else st.a.timeout)
            if run_role == "review" else st.a.timeout,
            wait_s=st.a.wait, confirmed=True, attempt=len(st.attempts),
            diff_range=request.diff_range, attachments=request.attachments,
            access_mode=st.a.access, host=st.a.host, idle_timeout=st.a.idle_timeout,
            allow_claude_review=st.a.allow_claude_review, author_family=author_family,
            diff_exclude=st.a.diff_exclude if run_role == "review" else None,
        ))
    except SlotTimeoutError as exc:
        rec.update(exc.record)
    except BaseException as exc:
        rec["failure"] = exception_reason(exc)
        for key in ("stdout", "stderr", "last_message"):
            if key in rec and not Path(rec[key]).is_file():
                rec[key] = None
        rec["duration_s"] = round(time.monotonic() - started)
        raise
    return rec


def executor_exhausted_error(attempts, route):
    """Why no executor ran, from the attempts of the executor route."""
    if all(rec["failure"] == "provider_limit" for rec in attempts):
        return "every executor route hit provider_limit: " + ", ".join(route)
    return "executor routes exhausted: " + ", ".join(
        f"{rec['profile']} ({rec['failure']})" for rec in attempts)


def run_pipeline_executor(st):
    """Try the executor route until one runs; record why none did."""
    check_paused()
    for profile in st.route:
        check_paused()
        st.executor_rec = pipeline_attempt(st, StepRequest(profile, st.role, st.a.card))
        if st.executor_rec["failure"] in ("provider_limit", "slot_timeout", "input_too_large"):
            continue
        st.executor_profile = profile
        if st.executor_rec["failure"] == "error":
            # An executor CLI can exit non-zero after the work is committed
            # (a cancelled input request at the very end, for one). With new
            # commits and a clean tree the gate and the reviewer judge it.
            snapshot = tree_snapshot(st.cwd)
            if snapshot[0] != st.base_commit and not snapshot[1]:
                st.executor_error_after_commit = True
            else:
                st.outcome = "executor_failed"
        elif st.executor_rec["failure"] != "none":
            st.outcome = "executor_failed"
        break
    else:
        st.outcome = "no_executor"
        st.error = executor_exhausted_error(st.attempts, st.route)


def run_pipeline_commit(st):
    """Commit what the executor left, and refuse a run that changed nothing."""
    st.step = "commit"
    check_paused()
    commit_t0 = time.monotonic()
    st.commit_result = "executor_committed"
    if st.executor_rec.get("dirty_after"):
        st.commit_result = "failed"
        runner_commit(st.cwd, f"{st.task_id}: {st.task} (committed by the delegate runner)", st.commit_log)
        st.auto_committed = True
        st.commit_result = "auto_committed"
    current = tree_snapshot(st.cwd)
    if current[0] == st.base_commit and not current[1]:
        st.commit_result = "no_changes"
        st.outcome = "no_changes"
    st.commit_duration_s = round(time.monotonic() - commit_t0)


def run_pipeline_gate(st):
    """Run the host gate and record what it saw."""
    st.step = "gate"
    check_paused()
    gate_state = {}
    try:
        run_gate(st.a.gate, st.cwd, st.a.timeout, st.gate_log, gate_state)
    finally:
        st.gate_ran, st.gate_exit = gate_state.get("ran", False), gate_state.get("exit")
        st.gate_timed_out = gate_state.get("timed_out", False)
        st.gate_duration_s = gate_state.get("duration_s", 0)
    if st.gate_timed_out:
        st.error = "gate timed out"
    if st.gate_exit != 0:
        st.outcome = "gate_failed"


def pipeline_pending_file(st, review_card_copy, gated_head, executor_family):
    """Write the file `review-pending` reads to finish this review later."""
    pending_file = PENDING / safe_remote_name(st.project) / f"{safe_remote_name(st.task_id)}.json"
    pending_file.parent.mkdir(parents=True, exist_ok=True)
    pending_file.write_text(json.dumps({
        "id": st.task_id, "task": st.task, "project": st.project, "cwd": st.cwd,
        "milestone": st.a.milestone,
        "base": st.base_commit, "head": gated_head,
        "executor_profile": st.executor_profile, "executor_family": executor_family,
        "review_route": st.given[len(st.given) - len(st.review_route):],
        "review_card": str(review_card_copy),
        "attachments": [st.a.card, *st.a.review_attach],
        "out": str(st.out), "access": st.a.access, "host": st.a.host,
        "timeout": st.a.review_timeout if st.a.review_timeout is not None else st.a.timeout,
        "idle_timeout": st.a.idle_timeout, "attempts": len(st.attempts),
        "gate": st.a.gate, "gate_exit": st.gate_exit, "auto_committed": st.auto_committed,
        # What the one fix round needs when the finished review has a major.
        "card": st.a.card, "route": st.route, "executor_timeout": st.a.timeout,
        "diff_exclude": st.a.diff_exclude,
        "created": now().isoformat(timespec="seconds"),
    }, ensure_ascii=False, indent=1))
    return pending_file


def review_exhausted_error(tried, skipped):
    """Why no reviewer read the work, from the attempts of the review route."""
    if not tried:
        error = "no reviewer outside the executor family"
    elif all(rec["failure"] == "provider_limit" for rec in tried):
        error = "every reviewer route hit provider_limit: " + ", ".join(rec["profile"] for rec in tried)
    else:
        error = "reviewer routes exhausted: " + ", ".join(
            f"{rec['profile']} ({rec['failure']})" for rec in tried)
    if skipped:
        error += "; skipped executor family: " + ", ".join(skipped)
    return error


def run_pipeline_review(st):
    """Try the review route until one reviewer reads the work; leave it pending."""
    st.step = "review"
    check_paused()
    gated_snapshot = tree_snapshot(st.cwd)
    review_card_copy = st.attempt_root / "review-card.md"
    review_card_copy.write_text(Path(st.a.review_card).read_text().replace(
        "{{DIFF_RANGE}}", f"{st.base_commit}...HEAD"))
    executor_family = MODELS[st.executor_profile][2]
    skipped_reviewers = []
    for profile in st.review_route:
        check_paused()
        if MODELS[profile][2] == executor_family:
            skipped_reviewers.append(profile)
            continue
        st.review_rec = pipeline_attempt(st, StepRequest(
            profile, "review", str(review_card_copy),
            diff_range=f"{st.base_commit}...{gated_snapshot[0]}",
            attachments=[st.a.card, *st.a.review_attach]))
        # Quota classification retains its precedence, but writes are never safe to retry.
        if tree_snapshot(st.cwd) != gated_snapshot:
            st.error = "review_wrote: tree changed after gate"
            st.outcome = "no_reviewer"
            break
        if st.review_rec["failure"] in REVIEW_RETRY:
            continue
        if st.review_rec["failure"] == "none":
            st.reviewer_profile = profile
            st.outcome = "reviewed"
        else:
            st.error = st.review_rec["failure"] + (
                f": {st.review_rec['hint']}" if st.review_rec.get("hint") else "")
            st.outcome = "no_reviewer"
        break
    if st.outcome is not None:
        return
    st.outcome = "no_reviewer"
    tried = [rec for rec in st.attempts if rec["role"] == "review"]
    # A reviewer refused for size will refuse again: it does not decide this.
    waiting = [rec for rec in tried if rec["failure"] != OVER_MODEL_CAP]
    if waiting and all(rec["failure"] in NO_CAPACITY for rec in waiting):
        st.outcome = "review_pending"
        st.pending_file = pipeline_pending_file(st, review_card_copy, gated_snapshot[0], executor_family)
    st.error = review_exhausted_error(tried, skipped_reviewers)


def pipeline_fix_round(st):
    """Read the finished review and run the one fix round when it has a major."""
    if st.outcome != "reviewed":
        return
    st.review_file = st.review_rec.get("last_message") or st.review_rec["stdout"]
    st.review = review_findings(st.review_file)
    # Every decision after the review reads the counts computed from the
    # lines: only a computed major opens the one fix round.
    if not st.review["counts"]["major"]:
        return
    st.fix = {}
    try:
        fix_round(st.fix, lambda request: pipeline_attempt(st, request),
                  task_id=st.task_id, task=st.task, cwd=st.cwd, out=st.out,
                  attempt_root=st.attempt_root, card=st.a.card, route=st.route,
                  executor_profile=st.executor_profile, gate=st.a.gate,
                  gate_timeout=st.a.timeout, review_route=st.review_route,
                  first=st.review, first_reviewer=st.reviewer_profile)
    except (Exception, SystemExit, KeyboardInterrupt) as exc:
        st.fix.update(state="paused" if isinstance(exc, PausedError) else "stopped",
                      error=exception_reason(exc))


def pipeline_attempt_lines(attempts):
    """One summary line per attempt, with the output files it left."""
    lines = []
    for rec in attempts:
        paths = " | ".join(f"{key}: {rec[key]}" for key in ("stdout", "stderr", "last_message")
                           if rec.get(key) and Path(rec[key]).is_file())
        lines.append(f"- {rec['role']}: {rec['profile']} | {rec['duration_s']}s | {rec['failure']} | {paths}")
    return lines


def pipeline_gate_line(st):
    """The summary line of the host gate."""
    gate_result = (f"timed out (exit {st.gate_exit})" if st.gate_timed_out
                   else f"exit {st.gate_exit}" if st.gate_ran else "not run")
    return (f"- gate: `{st.a.gate}` | {gate_result} | {st.gate_duration_s}s" +
            (f" | log: {st.gate_log}" if st.gate_ran and st.gate_log.is_file() else ""))


def trim_pipeline_lines(st, lines, head_count, fix_lines):
    """Cap a long summary; the complete manifest is in its steps file."""
    # Very long routes still have a complete machine-readable attempt manifest.
    if len(lines) <= 39:
        return lines
    # Preserve both winners, even with a long executor or reviewer quota route.
    decisive = [i for i, rec in enumerate(st.attempts)
                if rec is st.executor_rec or rec is st.review_rec]
    prefix = (head_count + bool(st.error) + bool(st.pending_file) + bool(st.reordered)
              + (st.reviewer_profile == CLAUDE_REVIEW) + bool(st.executor_error_after_commit))
    tail = 2 + len(fix_lines)
    keep = set(range(prefix)) | {prefix + i for i in decisive} | set(range(len(lines) - tail, len(lines)))
    for i in reversed(range(prefix, len(lines) - tail)):
        if len(keep) >= 38:
            break
        keep.add(i)
    lines = [line for i, line in enumerate(lines) if i in keep]
    lines.append("- additional steps omitted; full step outputs: "
                 f"{st.attempt_root / 'steps.json'}")
    return lines


def pipeline_summary(st, c, head):
    """Print and write the pipeline summary; return its path."""
    details = st.attempt_root / "steps.json"
    details.write_text(json.dumps(st.attempts, ensure_ascii=False, indent=2))
    outcome = c["outcome"]
    lines = [f"# Pipeline {st.task_id}: {st.task} — {outcome}", *final_lines(c, st.fix),
             f"- committed: {st.base_commit}..{head}; dirty: {bool(tree_snapshot(st.cwd)[1])}",
             f"- commit: {st.commit_result} | {st.commit_duration_s}s" +
             (f" | log: {st.commit_log}" if st.commit_log.is_file() else "")]
    head_count = len(lines)
    if st.error:
        lines.append(f"- stopped at {st.step}: {st.error}")
    if st.pending_file:
        lines.append("- review pending: every reviewer was out of quota or had no free slot; the work "
                     f"passed the gate. Finish with `review-pending --id {st.task_id} --confirmed` "
                     f"({first_reviewer_back(MODELS[st.executor_profile][2], st.review_route, availability())}).")
    if st.reordered:
        lines.append("- tried last (provider limit or missing CLI): " + ", ".join(st.reordered))
    if st.reviewer_profile == CLAUDE_REVIEW:
        lines.append(f"- reviewed by the fallback reviewer {CLAUDE_REVIEW} "
                     f"({MODELS[CLAUDE_REVIEW][1]}), allowed by the operator")
    if st.executor_error_after_commit:
        lines.append("- executor exited with an error after committing; the tree was clean, "
                     "so the gate and the review ran. Read its stderr before trusting the result.")
    lines += pipeline_attempt_lines(st.attempts)
    lines.append(pipeline_gate_line(st))
    fix_lines = fix_step_lines(st.fix, st.a.gate)
    lines += fix_lines
    lines.append(f"- full step outputs: {details}")
    lines = [" ".join(str(line).splitlines()) for line in lines]
    lines = trim_pipeline_lines(st, lines, head_count, fix_lines)
    if st.gate_ran and (st.gate_exit != 0 or st.gate_timed_out) and st.gate_log.is_file():
        lines += ["Gate log tail:"] + st.gate_log.read_text(errors="replace").splitlines()[-15:]
    fix_gate = (st.fix or {}).get("gate") or {}
    if observed_gate(fix_gate) == "fail" and Path(fix_gate["log"]).is_file():
        lines += ["Gate log tail (after the fix):"] + Path(fix_gate["log"]).read_text(
            errors="replace").splitlines()[-15:]
    reviews_summary(st.review, st.review_file, st.fix, c, lines)
    summary_text = "\n".join(lines) + "\n"
    summary_file = st.out / f"{st.task_id}.summary.md"
    summary_file.write_text(summary_text)
    print(summary_text, end="")
    return summary_file


def pipeline_record(st, c, head, summary_file):
    """The pipeline record of a finished run."""
    outcome, findings = c["outcome"], c["counts"]
    if st.fix:
        failed_step = None if st.fix.get("state") == "reviewed" else "fix_" + st.fix.get("stage", "executor")
    else:
        failed_step = st.step if outcome not in ("reviewed", "no_changes") else None
    rec = {
        "kind": "pipeline", "id": st.task_id, "project": st.project, "outcome": outcome,
        "final": c["final"], "executor_profile": st.executor_profile,
        "reviewer_profile": st.reviewer_profile,
        "gate_exit": st.gate_exit, "gate_timed_out": st.gate_timed_out,
        "gate_duration_s": st.gate_duration_s,
        "auto_committed": st.auto_committed, "findings": findings, "review_rounds": c["rounds"],
        "duration_s": round(time.monotonic() - st.t0), "base": st.base_commit, "head": head,
        "failed_step": failed_step,
        "error": st.error, "attempts": st.attempts, "summary": str(summary_file),
    }
    if st.review:
        rec.update(review_pipeline_fields(st.review))
    if st.fix:
        rec.update(first_findings={key: st.review["counts"][key] for key in COUNTED},
                   fix_round=fix_record(st.fix),
                   open_majors=[{key: m[key] for key in ("id", "location", "status", "said")}
                                for m in c["open_majors"]])
    if c["deviation"]:
        rec["deviation"] = c["deviation"]
    if st.a.diff_exclude:
        rec["diff_excluded"] = st.a.diff_exclude
    if st.pending_file:
        rec["pending"] = str(st.pending_file)
    if st.reviewer_profile == CLAUDE_REVIEW:
        rec["fallback_reviewer"] = True
    if st.reordered:
        rec["reordered"] = st.reordered
    if st.executor_error_after_commit:
        rec["executor_error_after_commit"] = True
    if st.a.host:
        rec["host"] = st.a.host
    return rec


def cmd_pipeline(a):
    st = build_pipeline_state(a)
    try:
        run_pipeline_executor(st)
        if st.outcome is None:
            run_pipeline_commit(st)
        if st.outcome is None:
            run_pipeline_gate(st)
        if st.outcome is None:
            run_pipeline_review(st)
    except (Exception, SystemExit, KeyboardInterrupt) as exc:
        st.error = exception_reason(exc)
        st.outcome = "paused" if isinstance(exc, PausedError) else (
            "no_reviewer" if st.step == "review" else "gate_failed" if st.step == "gate" else "executor_failed")
    pipeline_fix_round(st)
    c = conclude(st.outcome, st.review, st.fix)
    head = git(st.cwd, "rev-parse", "HEAD")
    summary_file = pipeline_summary(st, c, head)
    record = pipeline_record(st, c, head, summary_file)
    # The verdict goes first, so the pipeline record stays the last line of the
    # run. A pending review has no verdict yet: review-pending writes it.
    if c["outcome"] != "review_pending":
        fix_gate = (st.fix or {}).get("gate") or {}
        seen = fix_gate or {"ran": st.gate_ran, "exit": st.gate_exit, "timed_out": st.gate_timed_out}
        append(pipeline_verdict(VerdictInput(st.task_id, c, observed_gate(seen), st.reviewer_profile,
                                             st.fix, st.a.host)))
    append(record)
    if c["outcome"] == "paused":
        print("delegate: paused", file=sys.stderr)
    # An open major after the fix round is never a success.
    sys.exit(0 if c["outcome"] in ("reviewed", "fixed") else 3 if c["outcome"] == "paused" else 1)


@dataclasses.dataclass
class PendingReview:
    """The state of one `review-pending --id` run, as it goes."""
    a: object
    pending_file: Path
    p: dict
    task_id: str
    task: str
    project: str
    cwd: str
    out: Path
    attempt_root: Path
    snapshot: object
    base: str
    head: str
    executor_family: str
    executor_timeout: int
    t0: float
    route: list = dataclasses.field(default_factory=list)
    attempts: list = dataclasses.field(default_factory=list)
    reviewer_profile: object = None
    review_rec: object = None
    outcome: object = None
    error: str = ""
    review: object = None
    review_file: object = None
    fix: object = None


def list_pending_reviews(a):
    """The `review-pending` listing, one line per pending review."""
    files = pending_files(project=a.project)
    if not files:
        print("no pending reviews")
        return
    avail = availability()
    for path in files:
        try:
            p = json.loads(path.read_text())
            back = first_reviewer_back(p["executor_family"], p["review_route"], avail)
            print(f"{p['id']} | {p['project']} | written by {p['executor_profile']} | "
                  f"since {p['created']} | {back}")
        except (ValueError, KeyError, OSError):
            print(f"{path.stem} | {path.parent.name} | unreadable pending file: {path}")


def load_pending_review(a):
    """Read and validate the pending file `--id` names; exit on a usage error."""
    if not a.confirmed:
        usage_error("--confirmed required")
    read_severity_rubric()
    files = pending_files(a.id, a.project)
    if not files:
        usage_error(f"no pending review for {a.id}")
    if len(files) > 1:
        usage_error(f"{a.id} is pending in several projects; add --project "
                    + " or ".join(path.parent.name for path in files))
    pending_file = files[0]
    return pending_file, json.loads(pending_file.read_text())


def pending_context(a, pending_file, p):
    """The review state, after refusing a worktree that moved since the gate."""
    task_id, task, project, cwd = p["id"], p["task"], p["project"], p["cwd"]
    base, head, executor_family = p["base"], p["head"], p["executor_family"]
    # The review belongs to the milestone the pipeline was started for.
    set_attribution(cwd, p.get("milestone"))
    snapshot = tree_snapshot(cwd)
    if snapshot[0] != head or snapshot[1]:
        usage_error(f"the worktree changed since the gate of {task_id} ({cwd}: HEAD "
                    f"{snapshot[0][:10] or 'unknown'}, gated {head[:10]}, dirty: {bool(snapshot[1])}). "
                    "Run the gate again and review with `run --role review --diff-range`, "
                    f"then delete {pending_file}")
    t0 = time.monotonic()
    out = Path(p["out"])
    out.mkdir(parents=True, exist_ok=True)
    attempt_root = Path(tempfile.mkdtemp(prefix=f"{task_id}-review-", dir=out))
    return PendingReview(a=a, pending_file=pending_file, p=p, task_id=task_id, task=task,
                         project=project, cwd=cwd, out=out, attempt_root=attempt_root,
                         snapshot=snapshot, base=base, head=head, executor_family=executor_family,
                         executor_timeout=p.get("executor_timeout", DEFAULT_TIMEOUT_S), t0=t0)


def pending_route(a, ctx):
    """The reviewers of this pending review, checked and ordered by availability."""
    wanted = [*ctx.p["review_route"], *([a.reviewer] if a.reviewer else [])]
    for profile in wanted:
        check_claude_review(MODELS[profile][0], "review", a.allow_claude_review,
                            ctx.executor_family, ctx.p["host"])
    if CLAUDE_REVIEW in wanted:
        check_claude_login()
    return claude_last(order_route(
        list(dict.fromkeys(r for r in wanted if MODELS[r][2] != ctx.executor_family)), availability()))


def pending_run_step(ctx, request):
    """Run one step of a pending review and return its record."""
    profile, role, card = request.profile, request.role, request.card
    number = ctx.p["attempts"] + len(ctx.attempts) + 1
    rec = {"profile": profile, "role": role, "failure": "interrupted", "duration_s": 0}
    ctx.attempts.append(rec)
    try:
        rec.update(execute_run(
            task_id=ctx.task_id, task=ctx.task, role=role, profile=profile, cwd=ctx.cwd,
            card=card, out=str(ctx.attempt_root / f"{number}-{role}-{profile}"), project=ctx.project,
            timeout=(ctx.a.review_timeout or ctx.p["timeout"]) if role == "review" else ctx.executor_timeout,
            wait_s=ctx.a.wait, confirmed=True, attempt=number, diff_range=request.diff_range,
            attachments=request.attachments, access_mode=ctx.p["access"], host=ctx.p["host"],
            idle_timeout=ctx.p["idle_timeout"], allow_claude_review=ctx.a.allow_claude_review,
            author_family=request.author_family or ctx.executor_family,
            diff_exclude=ctx.p.get("diff_exclude") if role == "review" else None))
    except SlotTimeoutError as exc:
        rec.update(exc.record)
    return rec


def run_pending_route(ctx):
    """Try the ordered reviewers until one reads the work or the route ends."""
    try:
        for profile in ctx.route:
            rec = pending_run_step(ctx, StepRequest(profile, "review", ctx.p["review_card"],
                                                    f"{ctx.base}...{ctx.head}", ctx.p["attachments"]))
            if tree_snapshot(ctx.cwd) != ctx.snapshot:
                ctx.error, ctx.outcome = "review_wrote: tree changed after gate", "no_reviewer"
                break
            if rec["failure"] in REVIEW_RETRY:
                continue
            if rec["failure"] == "none":
                ctx.reviewer_profile, ctx.review_rec, ctx.outcome = profile, rec, "reviewed"
            else:
                ctx.error = rec["failure"] + (f": {rec['hint']}" if rec.get("hint") else "")
                ctx.outcome = "no_reviewer"
            break
    except PausedError:
        ctx.error, ctx.outcome = "paused", "paused"
    if ctx.outcome is None:
        waiting = [rec for rec in ctx.attempts if rec["failure"] != OVER_MODEL_CAP]
        if waiting and all(rec["failure"] in NO_CAPACITY for rec in waiting):
            ctx.outcome = "review_pending"
        else:
            ctx.outcome = "no_reviewer"
        ctx.error = "reviewer routes exhausted: " + (", ".join(
            f"{rec['profile']} ({rec['failure']})" for rec in ctx.attempts)
            or "no reviewer outside the executor family")


def pending_fix(ctx):
    """Read the finished review, then run the one fix round if it has a major."""
    if ctx.outcome != "reviewed":
        return
    # The review is done: the file goes before a fix round starts.
    ctx.pending_file.unlink()
    ctx.review_file = ctx.review_rec.get("last_message") or ctx.review_rec["stdout"]
    ctx.review = review_findings(ctx.review_file)
    if not ctx.review["counts"]["major"]:
        return
    card = ctx.p.get("card") or next(iter(ctx.p["attachments"]), None)
    ctx.fix = {}
    try:
        fix_round(ctx.fix, lambda request: pending_run_step(ctx, request),
                  task_id=ctx.task_id, task=ctx.task, cwd=ctx.cwd, out=ctx.out,
                  attempt_root=ctx.attempt_root, card=card,
                  route=ctx.p.get("route") or [ctx.p["executor_profile"]],
                  executor_profile=ctx.p["executor_profile"], gate=ctx.p["gate"],
                  gate_timeout=ctx.executor_timeout, review_route=ctx.route, first=ctx.review,
                  first_reviewer=ctx.reviewer_profile)
    except (Exception, SystemExit, KeyboardInterrupt) as exc:
        ctx.fix.update(state="paused" if isinstance(exc, PausedError) else "stopped",
                       error=exception_reason(exc))


def pending_summary(ctx, c):
    """Print and write the summary of a finished pending review; return its path."""
    outcome = c["outcome"]
    lines = [f"# Pipeline {ctx.task_id}: {ctx.task} — {outcome}", *final_lines(c, ctx.fix),
             f"- committed: {ctx.base}..{ctx.head}; review finished after a pending review"]
    if outcome == "review_pending":
        lines.append(f"- still pending: {first_reviewer_back(ctx.executor_family, ctx.p['review_route'], availability())}")
    if ctx.error:
        lines.append(f"- stopped at review: {ctx.error}")
    if ctx.reviewer_profile == CLAUDE_REVIEW:
        lines.append(f"- reviewed by the fallback reviewer {CLAUDE_REVIEW} "
                     f"({MODELS[CLAUDE_REVIEW][1]}), allowed by the operator")
    for rec in ctx.attempts:
        paths = " | ".join(f"{key}: {rec[key]}" for key in ("stdout", "stderr", "last_message")
                           if rec.get(key) and Path(rec[key]).is_file())
        lines.append(f"- {rec['role']}: {rec['profile']} | {rec['duration_s']}s | {rec['failure']} | {paths}")
    lines.append(f"- gate (before the wait): `{ctx.p['gate']}` | exit {ctx.p['gate_exit']}")
    lines += fix_step_lines(ctx.fix, ctx.p["gate"])
    lines = [" ".join(str(line).splitlines()) for line in lines]
    fix_gate = (ctx.fix or {}).get("gate") or {}
    if observed_gate(fix_gate) == "fail" and Path(fix_gate["log"]).is_file():
        lines += ["Gate log tail (after the fix):"] + Path(fix_gate["log"]).read_text(
            errors="replace").splitlines()[-15:]
    reviews_summary(ctx.review, ctx.review_file, ctx.fix, c, lines)
    summary_text = "\n".join(lines) + "\n"
    summary_file = ctx.out / f"{ctx.task_id}.summary.md"
    summary_file.write_text(summary_text)
    print(summary_text, end="")
    return summary_file


def pending_record(ctx, c, summary_file):
    """The pipeline record of a finished pending review."""
    outcome, findings = c["outcome"], c["counts"]
    if ctx.fix:
        failed_step = None if ctx.fix.get("state") == "reviewed" else "fix_" + ctx.fix.get("stage", "executor")
    else:
        failed_step = None if outcome == "reviewed" else "review"
    rec = {
        "kind": "pipeline", "id": ctx.task_id, "project": ctx.project, "outcome": outcome,
        "final": c["final"], "resumed_from": "review_pending",
        "executor_profile": ctx.p["executor_profile"], "reviewer_profile": ctx.reviewer_profile,
        "gate_exit": ctx.p["gate_exit"], "auto_committed": ctx.p["auto_committed"], "findings": findings,
        "review_rounds": c["rounds"],
        "duration_s": round(time.monotonic() - ctx.t0), "base": ctx.base,
        "head": git(ctx.cwd, "rev-parse", "HEAD") or ctx.head,
        "failed_step": failed_step,
        "error": ctx.error, "attempts": ctx.attempts, "summary": str(summary_file),
    }
    if ctx.review:
        rec.update(review_pipeline_fields(ctx.review))
    if ctx.fix:
        rec.update(first_findings={key: ctx.review["counts"][key] for key in COUNTED},
                   fix_round=fix_record(ctx.fix),
                   open_majors=[{key: m[key] for key in ("id", "location", "status", "said")}
                                for m in c["open_majors"]])
    if c["deviation"]:
        rec["deviation"] = c["deviation"]
    if ctx.p.get("diff_exclude"):
        rec["diff_excluded"] = ctx.p["diff_exclude"]
    if ctx.pending_file.exists():
        rec["pending"] = str(ctx.pending_file)
    if ctx.reviewer_profile == CLAUDE_REVIEW:
        rec["fallback_reviewer"] = True
    if ctx.p["host"]:
        rec["host"] = ctx.p["host"]
    return rec


def cmd_review_pending(a):
    if not a.id:
        list_pending_reviews(a)
        return
    pending_file, p = load_pending_review(a)
    ctx = pending_context(a, pending_file, p)
    ctx.route = pending_route(a, ctx)
    run_pending_route(ctx)
    pending_fix(ctx)
    c = conclude(ctx.outcome, ctx.review, ctx.fix)
    summary_file = pending_summary(ctx, c)
    # The file stays while the review can still be finished from it.
    if ctx.error.startswith("review_wrote"):
        pending_file.unlink(missing_ok=True)
    rec = pending_record(ctx, c, summary_file)
    if c["outcome"] != "review_pending":
        fix_gate = (ctx.fix or {}).get("gate") or {}
        seen = fix_gate or {"ran": True, "exit": p["gate_exit"], "timed_out": False}
        append(pipeline_verdict(VerdictInput(ctx.task_id, c, observed_gate(seen), ctx.reviewer_profile,
                                             ctx.fix, p["host"])))
    append(rec)
    sys.exit(0 if c["outcome"] in ("reviewed", "fixed") else 3 if c["outcome"] == "paused" else 1)


def cmd_pause(a):
    PAUSED.parent.mkdir(parents=True, exist_ok=True)
    PAUSED.write_text(a.reason or "")


def cmd_resume(a):
    PAUSED.unlink(missing_ok=True)


def active_runs():
    """Every active run this machine knows, local slots first, for `status`."""
    now_dt = now()

    def seconds_since(text):
        try:
            return max(0, int((now_dt - dt.datetime.fromisoformat(text)).total_seconds()))
        except (TypeError, ValueError):
            return None

    runs = []
    for remote, found in ((False, get_active_slots()), (True, get_active_remote())):
        for _, slot in sorted(found, key=lambda item: str(item[1].get("started", ""))):
            started = slot.get("started", "")
            runs.append({
                "id": slot.get("id", ""), "project": slot.get("project", ""),
                "profile": slot.get("profile", ""), "role": slot.get("role", ""),
                # A slot from a runner that wrote no machine is a local one.
                "machine": slot.get("machine") or local_machine(),
                "repo": slot.get("repo"), "milestone": slot.get("milestone"), "remote": remote,
                "started": started, "age_s": seconds_since(started) or 0,
                # Progress is watched on this machine only.
                "idle_s": None if remote else seconds_since(slot.get("last_progress") or started),
                "runner_gone": not remote and runner_gone(slot),
            })
    return runs


def print_run_status(run):
    """One active run as `status` prints it, with a warning if its runner died."""
    sid = run["id"]
    idle = "" if run["idle_s"] is None else f" | idle {run['idle_s'] // 60}m"
    where = " | remote" if run["remote"] else ""
    lost = " | runner gone" if run["runner_gone"] else ""
    print(f"{sid} | {run['project']} | {run['profile']} | {run['role']} | {run['machine']} | "
          f"{run['age_s'] // 60}m{idle}{where}{lost}")
    if lost:
        print(f"warning: the runner of {sid} died; its executor is still working and "
              f"will leave no result. Stop it with `kill {sid}`, then check the worktree.")


def read_run_records():
    """Every `run` record of the log, oldest first; unreadable lines are skipped."""
    records = []
    if not LOG.exists():
        return records
    for line in LOG.read_text().splitlines():
        try:
            r = json.loads(line)
        except (TypeError, ValueError):
            continue
        if r.get("kind") == "run":
            records.append(r)
    return records


def provider_limit_state(record, now_dt):
    """(executor, reset time, stderr path) of a recent provider_limit run, or None."""
    if record.get("failure") != "provider_limit":
        return None
    ex = record.get("executor")
    started_str = record.get("completed") or record.get("started")
    if not ex or not started_str:
        return None
    try:
        s_dt = dt.datetime.fromisoformat(started_str)
        if s_dt.tzinfo is None:
            s_dt = s_dt.replace(tzinfo=dt.timezone.utc)
        if not record.get("completed"):
            s_dt += dt.timedelta(seconds=record.get("duration_s", 0))
        age = (now_dt - s_dt).total_seconds()
    except (OverflowError, TypeError, ValueError):
        return None
    if not 0 <= age <= 6 * 3600:
        return None
    return ex, s_dt, record.get("stderr")


def collect_provider_limits(records, now_dt):
    """The latest recent provider_limit of each executor, as `status` shows it."""
    limits = {}
    for record in records:
        state = provider_limit_state(record, now_dt)
        if state and (state[0] not in limits or state[1] > limits[state[0]][0]):
            limits[state[0]] = (state[1], state[2])
    return limits


def print_provider_limits(limits):
    """The provider limits still in force and their reset time, when known."""
    for ex in sorted(limits.keys()):
        s_dt, stderr_path = limits[ex]
        reset_text = ""
        if stderr_path:
            try:
                stderr_content = Path(stderr_path).read_text(errors="replace")
                m = re.search(r"(try again at [^\n\r.]+)", stderr_content, re.IGNORECASE)
                if m:
                    reset_text = m.group(1).strip()
            except (OSError, TypeError, ValueError):
                pass
        if reset_text:
            print(f"{ex}: provider_limit ({reset_text})")
        else:
            print(f"{ex}: provider_limit at {s_dt.strftime('%H:%M:%S UTC')}")


def print_orphan_warning(records):
    """Warn when the last runs left orphan processes behind."""
    recent = records[-10:]
    found = sum((r.get("orphans") or {}).get("found") or 0 for r in recent)
    if found:
        killed = sum((r.get("orphans") or {}).get("killed") or 0 for r in recent)
        print(f"warning: recent runs left {found} orphan process(es) ({killed} killed); "
              "see the `orphans` field of the run records")


def cmd_status(a):
    runs = active_runs()
    if getattr(a, "json", False):
        print(json.dumps({"paused": PAUSED.exists(), "active": runs}, ensure_ascii=False, indent=1))
        return
    if PAUSED.exists():
        print("paused")
    else:
        print("active")

    now_dt = now()
    for run in runs:
        print_run_status(run)

    pending = len(pending_files())
    if pending:
        print(f"pending reviews: {pending} (list them with review-pending)")

    if LOG.exists():
        records = read_run_records()
        print_provider_limits(collect_provider_limits(records, now_dt))
        print_orphan_warning(records)


def cmd_kill(a):
    target_id = a.id
    matching = [(path, slot) for path, slot in get_active_slots() if slot.get("id") == target_id]
    if not matching:
        print(f"delegate: no running slot for {target_id}", file=sys.stderr)
        sys.exit(1)

    for _, slot in matching:
        if not slot.get("process_start"):
            print(f"delegate: slot predates identity checks; refusing to signal pid {slot['pid']}", file=sys.stderr)

    matching = [(path, slot) for path, slot in matching if slot.get("process_start")]
    if not matching:
        sys.exit(1)
    killed = False

    def still_owned(path, slot):
        try:
            return json.loads(path.read_text()) == slot and slot_owned(slot)
        except (OSError, ValueError):
            return False

    def signal_owned(sig):
        nonlocal killed
        with SlotLock():
            for path, slot in matching:
                if still_owned(path, slot):
                    try:
                        os.killpg(slot["pgid"], sig)
                        killed = True
                    except (ProcessLookupError, PermissionError):
                        pass

    signal_owned(signal.SIGTERM)
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        with SlotLock():
            if not any(still_owned(path, slot) for path, slot in matching):
                break
        time.sleep(0.05)
    signal_owned(signal.SIGKILL)
    clean_stale_slots()
    if not killed:
        sys.exit(1)


def format_access(access):
    reads = ",".join(access.get("extra_read") or []) or "none"
    limits = "; ".join(access.get("limits") or []) or "none"
    return (f"network={'yes' if access.get('network') else 'no'} | "
            f"git_write={'yes' if access.get('git_write') else 'no'} | "
            f"extra_read={reads} | limits={limits}")


def cmd_profiles(a):
    host = getattr(a, "host", None)
    checks, host_error = ({}, None)
    if host:
        try:
            checks = remote_checks(host)
        except RemoteError as exc:
            host_error = exc.detail
    for name, (executor, model, family) in MODELS.items():
        if name in FLASH_PROFILES and model != FLASH_MODEL:
            # `run` refuses the same override; show Flash and mark the entries
            # refused instead of advertising a model that will never launch.
            model, status = FLASH_MODEL, "refused"
        else:
            status = "found" if find_optional(executor) else "missing"
        remote_state = ""
        if executor == "claude" and status == "found":
            state, detail = claude_login()
            status += f" | login={detail if state == 'ok' else state}"
            reason = claude_login_problem(state, detail)
            if reason:
                print(f"delegate: {claude_login_help(reason)}", file=sys.stderr)
        if host and executor == "claude":
            remote_state = f" | host={host} local only"
        elif host:
            if host_error:
                remote_state = f" | host={host} not-ready ({host_error})"
            else:
                fix = remote_ready(checks, host, executor)
                ready = "ready" if fix is None else f"not-ready ({fix})"
                remote_state = f" | host={host} {ready}"
        trains = (f" | WARNING: trains on request data ({TRAINS_ON_REQUESTS[model]})"
                  if model in TRAINS_ON_REQUESTS else "")
        print(f"{name} | {executor} | {model} | {family} | {status}{trains}{remote_state}")
        cwd = str(Path.cwd())
        for label, role in (("implement, fix, mechanical, test", "implement"), ("review", "review")):
            if (executor == "claude" or agy_claude_model(executor, model)) and role != "review":
                continue
            policy = access_policy(executor, role, cwd)
            print(f"  {label} | {format_access(policy['access'])}")


def cmd_remote_clean(a):
    cwd = str(Path(a.cwd).resolve())
    project = a.project or Path(git(cwd, "rev-parse", "--show-toplevel") or cwd).name
    target = shlex.quote(safe_remote_name(project))
    if a.id:
        target += "/" + shlex.quote(remote_task_dir(a.id))
    snippet = 'base="$HOME/.atomic-skills/delegate/remote"; rm -rf "$base"/' + target
    staging = Path(tempfile.mkdtemp(prefix=".delegate-clean-", dir=cwd))
    try:
        subprocess.run(["git", "init", "-q", str(staging)], check=True, capture_output=True)
        sync = remote_cli(["sync", "--host", a.host, str(staging)],
                          timeout=max(120, a.timeout + 120))
        if sync.returncode != 0:
            detail = (sync.stderr.strip().splitlines() or ["remote-clean sync failed"])[-1]
            print(f"delegate: {detail}", file=sys.stderr)
            sys.exit(1)
        result = remote_cli(
            ["run", "-n", "--host", a.host, "-C", str(staging), "--wait", str(a.wait),
             "--", snippet], timeout=max(120, a.timeout + 120))
    except RemoteError as exc:
        print(f"delegate: {exc.detail}", file=sys.stderr)
        sys.exit(1)
    except subprocess.CalledProcessError as exc:
        print(f"delegate: cannot prepare the remote-clean staging repository: {exc}",
              file=sys.stderr)
        sys.exit(1)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    if result.returncode != 0:
        detail = (result.stderr.strip().splitlines() or ["remote-clean failed"])[-1]
        print(f"delegate: {detail}", file=sys.stderr)
        sys.exit(1)
    print("cleaned", a.id or project)


def cmd_record(a):
    rec = {"kind": "verdict", "id": a.id, "at": now().isoformat(timespec="seconds"),
           "gate_host": a.gate_host, "gate_executor_claim": a.gate_claim,
           "delivered": a.delivered, "review_by": a.review_by,
           "review_rounds": a.review_rounds, "findings_major": a.findings_major,
           "findings_medium": a.findings_medium, "findings_minor": a.findings_minor,
           "orchestrator_rework": a.rework, "deviation": a.deviation, "note": a.note}
    append({k: v for k, v in rec.items() if v is not None})
    print("recorded", a.id)


def cmd_report(a):
    if not LOG.exists():
        sys.exit("delegate: no log yet")
    runs, verdicts, pipelines = {}, {}, {}
    for line in LOG.read_text().splitlines():
        try:
            r = json.loads(line)
        except ValueError:
            continue
        kind = r.get("kind")
        if kind == "run":
            runs.setdefault(r.get("id", ""), []).append(r)
        elif kind == "verdict":
            verdicts.setdefault(r.get("id", ""), []).append(r)
        elif kind == "pipeline":
            pair = (r.get("executor_profile"), r.get("reviewer_profile"))
            pipelines.setdefault(pair, []).append(r)

    groups = {}
    for task_id, rs in runs.items():
        # Old log lines may name profiles, models and families that no longer exist;
        # report them verbatim instead of looking them up. A task id can hold runs of
        # several roles/models, so group every run by its own role, executor and model.
        verdict = (verdicts.get(task_id) or [{}])[-1]
        by_route = {}
        for r in rs:
            by_route.setdefault((r.get("role", ""), r.get("executor", ""), r.get("model", "")), []).append(r)
        for key, route_runs in by_route.items():
            groups.setdefault(key, []).append((task_id, route_runs, verdict))
    print(f"{len(runs)} tasks, {sum(len(v) for v in runs.values())} runs, log: {LOG}")
    for (role, ex, model), items in sorted(groups.items()):
        n = len(items)
        gated = [v for _, _, v in items if v.get("gate_host") in ("pass", "fail")]
        ok = sum(1 for v in gated if v["gate_host"] == "pass")
        rounds = [v.get("review_rounds") for _, _, v in items if v.get("review_rounds") is not None]
        major = sum(v.get("findings_major") or 0 for _, _, v in items)
        secs = sorted(r.get("duration_s") or 0 for _, route_runs, _ in items for r in route_runs)
        med = secs[len(secs) // 2] if secs else 0
        fails = sum(1 for _, route_runs, _ in items for r in route_runs
                    if r.get("exit_code", 0) != 0 or r.get("timed_out") or r.get("failure", "none") != "none")
        unconfirmed = sum(1 for _, route_runs, _ in items if not route_runs[0].get("user_confirmed"))
        rr = f"{sum(rounds) / len(rounds):.1f}" if rounds else "n/a"
        print(f"- {role} | {ex} | {model}: n={n}; host gate {ok}/{len(gated)} (no verdict: {n - len(gated)}); "
              f"review rounds avg {rr}; major findings {major}; median {med}s; failed runs {fails}; "
              f"unconfirmed {unconfirmed}")

    for (ex_prof, rev_prof), items in sorted(pipelines.items(), key=lambda item: tuple(p or "" for p in item[0])):
        n = len(items)
        outcomes = {}
        for p in items:
            o = p.get("outcome", "unknown")
            outcomes[o] = outcomes.get(o, 0) + 1
        outcomes_str = ", ".join(f"{k} {v}" for k, v in sorted(outcomes.items()))
        print(f"- pipeline | {ex_prof} -> {rev_prof}: n={n}; {outcomes_str}")


def removed_profile_asked(argv):
    """Return the first removed profile named by --profile/--route/--review-route."""
    for i, arg in enumerate(argv):
        if arg in ("--profile", "--route", "--review-route"):
            value = argv[i + 1] if i + 1 < len(argv) else ""
        elif arg.startswith(("--profile=", "--route=", "--review-route=")):
            value = arg.split("=", 1)[1]
        else:
            continue
        for part in value.split(","):
            name = part.strip()
            if name in REMOVED_PROFILES:
                return name
    return None


def reject_removed_profile():
    """Refuse a profile that was removed from the runner before argparse runs."""
    removed = removed_profile_asked(sys.argv[1:])
    if removed:
        print(REMOVED_PROFILE_MESSAGE.format(name=removed), file=sys.stderr)
        sys.exit(2)
    if len(sys.argv) >= 2 and sys.argv[1] == "run":
        pre = argparse.ArgumentParser(add_help=False)
        pre.add_argument("--profile")
        known, _ = pre.parse_known_args(sys.argv[2:])
        if known.profile == "deepseek-pro":
            print("delegate: profile deepseek-pro was removed (poor cost/benefit); use --profile flash",
                  file=sys.stderr)
            sys.exit(2)


def add_run_parser(sub):
    r = sub.add_parser("run")
    r.add_argument("--id", required=True); r.add_argument("--task", required=True)
    r.add_argument("--role", required=True, choices=ROLES)
    r.add_argument("--profile", choices=sorted([*MODELS, *ALIASES])); r.add_argument("--executor"); r.add_argument("--model")
    r.add_argument("--cwd", required=True); r.add_argument("--card", required=True)
    r.add_argument("--diff-range")
    r.add_argument("--diff-exclude", action="append", default=[], type=diff_exclude_arg, metavar="PATHSPEC",
                   help="leave this git pathspec out of the review diff (repeatable), "
                        "e.g. package-lock.json or 'dist/*'")
    r.add_argument("--attach", action="append", default=[])
    r.add_argument("--out"); r.add_argument("--project"); r.add_argument("--timeout", type=duration_arg, default=DEFAULT_TIMEOUT_S,
                   help="cap on the whole run, default 240m (seconds, or a number with a unit: 300, 300s, 90m, 2h)")
    r.add_argument("--idle-timeout", type=duration_arg, default=DEFAULT_IDLE_TIMEOUT_S,
                   help="stop a local run that shows no progress for this long, default 20m; "
                        "0 turns the idle limit off (seconds, or a number with a unit: 300, 300s, 90m, 2h)")
    r.add_argument("--allow-short-timeout", action="store_true",
                   help="accept a --timeout below 60 seconds")
    r.add_argument("--wait", type=duration_arg, default=3600,
                   help="how long to wait for a free slot, default 60m (seconds, or a number with a unit: 300, 300s, 90m, 2h)")
    r.add_argument("--attempt", type=int, default=1)
    r.add_argument("--resume", action="store_true",
                   help="continue the last run of this --id from its resume note")
    r.add_argument("--confirmed", action="store_true", help="the user approved task/role/model/executor for this batch")
    r.add_argument("--allow-peak", action="store_true")
    r.add_argument("--access", choices=["policy", "strict"], default="policy",
                   help="policy (default) or strict (no network, nothing outside the worktree)")
    r.add_argument("--host", help="run the executor on this remote-runner host")
    r.add_argument("--milestone", type=milestone_arg,
                   help="id of the project milestone this run works for, recorded as `milestone`")
    r.add_argument("--allow-claude-review", action="store_true",
                   help="the operator said yes to a Claude review for this task (the fallback reviewer)")
    r.add_argument("--author-family", choices=FAMILIES,
                   help="family of the model that wrote the code; required for claude-review")
    r.set_defaults(f=cmd_run)


def add_pipeline_parser(sub):
    pipe = sub.add_parser("pipeline")
    pipe.add_argument("--id", required=True)
    pipe.add_argument("--task", required=True)
    pipe.add_argument("--role", required=True, choices=["implement", "fix", "mechanical", "test"])
    pipe.add_argument("--cwd", required=True)
    pipe.add_argument("--card", required=True)
    pipe.add_argument("--route", required=True)
    pipe.add_argument("--gate", required=True)
    pipe.add_argument("--review-card", required=True)
    pipe.add_argument("--review-route", required=True)
    pipe.add_argument("--review-attach", action="append", default=[])
    pipe.add_argument("--diff-exclude", action="append", default=[], type=diff_exclude_arg, metavar="PATHSPEC",
                      help="leave this git pathspec out of every review diff of the pipeline (repeatable)")
    pipe.add_argument("--timeout", type=duration_arg, default=DEFAULT_TIMEOUT_S,
                      help="cap on each executor run and on the gate, default 240m (seconds, or a number with a unit: 300, 300s, 90m, 2h)")
    pipe.add_argument("--review-timeout", type=duration_arg,
                      help="cap on each review run, default: --timeout (seconds, or a number with a unit: 300, 300s, 90m, 2h)")
    pipe.add_argument("--idle-timeout", type=duration_arg, default=DEFAULT_IDLE_TIMEOUT_S,
                      help="stop a local run that shows no progress for this long, default 20m; "
                           "0 turns the idle limit off (seconds, or a number with a unit: 300, 300s, 90m, 2h)")
    pipe.add_argument("--allow-short-timeout", action="store_true",
                      help="accept a --timeout or --review-timeout below 60 seconds")
    pipe.add_argument("--wait", type=duration_arg, default=3600,
                      help="how long to wait for a free slot, default 60m (seconds, or a number with a unit: 300, 300s, 90m, 2h)")
    pipe.add_argument("--out")
    pipe.add_argument("--project")
    pipe.add_argument("--confirmed", action="store_true", required=True)
    pipe.add_argument("--access", choices=["policy", "strict"], default="policy",
                      help="policy (default) or strict (no network, nothing outside the worktree)")
    pipe.add_argument("--host", help="run every executor and reviewer on this remote-runner host")
    pipe.add_argument("--milestone", type=milestone_arg,
                      help="id of the project milestone this pipeline works for, recorded as "
                           "`milestone` on its record and on every run it launches")
    pipe.add_argument("--allow-claude-review", action="store_true",
                      help="the operator said yes to a Claude review for this task (the fallback reviewer)")
    pipe.set_defaults(f=cmd_pipeline)


def add_pause_parser(sub):
    p_pause = sub.add_parser("pause")
    p_pause.add_argument("--reason")
    p_pause.set_defaults(f=cmd_pause)


def add_resume_parser(sub):
    p_resume = sub.add_parser("resume")
    p_resume.set_defaults(f=cmd_resume)


def add_status_parser(sub):
    p_status = sub.add_parser("status")
    p_status.add_argument("--json", action="store_true",
                          help="print the active runs, local and --host, as JSON and nothing else")
    p_status.set_defaults(f=cmd_status)


def add_kill_parser(sub):
    p_kill = sub.add_parser("kill")
    p_kill.add_argument("id")
    p_kill.set_defaults(f=cmd_kill)


def add_record_parser(sub):
    v = sub.add_parser("record")
    v.add_argument("--id", required=True)
    v.add_argument("--gate-host", required=True, choices=GATE)
    v.add_argument("--gate-claim", choices=GATE); v.add_argument("--delivered", required=True, choices=DELIVERED)
    v.add_argument("--review-by"); v.add_argument("--review-rounds", type=int)
    v.add_argument("--findings-major", type=int); v.add_argument("--findings-medium", type=int)
    v.add_argument("--findings-minor", type=int)
    v.add_argument("--rework", choices=["none", "small", "large"], default="none")
    v.add_argument("--deviation"); v.add_argument("--note")
    v.set_defaults(f=cmd_record)


def add_report_parser(sub):
    sub.add_parser("report").set_defaults(f=cmd_report)


def add_peak_parser(sub):
    sub.add_parser("peak").set_defaults(f=lambda a: print("peak" if in_peak() else "off-peak"))


def add_review_pending_parser(sub):
    p_pending = sub.add_parser("review-pending")
    p_pending.add_argument("--id", help="finish the review of this task; without it, list what is pending")
    p_pending.add_argument("--project")
    p_pending.add_argument("--confirmed", action="store_true",
                           help="the review route was approved with the pipeline that left it pending")
    p_pending.add_argument("--wait", type=duration_arg, default=3600,
                           help="how long to wait for a free slot, default 60m")
    p_pending.add_argument("--review-timeout", type=duration_arg, default=None,
                           help="cap on each review run; default: the pipeline's own")
    p_pending.add_argument("--reviewer", choices=[CLAUDE_REVIEW],
                           help="add the fallback reviewer to the pending review route")
    p_pending.add_argument("--allow-claude-review", action="store_true",
                   help="the operator said yes to a Claude review for this task (the fallback reviewer)")
    p_pending.set_defaults(f=cmd_review_pending)


def add_route_parser(sub):
    p_route = sub.add_parser("route")
    p_route.add_argument("--role", required=True, choices=sorted(EXECUTOR_ROUTES))
    p_route.add_argument("--open-design", action="store_true",
                         help="the card leaves a design decision open, or touches concurrency, "
                              "security or a migration")
    p_route.add_argument("--json", action="store_true")
    p_route.set_defaults(f=cmd_route)


def add_profiles_parser(sub):
    p_profiles = sub.add_parser("profiles")
    p_profiles.add_argument("--host", help="also show which executors are ready on this host")
    p_profiles.set_defaults(f=cmd_profiles)


def add_remote_clean_parser(sub):
    p_clean = sub.add_parser("remote-clean")
    p_clean.add_argument("--host", required=True)
    p_clean.add_argument("--id")
    p_clean.add_argument("--cwd", default=".")
    p_clean.add_argument("--project")
    p_clean.add_argument("--wait", type=duration_arg, default=3600, help="seconds, or a number with a unit: 300, 300s, 90m, 2h")
    p_clean.add_argument("--timeout", type=duration_arg, default=600, help="seconds, or a number with a unit: 300, 300s, 90m, 2h")
    p_clean.set_defaults(f=cmd_remote_clean)


def install_signal_handlers():
    def interrupted(signum, frame):
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGHUP, interrupted)


def normalize_timeout_args(a):
    """Round the caps to whole seconds and refuse one below the minimum."""
    if a.cmd not in ("run", "pipeline"):
        return
    # Whole seconds for the caps (the remote path passes them on a command line).
    for name in ("timeout", "review_timeout", "wait"):
        value = getattr(a, name, None)
        if value is not None:
            setattr(a, name, int(-(-value // 1)))
    for name in ("timeout", "review_timeout"):
        value = getattr(a, name, None)
        if value is not None and value < MIN_TIMEOUT_S and not a.allow_short_timeout:
            usage_error(
                f"--{name.replace('_', '-')} {value} is {value} seconds: a time without a unit is in "
                "seconds (write 90m or 2h for longer); pass --allow-short-timeout if you mean it")


def main():
    reject_removed_profile()
    ap = argparse.ArgumentParser(prog="delegate.py")
    sub = ap.add_subparsers(dest="cmd", required=True)
    add_run_parser(sub)
    add_pipeline_parser(sub)
    add_pause_parser(sub)
    add_resume_parser(sub)
    add_status_parser(sub)
    add_kill_parser(sub)
    add_record_parser(sub)
    add_report_parser(sub)
    add_peak_parser(sub)
    add_review_pending_parser(sub)
    add_route_parser(sub)
    add_profiles_parser(sub)
    add_remote_clean_parser(sub)
    install_signal_handlers()
    a = ap.parse_args()
    normalize_timeout_args(a)
    try:
        a.f(a)
    except (PausedError, SlotTimeoutError) as exc:
        message = f"no free {exc.executor} slot (slot wait timed out)" if isinstance(exc, SlotTimeoutError) else str(exc)
        print(f"delegate: {message}", file=sys.stderr)
        sys.exit(3 if isinstance(exc, PausedError) else 4)


if __name__ == "__main__":
    main()
