"""Copied into the temporary sitecustomize after the coverage package path.

Coverage 7.6 has no exec/_exit patches yet. Save before these exits bypass
the atexit handler used by process_startup.
"""

import functools
import os

import coverage


cov = coverage.process_startup()
if cov is not None:
    def save_before(function):
        @functools.wraps(function)
        def wrapped(*args, **kwargs):
            # Keep tracing if an exec fails and control returns to the caller.
            cov.save()
            return function(*args, **kwargs)
        return wrapped

    # The other os.exec* helpers ultimately call one of these two primitives.
    for name in ("_exit", "execv", "execve"):
        setattr(os, name, save_before(getattr(os, name)))
