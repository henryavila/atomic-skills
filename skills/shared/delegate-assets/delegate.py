#!/usr/bin/env python3
"""delegate.py — run an external executor on a task card and keep the audit trail.

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

The log is one JSONL file shared by every project and agent on this machine:
  ${ATOMIC_SKILLS_HOME:-~/.atomic-skills}/delegate/runs.jsonl
Records are append-only. Values are enums, never free text, so the log can be audited.
"""
import argparse, datetime as dt, fcntl, hashlib, json, os, re, shutil, signal, subprocess, sys, time, tempfile
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
    "opencode": 2,
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
    r = subprocess.run(["git", "-C", cwd, *a], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def git_bytes(cwd, *a):
    r = subprocess.run(["git", "-C", cwd, *a], capture_output=True)
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


def build_argv(executor, model, role, cwd, card, last_msg):
    if executor == "opencode":
        return [find("opencode"), "run", "--auto", "--archived", "-m", model, card]
    if executor == "agy":
        return [find("agy"), "-p", card, "--model", model, "--output-format", "text",
                "--dangerously-skip-permissions"]
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
        if role != "review":
            common = git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir")
            if common:
                common_path = Path(common).resolve()
                try:
                    common_path.relative_to(Path(cwd))
                except ValueError:
                    argv += ["--add-dir", str(common_path)]
        return argv + ["-o", str(last_msg), "-"]
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


def wait_for_exit(process, timeout):
    """Observe exit without reaping: the zombie reserves PID/PGID until cleanup."""
    deadline = time.monotonic() + timeout
    while True:
        result = os.waitid(os.P_PID, process.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
        if result is not None:
            return
        if time.monotonic() >= deadline:
            raise subprocess.TimeoutExpired(process.args, timeout)
        time.sleep(0.02)


def stop_process(process):
    """Signal an unreaped child even if interrupted during ownership proof."""
    try:
        if process.returncode is None and not getattr(process, "_group_stopped", False):
            owned = True  # Popen owns this unreaped child until waitid says otherwise.
            try:
                try:
                    os.waitid(os.P_PID, process.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
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
    try:
        return Path(filename).read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        usage_error(f"cannot attach {filename}: {exc}")


def compose_prompt(card, attachments, diff_range, cwd):
    content = Path(card).read_text(encoding="utf-8")
    card_bytes = len(content.encode("utf-8"))
    attached, attached_bytes = [], 0
    for filename in attachments or []:
        path = Path(filename)
        attachment = read_attachment(filename)
        attached.append(path.name)
        attached_bytes += len(attachment.encode("utf-8"))
        content += f"\n## Attached: {path.name}\n" + fenced(attachment)
    diff_bytes = 0
    failure = None
    if diff_range:
        if not re.fullmatch(r"[^.\s-][^\s]*\.{2,3}[^.\s-][^\s]*", diff_range) or diff_range.startswith("-"):
            usage_error("--diff-range must be <base>...<head> or <base>..<head>")
        result = subprocess.run(["git", "-C", cwd, "diff", "--no-ext-diff", diff_range, "--"],
                                capture_output=True)
        if result.returncode:
            usage_error("cannot read --diff-range: " + result.stderr.decode("utf-8", errors="replace").strip())
        diff_bytes = len(result.stdout)
        diff = result.stdout.decode("utf-8", errors="replace")
        content += f"\n## Diff {diff_range}\n" + fenced(diff)
        if not diff_bytes:
            failure = "empty_diff"
    sizes = {"diff_bytes": diff_bytes, "attached": attached, "attached_bytes": attached_bytes,
             "card_bytes": card_bytes, "prompt_bytes": len(content.encode("utf-8"))}
    return content, sizes, failure


def execute_run(task_id, task, role, profile=None, executor=None, model=None, cwd=None,
                card=None, out=None, project=None, timeout=5400, wait_s=3600, attempt=1,
                confirmed=False, allow_peak=False, diff_range=None, attachments=None):
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
    if role == "review" and EXECUTOR_FLAGS.get(executor, {}).get("requires_review_diff") and not diff_range:
        usage_error(f"{executor} review requires --diff-range; it cannot run git or read outside the worktree")
    card_content, input_sizes, input_failure = compose_prompt(card, attachments, diff_range, cwd)
    if input_sizes["prompt_bytes"] > MAX_REVIEW_INPUT_BYTES:
        input_failure = "review_input_too_large"
    top = git(cwd, "rev-parse", "--show-toplevel") or cwd
    project = project or Path(top).name
    out_path = Path(out or HOME / "delegate" / "out" / project).resolve()
    out_path.mkdir(parents=True, exist_ok=True)
    stdout, stderr = out_path / f"{task_id}.out.md", out_path / f"{task_id}.err"
    last_msg = out_path / f"{task_id}.last.md"
    prompt = out_path / f"{task_id}.prompt.md"
    prompt.write_text(card_content, encoding="utf-8")
    # A refused input or a queue timeout has an audit record, but no child snapshot.
    pending = {
        "kind": "run", "id": task_id, "project": project, "task": task, "role": role,
        "executor": executor, "model": model, "family": family, "attempt": attempt,
        "user_confirmed": bool(confirmed), "duration_s": 0, "exit_code": None,
        "timed_out": False, "card": str(Path(card).resolve()), "prompt": str(prompt),
        "stdout": str(stdout), "stderr": str(stderr), **input_sizes,
    }
    if input_failure:
        pending.update(failure=input_failure, completed=now().isoformat(timespec="microseconds"))
        append(pending)
        return pending
    argv = build_argv(executor, model, role, cwd, card_content, last_msg)
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

    si = open(prompt, "rb") if executor == "codex" else None
    try:
        with open(stdout, "w") as so, open(stderr, "w") as se:
            while True:
                check_paused()
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
                        p = subprocess.Popen(
                            argv, cwd=cwd, stdout=so, stderr=se,
                            stdin=si if si is not None else subprocess.DEVNULL,
                            start_new_session=True,
                        )
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

            try:
                wait_for_exit(p, timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
                try:
                    os.killpg(p.pid, signal.SIGTERM)
                except (ProcessLookupError, PermissionError):
                    pass
                try:
                    wait_for_exit(p, 10)
                except subprocess.TimeoutExpired:
                    pass
    except SlotTimeoutError as exc:
        pending.update(failure="slot_timeout", wait_s=round(time.monotonic() - queued_at, 3),
                       completed=now().isoformat(timespec="microseconds"))
        append(pending)
        exc.record = pending
        raise
    finally:
        # Reap and removal are one locked transition: kill can trust the runner
        # identity while Darwin hides the unreaped zombie's start time.
        try:
            with SlotLock():
                try:
                    if p is not None:
                        stop_process(p)
                finally:
                    if slot_file and (p is None or p.returncode is not None):
                        slot_file.unlink(missing_ok=True)
                        slot_file.with_suffix(".tmp").unlink(missing_ok=True)
        finally:
            if si is not None:
                si.close()

    code = p.returncode

    snap1 = tree_snapshot(cwd)
    head1 = snap1[0]
    dirty_after = bool(snap1[1])
    review_wrote = role == "review" and snap1 != snap0
    review_output = (last_msg if executor == "codex" else stdout) if role == "review" else None
    failure = classify_failure(timed_out, code, stdout, stderr, review_wrote, review_output)
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
        "attempt": attempt, "prompt": str(prompt), **input_sizes,
    }
    if executor == "codex":
        rec["last_message"] = str(last_msg)
    append(rec)
    return rec


def cmd_run(a):
    rec = execute_run(
        task_id=a.id, task=a.task, role=a.role, profile=a.profile,
        executor=a.executor, model=a.model, cwd=a.cwd, card=a.card,
        out=a.out, project=a.project, timeout=a.timeout,
        wait_s=getattr(a, "wait", 3600), attempt=a.attempt,
        confirmed=a.confirmed, allow_peak=a.allow_peak, diff_range=a.diff_range, attachments=a.attach,
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
        step_out = attempt_root / f"{len(attempts) + 1}-{run_role}-{profile}"
        # Include pending attempts as well: a pause/slot exhaustion/exception has paths.
        rec = {"profile": profile, "role": run_role, "failure": "interrupted", "duration_s": 0,
               "stdout": str(step_out / f"{task_id}.out.md"),
               "stderr": str(step_out / f"{task_id}.err")}
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
            if executor_rec["failure"] in ("provider_limit", "slot_timeout"):
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
                gate_process = subprocess.Popen(["bash", "-lc", a.gate], cwd=cwd,
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
    append({
        "kind": "pipeline", "id": task_id, "project": project, "outcome": outcome,
        "executor_profile": executor_profile, "reviewer_profile": reviewer_profile,
        "gate_exit": gate_exit, "gate_timed_out": gate_timed_out, "gate_duration_s": gate_duration_s,
        "auto_committed": auto_committed, "findings": findings,
        "duration_s": round(time.monotonic() - t0_pipeline), "base": base_commit, "head": head,
        "failed_step": step if outcome not in ("reviewed", "no_changes") else None,
        "error": error, "attempts": attempts, "summary": str(summary_file),
    })
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
        print(f"{sid} | {project} | {profile} | {role} | {mins}m")

    if LOG.exists():
        limits = {}
        for line in LOG.read_text().splitlines():
            try:
                r = json.loads(line)
            except Exception:
                continue
            if r.get("kind") == "run" and r.get("failure") == "provider_limit":
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


def cmd_profiles(a):
    for name, (executor, model, family) in MODELS.items():
        if executor == "opencode" and model != FLASH_MODEL:
            # `run` refuses the same override; show Flash and mark the entries
            # refused instead of advertising a model that will never launch.
            model, status = FLASH_MODEL, "refused"
        else:
            status = "found" if find_optional(executor) else "missing"
        print(f"{name} | {executor} | {model} | {family} | {status}")


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
    r.add_argument("--out"); r.add_argument("--project"); r.add_argument("--timeout", type=int, default=5400)
    r.add_argument("--wait", type=int, default=3600)
    r.add_argument("--attempt", type=int, default=1)
    r.add_argument("--confirmed", action="store_true", help="the user approved task/role/model/executor for this batch")
    r.add_argument("--allow-peak", action="store_true")
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
    pipe.add_argument("--timeout", type=int, default=5400)
    pipe.add_argument("--review-timeout", type=int)
    pipe.add_argument("--wait", type=int, default=3600)
    pipe.add_argument("--out")
    pipe.add_argument("--project")
    pipe.add_argument("--confirmed", action="store_true", required=True)
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
    sub.add_parser("profiles").set_defaults(f=cmd_profiles)

    def interrupted(signum, frame):
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    a = ap.parse_args()
    try:
        a.f(a)
    except (PausedError, SlotTimeoutError) as exc:
        message = f"no free {exc.executor} slot (slot wait timed out)" if isinstance(exc, SlotTimeoutError) else str(exc)
        print(f"delegate: {message}", file=sys.stderr)
        sys.exit(3 if isinstance(exc, PausedError) else 4)


if __name__ == "__main__":
    main()
