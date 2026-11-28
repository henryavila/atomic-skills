"""Select shell sources for the ``sh`` measurers.

The shell source rule lives here and nowhere else:

* a path ending in ``.sh`` under a root of the ``sh`` stack is shell source;
* a file directly inside ``.husky/`` (no further ``/``) is shell source;
* nothing under the generated ``.husky/_/`` directory is shell source.

In a git work tree a shell file is a tracked path that the rule above selects;
untracked and ignored files are never measured. When the measured root is not
a git work tree (test fixtures), the rule is applied to every file on disk
except the husky-generated ``.husky/_/`` directory.
"""

import errno
import os
import stat
import subprocess

SKIP_DIRECTORIES = {"__pycache__", "node_modules", ".git"}
MISSING = (errno.ENOENT, errno.ENOTDIR)


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


def is_shell_source(key, roots):
    key = key.replace("\\", "/").replace(os.sep, "/").strip("/")
    if generated(key):
        return False
    if key.startswith(".husky/"):
        rest = key[len(".husky/"):]
        if "/" in rest:
            return rest.endswith(".sh")
        return True
    if not key.endswith(".sh"):
        return False
    return any(key == base or key.startswith(base + "/") for base in roots)


def walk(root, relative_dir, everything, found):
    relative_dir = relative_dir.replace(os.sep, "/").rstrip("/")
    if generated(relative_dir):
        return
    directory = os.path.join(root, relative_dir)
    try:
        mode = os.stat(directory).st_mode
    except OSError as error:
        if error.errno in MISSING:
            return
        fail("cannot inspect %s: %s" % (directory, error))
    if not stat.S_ISDIR(mode):
        return
    try:
        names = sorted(os.listdir(directory))
    except OSError as error:
        fail("cannot read %s: %s" % (directory, error))
    for name in names:
        path = os.path.join(directory, name)
        try:
            child = os.stat(path).st_mode
        except OSError as error:
            if error.errno in MISSING:
                continue
            fail("cannot inspect %s: %s" % (path, error))
        if stat.S_ISDIR(child):
            if name in SKIP_DIRECTORIES:
                continue
            walk(root, os.path.join(relative_dir, name), everything, found)
        elif stat.S_ISREG(child) and (everything or name.endswith(".sh")):
            found.add(os.path.relpath(path, root).replace(os.sep, "/"))
