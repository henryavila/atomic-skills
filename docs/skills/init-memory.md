# `atomic-skills:init-memory` — Persistent Context

> **Iron Law:** `NO DELETION WITHOUT CONFIRMED BACKUP.`

**Consolidate scattered memory into .ai/memory/ and wire it to the IDE**

Memory often already exists but is scattered across `.memory/`, `docs/memory/`, and Claude's auto-memory dir — duplicated, contradictory, or never actually read because it was never wired up. `init-memory` consolidates it into one indexed `.ai/memory/`, connects it via `autoMemoryDirectory` (the durable path, not the fragile redirect), and keeps `MEMORY.md` under the 200-line load limit. Originals are deleted only after an ls-compare confirms every file copied.

## Purpose

Bootstrap the persistent memory directory and index so that future sessions can pick up where this one left off.

## Usage

**When to use:**
- First time using atomic-skills in a project
- Memory directory missing or corrupted
- You want to standardize the memory layout

**When NOT to use:**
- Memory already initialized and healthy

## Reference

**Examples:**
- `/atomic-skills:init-memory` — Bootstrap memory in the current project

## Metadata

**Output artifacts:** `.ai/memory/MEMORY.md`

**Related:** `save-and-push`

**Tags:** `memory`, `setup`

**Version added:** `1.0.0`
