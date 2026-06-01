#!/usr/bin/env bash
# atomic-skills:project — PreToolUse hook (emergent-work provenance gate)
#
# Intercepts Edit / Write / MultiEdit on `.atomic-skills/initiatives/*.md` and
# `.atomic-skills/plans/*.md`. If the tool call ADDS new entries to `tasks[]`
# (initiative) or `phases[]` (plan) without a `provenance:` field, the hook
# either logs the would-block decision (dry-run, default) or denies the call
# (strict mode, opt-in via `emergent_strict_mode: true` in config.json).
#
# Rationale: the agent-proposes / user-invokes flow requires every mid-execution
# task/phase addition to set `provenance: { surfacedAt, surfacedDuring?,
# surfacedBy? }`. Without enforcement, the agent could bypass the ladder and
# silently mutate the plan. This hook closes that gap.
#
# Allowed without provenance (no block):
#   - File creation (Write to non-existent file) — original materialization
#   - Edits to existing tasks (status update, lastUpdated bump, etc.)
#   - Deletions
#   - Edits to files outside `.atomic-skills/{initiatives,plans}/`
#   - Edits to archive/ subdirectories
#   - Any tool call where the diff doesn't introduce new task/phase ids
#
# Fail-open: parser errors, missing config, malformed payload — all exit 0.
# The threat model is honest mistakes; users disable via SKIP-EMERGENT.
set -euo pipefail

PROJ_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
ASKILLS_DIR="$PROJ_DIR/.atomic-skills"
CONFIG="$ASKILLS_DIR/status/config.json"
LOG="$ASKILLS_DIR/status/emergent-drift.log"
SKIP_FLAG="$ASKILLS_DIR/status/SKIP"
SKIP_EMERGENT_FLAG="$ASKILLS_DIR/status/SKIP-EMERGENT"

# --- helpers ----------------------------------------------------------------

# Lexical path canonicalizer (same shape as stop.sh). No symlink resolution —
# this hook gates honest mistakes, not active evasion.
canonicalize_path() {
  local p=$1
  p=$(printf '%s' "$p" | sed -E 's://+:/:g; s:/$::')
  [[ -z "$p" ]] && { echo "."; return 0; }
  local IFS='/' parts=() out=() leading_slash=""
  [[ "$p" == /* ]] && leading_slash="/"
  read -ra parts <<< "${p#/}"
  for c in "${parts[@]}"; do
    case "$c" in
      "" | .) continue ;;
      ..)
        if (( ${#out[@]} > 0 )); then
          local last_idx=$(( ${#out[@]} - 1 ))
          if [[ "${out[$last_idx]}" != ".." ]]; then
            unset "out[$last_idx]"
            out=("${out[@]}")
          elif [[ -z "$leading_slash" ]]; then
            out+=('..')
          fi
        elif [[ -z "$leading_slash" ]]; then
          out+=('..')
        fi
        ;;
      *) out+=("$c") ;;
    esac
  done
  if (( ${#out[@]} == 0 )); then
    [[ -n "$leading_slash" ]] && echo "/" || echo "."
  else
    local joined
    joined=$(IFS='/'; echo "${out[*]}")
    echo "${leading_slash}${joined}"
  fi
}

# Resolve `file_path` to an absolute path against PROJ_DIR (most agents send
# absolute paths already, but Edit can receive relative ones too).
resolve_file_path() {
  local p=$1
  [[ "$p" == /* ]] || p="$PROJ_DIR/$p"
  canonicalize_path "$p"
}

# True iff the canonicalized path is under one of the gated prefixes (NOT
# archive subdirs — archived initiatives/plans are out of scope).
in_gated_path() {
  local abs=$1
  local init_dir="$ASKILLS_DIR/initiatives"
  local plans_dir="$ASKILLS_DIR/plans"
  local init_abs plans_abs
  init_abs=$(canonicalize_path "$init_dir")
  plans_abs=$(canonicalize_path "$plans_dir")
  # Direct children only — exclude archive/<file>.md and other nested dirs.
  case "$abs" in
    "$init_abs"/*) [[ "${abs#$init_abs/}" != */* ]] && return 0 ;;
    "$plans_abs"/*) [[ "${abs#$plans_abs/}" != */* ]] && return 0 ;;
  esac
  return 1
}

# Extract task / phase / parked / emerged entries from a markdown file's
# frontmatter. Reads from stdin; emits one line per entry:
#   <kind>|<id>|<has_prov>|<has_ctx_solves>|<has_ctx_trigger>|<has_ctx_ratified>
# where:
#   <kind>    — `task` | `phase` | `parked` | `emerged`
#   <id>      — `id` field for task/phase; `surfacedAt` for parked/emerged
#               (parked/emerged have no `id`; surfacedAt is the unique key
#                generated on insert and preserved across edits).
#   flags     — `yes`/`no`
#
# Handles two YAML forms:
#   block form:
#     - id: T-001
#       title: 'foo'
#       provenance:
#         surfacedAt: ...
#       context:
#         solves: '...'
#         trigger: '...'
#         ratifiedAt: '...'
#   inline form (rare for tasks/phases — usually only stack frames):
#     - { id: T-001, status: pending, provenance: { ... }, context: { ... } }
#
# Parked / emerged entries don't carry `id` or `provenance` — only the `context`
# requirement applies. has_prov is forced to "yes" on these kinds so the
# downstream violation logic flows through the context-completeness check.
#
# Skips lines outside the frontmatter (between the first two `---` markers).
extract_entries() {
  awk '
    BEGIN {
      fm = 0
      in_tasks = 0; in_phases = 0; in_parked = 0; in_emerged = 0
      cur_kind = ""; cur_id = ""
      cur_prov = "no"; cur_ctx_solves = "no"; cur_ctx_trigger = "no"; cur_ctx_ratified = "no"
      cur_pending_surfacedat = "no"  # parked/emerged: capture surfacedAt as id
    }
    function reset_entry() {
      cur_id = ""
      cur_prov = "no"; cur_ctx_solves = "no"; cur_ctx_trigger = "no"; cur_ctx_ratified = "no"
      cur_pending_surfacedat = "no"
    }
    function flush() {
      if (cur_id != "") {
        # parked/emerged have no provenance field — context-check is the only
        # gate. Force has_prov to "yes" so the violation logic treats their
        # missing context fields as the real failure, not "no provenance".
        prov = cur_prov
        if (cur_kind == "parked" || cur_kind == "emerged") prov = "yes"
        print cur_kind "|" cur_id "|" prov "|" cur_ctx_solves "|" cur_ctx_trigger "|" cur_ctx_ratified
      }
      reset_entry()
    }
    /^---[[:space:]]*$/ { fm++; if (fm == 2) { flush(); exit } next }
    fm != 1 { next }

    # Block transitions — a top-level key resets state.
    /^tasks:[[:space:]]*$/    { flush(); in_tasks = 1; in_phases = 0; in_parked = 0; in_emerged = 0; cur_kind = "task";    next }
    /^phases:[[:space:]]*$/   { flush(); in_tasks = 0; in_phases = 1; in_parked = 0; in_emerged = 0; cur_kind = "phase";   next }
    /^parked:[[:space:]]*$/   { flush(); in_tasks = 0; in_phases = 0; in_parked = 1; in_emerged = 0; cur_kind = "parked";  next }
    /^emerged:[[:space:]]*$/  { flush(); in_tasks = 0; in_phases = 0; in_parked = 0; in_emerged = 1; cur_kind = "emerged"; next }
    /^[A-Za-z][A-Za-z0-9_]*:/ { flush(); in_tasks = 0; in_phases = 0; in_parked = 0; in_emerged = 0; next }

    (in_tasks == 0 && in_phases == 0 && in_parked == 0 && in_emerged == 0) { next }

    # New entry — inline form `  - { ... }` (one-line shape).
    /^[[:space:]]+-[[:space:]]+\{/ {
      flush()
      line = $0
      # tasks/phases: id is the natural key. parked/emerged: surfacedAt is.
      if (in_tasks || in_phases) {
        if (match(line, /id:[[:space:]]*['"'"'"]?[A-Za-z0-9_.-]+['"'"'"]?/)) {
          id_str = substr(line, RSTART, RLENGTH)
          sub(/^id:[[:space:]]*/, "", id_str)
          gsub(/['"'"'"]/, "", id_str)
          cur_id = id_str
        }
      } else {
        # parked/emerged: surfacedAt is the unique key. Tolerate quoted and
        # unquoted ISO timestamps.
        if (match(line, /surfacedAt:[[:space:]]*['"'"'"]?[0-9T:.+Z-]+['"'"'"]?/)) {
          id_str = substr(line, RSTART, RLENGTH)
          sub(/^surfacedAt:[[:space:]]*/, "", id_str)
          gsub(/['"'"'"]/, "", id_str)
          cur_id = id_str
        }
      }
      if (line ~ /provenance[[:space:]]*:/) cur_prov = "yes"
      if (line ~ /solves[[:space:]]*:/)     cur_ctx_solves = "yes"
      if (line ~ /trigger[[:space:]]*:/)    cur_ctx_trigger = "yes"
      if (line ~ /ratifiedAt[[:space:]]*:/) cur_ctx_ratified = "yes"
      flush()
      next
    }

    # tasks/phases block form — entry starts with `  - id: X`.
    /^[[:space:]]+-[[:space:]]+id:/ {
      if (in_tasks || in_phases) {
        flush()
        line = $0
        sub(/^[[:space:]]+-[[:space:]]+id:[[:space:]]*/, "", line)
        gsub(/['"'"'"]/, "", line)
        sub(/[[:space:]]+#.*$/, "", line)
        sub(/[[:space:]]+$/, "", line)
        cur_id = line
      }
      next
    }

    # parked/emerged block form — entry starts with `  - title: ...`. The
    # surfacedAt (which we use as the key) is on a following line; capture it
    # via the nested-key rule below.
    /^[[:space:]]+-[[:space:]]+title:/ {
      if (in_parked || in_emerged) {
        flush()
        # cur_id stays empty; will be set when we see `    surfacedAt: ...`
        cur_pending_surfacedat = "waiting"
      }
      next
    }

    # Nested keys at child indent of the current entry. Match by key name; the
    # top-level-key rule above already ends the entry scope before any of
    # these keywords could reappear at a sibling level.
    /^[[:space:]]+surfacedAt[[:space:]]*:/ {
      if (cur_pending_surfacedat == "waiting") {
        line = $0
        sub(/^[[:space:]]+surfacedAt[[:space:]]*:[[:space:]]*/, "", line)
        gsub(/['"'"'"]/, "", line)
        sub(/[[:space:]]+#.*$/, "", line)
        sub(/[[:space:]]+$/, "", line)
        cur_id = line
        cur_pending_surfacedat = "done"
      }
      next
    }
    /^[[:space:]]+provenance[[:space:]]*:/ {
      if (cur_id != "" || cur_pending_surfacedat == "waiting") cur_prov = "yes"
      next
    }
    /^[[:space:]]+solves[[:space:]]*:/ {
      if (cur_id != "" || cur_pending_surfacedat == "waiting") cur_ctx_solves = "yes"
      next
    }
    /^[[:space:]]+trigger[[:space:]]*:/ {
      if (cur_id != "" || cur_pending_surfacedat == "waiting") cur_ctx_trigger = "yes"
      next
    }
    /^[[:space:]]+ratifiedAt[[:space:]]*:/ {
      if (cur_id != "" || cur_pending_surfacedat == "waiting") cur_ctx_ratified = "yes"
      next
    }
  '
}

# Reconstruct the NEW file content from the tool payload. Writes to stdout.
# Uses python3 because bash string ops on multi-line strings with arbitrary
# escapes are unsafe.
reconstruct_new_content() {
  local payload=$1 file=$2
  if ! command -v python3 >/dev/null 2>&1; then
    return 1
  fi
  python3 - "$file" <<'PY' "$payload"
import sys, json, os
file_path = sys.argv[1]
payload = json.loads(sys.argv[2])
tool = payload.get("tool_name") or payload.get("toolName") or ""
ti = payload.get("tool_input") or payload.get("toolInput") or {}
try:
    with open(file_path, "r", encoding="utf-8") as f:
        orig = f.read()
except FileNotFoundError:
    orig = ""
except Exception:
    sys.exit(2)

if tool == "Write":
    sys.stdout.write(ti.get("content", ""))
elif tool == "Edit":
    os_, ns = ti.get("old_string", ""), ti.get("new_string", "")
    if ti.get("replace_all"):
        sys.stdout.write(orig.replace(os_, ns))
    else:
        sys.stdout.write(orig.replace(os_, ns, 1))
elif tool == "MultiEdit":
    text = orig
    for e in (ti.get("edits") or []):
        os_, ns = e.get("old_string", ""), e.get("new_string", "")
        if e.get("replace_all"):
            text = text.replace(os_, ns)
        else:
            text = text.replace(os_, ns, 1)
    sys.stdout.write(text)
else:
    sys.exit(3)
PY
}

# Read OLD file content (empty if missing).
read_old_content() {
  local file=$1
  [[ -f "$file" ]] && cat "$file" || true
}

# --- pre-flight bypasses ----------------------------------------------------

# Emergency global bypass (shared with stop.sh) — 24h grace.
if [[ -f "$SKIP_FLAG" ]]; then
  skip_mtime=$(stat -c %Y "$SKIP_FLAG" 2>/dev/null || stat -f %m "$SKIP_FLAG" 2>/dev/null || echo 0)
  now=$(date +%s)
  [[ $((now - skip_mtime)) -lt 86400 ]] && exit 0
fi

# Hook-specific bypass — same 24h grace.
if [[ -f "$SKIP_EMERGENT_FLAG" ]]; then
  skip_mtime=$(stat -c %Y "$SKIP_EMERGENT_FLAG" 2>/dev/null || stat -f %m "$SKIP_EMERGENT_FLAG" 2>/dev/null || echo 0)
  now=$(date +%s)
  [[ $((now - skip_mtime)) -lt 86400 ]] && exit 0
fi

# Parse stdin payload. Anything malformed → fail-open.
payload=$(cat)
[[ -z "$payload" ]] && exit 0

tool_name=$(printf '%s' "$payload" | jq -r '.tool_name // .toolName // empty' 2>/dev/null || echo "")
case "$tool_name" in
  Edit|Write|MultiEdit|NotebookEdit) ;;
  *) exit 0 ;;
esac

file_path=$(printf '%s' "$payload" | jq -r '
  .tool_input.file_path
  // .tool_input.notebook_path
  // .toolInput.file_path
  // .toolInput.notebook_path
  // empty
' 2>/dev/null || echo "")
[[ -z "$file_path" ]] && exit 0

# NotebookEdit doesn't touch .md frontmatter; skip without parsing.
[[ "$tool_name" == "NotebookEdit" ]] && exit 0

abs_path=$(resolve_file_path "$file_path")
in_gated_path "$abs_path" || exit 0

# Only gate Markdown files. Other extensions inside the dirs (e.g. JSON state)
# don't carry tasks/phases YAML.
[[ "$abs_path" == *.md ]] || exit 0
# Rendered files are derived artifacts — never mutated by hand or by the skill.
[[ "$abs_path" == *.rendered.md ]] && exit 0

# Config absent → no gating (skill not installed or not configured).
[[ ! -f "$CONFIG" ]] && exit 0
strict_mode=$(jq -r '.emergent_strict_mode // false' "$CONFIG" 2>/dev/null || echo false)

# --- diff & detect ----------------------------------------------------------

old_content=$(read_old_content "$abs_path")

# File creation (no prior content) is the original materialization — every
# task/phase shipped here is by definition original. Don't gate.
[[ -z "$old_content" ]] && exit 0

new_content=$(reconstruct_new_content "$payload" "$abs_path" 2>/dev/null) || exit 0
[[ -z "$new_content" ]] && exit 0

# Extract entries. Tmp files used to avoid here-string portability issues on
# Bash 3.2 (macOS).
old_tmp=$(mktemp -t pre-write-old.XXXXXX) || exit 0
new_tmp=$(mktemp -t pre-write-new.XXXXXX) || { rm -f "$old_tmp"; exit 0; }
trap 'rm -f "$old_tmp" "$new_tmp"' EXIT
printf '%s' "$old_content" > "$old_tmp"
printf '%s' "$new_content" > "$new_tmp"

old_entries=$(extract_entries < "$old_tmp" 2>/dev/null || true)
new_entries=$(extract_entries < "$new_tmp" 2>/dev/null || true)

# IDs present in OLD (regardless of provenance).
old_ids=$(printf '%s\n' "$old_entries" | awk -F'|' 'NF>=2 {print $1"|"$2}' | sort -u)

# Walk NEW entries; flag any whose `<kind>|<id>` doesn't exist in OLD AND
# either (a) lacks provenance OR (b) has provenance but lacks a complete
# context block (solves + trigger + ratifiedAt). The two failure modes are
# tagged separately so the violation message is actionable.
violations=()
while IFS= read -r row; do
  [[ -z "$row" ]] && continue
  kind=$(printf '%s' "$row" | awk -F'|' '{print $1}')
  id=$(printf '%s' "$row" | awk -F'|' '{print $2}')
  has_prov=$(printf '%s' "$row" | awk -F'|' '{print $3}')
  has_solves=$(printf '%s' "$row" | awk -F'|' '{print $4}')
  has_trigger=$(printf '%s' "$row" | awk -F'|' '{print $5}')
  has_ratified=$(printf '%s' "$row" | awk -F'|' '{print $6}')
  [[ -z "$id" ]] && continue
  key="$kind|$id"
  if printf '%s\n' "$old_ids" | grep -Fxq "$key"; then
    continue  # existing entry, not an addition
  fi
  if [[ "$has_prov" != "yes" ]]; then
    violations+=("$kind:$id (no provenance)")
    continue
  fi
  # provenance present — context must also be complete
  missing=()
  [[ "$has_solves"   == "yes" ]] || missing+=("solves")
  [[ "$has_trigger"  == "yes" ]] || missing+=("trigger")
  [[ "$has_ratified" == "yes" ]] || missing+=("ratifiedAt")
  if (( ${#missing[@]} > 0 )); then
    missing_csv=$(IFS=','; echo "${missing[*]}")
    violations+=("$kind:$id (missing context.{$missing_csv})")
  fi
done <<< "$new_entries"

(( ${#violations[@]} == 0 )) && exit 0

# --- decide -----------------------------------------------------------------

slug=$(basename "$abs_path" .md)
violations_csv=$(IFS=$'\n'; echo "${violations[*]}")
msg="Edit to ${slug}.md violates the agent-proposes / user-ratifies flow:
${violations_csv}

Use the new-task / new-phase / split-phase / emerge --target / park commands; each prompts the user to ratify a context block (solves + trigger + assumesStillValid) before mutating state. Direct edits bypass that articulation, which is why downstream listings end up as cryptic title-only stubs.

To bypass for 24h: \`touch .atomic-skills/status/SKIP-EMERGENT\`."

if [[ "$strict_mode" == "true" ]]; then
  echo "$msg" >&2
  exit 2
fi

# Dry-run: append a structured JSON line for later analysis.
mkdir -p "$(dirname "$LOG")"
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
violations_json=$(printf '%s\n' "${violations[@]}" | jq -R . | jq -s .)
jq -n --arg ts "$ts" --arg slug "$slug" --arg file "$abs_path" \
  --arg tool "$tool_name" --argjson v "$violations_json" \
  '{ts: $ts, mode: "dry-run", initiative_or_plan: $slug, file: $file,
    tool: $tool, would_block: true, violations: $v}' >> "$LOG"

exit 0
