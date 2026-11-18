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
import argparse, datetime as dt, fcntl, hashlib, json, os, re, shutil, signal, subprocess, sys, time
from pathlib import Path

HOME = Path(os.environ.get("ATOMIC_SKILLS_HOME", Path.home() / ".atomic-skills"))
LOG = HOME / "delegate" / "runs.jsonl"
RUNNING = HOME / "delegate" / "running"
PAUSED = HOME / "delegate" / "PAUSED"

# DeepSeek peak windows in UTC, Monday-Friday only.
DEFAULT_PEAK_WINDOWS = "01:00-04:00,06:00-10:00"
CODEX_MODEL = os.environ.get("DELEGATE_CODEX_MODEL") or "gpt-6.1-sol"
LIMIT_RE = re.compile(r"usage limit|rate limit|quota|too many requests|\b429\b", re.IGNORECASE)
TOTAL_RE = re.compile(r"^[ \t`*]*TOTAL major=\d+ medium=\d+ minor=\d+[ \t`*]*$")

MODELS = {
    "flash": ("opencode", "opencode-go/deepseek-v4.1-flash", "deepseek"),
    "glm-flash": ("opencode", "opencode-go/glm-5.3-flash", "zhipu"),
    "kimi": ("opencode", "opencode-go/kimi-k3.1-pro", "moonshot"),
    "hy4-review": ("opencode", "opencode-go/hy4", "tencent"),
    "codex": ("codex", CODEX_MODEL, "openai"),
    "codex-review": ("codex", CODEX_MODEL, "openai"),
    "agy": ("agy", "gemini-4-hydrogen-high", "gemini"),
    "agy-review": ("agy", "gemini-4-hydrogen-xhigh", "gemini"),
}
ALIASES = {
    "deepseek-light": "flash",
}
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


def clean_stale_slots():
    RUNNING.mkdir(parents=True, exist_ok=True)
    for p in list(RUNNING.glob("*.json")):
        try:
            data = json.loads(p.read_text())
            pid = data.get("pid")
            if not pid or not is_pid_alive(pid):
                p.unlink(missing_ok=True)
        except Exception:
            p.unlink(missing_ok=True)


def get_active_slots(executor=None):
    clean_stale_slots()
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


def check_paused():
    if PAUSED.exists():
        print("delegate: paused", file=sys.stderr)
        sys.exit(3)


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


def execute_run(task_id, task, role, profile=None, executor=None, model=None, cwd=None,
                card=None, out=None, project=None, timeout=5400, wait_s=3600, attempt=1,
                confirmed=False, allow_peak=False):
    check_paused()
    if profile in ALIASES:
        target = ALIASES[profile]
        print(f"delegate: profile {profile} is deprecated; use --profile {target}", file=sys.stderr)
        profile = target
    if profile:
        executor, model, family = MODELS[profile]
    else:
        family = None
    if not executor or not model:
        sys.exit("delegate: give --profile, or both --executor and --model")

    cwd = str(Path(cwd).resolve())
    card_content = Path(card).read_text()
    top = git(cwd, "rev-parse", "--show-toplevel") or cwd
    project = project or Path(top).name
    out_path = Path(out or HOME / "delegate" / "out" / project).resolve()
    out_path.mkdir(parents=True, exist_ok=True)
    stdout, stderr = out_path / f"{task_id}.out.md", out_path / f"{task_id}.err"
    last_msg = out_path / f"{task_id}.last.md"
    argv = build_argv(executor, model, role, cwd, card_content, last_msg)
    peak = in_peak() and family == "deepseek"
    if peak:
        print("delegate: DeepSeek peak window (UTC); DeepSeek costs double now — proceeding",
              file=sys.stderr)
    if executor == "codex":
        last_msg.unlink(missing_ok=True)

    snap0 = tree_snapshot(cwd)
    head0 = snap0[0]
    dirty_before = bool(snap0[1])

    # Slot acquisition with polling
    deadline = time.time() + wait_s
    max_slots = get_max_slots(executor)
    p = None
    slot_file = None
    started = now().isoformat(timespec="seconds")
    t0 = time.time()
    timed_out = False

    si = open(card, "rb") if executor == "codex" else None
    try:
        with open(stdout, "w") as so, open(stderr, "w") as se:
            while True:
                check_paused()
                with SlotLock():
                    active = get_active_slots(executor)
                    if len(active) < max_slots:
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
                            "pgid": os.getpgid(p.pid) if hasattr(os, "getpgid") else p.pid,
                            "started": started,
                        }
                        slot_file.write_text(json.dumps(slot_data, ensure_ascii=False))
                        break

                if time.time() >= deadline:
                    print(f"delegate: no free {executor} slot", file=sys.stderr)
                    sys.exit(4)
                remaining = deadline - time.time()
                time.sleep(min(5.0, max(0.05, remaining)))

            try:
                code = p.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
                try:
                    os.killpg(p.pid, signal.SIGTERM)
                except OSError:
                    pass
                try:
                    code = p.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(p.pid, signal.SIGKILL)
                    except OSError:
                        pass
                    code = p.wait()
    finally:
        if si is not None:
            si.close()
        if slot_file:
            slot_file.unlink(missing_ok=True)

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
        "duration_s": round(time.time() - t0), "exit_code": code, "timed_out": timed_out,
        "failure": failure,
        "peak": peak, "base": head0[:10], "head": head1[:10],
        "commits": int(commits) if commits.isdigit() else 0,
        "files_changed": len([f for f in files.splitlines() if f]),
        "dirty_before": dirty_before,
        "dirty_after": dirty_after,
        "uncommitted": uncommitted,
        "card": str(Path(card).resolve()), "stdout": str(stdout), "stderr": str(stderr),
        "attempt": attempt,
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
        confirmed=a.confirmed, allow_peak=a.allow_peak,
    )
    print(json.dumps(rec, ensure_ascii=False, indent=1))
    sys.exit(0 if rec["failure"] == "none" else 1)


def cmd_pipeline(a):
    if not a.confirmed:
        sys.exit("delegate: --confirmed required")
    check_paused()

    t0_pipeline = time.time()
    task_id = a.id
    task = a.task
    role = a.role
    cwd = str(Path(a.cwd).resolve())
    top = git(cwd, "rev-parse", "--show-toplevel") or cwd
    project = a.project or Path(top).name
    out = Path(a.out or HOME / "delegate" / "out" / project).resolve()
    out.mkdir(parents=True, exist_ok=True)
    card_path = str(Path(a.card).resolve())
    route = [p.strip() for p in a.route.split(",") if p.strip()]
    gate_cmd = a.gate
    review_card_path = str(Path(a.review_card).resolve())
    review_route = [p.strip() for p in a.review_route.split(",") if p.strip()]
    timeout = a.timeout
    review_timeout = a.review_timeout if a.review_timeout is not None else a.timeout
    wait_s = a.wait if a.wait is not None else 3600

    base_commit = git(cwd, "rev-parse", "HEAD")
    chosen_executor_profile = None
    executor_rec = None
    outcome = None
    all_quota = True

    # Step 1: Executor step
    for p_name in route:
        if is_paused():
            outcome = "paused"
            break
        exec_rec = execute_run(
            task_id=task_id, task=task, role=role, profile=p_name,
            cwd=cwd, card=card_path, out=str(out), project=project,
            timeout=timeout, wait_s=wait_s, confirmed=True,
        )
        if exec_rec["failure"] == "provider_limit":
            continue
        all_quota = False
        if exec_rec["failure"] == "none":
            chosen_executor_profile = p_name
            executor_rec = exec_rec
            break
        else:
            outcome = "executor_failed"
            chosen_executor_profile = p_name
            executor_rec = exec_rec
            break

    if outcome is None and chosen_executor_profile is None:
        outcome = "no_executor" if all_quota else "executor_failed"

    # Step 2: Commit step
    auto_committed = False
    if outcome is None:
        if executor_rec.get("uncommitted"):
            git(cwd, "add", "-A")
            git(cwd, "commit", "-m", f"{task_id}: {task} (committed by the delegate runner)")
            auto_committed = True

        current_head = git(cwd, "rev-parse", "HEAD")
        current_snap = tree_snapshot(cwd)
        if current_head == base_commit and not current_snap[1] and executor_rec.get("commits", 0) == 0:
            outcome = "no_changes"

    # Step 3: Gate step
    gate_exit = None
    gate_duration_s = 0
    gate_log_file = out / f"{task_id}.gate.log"
    if outcome is None:
        if is_paused():
            outcome = "paused"
        else:
            t0_gate = time.time()
            with open(gate_log_file, "w") as gf:
                p_gate = subprocess.run(
                    ["bash", "-lc", gate_cmd],
                    cwd=cwd,
                    stdout=gf,
                    stderr=subprocess.STDOUT,
                )
                gate_exit = p_gate.returncode
            gate_duration_s = round(time.time() - t0_gate)
            if gate_exit != 0:
                outcome = "gate_failed"

    # Step 4: Review step
    chosen_reviewer_profile = None
    review_rec = None
    if outcome is None:
        if is_paused():
            outcome = "paused"
        else:
            review_card_content = Path(review_card_path).read_text()
            diff_range = f"{base_commit}...HEAD"
            review_card_copy_content = review_card_content.replace("{{DIFF_RANGE}}", diff_range)
            review_card_copy = out / f"{task_id}.review-card.md"
            review_card_copy.write_text(review_card_copy_content)

            executor_family = MODELS.get(chosen_executor_profile, (None, None, None))[2]

            for r_name in review_route:
                if is_paused():
                    outcome = "paused"
                    break
                r_family = MODELS.get(r_name, (None, None, None))[2]
                if r_family == executor_family:
                    continue
                r_rec = execute_run(
                    task_id=task_id, task=task, role="review", profile=r_name,
                    cwd=cwd, card=str(review_card_copy), out=str(out), project=project,
                    timeout=review_timeout, wait_s=wait_s, confirmed=True,
                )
                if r_rec["failure"] in ("provider_limit", "empty_output", "incomplete_review"):
                    continue
                elif r_rec["failure"] == "none":
                    chosen_reviewer_profile = r_name
                    review_rec = r_rec
                    break
                else:
                    continue

            if outcome is None:
                if chosen_reviewer_profile is None:
                    outcome = "no_reviewer"
                else:
                    outcome = "reviewed"

    # Parse review findings
    findings = {"major": 0, "medium": 0, "minor": 0}
    finding_lines = []
    total_line = ""
    if outcome == "reviewed" and review_rec:
        rev_file = review_rec.get("last_message") or review_rec.get("stdout")
        try:
            rev_text = Path(rev_file).read_text(errors="replace")
            for l in rev_text.splitlines():
                if re.match(r"^\W*R\d+\s*\|", l):
                    finding_lines.append(l)
                m = re.search(r"TOTAL\s+major=(\d+)\s+medium=(\d+)\s+minor=(\d+)", l)
                if m:
                    total_line = l.strip()
                    findings = {
                        "major": int(m.group(1)),
                        "medium": int(m.group(2)),
                        "minor": int(m.group(3)),
                    }
        except Exception:
            pass

    # Summary
    summary_lines = []
    summary_lines.append(f"# Pipeline {task_id}: {task} — {outcome}")
    summary_lines.append("")
    summary_lines.append("## Steps")
    if executor_rec:
        res_str = "pass" if executor_rec["failure"] == "none" else executor_rec["failure"]
        summary_lines.append(f"- executor: {chosen_executor_profile} | {executor_rec['duration_s']}s | {res_str}")
    if gate_exit is not None:
        gres_str = "pass" if gate_exit == 0 else f"fail (exit {gate_exit})"
        summary_lines.append(f"- gate: `{gate_cmd}` | exit {gate_exit} | {gate_duration_s}s | {gres_str}")
    if review_rec:
        rres_str = "pass" if review_rec["failure"] == "none" else review_rec["failure"]
        summary_lines.append(f"- reviewer: {chosen_reviewer_profile} | {review_rec['duration_s']}s | {rres_str}")
    summary_lines.append("")

    if gate_exit is not None and gate_exit != 0:
        summary_lines.append("## Gate log tail")
        if gate_log_file.exists():
            log_lines = gate_log_file.read_text(errors="replace").splitlines()
            for l in log_lines[-15:]:
                summary_lines.append(l)
        summary_lines.append("")

    if finding_lines or total_line:
        summary_lines.append("## Review findings")
        for fl in finding_lines:
            summary_lines.append(fl)
        if total_line:
            summary_lines.append(total_line)
        summary_lines.append("")

    summary_lines.append("## Outputs")
    if executor_rec:
        summary_lines.append(f"- executor stdout: {executor_rec['stdout']}")
    if gate_exit is not None:
        summary_lines.append(f"- gate log: {gate_log_file}")
    if review_rec:
        summary_lines.append(f"- reviewer stdout: {review_rec['stdout']}")

    summary_text = "\n".join(summary_lines) + "\n"
    summary_file = out / f"{task_id}.summary.md"
    summary_file.write_text(summary_text)
    print(summary_text, end="")

    pipe_rec = {
        "kind": "pipeline",
        "id": task_id,
        "project": project,
        "outcome": outcome,
        "executor_profile": chosen_executor_profile,
        "reviewer_profile": chosen_reviewer_profile,
        "gate_exit": gate_exit,
        "auto_committed": auto_committed,
        "findings": findings,
        "duration_s": round(time.time() - t0_pipeline),
    }
    append(pipe_rec)

    if outcome == "reviewed":
        sys.exit(0)
    elif outcome == "paused":
        print("delegate: paused", file=sys.stderr)
        sys.exit(3)
    else:
        sys.exit(1)


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
                started_str = r.get("started")
                if not ex or not started_str:
                    continue
                try:
                    s_dt = dt.datetime.fromisoformat(started_str)
                    if s_dt.tzinfo is None:
                        s_dt = s_dt.replace(tzinfo=dt.timezone.utc)
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
    active_slots = get_active_slots()
    matching = [slot for (_, slot) in active_slots if slot.get("id") == target_id]
    if not matching:
        print(f"delegate: no running slot for {target_id}", file=sys.stderr)
        sys.exit(1)

    for slot in matching:
        pgid = slot.get("pgid") or slot.get("pid")
        try:
            os.killpg(pgid, signal.SIGTERM)
        except OSError:
            pass

    deadline = time.time() + 10.0
    while time.time() < deadline:
        alive = [s for s in matching if is_pid_alive(s.get("pid"))]
        if not alive:
            break
        time.sleep(0.05)

    for s in matching:
        if is_pid_alive(s.get("pid")):
            pgid = s.get("pgid") or s.get("pid")
            try:
                os.killpg(pgid, signal.SIGKILL)
            except OSError:
                pass
    clean_stale_slots()


def cmd_profiles(a):
    for name, (executor, model, family) in MODELS.items():
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
            runs.setdefault(r["id"], []).append(r)
        elif kind == "verdict":
            verdicts.setdefault(r["id"], []).append(r)
        elif kind == "pipeline":
            pair = (r.get("executor_profile"), r.get("reviewer_profile"))
            pipelines.setdefault(pair, []).append(r)

    groups = {}
    for i, rs in runs.items():
        first = rs[0]
        g = groups.setdefault((first["role"], first["executor"], first["model"]), [])
        g.append((rs, (verdicts.get(i) or [{}])[-1]))
    print(f"{len(runs)} tasks, {sum(len(v) for v in runs.values())} runs, log: {LOG}")
    for (role, ex, model), items in sorted(groups.items()):
        n = len(items)
        gated = [v for _, v in items if v.get("gate_host") in ("pass", "fail")]
        ok = sum(1 for v in gated if v["gate_host"] == "pass")
        rounds = [v.get("review_rounds") for _, v in items if v.get("review_rounds") is not None]
        major = sum(v.get("findings_major") or 0 for _, v in items)
        secs = sorted(r["duration_s"] for rs, _ in items for r in rs)
        med = secs[len(secs) // 2] if secs else 0
        fails = sum(1 for rs, _ in items for r in rs if r["exit_code"] != 0 or r["timed_out"])
        unconfirmed = sum(1 for rs, _ in items if not rs[0].get("user_confirmed"))
        rr = f"{sum(rounds) / len(rounds):.1f}" if rounds else "n/a"
        print(f"- {role} | {ex} | {model}: n={n}; host gate {ok}/{len(gated)} (no verdict: {n - len(gated)}); "
              f"review rounds avg {rr}; major findings {major}; median {med}s; failed runs {fails}; "
              f"unconfirmed {unconfirmed}")

    for (ex_prof, rev_prof), items in sorted(pipelines.items()):
        n = len(items)
        outcomes = {}
        for p in items:
            o = p.get("outcome", "unknown")
            outcomes[o] = outcomes.get(o, 0) + 1
        outcomes_str = ", ".join(f"{k} {v}" for k, v in sorted(outcomes.items()))
        print(f"- pipeline | {ex_prof} -> {rev_prof}: n={n}; {outcomes_str}")


def main():
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

    a = ap.parse_args(); a.f(a)


if __name__ == "__main__":
    main()
