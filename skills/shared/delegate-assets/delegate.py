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
  profiles  list configured profiles and whether each executor CLI is available.
  remote-clean  remove a remote task checkout, its kept copies and run files (with --host).

The log is one JSONL file shared by every project and agent on this machine:
  ${ATOMIC_SKILLS_HOME:-~/.atomic-skills}/delegate/runs.jsonl
Records are append-only. Values are enums, never free text, so the log can be audited.
"""
import argparse, datetime as dt, errno, fcntl, hashlib, json, os, re, shlex, shutil, signal, subprocess, sys, time, tempfile
from pathlib import Path

HOME = Path(os.environ.get("ATOMIC_SKILLS_HOME", Path.home() / ".atomic-skills"))
LOG = HOME / "delegate" / "runs.jsonl"
RUNNING = HOME / "delegate" / "running"
PAUSED = HOME / "delegate" / "PAUSED"

# DeepSeek peak windows in UTC, Monday-Friday only.
DEFAULT_PEAK_WINDOWS = "01:00-04:00,06:00-10:00"
CODEX_MODEL = os.environ.get("DELEGATE_CODEX_MODEL") or "gpt-6.1-sol"
# OpenCode runs one model. The variable can only pin it to the same value; any
# other value is refused by check_model_allowed before anything is launched.
FLASH_MODEL = "opencode-go/deepseek-v4.1-flash"
OPENCODE_MODEL = os.environ.get("DELEGATE_OPENCODE_MODEL") or FLASH_MODEL
LIMIT_RE = re.compile(r"usage limit|rate limit|quota|too many requests|\b429\b", re.IGNORECASE)
TOTAL_RE = re.compile(r"^[ \t`*]*TOTAL major=\d+ medium=\d+ minor=\d+[ \t`*]*$")

MODELS = {
    "flash": ("opencode", OPENCODE_MODEL, "deepseek"),
    "flash-review": ("opencode", OPENCODE_MODEL, "deepseek"),
    "codex": ("codex", CODEX_MODEL, "openai"),
    "codex-review": ("codex", CODEX_MODEL, "openai"),
    "agy": ("agy", "gemini-4-hydrogen-high", "gemini"),
    "agy-review": ("agy", "gemini-4-hydrogen-xhigh", "gemini"),
}
# Executor capabilities shared by every profile using that CLI.
EXECUTOR_FLAGS = {
    "opencode": {"requires_review_diff": False},
    "codex": {"requires_review_diff": False},
    "agy": {"requires_review_diff": True},
}
MAX_REVIEW_INPUT_BYTES = 600 * 1024
# Remote runs use the separate `remote-runner` CLI (PATH or DELEGATE_REMOTE_RUNNER).
# The per-task checkout lives under the remote user's home by default. Policy paths
# are built against a placeholder that the shipped shell wrapper expands from $HOME.
REMOTE_BASE_DEFAULT = "~/.atomic-skills/delegate/remote"
REMOTE_POLICY_ROOT = "/tmp/__DELEGATE_REMOTE_BASE__"
REMOTE_TOKEN = "__DELEGATE_REMOTE_BASE__"
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
# A reviewer route that names `flash` means `flash-review`: the only rule for a
# reviewer is that it is not of the family that wrote the code.
REVIEW_PROFILES = {"flash": "flash-review"}
# Removed on 2026-11-18: OpenCode runs a single model (Flash). Old log lines may
# still name these profiles, their models and their families; readers must keep
# showing them, but no new run may be launched with one.
REMOVED_PROFILES = ("hy4-review", "glm-flash", "kimi")
REMOVED_PROFILE_MESSAGE = ("delegate: profile {name} was removed; valid profiles: "
                           "flash, flash-review, codex, codex-review, agy, agy-review")
ROLES = ["implement", "fix", "review", "mechanical", "test"]
GATE = ["pass", "fail", "not_run"]
DELIVERED = ["yes", "partial", "no"]

DEFAULT_MAX_SLOTS = {
    "opencode": 10,
    "codex": 1,
    "agy": 2,
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
            if start <= hhmm <= end:
                return True
        elif hhmm >= start or hhmm <= end:
            return True
    return False


def append(rec):
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
    common = git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir")
    if not common:
        common = git(cwd, "rev-parse", "--git-common-dir")
        if common:
            common = str((Path(cwd) / common).resolve())
    if not common:
        return ""
    resolved = Path(common).resolve()
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
            {"action": "websearch", "resource": "*", "effect": "allow"},
            {"action": "edit", "resource": "*", "effect": "deny"},
        ]
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
    if executor == "agy":
        # agy --help: "-p, --print Run a single prompt non-interactively";
        #   "--output-format Output format for print mode". Print mode reads
        #   the prompt from stdin when no prompt argument is given; the runner
        #   writes it there so a composed prompt is not an argv element.
        argv = [find("agy"), "-p", "--model", model, "--output-format", "text"]
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


def classify_failure(timed_out, code, stdout, stderr, review_wrote, review_output=None):
    if timed_out:
        return "timeout"
    if code != 0 and has_provider_limit(stdout, stderr):
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
            return "empty_output"
        if not any(TOTAL_RE.match(line) for line in review_text.splitlines()):
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
    if not pid or pid <= 0:
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
    if not isinstance(pid, int) or pid <= 0:
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
        except Exception:
            p.unlink(missing_ok=True)


def _get_active_slots(executor=None):
    _clean_stale_slots()
    active = []
    for p in list(RUNNING.glob("*.json")):
        try:
            data = json.loads(p.read_text())
            ex = p.name.split("-")[0]
            if executor is None or ex == executor:
                active.append((p, data))
        except Exception:
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

    Progress is any change in: the size of the captured stdout or stderr, the
    branch HEAD, or the working tree (the `git status` entries and the size and
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
        except Exception:
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
        except Exception:
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
            row = table.get(root)
            if row:
                self._remember(root, table)
                _ppid, pgid, sid, _state = row
                if pgid > 1:
                    self.pgids.add(pgid)
                if sid > 0:
                    self.sessions.add(sid)
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
        # Adopted orphans and new members of a remembered session/group may
        # have left the ppid tree; add them until the scope stops growing.
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
    def __enter__(self):
        RUNNING.mkdir(parents=True, exist_ok=True)
        self.lock_path = RUNNING / ".lock"
        self.f = open(self.lock_path, "w")
        fcntl.flock(self.f, fcntl.LOCK_EX)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            fcntl.flock(self.f, fcntl.LOCK_UN)
            self.f.close()
        except Exception:
            pass


def check_model_allowed(role, executor, model):
    """The one check for the OpenCode rule.

    OpenCode runs DeepSeek Flash only. The reviewer rule lives in the pipeline
    family check, not here: Flash reviews another family's work. Called after
    every alias, profile, flag and environment override is resolved, and before
    anything is launched or any slot is taken.
    """
    if executor != "opencode":
        return
    if model != FLASH_MODEL:
        print(f"delegate: OpenCode runs only {FLASH_MODEL}; use codex or agy for another model",
              file=sys.stderr)
        sys.exit(2)


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


def compose_prompt(card, attachments, diff_range, cwd):
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
        result = subprocess.run(["git", "-C", cwd, "diff", "--no-ext-diff", diff_range, "--"],
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
        content += f"\n## Diff {diff_range}\n" + fenced(diff)
        if not diff_bytes:
            failure = "empty_diff"
    sizes = {"diff_bytes": diff_bytes, "diff_decoded_replaced": diff_decoded_replaced,
             "attached": attached, "attached_bytes": attached_bytes,
             "card_bytes": card_bytes, "prompt_bytes": len(content.encode("utf-8"))}
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
        # Path.resolve() on macOS turns /tmp into /private/tmp; replace either.
        resolved = str(Path(REMOTE_POLICY_ROOT).resolve())
        return value.replace(resolved, REMOTE_TOKEN).replace(
            REMOTE_POLICY_ROOT, REMOTE_TOKEN)
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
    text = json.dumps(access, ensure_ascii=False).replace(REMOTE_TOKEN, remote_base)
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
            f"{name}=\"${{{name}//{REMOTE_TOKEN}/$R}}\"\n")


def remote_exec_script(executor, model, role, policy):
    """Shell wrapper that runs one executor inside the remote checkout.

    `R` is the absolute remote per-task directory exported by the driver. The
    composed prompt is a file under `$R/run`; it reaches the executor from that
    file, never from this wrapper's argv or the remote-runner argv.
    """
    lines = ["set -e"]
    variables = []

    def shell_arg(value):
        if REMOTE_TOKEN not in value:
            return shlex.quote(value)
        if value.startswith(REMOTE_TOKEN):
            suffix = value[len(REMOTE_TOKEN):]
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
        argv = ["agy", "-p", "--model", model, "--output-format", "text"] + policy["argv"]
        guard_argv(argv, executor)
        lines.append("exec " + " ".join(shell_arg(arg) for arg in argv) +
                     ' < "$R/run/prompt.md"')
    elif executor == "codex":
        effort = "high" if role == "review" else "medium"
        sandbox = "read-only" if role == "review" else "workspace-write"
        argv = [
            "codex", "-a", "never", "exec", "--model", model,
            "-c", f"model_reasoning_effort={effort}", "--sandbox", sandbox,
            "--skip-git-repo-check", "--ephemeral", "-C", REMOTE_TOKEN + "/tree",
        ] + policy["argv"] + ["-o", REMOTE_TOKEN + "/run/last.md", "-"]
        guard_argv(argv, executor)
        lines.append("exec " + " ".join(shell_arg(arg) for arg in argv) +
                     ' < "$R/run/prompt.md"')
    else:
        raise RemoteError("remote_error", f"unknown executor {executor}")
    return "\n".join(variables + lines) + "\n"


def remote_driver_script(task_id, task, role, branch, sent, project, digest, token):
    q = shlex.quote
    project_dir = safe_remote_name(project)
    task_dir = remote_task_dir(task_id)
    message = q(f"{task_id}: {task} (committed by the delegate runner)")
    review = role == "review"
    return f"""#!/bin/bash
set -u
id={q(task_id)}
branch={q(branch)}
sent={q(sent)}
role={q(role)}
msg={message}
token={q(token)}
common=$(git rev-parse --path-format=absolute --git-common-dir)
stage="$common/delegate/{digest}"
R="$HOME/.atomic-skills/delegate/remote/{project_dir}/{task_dir}"
tree="$R/tree"
run="$R/run"
res="$PWD/{REMOTE_RESULT_PREFIX}{digest}"
cleanup() {{
  [ -n "${{run:-}}" ] && rm -rf "$run"
  [ -n "${{stage:-}}" ] && rm -rf "$stage"
}}
trap 'cleanup; exit 143' TERM INT HUP
trap cleanup EXIT
rm -rf "$run" "$res"
mkdir -p "$R"
# Identify this run exactly. remote-runner writes a record whose first line is
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
# Reuse only a checkout that is exactly the commit being sent and clean.
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
export R
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


def execute_remote_run(task_id, task, role, executor, model, family, profile, cwd, project,
                       out_path, card_content, input_sizes, pending, timeout, wait_s, attempt,
                       confirmed, allow_peak, diff_range, attachments, access_mode, host, prompt,
                       stdout, stderr, last_msg):
    """Run remotely and always leave a record, even for an unhandled error."""
    try:
        return _execute_remote_run(
            task_id, task, role, executor, model, family, profile, cwd, project, out_path,
            card_content, input_sizes, pending, timeout, wait_s, attempt, confirmed,
            allow_peak, diff_range, attachments, access_mode, host, prompt, stdout, stderr,
            last_msg)
    except (KeyboardInterrupt, SystemExit):
        raise
    except BaseException as exc:
        if "completed" in pending:
            raise
        return _remote_record_failure(
            pending, "remote_error", f"remote run failed: {exception_reason(exc)}",
            host=host)


def _execute_remote_run(task_id, task, role, executor, model, family, profile, cwd, project,
                        out_path, card_content, input_sizes, pending, timeout, wait_s, attempt,
                        confirmed, allow_peak, diff_range, attachments, access_mode, host, prompt,
                        stdout, stderr, last_msg):
    """Run the executor on a remote host through the remote-runner CLI.

    Code is shipped as a git bundle inside a dedicated staging repository that
    holds no worktree files and is fetched into a per-task checkout. Results
    return as a git bundle written in the remote staging directory and pulled
    back before a local fast-forward fetch.
    """
    snap0 = tree_snapshot(cwd)
    branch = git(cwd, "rev-parse", "--abbrev-ref", "HEAD")
    policy = remote_access_policy(executor, role, strict=access_mode == "strict")
    default_base = remote_base_rel(project, task_id)
    pending.update(host=host, remote_dir=default_base,
                   access=resolve_remote_access(policy["access"], default_base))
    if snap0[1]:
        return _remote_record_failure(pending, "dirty_worktree", wait_s=0)
    if not branch or branch == "HEAD":
        return _remote_record_failure(
            pending, "remote_error",
            "remote runs need a named branch; check out the task branch first")
    if not remote_runner_cmd():
        return _remote_record_failure(
            pending, "remote_not_ready",
            "remote-runner not found; install it or set DELEGATE_REMOTE_RUNNER")
    try:
        checks = remote_checks(host)
    except RemoteError as exc:
        return _remote_record_failure(pending, exc.failure, exc.detail)
    fix = remote_ready(checks, host, executor)
    if fix:
        return _remote_record_failure(pending, "remote_not_ready", fix)

    peak = in_peak() and family == "deepseek"
    if peak:
        print("delegate: DeepSeek peak window (UTC); DeepSeek costs double now — proceeding",
              file=sys.stderr)
    if executor == "codex":
        last_msg.unlink(missing_ok=True)

    sent = snap0[0]
    digest = hashlib.sha256(f"{task_id}\0{sent}".encode("utf-8")).hexdigest()[:16]
    # Ship a dedicated repository that holds only the bundle and the run files.
    # Syncing the worktree would also send every untracked and ignored file,
    # including .env* (remote-runner's includeIgnored default).
    staging = Path(cwd) / f".delegate-remote-stage-{digest}"
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir(parents=True)
    try:
        subprocess.run(["git", "init", "-q", str(staging)], check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError) as exc:
        shutil.rmtree(staging, ignore_errors=True)
        return _remote_record_failure(
            pending, "remote_error", f"cannot prepare the remote staging repository: {exc}")
    stage = staging / ".git" / "delegate" / digest
    local_res = staging / f"{REMOTE_RESULT_PREFIX}{digest}"
    stage.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(stage, 0o700)
    except OSError:
        pass
    bundle = stage / "code.bundle"
    out_path.mkdir(parents=True, exist_ok=True)
    stdout.write_text("", encoding="utf-8")
    stderr.write_text("", encoding="utf-8")
    started = now().isoformat(timespec="microseconds")
    remote_out = tempfile.NamedTemporaryFile(prefix="delegate-remote-", suffix=".out", delete=False)
    remote_err = tempfile.NamedTemporaryFile(prefix="delegate-remote-", suffix=".err", delete=False)
    remote_out.close()
    remote_err.close()
    process = None
    timed_out = False
    local_slot_timeout = False
    orphan_failure = None
    interrupted_exc = None
    remote_id = None
    kill_result = None
    run_token = os.urandom(8).hex()
    run_s = send_s = fetch_s = 0.0

    def discover_remote_id():
        nonlocal remote_id
        if not remote_id:
            remote_id = remote_run_marker(remote_err.name, run_token)
        return remote_id

    try:
        try:
            subprocess.run(["git", "-C", cwd, "bundle", "create", str(bundle), branch],
                           check=True, capture_output=True)
        except (OSError, subprocess.CalledProcessError) as exc:
            detail = getattr(exc, "stderr", b"")
            if isinstance(detail, bytes):
                detail = detail.decode("utf-8", errors="replace")
            raise RemoteError("remote_error", f"cannot create git bundle: {detail or exc}")
        (stage / "prompt.md").write_text(card_content, encoding="utf-8")
        exec_script = remote_exec_script(executor, model, role, policy)
        (stage / "exec.sh").write_text(exec_script, encoding="utf-8")
        (stage / "remote-run.sh").write_text(
            remote_driver_script(task_id, task, role, branch, sent, project, digest,
                                 run_token),
            encoding="utf-8")
        if attachments:
            attach_dir = stage / "attachments"
            attach_dir.mkdir(exist_ok=True)
            for filename in attachments:
                source = Path(filename)
                _copy_result(source, attach_dir / source.name)
        if diff_range:
            diff_result = subprocess.run(
                ["git", "-C", cwd, "diff", "--no-ext-diff", diff_range, "--"],
                capture_output=True)
            if diff_result.returncode == 0:
                (stage / "diff.txt").write_bytes(diff_result.stdout)

        send_t0 = time.monotonic()
        sync_result = remote_cli(["sync", "--host", host, str(staging)],
                                 timeout=max(120, timeout + 120),
                                 timeout_failure="remote_error")
        send_s = time.monotonic() - send_t0
        if sync_result.returncode != 0:
            detail = (sync_result.stderr.strip().splitlines() or
                      ["remote-runner sync failed"])[-1]
            raise RemoteError("remote_error", detail)

        snippet = f'exec bash "$(git rev-parse --path-format=absolute --git-common-dir)/delegate/{digest}/remote-run.sh"'
        argv = [remote_runner_cmd(), "run", "-n", "--host", host, "-C", str(staging),
                "--wait", str(wait_s), "--timeout", str(max(1, timeout + 30)), "--", snippet]
        run_t0 = time.monotonic()
        # The queue is bounded by --wait; the executor timeout starts only when
        # the run reports that it is active (its marker), never while queued.
        queue_deadline = run_t0 + wait_s + 2
        deadline = None
        with open(remote_out.name, "w") as so, open(remote_err.name, "w") as se:
            process = subprocess.Popen(argv, stdout=so, stderr=se, start_new_session=True)
        parent_pid = os.getppid()
        next_probe = time.monotonic()
        while True:
            code_now = process.poll()
            if code_now is not None:
                break
            if os.getppid() != parent_pid:
                raise ParentGone()
            now_s = time.monotonic()
            if deadline is not None and now_s >= deadline:
                timed_out = True
                discover_remote_id()
                kill_result = remote_stop(host, remote_id)
                pending["_remote_kill"] = kill_result
                _terminate_remote_process(process)
                break
            if deadline is None and now_s >= queue_deadline:
                local_slot_timeout = True
                discover_remote_id()
                kill_result = remote_stop(host, remote_id)
                pending["_remote_kill"] = kill_result
                _terminate_remote_process(process)
                break
            if now_s >= next_probe:
                if discover_remote_id() and deadline is None:
                    deadline = time.monotonic() + timeout
                next_probe = time.monotonic() + 0.25
            time.sleep(0.05)
        run_s = time.monotonic() - run_t0
    except ParentGone:
        orphan_failure = "orphaned"
        discover_remote_id()
        kill_result = remote_stop(host, remote_id)
        pending["_remote_kill"] = kill_result
        if process is not None:
            _terminate_remote_process(process)
    except (KeyboardInterrupt, SystemExit) as exc:
        orphan_failure = "interrupted"
        interrupted_exc = exc
        discover_remote_id()
        kill_result = remote_stop(host, remote_id)
        pending["_remote_kill"] = kill_result
        if process is not None:
            _terminate_remote_process(process)
    except RemoteError as exc:
        _cleanup_remote_local(staging)
        _cleanup_temp(remote_out.name, remote_err.name)
        return _remote_record_failure(pending, exc.failure, exc.detail,
                                      send_s=round(send_s, 3),
                                      run_s=round(run_s, 3),
                                      fetch_s=round(fetch_s, 3))
    finally:
        if process is not None and process.poll() is None:
            _terminate_remote_process(process)

    remote_code = process.returncode if process is not None else None
    remote_stderr = ""
    try:
        remote_stderr = Path(remote_err.name).read_text(errors="replace").strip()
    except OSError:
        pass
    causes = [line for line in remote_stderr.splitlines()
              if line.strip() and not line.startswith(("remote-runner: result=", REMOTE_RUN_MARKER,
                                                       REMOTE_WORK_MARKER))]
    last_line = (causes or [""])[-1]
    work_info = remote_work_marker(remote_err.name, run_token)
    if work_info:
        pending["_remote_work"] = dict(work_info)

    def kept_record(extra=None):
        if not work_info:
            return None
        kept = dict(work_info)
        if extra:
            kept.update(extra)
        return kept

    try:
        # A stop signal ends this run: do not pull or merge its partial result.
        if orphan_failure:
            rec = _remote_record_failure(
                pending, orphan_failure, wait_s=round(run_s, 3),
                send_s=round(send_s, 3), run_s=round(run_s, 3),
                fetch_s=round(fetch_s, 3), exit_code=remote_code)
            if interrupted_exc is not None:
                raise interrupted_exc
            return rec
        if local_slot_timeout:
            extra = {"remote_kill": kill_result} if kill_result else {}
            return _remote_record_failure(
                pending, "slot_timeout",
                last_line or "no free capacity on the host within --wait", host=host,
                wait_s=round(run_s, 3), send_s=round(send_s, 3),
                run_s=round(run_s, 3), fetch_s=round(fetch_s, 3),
                exit_code=remote_code, **extra)
        if remote_code == 74:
            return _remote_record_failure(
                pending, "slot_timeout", last_line or None, host=host,
                wait_s=round(run_s, 3), send_s=round(send_s, 3),
                run_s=round(run_s, 3), fetch_s=round(fetch_s, 3))
        fetch_t0 = time.monotonic()
        shutil.rmtree(local_res, ignore_errors=True)
        pull = remote_cli(["pull", "--host", host, str(local_res)], timeout=max(120, timeout + 120))
        meta_file = local_res / "meta.txt"
        meta = {}
        if meta_file.is_file():
            for line in meta_file.read_text(errors="replace").splitlines():
                key, sep, value = line.partition("=")
                if sep:
                    meta[key] = value
        if meta.get("token") != run_token:
            fetch_s = time.monotonic() - fetch_t0
            _cleanup_remote_local(staging)
            if timed_out:
                extra = {"remote_work_kept": kept_record()} if kept_record() else {}
                if kill_result:
                    extra["remote_kill"] = kill_result
                return _remote_record_failure(
                    pending, "timeout", wait_s=round(run_s, 3), timed_out=True,
                    send_s=round(send_s, 3), run_s=round(run_s, 3),
                    fetch_s=round(fetch_s, 3), exit_code=remote_code, **extra)
            if orphan_failure:
                extra = {"remote_work_kept": kept_record()} if kept_record() else {}
                if kill_result:
                    extra["remote_kill"] = kill_result
                return _remote_record_failure(
                    pending, orphan_failure, wait_s=round(run_s, 3),
                    send_s=round(send_s, 3), run_s=round(run_s, 3),
                    fetch_s=round(fetch_s, 3), exit_code=remote_code, **extra)
            detail = last_line or (pull.stderr.strip().splitlines() or [""])[-1]
            return _remote_record_failure(
                pending, "remote_error", detail or "remote run produced no result",
                send_s=round(send_s, 3), run_s=round(run_s, 3),
                fetch_s=round(fetch_s, 3), exit_code=remote_code)
        remote_base = meta.get("remote_base") or default_base
        received = meta.get("received") or sent
        remote_exit = int(meta.get("exit") or 0)
        remote_dirty = meta.get("dirty") == "1"
        commit_rc = meta.get("commit_rc") or ""
        commit_failed = commit_rc not in ("", "0")
        commit_error = None
        if commit_failed:
            commit_error = f"remote auto-commit failed (git exit {commit_rc})"
            try:
                tail = [line for line in (local_res / "commit.log").read_text(
                    errors="replace").splitlines() if line.strip()]
            except OSError:
                tail = []
            if tail:
                commit_error += ": " + tail[-1]
        _copy_result(local_res / "stdout", stdout)
        _copy_result(local_res / "stderr", stderr)
        if executor == "codex":
            _copy_result(local_res / "last.md", last_msg)
        review_wrote = role == "review" and (remote_dirty or received != sent)
        diverged = False
        diverged_reason = None
        fetched_ref = None
        fetch_error = None
        if role != "review" and received != sent and not timed_out and not orphan_failure:
            fetched_ref = remote_delegate_ref(task_id)
            current_branch = git(cwd, "rev-parse", "--abbrev-ref", "HEAD")
            fetch = subprocess.run(
                ["git", "-C", cwd, "fetch", "--no-tags", str(local_res / "result.bundle"),
                 f"+refs/heads/{branch}:{fetched_ref}"], capture_output=True, text=True)
            if fetch.returncode != 0:
                fetch_error = fetch.stderr.strip() or "cannot fetch the result bundle"
            elif current_branch != branch:
                diverged = True
                diverged_reason = (f"the worktree moved to {current_branch or 'a detached HEAD'}, "
                                   f"not {branch}; the result is kept at {fetched_ref}")
            elif subprocess.run(["git", "-C", cwd, "merge-base", "--is-ancestor",
                                 "HEAD", fetched_ref], capture_output=True).returncode != 0:
                diverged = True
                diverged_reason = ("the local branch and the remote result diverge; "
                                   f"the result is kept at {fetched_ref}")
            else:
                merge = subprocess.run(["git", "-C", cwd, "merge", "--ff-only", fetched_ref],
                                       capture_output=True, text=True)
                if merge.returncode != 0:
                    diverged = True
                    detail = (merge.stderr.strip().splitlines() or
                              ["git refused the fast-forward"])[-1]
                    diverged_reason = ("a local change overlaps the remote result and the "
                                       f"fast-forward was refused ({detail}); commit or stash "
                                       f"it, then merge {fetched_ref}")
                else:
                    subprocess.run(["git", "-C", cwd, "update-ref", "-d", fetched_ref],
                                   capture_output=True)
        fetch_s = time.monotonic() - fetch_t0
        # The pulled result directory lives in the synced staging repository;
        # remove it before snapshotting, or it would look like executor dirt.
        _cleanup_remote_local(staging)

        snap1 = tree_snapshot(cwd)
        head1 = snap1[0]
        dirty_after = bool(snap1[1])
        uncommitted = bool(remote_dirty and role != "review")
        if orphan_failure:
            failure = orphan_failure
        elif timed_out:
            failure = "timeout"
        elif diverged:
            failure = "diverged"
        elif fetch_error:
            failure = "remote_error"
        elif review_wrote:
            failure = "review_wrote"
        elif commit_failed:
            failure = "remote_error"
        else:
            review_output = None
            if role == "review":
                review_output = last_msg if executor == "codex" else stdout
            failure = classify_failure(False, remote_exit, stdout, stderr,
                                       review_wrote, review_output)
        commits = git(cwd, "rev-list", "--count", f"{sent}..{head1}") if sent and head1 else ""
        files = git(cwd, "diff", "--name-only", f"{sent}..{head1}") if sent and head1 else ""
        access = resolve_remote_access(policy["access"], remote_base)
        access.setdefault("limits", []).append(
            "leftover-process cleanup on the host is only what remote-runner kill guarantees")
        if kill_result in ("failed", "no_id"):
            access.setdefault("limits", []).append(
                f"remote-runner kill did not confirm a stop ({kill_result}); "
                f"check `remote-runner runs --host {host}` on the host")
        rec = {
            "kind": "run", "id": task_id, "project": project,
            "task": task, "role": role, "executor": executor, "model": model,
            "family": family, "user_confirmed": bool(confirmed), "started": started,
            "duration_s": round(run_s), "exit_code": remote_exit, "timed_out": timed_out,
            "completed": now().isoformat(timespec="microseconds"),
            "wait_s": round(run_s if remote_code == 74 else 0, 3),
            "failure": failure, "peak": peak, "base": sent[:10], "head": head1[:10],
            "commits": int(commits) if commits.isdigit() else 0,
            "files_changed": len([f for f in files.splitlines() if f]),
            "dirty_before": False, "dirty_after": dirty_after, "uncommitted": uncommitted,
            "card": str(Path(pending["card"]).resolve()), "stdout": str(stdout),
            "stderr": str(stderr), "attempt": attempt, "prompt": str(prompt),
            "access": access, "host": host, "remote_dir": remote_base,
            "sync": {"sent": sent, "received": received},
            "orphans": {"found": 0, "killed": 0, "sample": []},
            "send_s": round(send_s, 3), "run_s": round(run_s, 3),
            "fetch_s": round(fetch_s, 3), **input_sizes,
        }
        if fetch_error:
            rec["remote_error"] = fetch_error
        elif commit_error:
            rec["remote_error"] = commit_error
        elif diverged_reason:
            rec["remote_error"] = diverged_reason
        if kill_result:
            rec["remote_kill"] = kill_result
        if diverged and fetched_ref:
            rec["remote_ref"] = fetched_ref
        if failure != "none":
            kept = kept_record({"ref": fetched_ref} if diverged and fetched_ref else None)
            if kept:
                rec["remote_work_kept"] = kept
        if executor == "codex":
            rec["last_message"] = str(last_msg)
        append(rec)
        if interrupted_exc is not None:
            raise interrupted_exc
        return rec
    finally:
        _cleanup_remote_local(staging)
        _cleanup_temp(remote_out.name, remote_err.name)


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


def write_checkpoint(task_id, cwd, out_path, base, failure, timeout, idle_timeout, captures):
    """Keep the work of a stopped run: commit a dirty tree and write the resume note.

    Called after the executor's processes are gone. The commit uses the
    repository's own identity and hooks, like the pipeline's runner commit; a
    refused commit leaves the files in the tree and is written in the note.
    """
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


def execute_run(task_id, task, role, profile=None, executor=None, model=None, cwd=None,
                card=None, out=None, project=None, timeout=DEFAULT_TIMEOUT_S, wait_s=3600, attempt=1,
                confirmed=False, allow_peak=False, diff_range=None, attachments=None,
                access_mode="policy", host=None, idle_timeout=DEFAULT_IDLE_TIMEOUT_S, resume=False):
    check_paused()
    alias_notice = None
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
        family = None
    if not executor or not model:
        sys.exit("delegate: give --profile, or both --executor and --model")
    check_model_allowed(role, executor, model)
    if alias_notice:
        print(alias_notice, file=sys.stderr)

    cwd = str(Path(cwd).resolve())
    parent_pid = os.getppid()
    if role == "review" and EXECUTOR_FLAGS.get(executor, {}).get("requires_review_diff") and not diff_range:
        usage_error(f"{executor} review requires --diff-range; the runner attaches the exact diff")
    card_content, input_sizes, input_failure = compose_prompt(card, attachments, diff_range, cwd)
    if role == "review" and not diff_range and "{{DIFF_RANGE}}" in Path(card).read_text(encoding="utf-8"):
        usage_error("review card contains {{DIFF_RANGE}} but no --diff-range was given; "
                    "pass --diff-range <base>...<head>")
    top = git(cwd, "rev-parse", "--show-toplevel") or cwd
    project = project or Path(top).name
    resumed_from = None
    if resume:
        previous, problem = find_resume(task_id, project)
        if problem:
            usage_error(problem)
        card_content += RESUME_SECTION + fenced(previous["text"])
        input_sizes["prompt_bytes"] = len(card_content.encode("utf-8"))
        input_sizes["resume_note"] = previous["path"]
        resumed_from = previous["completed"]
        attempt = max(attempt, previous["attempt"] + 1)
    size_failure = "review_input_too_large" if role == "review" else "input_too_large"
    if input_sizes["prompt_bytes"] > MAX_REVIEW_INPUT_BYTES:
        input_failure = size_failure
    elif executor in ARGV_PROMPT_EXECUTORS and input_sizes["prompt_bytes"] >= MAX_ARG_BYTES:
        # OpenCode takes the prompt as one argv element and would fail with
        # E2BIG at or above the kernel limit; it has no stdin prompt.
        input_failure = size_failure
    out_path = Path(out or HOME / "delegate" / "out" / project).resolve()
    out_path.mkdir(parents=True, exist_ok=True)
    policy = access_policy(executor, role, cwd, out_path, strict=access_mode == "strict")
    stdout, stderr, last_msg, prompt = run_output_paths(out_path, task_id, attempt)
    prompt.write_text(card_content, encoding="utf-8")
    tracker = ProcessTracker()
    orphans = {"found": 0, "killed": 0, "sample": [],
               "tracked": False, "polls": 0, "method": tracker.method}
    # A refused input or a queue timeout has an audit record, but no child snapshot.
    pending = {
        "kind": "run", "id": task_id, "project": project, "task": task, "role": role,
        "executor": executor, "model": model, "family": family, "attempt": attempt,
        "user_confirmed": bool(confirmed), "duration_s": 0, "exit_code": None,
        "timed_out": False, "card": str(Path(card).resolve()), "prompt": str(prompt),
        "stdout": str(stdout), "stderr": str(stderr), "access": policy["access"],
        "orphans": orphans, **input_sizes,
    }
    if resume:
        pending["resumed_from"] = resumed_from
    if input_failure:
        pending["orphans"] = tracker.sweep()
        pending.update(failure=input_failure, completed=now().isoformat(timespec="microseconds"))
        append(pending)
        return pending
    if host:
        return execute_remote_run(
            task_id=task_id, task=task, role=role, executor=executor, model=model,
            family=family, profile=profile, cwd=cwd, project=project, out_path=out_path,
            card_content=card_content, input_sizes=input_sizes, pending=pending,
            timeout=timeout, wait_s=wait_s,
            attempt=attempt, confirmed=confirmed, allow_peak=allow_peak,
            diff_range=diff_range, attachments=attachments, access_mode=access_mode,
            host=host, prompt=prompt, stdout=stdout, stderr=stderr, last_msg=last_msg)
    argv = build_argv(executor, model, role, cwd, card_content, last_msg, policy)
    peak = in_peak() and family == "deepseek"
    if peak:
        print("delegate: DeepSeek peak window (UTC); DeepSeek costs double now — proceeding",
              file=sys.stderr)
    if executor == "codex":
        last_msg.unlink(missing_ok=True)

    # Slot acquisition with polling
    deadline = time.time() + wait_s
    max_slots = get_max_slots(executor)
    p = None
    slot_file = None
    queued_at = time.monotonic()
    timed_out = False
    stalled = False
    orphan_failure = None
    interrupted_exc = None
    exit_seen = False
    pending_return = False
    pending_error = None

    # Codex and Antigravity read the prompt from stdin; OpenCode takes it as an
    # argv element (see ARGV_PROMPT_EXECUTORS).
    si = open(prompt, "rb") if executor in ("codex", "agy") else None
    try:
        with open(stdout, "w") as so, open(stderr, "w") as se:
            while True:
                check_paused()
                if os.getppid() != parent_pid:
                    raise ParentGone()
                with SlotLock():
                    active = _get_active_slots(executor)
                    if len(active) < max_slots:
                        check_paused()
                        snap0 = tree_snapshot(cwd)
                        head0 = snap0[0]
                        dirty_before = bool(snap0[1])
                        started = now().isoformat(timespec="microseconds")
                        t0 = time.monotonic()
                        wait_duration_s = t0 - queued_at
                        child_env = dict(os.environ)
                        child_env.update(policy["env"])
                        p = subprocess.Popen(
                            argv, cwd=cwd, stdout=so, stderr=se,
                            stdin=si if si is not None else subprocess.DEVNULL,
                            start_new_session=True, env=child_env,
                        )
                        tracker.watch(p.pid)
                        slot_file = RUNNING / f"{executor}-{task_id}-{p.pid}.json"
                        slot_data = {
                            "id": task_id,
                            "project": project,
                            "profile": profile,
                            "role": role,
                            "pid": p.pid,
                            "pgid": p.pid,
                            "started": started,
                            "process_start": process_identity(p.pid) or f"unreaped:{os.getpid()}:{p.pid}",
                            "runner_pid": os.getpid(),
                            "runner_start": process_identity(os.getpid()),
                        }
                        slot_tmp = slot_file.with_suffix(".tmp")
                        slot_tmp.write_text(json.dumps(slot_data, ensure_ascii=False))
                        os.replace(slot_tmp, slot_file)
                        break

                if time.time() >= deadline:
                    raise SlotTimeoutError(executor)
                remaining = deadline - time.time()
                time.sleep(min(5.0, max(0.05, remaining)))

            progress = ProgressWatch(cwd, (stdout, stderr), idle_timeout, slot_file, slot_data)
            try:
                wait_for_exit(p, timeout, parent_pid=parent_pid, tracker=tracker, progress=progress)
                exit_seen = True
            except ParentGone:
                # The orchestrator's background task (or the parent shell) went
                # away. Poll before TERM so the last detached child is known.
                orphan_failure = "orphaned"
                tracker.poll(force=True)
                terminate_process(p)
            except (KeyboardInterrupt, SystemExit) as exc:
                orphan_failure = "interrupted"
                interrupted_exc = exc
                tracker.poll(force=True)
                terminate_process(p)
            except (subprocess.TimeoutExpired, Stalled) as stop:
                stalled = isinstance(stop, Stalled)
                timed_out = not stalled
                tracker.poll(force=True)
                try:
                    os.killpg(p.pid, signal.SIGTERM)
                except (ProcessLookupError, PermissionError):
                    pass
                try:
                    wait_for_exit(p, 10, tracker=tracker)
                    exit_seen = True
                except subprocess.TimeoutExpired:
                    pass
    except ParentGone:
        pending.update(failure="orphaned", wait_s=round(time.monotonic() - queued_at, 3),
                       completed=now().isoformat(timespec="microseconds"))
        pending_return = True
    except SlotTimeoutError as exc:
        pending.update(failure="slot_timeout", wait_s=round(time.monotonic() - queued_at, 3),
                       completed=now().isoformat(timespec="microseconds"))
        pending_return = True
        pending_error = exc
        exc.record = pending
    finally:
        # Reap and removal are one locked transition: kill can trust the runner
        # identity while Darwin hides the unreaped zombie's start time.
        try:
            with SlotLock():
                try:
                    if p is not None:
                        # The normal exit already forced its snapshot in
                        # wait_for_exit; the stalled paths force one here
                        # before the group kill.
                        if not exit_seen:
                            tracker.poll(force=True)
                        stop_process(p)
                finally:
                    if slot_file and (p is None or p.returncode is not None):
                        slot_file.unlink(missing_ok=True)
                        slot_file.with_suffix(".tmp").unlink(missing_ok=True)
        finally:
            try:
                # Runs on success, failure, timeout, stop and the orphan watcher:
                # whatever the executor left outside its group ends here. The
                # sweep result is part of every record, including pending ones.
                # A normal exit already forced its poll; the other paths need
                # one more snapshot here before the sweep acts.
                orphans = tracker.sweep(force_poll=not exit_seen)
                pending["orphans"] = orphans
            finally:
                if si is not None:
                    si.close()

    if pending_return:
        append(pending)
        if pending_error is not None:
            raise pending_error
        return pending

    code = p.returncode

    # A run that was stopped (idle limit, time cap, stop signal, lost parent)
    # keeps its work: the processes are gone by now, so the tree is stable.
    stop_failure = orphan_failure or ("stalled" if stalled else "timeout" if timed_out else None)
    checkpoint = None
    if stop_failure and role != "review":
        try:
            checkpoint = write_checkpoint(task_id, cwd, out_path, head0, stop_failure,
                                          timeout, idle_timeout, (stdout, stderr))
        except Exception as exc:  # the record must still be written
            checkpoint = {"commit": None, "resume": None, "error": str(exc)[:300]}

    snap1 = tree_snapshot(cwd)
    head1 = snap1[0]
    dirty_after = bool(snap1[1])
    review_wrote = role == "review" and snap1 != snap0
    review_output = (last_msg if executor == "codex" else stdout) if role == "review" else None
    failure = orphan_failure or ("stalled" if stalled else classify_failure(
        timed_out, code, stdout, stderr, review_wrote, review_output))
    uncommitted = role != "review" and head1 == head0 and snap1 != snap0
    commits = git(cwd, "rev-list", "--count", f"{head0}..{head1}") if head0 and head1 else ""
    files = git(cwd, "diff", "--name-only", f"{head0}..{head1}") if head0 and head1 else ""
    rec = {
        "kind": "run", "id": task_id, "project": project,
        "task": task, "role": role, "executor": executor, "model": model, "family": family,
        "user_confirmed": bool(confirmed), "started": started,
        "duration_s": round(time.monotonic() - t0), "exit_code": code, "timed_out": timed_out,
        "completed": now().isoformat(timespec="microseconds"), "wait_s": round(wait_duration_s, 3),
        "failure": failure,
        "peak": peak, "base": head0[:10], "head": head1[:10],
        "commits": int(commits) if commits.isdigit() else 0,
        "files_changed": len([f for f in files.splitlines() if f]),
        "dirty_before": dirty_before,
        "dirty_after": dirty_after,
        "uncommitted": uncommitted,
        "card": str(Path(card).resolve()), "stdout": str(stdout), "stderr": str(stderr),
        "attempt": attempt, "prompt": str(prompt), "access": policy["access"], **input_sizes,
        "orphans": orphans,
    }
    if executor == "codex":
        rec["last_message"] = str(last_msg)
    if stalled:
        rec["idle_s"] = round(progress.idle_s())
    if checkpoint is not None:
        rec["checkpoint"] = checkpoint
    if resume:
        rec["resumed_from"] = resumed_from
    append(rec)
    if interrupted_exc is not None:
        # The record and slot cleanup are complete; keep the runner's normal
        # signal exit semantics.
        raise interrupted_exc
    return rec


def cmd_run(a):
    rec = execute_run(
        task_id=a.id, task=a.task, role=a.role, profile=a.profile,
        executor=a.executor, model=a.model, cwd=a.cwd, card=a.card,
        out=a.out, project=a.project, timeout=a.timeout,
        wait_s=getattr(a, "wait", 3600), attempt=a.attempt,
        confirmed=a.confirmed, allow_peak=a.allow_peak, diff_range=a.diff_range, attachments=a.attach,
        access_mode=a.access, host=a.host, idle_timeout=a.idle_timeout, resume=a.resume,
    )
    print(json.dumps(rec, ensure_ascii=False, indent=1))
    sys.exit(0 if rec["failure"] == "none" else 1)


def canonical_route(raw):
    route = [ALIASES.get(p.strip(), p.strip()) for p in raw.split(",") if p.strip()]
    for p in route:
        if p in REMOVED_PROFILES:
            raise ValueError(REMOVED_PROFILE_MESSAGE.format(name=p))
    if not route or any(p not in MODELS for p in route):
        raise ValueError(f"invalid route: {raw}")
    return route


def cmd_pipeline(a):
    if not a.confirmed:
        sys.exit("delegate: --confirmed required")
    t0_pipeline = time.monotonic()
    task_id, task, role = a.id, a.task, a.role
    cwd = str(Path(a.cwd).resolve())
    top = git(cwd, "rev-parse", "--show-toplevel") or cwd
    project = a.project or Path(top).name
    out = Path(a.out or HOME / "delegate" / "out" / project).resolve()
    out.mkdir(parents=True, exist_ok=True)
    # Refuse before creating outputs, taking a slot or launching anything: every
    # profile in both routes goes through the same check as a standalone run.
    try:
        route, review_route = canonical_route(a.route), canonical_route(a.review_route)
        review_route = [REVIEW_PROFILES.get(p, p) for p in review_route]
    except ValueError as exc:
        message = str(exc)
        sys.exit(message if message.startswith("delegate:") else f"delegate: {message}")
    for profile in route:
        check_model_allowed(role, *MODELS[profile][:2])
    for profile in review_route:
        check_model_allowed("review", *MODELS[profile][:2])
    for filename in a.review_attach:
        read_attachment(filename)
    # Each invocation and attempt owns its outputs, even when the same ID is reused.
    attempt_root = Path(tempfile.mkdtemp(prefix=f"{task_id}-", dir=out))
    base_commit = git(cwd, "rev-parse", "HEAD")
    outcome = None
    executor_profile = reviewer_profile = None
    executor_rec = review_rec = None
    auto_committed = False
    gate_exit = None
    gate_duration_s = 0
    gate_timed_out = False
    gate_ran = False
    gate_log = out / f"{task_id}.gate.log"
    commit_log = attempt_root / "commit.log"
    attempts = []
    step = "executor"
    error = ""
    commit_result = "not_run"
    commit_duration_s = 0

    def run_attempt(profile, run_role, card, diff_range=None, attachments=None):
        attempt_number = len(attempts) + 1
        step_out = attempt_root / f"{attempt_number}-{run_role}-{profile}"
        default_stdout, default_stderr, _, _ = run_output_paths(
            step_out, task_id, attempt_number, reserve=False)
        # Include pending attempts as well: a pause/slot exhaustion/exception has paths.
        rec = {"profile": profile, "role": run_role, "failure": "interrupted", "duration_s": 0,
               "stdout": str(default_stdout),
               "stderr": str(default_stderr)}
        attempts.append(rec)
        started = time.monotonic()
        try:
            rec.update(execute_run(
                task_id=task_id, task=task, role=run_role, profile=profile,
                cwd=cwd, card=card, out=str(step_out), project=project,
                timeout=(a.review_timeout if a.review_timeout is not None else a.timeout)
                if run_role == "review" else a.timeout,
                wait_s=a.wait, confirmed=True, attempt=len(attempts),
                diff_range=diff_range, attachments=attachments,
                access_mode=a.access, host=a.host, idle_timeout=a.idle_timeout,
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

    try:
        check_paused()
        for profile in route:
            check_paused()
            executor_rec = run_attempt(profile, role, a.card)
            if executor_rec["failure"] in ("provider_limit", "slot_timeout", "input_too_large"):
                continue
            executor_profile = profile
            if executor_rec["failure"] != "none":
                outcome = "executor_failed"
            break
        else:
            outcome = "no_executor"
            error = "every executor route hit provider_limit: " + ", ".join(route) if all(
                rec["failure"] == "provider_limit" for rec in attempts) else "executor routes exhausted: " + ", ".join(
                    f"{rec['profile']} ({rec['failure']})" for rec in attempts)

        if outcome is None:
            step = "commit"
            check_paused()
            commit_t0 = time.monotonic()
            commit_result = "executor_committed"
            if executor_rec.get("dirty_after"):
                commit_result = "failed"
                with open(commit_log, "w") as cf:
                    for args in (("add", "-A"), ("commit", "-m", f"{task_id}: {task} (committed by the delegate runner)")):
                        result = subprocess.run(["git", "-C", cwd, *args], stdout=cf, stderr=subprocess.STDOUT)
                        if result.returncode != 0:
                            raise RuntimeError(f"commit {args[0]} failed (exit {result.returncode})")
                if git(cwd, "rev-parse", "HEAD").startswith(executor_rec["head"]) or tree_snapshot(cwd)[1]:
                    raise RuntimeError("commit failed to produce a clean committed tree")
                auto_committed = True
                commit_result = "auto_committed"
            current = tree_snapshot(cwd)
            if current[0] == base_commit and not current[1]:
                commit_result = "no_changes"
                outcome = "no_changes"
            commit_duration_s = round(time.monotonic() - commit_t0)

        if outcome is None:
            step = "gate"
            check_paused()
            t0_gate = time.monotonic()
            with open(gate_log, "w") as gf:
                gate_ran = True
                gate_process = subprocess.Popen(["bash", "--noprofile", "--norc", "-p", "-c", a.gate], cwd=cwd,
                                                stdout=gf, stderr=subprocess.STDOUT,
                                                start_new_session=True)
                try:
                    wait_for_exit(gate_process, a.timeout)
                except subprocess.TimeoutExpired:
                    gate_timed_out = True
                    error = "gate timed out"
                finally:
                    try:
                        stop_process(gate_process)
                        gate_exit = gate_process.returncode
                    finally:
                        gate_duration_s = round(time.monotonic() - t0_gate)
            if gate_exit != 0:
                outcome = "gate_failed"

        if outcome is None:
            step = "review"
            check_paused()
            gated_snapshot = tree_snapshot(cwd)
            review_card_copy = attempt_root / "review-card.md"
            review_card_copy.write_text(Path(a.review_card).read_text().replace("{{DIFF_RANGE}}", f"{base_commit}...HEAD"))
            executor_family = MODELS[executor_profile][2]
            skipped_reviewers = []
            for profile in review_route:
                check_paused()
                if MODELS[profile][2] == executor_family:
                    skipped_reviewers.append(profile)
                    continue
                review_rec = run_attempt(profile, "review", str(review_card_copy),
                                         diff_range=f"{base_commit}...{gated_snapshot[0]}",
                                         attachments=[a.card, *a.review_attach])
                # Quota classification retains its precedence, but writes are never safe to retry.
                if tree_snapshot(cwd) != gated_snapshot:
                    error = "review_wrote: tree changed after gate"
                    outcome = "no_reviewer"
                    break
                if review_rec["failure"] in ("provider_limit", "slot_timeout", "empty_output", "incomplete_review"):
                    continue
                if review_rec["failure"] == "none":
                    reviewer_profile = profile
                    outcome = "reviewed"
                else:
                    error = review_rec["failure"]
                    outcome = "no_reviewer"
                break
            if outcome is None:
                outcome = "no_reviewer"
                tried = [rec for rec in attempts if rec["role"] == "review"]
                if not tried:
                    error = "no reviewer outside the executor family"
                elif all(rec["failure"] == "provider_limit" for rec in tried):
                    error = "every reviewer route hit provider_limit: " + ", ".join(rec["profile"] for rec in tried)
                else:
                    error = "reviewer routes exhausted: " + ", ".join(
                        f"{rec['profile']} ({rec['failure']})" for rec in tried)
                if skipped_reviewers:
                    error += "; skipped executor family: " + ", ".join(skipped_reviewers)
    except (Exception, SystemExit, KeyboardInterrupt) as exc:
        error = exception_reason(exc)
        outcome = "paused" if isinstance(exc, PausedError) else (
            "no_reviewer" if step == "review" else "gate_failed" if step == "gate" else "executor_failed")

    findings = {"major": 0, "medium": 0, "minor": 0}
    finding_lines, total_line = [], ""
    review_file = None
    if outcome == "reviewed":
        review_file = review_rec.get("last_message") or review_rec["stdout"]
        for line in Path(review_file).read_text(errors="replace").splitlines():
            if re.match(r"^\W*R\d+\s*\|", line):
                finding_lines.append(line)
            match = re.search(r"TOTAL\s+major=(\d+)\s+medium=(\d+)\s+minor=(\d+)", line)
            if match:
                total_line = line.strip()
                findings = dict(zip(("major", "medium", "minor"), map(int, match.groups())))

    head = git(cwd, "rev-parse", "HEAD")
    details = attempt_root / "steps.json"
    details.write_text(json.dumps(attempts, ensure_ascii=False, indent=2))
    # Bound all free text to one physical line, then reserve room for findings and tail.
    def one_line(value):
        return " ".join(str(value).splitlines())

    lines = [f"# Pipeline {task_id}: {task} — {outcome}",
             f"- committed: {base_commit}..{head}; dirty: {bool(tree_snapshot(cwd)[1])}",
             f"- commit: {commit_result} | {commit_duration_s}s" +
             (f" | log: {commit_log}" if commit_log.is_file() else "")]
    if error:
        lines.append(f"- stopped at {step}: {error}")
    for rec in attempts:
        paths = " | ".join(f"{key}: {rec[key]}" for key in ("stdout", "stderr", "last_message")
                           if rec.get(key) and Path(rec[key]).is_file())
        lines.append(f"- {rec['role']}: {rec['profile']} | {rec['duration_s']}s | {rec['failure']} | {paths}")
    gate_result = f"timed out (exit {gate_exit})" if gate_timed_out else f"exit {gate_exit}" if gate_ran else "not run"
    lines.append(f"- gate: `{a.gate}` | {gate_result} | {gate_duration_s}s" +
                 (f" | log: {gate_log}" if gate_ran and gate_log.is_file() else ""))
    lines.append(f"- full step outputs: {details}")
    lines = [one_line(line) for line in lines]
    # Very long routes still have a complete machine-readable attempt manifest.
    if len(lines) > 39:
        # Preserve both winners, even with a long executor or reviewer quota route.
        decisive = [i for i, rec in enumerate(attempts)
                    if rec is executor_rec or rec is review_rec]
        prefix = 4 if error else 3
        keep = set(range(prefix)) | {prefix + i for i in decisive} | {len(lines) - 2, len(lines) - 1}
        for i in reversed(range(prefix, len(lines) - 2)):
            if len(keep) >= 38:
                break
            keep.add(i)
        lines = [line for i, line in enumerate(lines) if i in keep]
        lines.append(f"- additional steps omitted; full step outputs: {details}")
    if gate_ran and (gate_exit != 0 or gate_timed_out) and gate_log.is_file():
        lines += ["Gate log tail:"] + gate_log.read_text(errors="replace").splitlines()[-15:]
    if finding_lines or total_line:
        budget = max(0, 59 - len(lines) - 2)  # TOTAL and explicit overflow link
        lines.extend(finding_lines[:budget])
        if len(finding_lines) > budget:
            lines.append(f"- {len(finding_lines) - budget} findings omitted; full review: {review_file}")
        if total_line:
            lines.append(total_line)
    summary_text = "\n".join(lines) + "\n"
    summary_file = out / f"{task_id}.summary.md"
    summary_file.write_text(summary_text)
    print(summary_text, end="")
    pipeline_rec = {
        "kind": "pipeline", "id": task_id, "project": project, "outcome": outcome,
        "executor_profile": executor_profile, "reviewer_profile": reviewer_profile,
        "gate_exit": gate_exit, "gate_timed_out": gate_timed_out, "gate_duration_s": gate_duration_s,
        "auto_committed": auto_committed, "findings": findings,
        "duration_s": round(time.monotonic() - t0_pipeline), "base": base_commit, "head": head,
        "failed_step": step if outcome not in ("reviewed", "no_changes") else None,
        "error": error, "attempts": attempts, "summary": str(summary_file),
    }
    if a.host:
        pipeline_rec["host"] = a.host
    append(pipeline_rec)
    if outcome == "paused":
        print("delegate: paused", file=sys.stderr)
    sys.exit(0 if outcome == "reviewed" else 3 if outcome == "paused" else 1)


def cmd_pause(a):
    PAUSED.parent.mkdir(parents=True, exist_ok=True)
    PAUSED.write_text(a.reason or "")


def cmd_resume(a):
    PAUSED.unlink(missing_ok=True)


def cmd_status(a):
    if PAUSED.exists():
        print("paused")
    else:
        print("active")

    active = get_active_slots()
    active.sort(key=lambda item: item[1].get("started", ""))
    now_dt = now()
    for _, slot in active:
        sid = slot.get("id", "")
        project = slot.get("project", "")
        profile = slot.get("profile", "")
        role = slot.get("role", "")
        started_str = slot.get("started", "")
        mins = 0
        if started_str:
            try:
                started_dt = dt.datetime.fromisoformat(started_str)
                mins = max(0, int((now_dt - started_dt).total_seconds() // 60))
            except Exception:
                pass
        idle = ""
        try:
            quiet = (now_dt - dt.datetime.fromisoformat(slot.get("last_progress") or started_str)).total_seconds()
            idle = f" | idle {max(0, int(quiet // 60))}m"
        except Exception:
            pass
        print(f"{sid} | {project} | {profile} | {role} | {mins}m{idle}")

    if LOG.exists():
        limits = {}
        recent_runs = []
        for line in LOG.read_text().splitlines():
            try:
                r = json.loads(line)
            except Exception:
                continue
            if r.get("kind") != "run":
                continue
            recent_runs.append(r)
            if r.get("failure") == "provider_limit":
                ex = r.get("executor")
                started_str = r.get("completed") or r.get("started")
                if not ex or not started_str:
                    continue
                try:
                    s_dt = dt.datetime.fromisoformat(started_str)
                    if s_dt.tzinfo is None:
                        s_dt = s_dt.replace(tzinfo=dt.timezone.utc)
                    if not r.get("completed"):
                        s_dt += dt.timedelta(seconds=r.get("duration_s", 0))
                    age = (now_dt - s_dt).total_seconds()
                    if 0 <= age <= 6 * 3600:
                        if ex not in limits or s_dt > limits[ex][0]:
                            limits[ex] = (s_dt, r.get("stderr"))
                except Exception:
                    continue

        for ex in sorted(limits.keys()):
            s_dt, stderr_path = limits[ex]
            reset_text = ""
            if stderr_path:
                try:
                    stderr_content = Path(stderr_path).read_text(errors="replace")
                    m = re.search(r"(try again at [^\n\r.]+)", stderr_content, re.IGNORECASE)
                    if m:
                        reset_text = m.group(1).strip()
                except Exception:
                    pass
            if reset_text:
                print(f"{ex}: provider_limit ({reset_text})")
            else:
                print(f"{ex}: provider_limit at {s_dt.strftime('%H:%M:%S UTC')}")

        recent = recent_runs[-10:]
        found = sum((r.get("orphans") or {}).get("found") or 0 for r in recent)
        if found:
            killed = sum((r.get("orphans") or {}).get("killed") or 0 for r in recent)
            print(f"warning: recent runs left {found} orphan process(es) ({killed} killed); "
                  "see the `orphans` field of the run records")


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
        if executor == "opencode" and model != FLASH_MODEL:
            # `run` refuses the same override; show Flash and mark the entries
            # refused instead of advertising a model that will never launch.
            model, status = FLASH_MODEL, "refused"
        else:
            status = "found" if find_optional(executor) else "missing"
        remote_state = ""
        if host:
            if host_error:
                remote_state = f" | host={host} not-ready ({host_error})"
            else:
                fix = remote_ready(checks, host, executor)
                ready = "ready" if fix is None else f"not-ready ({fix})"
                remote_state = f" | host={host} {ready}"
        print(f"{name} | {executor} | {model} | {family} | {status}{remote_state}")
        cwd = str(Path.cwd())
        for label, role in (("implement, fix, mechanical, test", "implement"), ("review", "review")):
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


def main():
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
    ap = argparse.ArgumentParser(prog="delegate.py")
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("run")
    r.add_argument("--id", required=True); r.add_argument("--task", required=True)
    r.add_argument("--role", required=True, choices=ROLES)
    r.add_argument("--profile", choices=sorted([*MODELS, *ALIASES])); r.add_argument("--executor"); r.add_argument("--model")
    r.add_argument("--cwd", required=True); r.add_argument("--card", required=True)
    r.add_argument("--diff-range")
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
    r.set_defaults(f=cmd_run)

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
    pipe.set_defaults(f=cmd_pipeline)

    p_pause = sub.add_parser("pause")
    p_pause.add_argument("--reason")
    p_pause.set_defaults(f=cmd_pause)

    p_resume = sub.add_parser("resume")
    p_resume.set_defaults(f=cmd_resume)

    p_status = sub.add_parser("status")
    p_status.set_defaults(f=cmd_status)

    p_kill = sub.add_parser("kill")
    p_kill.add_argument("id")
    p_kill.set_defaults(f=cmd_kill)

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

    sub.add_parser("report").set_defaults(f=cmd_report)
    sub.add_parser("peak").set_defaults(f=lambda a: print("peak" if in_peak() else "off-peak"))
    p_profiles = sub.add_parser("profiles")
    p_profiles.add_argument("--host", help="also show which executors are ready on this host")
    p_profiles.set_defaults(f=cmd_profiles)

    p_clean = sub.add_parser("remote-clean")
    p_clean.add_argument("--host", required=True)
    p_clean.add_argument("--id")
    p_clean.add_argument("--cwd", default=".")
    p_clean.add_argument("--project")
    p_clean.add_argument("--wait", type=duration_arg, default=3600, help="seconds, or a number with a unit: 300, 300s, 90m, 2h")
    p_clean.add_argument("--timeout", type=duration_arg, default=600, help="seconds, or a number with a unit: 300, 300s, 90m, 2h")
    p_clean.set_defaults(f=cmd_remote_clean)

    def interrupted(signum, frame):
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGHUP, interrupted)
    a = ap.parse_args()
    if a.cmd in ("run", "pipeline"):
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
    try:
        a.f(a)
    except (PausedError, SlotTimeoutError) as exc:
        message = f"no free {exc.executor} slot (slot wait timed out)" if isinstance(exc, SlotTimeoutError) else str(exc)
        print(f"delegate: {message}", file=sys.stderr)
        sys.exit(3 if isinstance(exc, PausedError) else 4)


if __name__ == "__main__":
    main()
