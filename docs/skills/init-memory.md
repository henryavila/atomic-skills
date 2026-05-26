# `atomic-skills:init-memory` — Persistent Context

> **Iron Law:** `NO DELETION WITHOUT CONFIRMED BACKUP.`

**Centralize project memory to .ai/memory/**

New sessions start from zero. `init-memory` bootstraps a persistent memory directory so every future session inherits context from past ones. Run once, benefit forever.

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
