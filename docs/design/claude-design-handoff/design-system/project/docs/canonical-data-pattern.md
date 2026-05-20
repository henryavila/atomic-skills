# Canonical Data Pattern

aiDeck enforces a strict separation between **data** (canonical, persistent) and **views** (projections, ephemeral).

## The rule

1. **Skills own canonical data**, written to `.atomic-skills/**` (or consumer-defined paths) as YAML or Markdown with structured frontmatter.
2. **aiDeck reads data**, never owns it. It projects state into views (HTML in browser, JSON over HTTP, MCP tools).
3. **Views are disposable**. Regenerating from data must always be lossless.

This guarantees:

- Skills work without aiDeck running (offline, terminal-only, CI).
- aiDeck crashes never corrupt project state.
- Data format evolves independently from runtime version.
- Multiple consumers can render the same data differently.

## Schema versioning

Every canonical payload includes `schemaVersion`. Consumers MUST check version compatibility:

```typescript
import { ProjectStatusState, SCHEMA_VERSION } from '@henryavila/aideck/schemas'

function parse(raw: unknown): ProjectStatusState {
  const data = raw as ProjectStatusState
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Schema mismatch: got ${data.schemaVersion}, expected ${SCHEMA_VERSION}`)
  }
  return data
}
```

Minor versions (`0.1.x`) are additive — new fields allowed, none removed/renamed.
Major bumps require migration. aiDeck ships migration scripts.

## File layout convention

Each consumer declares a directory under `.atomic-skills/` (or equivalent) containing:

```
<consumer-root>/
├── *.{yaml,md}              ← canonical entries (one per entity)
├── annotations/             ← human/AI annotations (append-only)
├── highlights/              ← flagged items (append-only)
└── inbox/                   ← pending human-to-AI signals
```

Annotations and highlights are append-only logs. Skills tail them via aiDeck's MCP `aideck_inbox` tool to discover human input.

## Read-only vs read-write

By default, consumers expose their canonical files as **read-only** to aiDeck. aiDeck reads, parses, renders.

When a consumer opts into **read-write** integration:

- aiDeck can write annotations/highlights back via MCP tools.
- Writes go to dedicated subdirectories (`annotations/`, `highlights/`) — never modify entity files directly.
- The consumer is responsible for surfacing inbox items to its skill logic.

This pattern prevents aiDeck from racing the skill on entity mutations.
