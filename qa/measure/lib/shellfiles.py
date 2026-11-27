"""Select shell sources for the ``sh`` measurers.

In a git work tree a shell file is a tracked path under the ``sh`` roots;
untracked and ignored files are never measured. When the measured root is not
a git work tree (test fixtures), every file under the roots is a shell file
except the husky-generated ``.husky/_/`` directory.
"""

import os
import subprocess

SKIP_DIRECTORIES = {"__pycache__", "node_modules", ".git"}


def fail(message):
    raise RuntimeError(message)


def git_work_tree(root):
    try:
        result = subprocess.run(
            ["git", "-C", root, "rev-parse", "--is-inside-work-tree"],
            capture_output=True,
            text=True,
        )
    except OSError:
        return False
    return result.returncode == 0 and result.stdout.strip() == "true"


def tracked(root, roots):
    """Tracked paths under ``roots``, or ``None`` outside a git work tree."""
    if not git_work_tree(root):
        return None
    try:
        result = subprocess.run(
            ["git", "-C", root, "ls-files", "-z", "--", ".husky"] + list(roots),
            capture_output=True,
            text=True,
        )
    except OSError as error:
        fail("cannot run git ls-files: %s" % error)
    if result.returncode != 0:
        fail("git ls-files failed: %s" % result.stderr.strip())
    return [key for key in result.stdout.split("\0") if key]


def generated(key):
    return key == ".husky/_" or key.startswith(".husky/_/")


def walk(root, relative_dir, everything, found):
    relative_dir = relative_dir.replace(os.sep, "/").rstrip("/")
    if generated(relative_dir):
        return
    directory = os.path.join(root, relative_dir)
    if not os.path.isdir(directory):
        return
    for name in sorted(os.listdir(directory)):
        path = os.path.join(directory, name)
        if os.path.isdir(path):
            if name in SKIP_DIRECTORIES:
                continue
            walk(root, os.path.join(relative_dir, name), everything, found)
        elif os.path.isfile(path) and (everything or name.endswith(".sh")):
            found.add(os.path.relpath(path, root).replace(os.sep, "/"))
