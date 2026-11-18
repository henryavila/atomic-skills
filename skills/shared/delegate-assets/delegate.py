#!/usr/bin/env python3
"""delegate.py — run an external executor on a task card and keep the audit trail.

Subcommands:
  run     launch one executor (opencode/DeepSeek or agy) on a card, headless, with a
          hard timeout; capture output; append a `run` record with measured facts.
  record  append what only the orchestrator knows (host gate, review, rework) to the
          same task id.
  report  summarise the log (per executor/model: gate pass rate, review findings, time).
  peak    say whether now is inside the DeepSeek peak window.

The log is one JSONL file shared by every project and agent on this machine:
  ${ATOMIC_SKILLS_HOME:-~/.atomic-skills}/delegate/runs.jsonl
Records are append-only. Values are enums, never free text, so the log can be audited.
"""
import argparse, datetime as dt, json, os, shutil, signal, subprocess, sys, time
from pathlib import Path

HOME = Path(os.environ.get("ATOMIC_SKILLS_HOME", Path.home() / ".atomic-skills"))
LOG = HOME / "delegate" / "runs.jsonl"
# DeepSeek peak window, local wall clock of PEAK_TZ_OFFSET (hours from UTC).
PEAK_START = os.environ.get("DELEGATE_PEAK_START", "07:00")
PEAK_END = os.environ.get("DELEGATE_PEAK_END", "21:59")
PEAK_TZ_OFFSET = float(os.environ.get("DELEGATE_PEAK_TZ_OFFSET", "-3"))

MODELS = {
    "deepseek-pro": ("opencode", "opencode-go/deepseek-v4-pro"),
    "deepseek-light": ("opencode", "opencode-go/deepseek-v4.1-flash"),
    "agy": ("agy", "gemini-4-hydrogen-high"),
    "agy-review": ("agy", "gemini-4-hydrogen-xhigh"),
}
ROLES = ["implement", "fix", "review", "mechanical", "test"]
GATE = ["pass", "fail", "not_run"]
DELIVERED = ["yes", "partial", "no"]


def now():
    return dt.datetime.now(dt.timezone.utc)


def in_peak(t=None):
    t = (t or now()) + dt.timedelta(hours=PEAK_TZ_OFFSET)
    hhmm = t.strftime("%H:%M")
    return PEAK_START <= hhmm <= PEAK_END


def append(rec):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG, "a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def git(cwd, *a):
    r = subprocess.run(["git", "-C", cwd, *a], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def find(binary):
    p = shutil.which(binary)
    if p:
        return p
    for d in ("~/.npm-global/bin", "~/.local/bin", "~/.opencode/bin", "/opt/homebrew/bin"):
        c = Path(d).expanduser() / binary
        if c.exists():
            return str(c)
    sys.exit(f"delegate: `{binary}` not found; install it or add it to PATH")


def cmd_run(a):
    if a.profile:
        executor, model = MODELS[a.profile]
    else:
        executor, model = a.executor, a.model
    if not executor or not model:
        sys.exit("delegate: give --profile, or both --executor and --model")
    cwd = str(Path(a.cwd).resolve())
    card = Path(a.card).read_text()
    top = git(cwd, "rev-parse", "--show-toplevel") or cwd
    project = a.project or Path(top).name
    # Outside the repo by default: executor output never dirties the worktree.
    out = Path(a.out or HOME / "delegate" / "out" / project)
    out.mkdir(parents=True, exist_ok=True)
    stdout, stderr = out / f"{a.id}.out.md", out / f"{a.id}.err"
    if executor == "opencode":
        argv = [find("opencode"), "run", "--auto", "--archived", "-m", model, card]
    elif executor == "agy":
        argv = [find("agy"), "-p", card, "--model", model, "--output-format", "text"]
        argv += ["--mode", "plan"] if a.role == "review" else ["--dangerously-skip-permissions"]
    else:
        sys.exit(f"delegate: unknown executor {executor}")
    peak = in_peak()
    if peak and executor == "opencode" and not a.allow_peak:
        sys.exit(f"delegate: DeepSeek peak window ({PEAK_START}-{PEAK_END}, UTC{PEAK_TZ_OFFSET:+g}). "
                 "Wait, use agy, or pass --allow-peak after the user says so.")
    head0, t0 = git(cwd, "rev-parse", "HEAD"), time.time()
    started = now().isoformat(timespec="seconds")
    timed_out = False
    with open(stdout, "w") as so, open(stderr, "w") as se:
        p = subprocess.Popen(argv, cwd=cwd, stdout=so, stderr=se, stdin=subprocess.DEVNULL,
                             start_new_session=True)
        try:
            code = p.wait(timeout=a.timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(p.pid, signal.SIGTERM)
            try:
                code = p.wait(timeout=20)
            except subprocess.TimeoutExpired:
                os.killpg(p.pid, signal.SIGKILL)
                code = p.wait()
    head1 = git(cwd, "rev-parse", "HEAD")
    commits = git(cwd, "rev-list", "--count", f"{head0}..{head1}") if head0 and head1 else ""
    files = git(cwd, "diff", "--name-only", f"{head0}..{head1}") if head0 and head1 else ""
    rec = {
        "kind": "run", "id": a.id, "project": project,
        "task": a.task, "role": a.role, "executor": executor, "model": model,
        "user_confirmed": bool(a.confirmed), "started": started,
        "duration_s": round(time.time() - t0), "exit_code": code, "timed_out": timed_out,
        "peak": peak, "base": head0[:10], "head": head1[:10],
        "commits": int(commits) if commits.isdigit() else 0,
        "files_changed": len([f for f in files.splitlines() if f]),
        "dirty_after": bool(git(cwd, "status", "--porcelain")),
        "card": str(Path(a.card).resolve()), "stdout": str(stdout), "stderr": str(stderr),
        "attempt": a.attempt,
    }
    append(rec)
    print(json.dumps(rec, ensure_ascii=False, indent=1))
    sys.exit(0 if code == 0 and not timed_out else 1)


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
    runs, verdicts = {}, {}
    for line in LOG.read_text().splitlines():
        try:
            r = json.loads(line)
        except ValueError:
            continue
        (runs if r.get("kind") == "run" else verdicts).setdefault(r["id"], []).append(r)
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


def main():
    ap = argparse.ArgumentParser(prog="delegate.py")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--id", required=True); r.add_argument("--task", required=True)
    r.add_argument("--role", required=True, choices=ROLES)
    r.add_argument("--profile", choices=sorted(MODELS)); r.add_argument("--executor"); r.add_argument("--model")
    r.add_argument("--cwd", required=True); r.add_argument("--card", required=True)
    r.add_argument("--out"); r.add_argument("--project"); r.add_argument("--timeout", type=int, default=5400)
    r.add_argument("--attempt", type=int, default=1)
    r.add_argument("--confirmed", action="store_true", help="the user approved task/role/model/executor for this batch")
    r.add_argument("--allow-peak", action="store_true")
    r.set_defaults(f=cmd_run)
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
    a = ap.parse_args(); a.f(a)


if __name__ == "__main__":
    main()
