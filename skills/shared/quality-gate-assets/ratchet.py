#!/usr/bin/env python3
"""Per-item debt ratchet for a code-quality gate. Standard library only.

A measurer prints one line per item above its ceiling:

    <stack> TAB <metric> TAB <key> TAB <value>

The key is `<path from the repository root>::<symbol>` (`::*` for a whole
file). It never carries a line number, so editing above an item does not
rename it.

Files under --root (default `qa`); every file but the debt files has a
header line:

    stacks.tsv      stack, language, roots, generated, tests, group
    ceilings.tsv    metric, ceiling, applies_to (languages, comma separated)
    dimensions.tsv  dimension, metric
    exceptions.tsv  stack, metric, key, limit, reason
    moves.tsv       metric, from, to, value            (written by `move`)
    debt/<stack>.<metric>.tsv   key, value             (sorted, no header)

A stack is frozen once it has at least one debt file. Before that the
ratchet reports and does not fail.

`check` and `lower` treat every stack and metric in their scope as fully
measured: a recorded item missing from the measures counts as paid. Pass
--stack and --metric whenever the measures cover only part of the
repository, or `lower` deletes debt nobody measured.

Exit codes: 0 pass, 1 ratchet failure, 2 usage or configuration error.
Code 3 is left for measurers ("tool not available").
"""

import argparse
import os
import sys
from collections import defaultdict

HEADERS = {
    "stacks.tsv": "stack",
    "ceilings.tsv": "metric",
    "dimensions.tsv": "dimension",
    "exceptions.tsv": "stack",
    "moves.tsv": "metric",
}


class UsageError(Exception):
    """A wrong argument or a malformed file: exit code 2."""


# ---------------------------------------------------------------- files


def read_rows(path, columns):
    """Rows of a TSV file, each padded to `columns`. A missing file is []."""
    if not os.path.isfile(path):
        return []
    header = HEADERS.get(os.path.basename(path))
    rows = []
    with open(path, encoding="utf-8") as handle:
        for number, line in enumerate(handle, 1):
            line = line.rstrip("\n").rstrip("\r")
            if not line.strip() or line.startswith("#"):
                continue
            fields = line.split("\t")
            if number == 1 and header and fields[0] == header:
                continue
            if len(fields) > columns:
                raise UsageError(f"{path}:{number}: more than {columns} columns")
            rows.append(fields + [""] * (columns - len(fields)))
    return rows


def parse_value(text, where):
    try:
        return float(text)
    except ValueError:
        raise UsageError(f"{where}: not a number: {text!r}") from None


def format_value(value):
    return str(int(value)) if float(value).is_integer() else repr(float(value))


def read_debt(path):
    """key -> value. A missing file is {}."""
    return {key: parse_value(value, path) for key, value in read_rows(path, 2)}


def write_debt(path, items):
    """Sorted by key, one item per line, integers without `.0`."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    body = "".join(f"{key}\t{format_value(items[key])}\n" for key in sorted(items))
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(body)


class Root:
    """One ratchet directory: its configuration and its debt files."""

    def __init__(self, path):
        self.path = path
        self.stacks = {}
        for name, language, roots, _generated, _tests, group in read_rows(self.file("stacks.tsv"), 6):
            if "." in name or "/" in name:
                raise UsageError(f"stack name with '.' or '/': {name!r}")
            self.stacks[name] = {
                "language": language,
                "roots": [r.strip().rstrip("/") for r in roots.split(",") if r.strip() not in ("", "-")],
                "group": group if group not in ("", "-") else None,
            }
        self.ceilings = {}
        for metric, ceiling, applies_to in read_rows(self.file("ceilings.tsv"), 3):
            languages = {x.strip() for x in applies_to.split(",") if x.strip()}
            self.ceilings[metric] = {"ceiling": ceiling.strip(), "languages": languages}
        self.dimensions = defaultdict(list)
        for dimension, metric in read_rows(self.file("dimensions.tsv"), 2):
            self.dimensions[dimension].append(metric)

    def file(self, name):
        return os.path.join(self.path, name)

    def debt_path(self, stack, metric):
        return os.path.join(self.path, "debt", f"{stack}.{metric}.tsv")

    def debt_files(self):
        """(stack, metric) of every debt file on disk."""
        folder = os.path.join(self.path, "debt")
        found = []
        if os.path.isdir(folder):
            for name in sorted(os.listdir(folder)):
                if name.endswith(".tsv") and "." in name[:-4]:
                    stack, metric = name[:-4].split(".", 1)
                    found.append((stack, metric))
        return found

    def frozen(self, stack):
        return any(found == stack for found, _metric in self.debt_files())

    def applies(self, metric, stack):
        entry = self.ceilings.get(metric)
        info = self.stacks.get(stack)
        return bool(entry and info and info["language"] in entry["languages"])

    def exceptions(self):
        """[(stack, metric, key, limit, reason)]"""
        rows = []
        for stack, metric, key, limit, reason in read_rows(self.file("exceptions.tsv"), 5):
            rows.append((stack, metric, key, parse_value(limit, self.file("exceptions.tsv")), reason.strip()))
        return rows

    def moves(self):
        """[(metric, from, to, value)]"""
        path = self.file("moves.tsv")
        return [(m, f, t, parse_value(v, path)) for m, f, t, v in read_rows(path, 4)]

    def stack_of_key(self, key):
        """The stack whose root holds the path of `key`; the longest root wins."""
        path = key.split("::", 1)[0]
        best, best_length = None, -1
        for name, info in self.stacks.items():
            for root in info["roots"]:
                if (path == root or path.startswith(root + "/")) and len(root) > best_length:
                    best, best_length = name, len(root)
        return best


def read_measures(paths, root):
    """(stack, metric) -> {key: value}, from files or `-` for stdin."""
    measured: dict[tuple[str, str], dict[str, float]] = defaultdict(dict)
    for path in paths:
        if path == "-":
            lines = sys.stdin.read().splitlines()
        else:
            if not os.path.isfile(path):
                raise UsageError(f"measures file not found: {path}")
            with open(path, encoding="utf-8") as handle:
                lines = handle.read().splitlines()
        for number, line in enumerate(lines, 1):
            if not line.strip() or line.startswith("#"):
                continue
            fields = line.split("\t")
            if len(fields) != 4:
                raise UsageError(f"{path}:{number}: expected stack, metric, key, value")
            stack, metric, key, value = fields
            if stack not in root.stacks:
                raise UsageError(f"{path}:{number}: unknown stack {stack!r}")
            value = parse_value(value, f"{path}:{number}")
            items = measured[(stack, metric)]
            items[key] = max(value, items.get(key, value))
    return measured


def scope(root, args):
    """The (stack, metric) pairs a command covers, in a stable order."""
    stacks = args.stack or sorted(root.stacks)
    for stack in stacks:
        if stack not in root.stacks:
            raise UsageError(f"unknown stack {stack!r}")
    metrics = args.metric or sorted(root.ceilings)
    for metric in metrics:
        if metric not in root.ceilings:
            raise UsageError(f"unknown metric {metric!r}")
    return [(s, m) for s in stacks for m in metrics if root.applies(m, s)]


def plural(count):
    return f"{count} item" + ("" if count == 1 else "s")


# ------------------------------------------------------------- commands


def check_exceptions(root, maximum, stacks=None):
    """More exceptions than the limit in a stack, or one without a reason."""
    failures = []
    per_stack: dict[str, int] = defaultdict(int)
    for stack, metric, key, _limit, reason in root.exceptions():
        if stacks is not None and stack not in stacks:
            continue
        per_stack[stack] += 1
        if not reason:
            failures.append(f"FAIL\t{stack}.{metric}\t{key}\texception without a reason")
    for stack in sorted(per_stack):
        if per_stack[stack] > maximum:
            failures.append(f"FAIL\t{stack}\t-\tmore than {maximum} exceptions in {stack}")
    return failures


def check_pair(measured, debt, limits):
    """Failures and the number of recorded items that can be lowered."""
    failures = []
    for key in sorted(measured):
        value = measured[key]
        if key in limits:
            if value > limits[key]:
                failures.append((key, "exception-exceeded", value, limits[key]))
        elif key in debt:
            if value > debt[key]:
                failures.append((key, "worse", value, debt[key]))
        else:
            failures.append((key, "new", value, None))
    lowerable = sum(1 for key, recorded in debt.items() if key not in measured or measured[key] < recorded)
    return failures, lowerable


def lower_pair(measured, debt):
    """Only keys still measured, at min(recorded, measured). Never adds, never raises."""
    return {key: min(recorded, measured[key]) for key, recorded in debt.items() if key in measured}


def cmd_check(root, args):
    measured = read_measures(args.measures, root)
    limits: dict[tuple[str, str], dict[str, float]] = defaultdict(dict)
    for stack, metric, key, limit, _reason in root.exceptions():
        limits[(stack, metric)][key] = limit
    pairs = scope(root, args)
    stacks = {stack for stack, _metric in pairs} | set(args.stack or [])
    lines = check_exceptions(root, args.max_exceptions, stacks)
    unfrozen: dict[str, int] = defaultdict(int)
    lowerable = 0
    for stack, metric in pairs:
        items = measured.get((stack, metric), {})
        if not root.frozen(stack):
            unfrozen[stack] += len(items)
            continue
        failures, can_lower = check_pair(items, read_debt(root.debt_path(stack, metric)), limits[(stack, metric)])
        lowerable += can_lower
        for key, reason, value, recorded in failures:
            shown = "-" if recorded is None else format_value(recorded)
            lines.append(f"FAIL\t{stack}.{metric}\t{key}\t{reason}\t{format_value(value)}\t{shown}")
    for stack in sorted(unfrozen):
        print(f"not frozen: {stack} ({plural(unfrozen[stack])} above the ceiling)")
    if lowerable:
        print(f"can lower: {plural(lowerable)} (run `lower` with the same measures and scope)")
    for line in lines:
        print(line)
    return 1 if lines else 0


def cmd_lower(root, args):
    measured = read_measures(args.measures, root)
    changed = 0
    for stack, metric in scope(root, args):
        path = root.debt_path(stack, metric)
        if not os.path.isfile(path):
            continue
        debt = read_debt(path)
        lowered = lower_pair(measured.get((stack, metric), {}), debt)
        if lowered != debt:
            write_debt(path, lowered)
            changed += 1
            print(f"lowered: {path} ({len(debt)} -> {len(lowered)} lines)")
    if not changed:
        print("nothing to lower")
    return 0


def cmd_freeze(root, args):
    measured = read_measures(args.measures, root)
    excepted = {(s, m, k) for s, m, k, _limit, _reason in root.exceptions()}
    for stack, metric in scope(root, args):
        path = root.debt_path(stack, metric)
        if os.path.exists(path):
            print(f"already frozen: {path}")
            continue
        items = {k: v for k, v in measured.get((stack, metric), {}).items() if (stack, metric, k) not in excepted}
        write_debt(path, items)
        print(f"frozen: {path} ({plural(len(items))})")
    return 0


def all_debt(root):
    """(stack, metric) -> {key: value} for every debt file on disk."""
    return {pair: read_debt(root.debt_path(*pair)) for pair in root.debt_files()}


def by_metric(debt):
    """metric -> {key: value} across every stack."""
    merged: dict[str, dict[str, float]] = defaultdict(dict)
    for (_stack, metric), items in debt.items():
        merged[metric].update(items)
    return merged


def new_moves(base_moves, head_moves):
    """Moves present in the head and not in the base, as a multiset difference."""
    remaining = list(base_moves)
    added = []
    for move in head_moves:
        if move in remaining:
            remaining.remove(move)
        else:
            added.append(move)
    return added


def judge_moves(moves, base_debt, head_debt, allowed):
    """Approved destinations and the failures of the moves themselves.

    Returns ({(metric, to): value}, [(metric, key, reason)], {(metric, key)}).
    The last set holds every destination a failure already covers, so the
    line-by-line pass does not report it twice.
    """
    approved: dict[tuple[str, str], float] = {}
    failures: list[tuple[str, str, str]] = []
    covered: set[tuple[str, str]] = set()
    if not allowed:
        return approved, failures, covered
    base, head = by_metric(base_debt), by_metric(head_debt)
    groups = defaultdict(list)
    for metric, origin, target, value in moves:
        groups[(metric, origin)].append((target, value))
    for (metric, origin), targets in sorted(groups.items()):
        keys = [target for target, _value in targets]
        if origin not in base[metric] or origin in head[metric]:
            for key in keys:
                failures.append((metric, key, "new debt line"))
                covered.add((metric, key))
            continue
        taken = [key for key in keys if key in base[metric]]
        if taken:
            for key in taken:
                failures.append((metric, key, "new debt line"))
            covered.update((metric, key) for key in keys)
            continue
        if sum(value for _target, value in targets) > base[metric][origin]:
            failures.append((metric, origin, "debt value raised"))
            covered.update((metric, key) for key in keys)
            continue
        for target, value in targets:
            approved[(metric, target)] = value
    return approved, failures, covered


def new_file_accepted(base, head, stack, metric, branch, freeze_prefix):
    """A debt file absent from the base is the first freeze of its stack, or a
    metric that starts to apply to the language of a stack already frozen."""
    if stack not in head.stacks:
        return False
    if not base.frozen(stack):
        if not branch.startswith(freeze_prefix):
            return False
        name = branch[len(freeze_prefix):]
        return name in (stack, head.stacks[stack]["group"])
    language = head.stacks[stack]["language"]
    before = base.ceilings.get(metric, {"languages": set()})["languages"]
    after = head.ceilings.get(metric, {"languages": set()})["languages"]
    return language in after and language not in before


def cmd_diff(root, args):
    if not os.path.isdir(args.base):
        raise UsageError(f"base directory not found: {args.base}")
    base = Root(args.base)
    base_debt, head_debt = all_debt(base), all_debt(root)
    lines = []

    for metric in sorted(root.ceilings):
        old, new = base.ceilings.get(metric), root.ceilings[metric]
        if not old:
            continue
        try:
            raised = float(new["ceiling"]) > float(old["ceiling"])
        except ValueError:
            raised = False
        if raised:
            lines.append(f"FAIL\t{metric}\t-\tceiling raised\t{new['ceiling']}\t{old['ceiling']}")

    allowed = args.branch.startswith(args.move_prefix)
    added = new_moves(base.moves(), root.moves())
    approved, move_failures, covered = judge_moves(added, base_debt, head_debt, allowed)
    stack_of = {}
    for (stack, metric), items in head_debt.items():
        for key in items:
            stack_of[(metric, key)] = stack
    for metric, key, reason in move_failures:
        stack = stack_of.get((metric, key)) or root.stack_of_key(key) or "-"
        lines.append(f"FAIL\t{stack}.{metric}\t{key}\t{reason}")

    for (stack, metric), items in sorted(head_debt.items()):
        label = f"{stack}.{metric}"
        if (stack, metric) not in base_debt:
            if new_file_accepted(base, root, stack, metric, args.branch, args.freeze_prefix):
                continue
            if not items:
                lines.append(f"FAIL\t{label}\t-\tnew debt file")
            before = {}
        else:
            before = base_debt[(stack, metric)]
        for key in sorted(items):
            value = items[key]
            if (metric, key) in covered:
                continue
            if key in before:
                if value > before[key]:
                    lines.append(
                        f"FAIL\t{label}\t{key}\tdebt value raised\t{format_value(value)}\t{format_value(before[key])}"
                    )
            elif (metric, key) in approved:
                if value > approved[(metric, key)]:
                    lines.append(
                        f"FAIL\t{label}\t{key}\tdebt value raised\t{format_value(value)}"
                        f"\t{format_value(approved[(metric, key)])}"
                    )
            else:
                lines.append(f"FAIL\t{label}\t{key}\tnew debt line\t{format_value(value)}")

    known = {(s, m, k) for s, m, k, _limit, _reason in base.exceptions()}
    for stack, metric, key, limit, reason in root.exceptions():
        if (stack, metric, key) not in known:
            print(f"new exception: {stack}.{metric}\t{key}\t{format_value(limit)}\t{reason}")
    for line in lines:
        print(line)
    return 1 if lines else 0


def cmd_move(root, args):
    metric = args.metric
    origin_stack = None
    for stack, found in root.debt_files():
        if found == metric and args.origin in read_debt(root.debt_path(stack, found)):
            origin_stack = stack
            break
    if origin_stack is None:
        raise UsageError(f"{args.origin} is not in the debt of {metric}")
    original = read_debt(root.debt_path(origin_stack, metric))[args.origin]

    targets = []
    for item in args.to:
        key, separator, value = item.rpartition("=")
        if not separator or not key:
            raise UsageError(f"--to expects <key>=<value>, got {item!r}")
        targets.append((key, parse_value(value, "--to")))
    if len({key for key, _value in targets}) != len(targets):
        raise UsageError("the same destination appears twice")
    total = sum(value for _key, value in targets)
    if total > original:
        raise UsageError(f"the destinations add up to {format_value(total)}, above the origin {format_value(original)}")

    existing = by_metric(all_debt(root))[metric]
    placed = []
    for key, value in targets:
        if key in existing:
            raise UsageError(f"{key} is already in the debt of {metric}")
        stack = root.stack_of_key(key)
        if stack is None:
            raise UsageError(f"no stack in stacks.tsv holds {key}")
        if not root.frozen(stack):
            raise UsageError(f"stack {stack} is not frozen; freeze it before moving debt into it")
        placed.append((stack, key, value))

    files: dict[str, dict[str, float]] = defaultdict(dict)
    files[origin_stack] = read_debt(root.debt_path(origin_stack, metric))
    del files[origin_stack][args.origin]
    for stack, key, value in placed:
        if stack not in files:
            files[stack] = read_debt(root.debt_path(stack, metric))
        files[stack][key] = value
    for stack, items in files.items():
        write_debt(root.debt_path(stack, metric), items)

    path = root.file("moves.tsv")
    fresh = not os.path.isfile(path)
    with open(path, "a", encoding="utf-8") as handle:
        if fresh:
            handle.write("metric\tfrom\tto\tvalue\n")
        for _stack, key, value in placed:
            handle.write(f"{metric}\t{args.origin}\t{key}\t{format_value(value)}\n")
    for stack, key, value in placed:
        print(f"moved: {metric}\t{args.origin} -> {key} ({stack}, {format_value(value)})")
    return 0


def cmd_status(root, args):
    """One line per stack and dimension: strong, debt N, not frozen, no measurer."""
    lines = check_exceptions(root, args.max_exceptions)
    weak = False
    debt = all_debt(root)
    for stack in sorted(root.stacks):
        frozen = root.frozen(stack)
        for dimension in sorted(root.dimensions):
            metrics = [m for m in root.dimensions[dimension] if root.applies(m, stack)]
            if not metrics:
                state = "no measurer"
            elif not frozen:
                state = "not frozen"
            else:
                owed = sum(len(debt.get((stack, metric), {})) for metric in metrics)
                missing = [m for m in metrics if (stack, m) not in debt]
                if missing:
                    state = "not frozen: " + ",".join(missing)
                else:
                    state = f"debt {owed}" if owed else "strong"
            weak = weak or state != "strong"
            print(f"{stack}\t{dimension}\t{state}")
    for line in lines:
        print(line)
    return 1 if weak or lines else 0


# ------------------------------------------------------------------ cli


def build_parser():
    parser = argparse.ArgumentParser(prog="ratchet.py", description=__doc__.split("\n\n")[0])
    parser.add_argument("--root", default="qa", help="ratchet directory (default: qa)")
    commands = parser.add_subparsers(dest="command", required=True)

    def scoped(name, text, measures=True, stack_required=False):
        sub = commands.add_parser(name, help=text)
        if measures:
            sub.add_argument("--measures", nargs="+", required=True, metavar="FILE", help="measure files, or - for stdin")
        sub.add_argument("--stack", nargs="+", required=stack_required, help="stacks the measures cover")
        sub.add_argument("--metric", nargs="+", help="metrics the measures cover (default: all)")
        return sub

    check = scoped("check", "fail on a new item, a worse item or an exceeded exception")
    check.add_argument("--max-exceptions", type=int, default=10)
    scoped("lower", "rewrite the debt files with what was paid")
    scoped("freeze", "write the first debt files of a stack", stack_required=True)

    diff = commands.add_parser("diff", help="fail when the debt files grew against a base")
    diff.add_argument("--base", required=True, help="the ratchet directory as it is in the base revision")
    diff.add_argument("--branch", required=True, help="name of the branch under review")
    diff.add_argument("--move-prefix", default="qa/", help="branches that may move debt (default: qa/)")
    diff.add_argument("--freeze-prefix", default="qa/freeze-", help="branches that may freeze a stack")

    move = commands.add_parser("move", help="carry the debt of moved code to its new key")
    move.add_argument("--metric", required=True)
    move.add_argument("--from", dest="origin", required=True, metavar="KEY")
    move.add_argument("--to", nargs="+", required=True, metavar="KEY=VALUE")

    status = commands.add_parser("status", help="each stack and dimension: strong or what is missing")
    status.add_argument("--max-exceptions", type=int, default=10)
    return parser


COMMANDS = {
    "check": cmd_check,
    "lower": cmd_lower,
    "freeze": cmd_freeze,
    "diff": cmd_diff,
    "move": cmd_move,
    "status": cmd_status,
}


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        if not os.path.isdir(args.root):
            raise UsageError(f"ratchet directory not found: {args.root}")
        return COMMANDS[args.command](Root(args.root), args)
    except UsageError as error:
        print(f"ratchet: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
