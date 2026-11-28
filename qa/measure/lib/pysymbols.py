"""Function symbols and line helpers shared by the Python measurers.

Standard library only, Python 3.9 compatible.

A symbol is the qualified name of a function in its file:

  - ``Class.method`` for a method;
  - ``outer>inner`` for a function nested in a function;
  - ``outer>Class.method`` when the class is defined inside a function;
  - ``#2``, ``#3`` after a symbol that already appeared in the same file, in
    source order.

The walk is a pre-order traversal, so entries come out in source order.
"""

import ast
import io
import tokenize

FUNCTION_TYPES = (ast.FunctionDef, ast.AsyncFunctionDef)
SCOPE_TYPES = FUNCTION_TYPES + (ast.Lambda, ast.ClassDef)


def collect_functions(tree):
    """Entries with ``symbol``, ``node``, ``start`` and ``end`` in source order."""
    entries = []
    seen = {}

    def unique(base):
        count = seen.get(base, 0) + 1
        seen[base] = count
        return base if count == 1 else "%s#%d" % (base, count)

    def walk(node, fn_symbol, class_symbol):
        if isinstance(node, ast.ClassDef):
            prefix = fn_symbol or class_symbol
            class_name = "%s>%s" % (prefix, node.name) if prefix else node.name
            for child in ast.iter_child_nodes(node):
                walk(child, fn_symbol, class_name)
            return
        if isinstance(node, FUNCTION_TYPES):
            name = node.name
            if class_symbol:
                base = "%s.%s" % (class_symbol, name)
            elif fn_symbol:
                base = "%s>%s" % (fn_symbol, name)
            else:
                base = name
            symbol = unique(base)
            entries.append(
                {
                    "symbol": symbol,
                    "node": node,
                    "start": node.lineno,
                    "end": node.end_lineno,
                }
            )
            for child in ast.iter_child_nodes(node):
                walk(child, symbol, None)
            return
        for child in ast.iter_child_nodes(node):
            walk(child, fn_symbol, class_symbol)

    walk(tree, None, None)
    return entries


def function_at_start(entries, line):
    """The function whose ``def`` line is exactly ``line``."""
    for entry in entries:
        if entry["start"] == line:
            return entry
    return None


def function_at_line(entries, line):
    """The innermost function that contains ``line``, or None."""
    best = None
    for entry in entries:
        if entry["start"] <= line <= entry["end"]:
            if best is None or entry["start"] > best["start"]:
                best = entry
    return best


def symbol_at_line(entries, line):
    """The innermost function symbol at ``line``, or ``<module>``."""
    entry = function_at_line(entries, line)
    return entry["symbol"] if entry else "<module>"


def comment_only_lines(source):
    """Physical line numbers whose only content is a comment."""
    lines = set()
    try:
        tokens = tokenize.generate_tokens(io.StringIO(source).readline)
        for token in tokens:
            if token.type == tokenize.COMMENT:
                if not token.line[: token.start[1]].strip():
                    lines.add(token.start[0])
    except (tokenize.TokenError, IndentationError):
        # ast.parse already accepted the source; keep the lines found so far.
        pass
    return lines


def function_lines(source_lines, node, comments):
    """Lines from the ``def`` line to the last line, without blank/comment lines."""
    count = 0
    for number in range(node.lineno, node.end_lineno + 1):
        text = source_lines[number - 1]
        if not text.strip():
            continue
        if number in comments:
            continue
        count += 1
    return count


def parameter_count(node):
    """Positional, keyword-only, ``*args`` and ``**kwargs``, minus self/cls."""
    args = node.args
    names = list(getattr(args, "posonlyargs", [])) + list(args.args) + list(args.kwonlyargs)
    count = len([item for item in names if item.arg not in ("self", "cls")])
    if args.vararg and args.vararg.arg not in ("self", "cls"):
        count += 1
    if args.kwarg and args.kwarg.arg not in ("self", "cls"):
        count += 1
    return count
