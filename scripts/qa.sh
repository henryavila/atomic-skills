#!/usr/bin/env bash
#
# The repository's only quality gate. Every hook and CI job calls this script;
# nothing else lists quality tools on its own.
#
# ---------------------------------------------------------------------------
# Measurer contract
# ---------------------------------------------------------------------------
# A measurer is any executable regular file directly inside qa/measure/ (not in
# a subfolder; names starting with `_` or `.` are ignored). Helper modules live
# in qa/measure/lib/.
#
#   <measurer> --describe
#       Prints, tab separated, exactly one `mode<TAB>fast` or `mode<TAB>full`
#       line, exactly one `changed<TAB>yes` or `changed<TAB>no` line, and one
#       `covers<TAB><stack><TAB><metric>` line per pair it measures. Exit 0.
#
#   <measurer>
#       Measures the whole repository and prints one line per item above its
#       ceiling: `<stack><TAB><metric><TAB><key><TAB><value>`, and nothing else
#       on standard output.
#
#   <measurer> --files <path>...
#       Measures only the listed files, paths from the repository root. A
#       measurer with `changed no` is never called with --files.
#
#   Exit 0 when it measured (even with items); exit 3 when its tool is not
#   installed. Any other exit code is a crash.
#
#   A measurer reads its ceiling from qa/ceilings.tsv; it never hard-codes one.
#   Keys are `<path from the repository root>::<symbol>` or `::*` for a whole
#   file. Never a line number.
#
# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------
#   fast     every fast measurer over the whole repository, then check
#   changed  fast changed-aware measurers on changed files (--staged or --base)
#   full     fast, then full measurers, then npm test
#   strong   full, then ratchet status (exit 1 unless every line is strong)
#   measure  the measuring lines only, filtered by --metric/--stack, no check
#   setup    create qa/.venv and install qa/requirements.txt into it
#
# Exit 0 passes, 1 means a rule failed, 2 means a person is needed (missing
# tool, malformed table, crashed measurer, bad usage).

set -u

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel 2>/dev/null) || {
  echo "qa: not inside a git repository — run from the repository root" >&2
  exit 2
}
cd "$ROOT" || {
  echo "qa: cannot enter $ROOT" >&2
  exit 2
}

TMP=$(mktemp -d "${TMPDIR:-/tmp}/qa.XXXXXX") || {
  echo "qa: cannot create a temporary directory — check TMPDIR" >&2
  exit 2
}
trap 'rm -rf "$TMP"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

usage() {
  cat >&2 <<'USAGE'
usage: scripts/qa.sh <mode> [options]

Modes:
  fast                              fast measurers, then the debt ratchet
  changed [--staged | --base <ref>] fast changed-aware measurers on changed files
  full                              fast, full measurers, then npm test
  strong                            full, then ratchet status
  measure [--metric <m>...] [--stack <s>...]
                                    print measuring lines without checking them
  setup                             create qa/.venv and install qa/requirements.txt
USAGE
  exit 2
}

die() {
  echo "qa: $*" >&2
  exit 2
}

tool_missing() {
  echo "qa: $1: tool not installed — run scripts/qa.sh setup or npm ci" >&2
  exit 2
}

show() {
  [ -s "$1" ] && cat "$1" >&2
  return 0
}

require_tables() {
  for table in qa/stacks.tsv qa/ceilings.tsv qa/dimensions.tsv; do
    if [ ! -f "$table" ]; then
      die "$table is missing — add the quality table"
    fi
  done

  if ! bad=$(awk -F'\t' '
    NR == 1 { next }
    /^[ \t]*(#|$)/ { next }
    {
      count = split($3, roots, ",")
      for (i = 1; i <= count; i++) {
        root = roots[i]
        gsub(/^[ \t]+|[ \t]+$/, "", root)
        if (root != "" && root != "-") next
      }
      print NR
      exit
    }
  ' qa/stacks.tsv); then
    die "qa/stacks.tsv: cannot be read — fix the table"
  fi
  if [ -n "$bad" ]; then
    die "qa/stacks.tsv:$bad: a stack row needs at least one root — fix the table"
  fi
}

discover() {
  MEASURERS=()
  [ -d qa/measure ] || return 0
  for path in qa/measure/*; do
    [ -f "$path" ] || continue
    [ -x "$path" ] || continue
    name=${path##*/}
    case "$name" in
      _* | .*) continue ;;
    esac
    MEASURERS[${#MEASURERS[@]}]="$path"
  done
}

require_measurers() {
  if [ "${#MEASURERS[@]}" -eq 0 ]; then
    die "no measurer found in qa/measure"
  fi
}

describe_all() {
  MODE=()
  CHANGED=()
  index=0
  if [ "${#MEASURERS[@]}" -gt 0 ]; then
    for measurer in "${MEASURERS[@]}"; do
      desc="$TMP/describe.$index"
      err="$TMP/describe.$index.err"
      if "$measurer" --describe >"$desc" 2>"$err"; then
        :
      else
        code=$?
        if [ "$code" -eq 3 ]; then
          tool_missing "$measurer"
        fi
        show "$err"
        die "$measurer: --describe failed (exit $code) — fix the measurer"
      fi

      if ! awk -F'\t' '
        $1 == "mode" && NF == 2 && ($2 == "fast" || $2 == "full") { next }
        $1 == "changed" && NF == 2 && ($2 == "yes" || $2 == "no") { next }
        $1 == "covers" && NF == 3 && length($2) > 0 && length($3) > 0 { next }
        { exit 1 }
      ' "$desc"; then
        die "$measurer: malformed --describe — fix the measurer (it prints mode, changed and covers lines)"
      fi

      mode_count=$(awk -F'\t' '$1 == "mode"' "$desc" | wc -l | tr -d ' ')
      changed_count=$(awk -F'\t' '$1 == "changed"' "$desc" | wc -l | tr -d ' ')
      if [ "$mode_count" -ne 1 ] || [ "$changed_count" -ne 1 ]; then
        die "$measurer: --describe needs exactly one mode line and one changed line — fix the measurer"
      fi

      MODE[index]=$(awk -F'\t' '$1 == "mode" { print $2; exit }' "$desc")
      CHANGED[index]=$(awk -F'\t' '$1 == "changed" { print $2; exit }' "$desc")
      awk -F'\t' '$1 == "covers" { print $2 "\t" $3 }' "$desc" >"$TMP/covers.$index"
      index=$((index + 1))
    done
  fi
}

add_unique() {
  file=$1
  value=$2
  grep -qxF -- "$value" "$file" 2>/dev/null || printf '%s\n' "$value" >>"$file"
}

add_metric() {
  add_unique "$TMP/metrics" "$1"
}

add_stack() {
  add_unique "$TMP/stacks" "$1"
}

collect_covers() {
  index=$1
  while IFS=$'\t' read -r stack metric; do
    [ -n "${metric:-}" ] || continue
    add_metric "$metric"
    add_stack "$stack"
    printf '%s\t%s\n' "$stack" "$metric" >>"$TMP/pairs"
  done <"$TMP/covers.$index"
}

MEASURE_INDEX=0
run_measurer() {
  measurer=$1
  covers_index=$2
  shift 2
  out="$TMP/out.$MEASURE_INDEX"
  err="$TMP/err.$MEASURE_INDEX"
  MEASURE_INDEX=$((MEASURE_INDEX + 1))

  "$measurer" "$@" >"$out" 2>"$err"
  code=$?
  if [ "$code" -eq 3 ]; then
    tool_missing "$measurer"
  fi
  if [ "$code" -ne 0 ]; then
    show "$err"
    die "$measurer: exited $code while measuring — fix the measurer (or run scripts/qa.sh setup)"
  fi

  bad=$(awk -F'\t' 'NF != 4 { print NR ": " $0; exit }' "$out")
  if [ -n "$bad" ]; then
    die "$measurer: output is not four tab-separated fields at line $bad — fix the measurer"
  fi

  # A row outside the measurer's own --describe coverage is malformed, not a
  # row to drop: filtering it would hide the mistake.
  bad=$(awk -F'\t' -v covers="$TMP/covers.$covers_index" '
    BEGIN {
      while ((getline line < covers) > 0) {
        split(line, fields, "\t")
        if (fields[1] != "" && fields[2] != "") covered[fields[1] "\t" fields[2]] = 1
      }
    }
    {
      if (!(($1 "\t" $2) in covered)) {
        print NR ": " $0
        exit
      }
    }
  ' "$out")
  if [ -n "$bad" ]; then
    die "$measurer: output line $bad is not covered by --describe — fix the measurer"
  fi
  # A measurer may end its last row without a newline. Normalise every output
  # to terminated lines before appending, so two measurers never join a row.
  awk '{ print }' "$out" >>"$TMP/measures"
}

run_phase() {
  wanted=$1
  : >"$TMP/measures"
  : >"$TMP/metrics"
  : >"$TMP/stacks"
  : >"$TMP/pairs"
  index=0
  if [ "${#MEASURERS[@]}" -gt 0 ]; then
    for measurer in "${MEASURERS[@]}"; do
      if [ "${MODE[$index]}" = "$wanted" ]; then
        run_measurer "$measurer" "$index"
        collect_covers "$index"
      fi
      index=$((index + 1))
    done
  fi
}

run_check() {
  : >"$TMP/check.stacks"
  : >"$TMP/check.metrics"
  : >"$TMP/check.measures"
  awk -F'\t' 'NF >= 2 && length($1) > 0 { print $1 }' "$TMP/pairs" |
    sort -u >"$TMP/check.stacks"

  failed=0
  while IFS= read -r stack; do
    [ -n "$stack" ] || continue
    awk -F'\t' -v stack="$stack" 'NF >= 2 && $1 == stack { print $2 }' "$TMP/pairs" |
      sort -u >"$TMP/check.metrics"
    [ -s "$TMP/check.metrics" ] || continue
    awk -F'\t' -v stack="$stack" '$1 == stack' "$TMP/measures" >"$TMP/check.measures"

    args=(python3 -I qa/ratchet.py check --measures "$TMP/check.measures" --stack "$stack" --metric)
    while IFS= read -r metric; do
      args[${#args[@]}]="$metric"
    done <"$TMP/check.metrics"

    "${args[@]}"
    code=$?
    case "$code" in
      0) ;;
      1) failed=1 ;;
      *) die "ratchet check exited $code — fix qa/ tables or the measurer output" ;;
    esac
  done <"$TMP/check.stacks"

  if [ "$failed" -eq 1 ]; then
    echo 'qa: quality check failed — fix the code or see "When the gate is red" in docs/quality.md' >&2
    return 1
  fi
  return 0
}

do_fast() {
  require_tables
  discover
  require_measurers
  describe_all
  run_phase fast
  run_check
}

do_full() {
  do_fast || return $?
  run_phase full
  run_check || return 1
  npm test
  code=$?
  if [ "$code" -ne 0 ]; then
    echo "qa: npm test failed — fix the failing tests, then rerun scripts/qa.sh full" >&2
    return 1
  fi
  return 0
}

filter_has() {
  local value=$1
  shift
  if [ "$#" -eq 0 ]; then
    return 0
  fi
  for candidate in "$@"; do
    [ "$candidate" = "$value" ] && return 0
  done
  return 1
}

metric_selected() {
  if [ "${#FILTER_METRICS[@]}" -eq 0 ]; then
    return 0
  fi
  filter_has "$1" "${FILTER_METRICS[@]}"
}

stack_selected() {
  if [ "${#FILTER_STACKS[@]}" -eq 0 ]; then
    return 0
  fi
  filter_has "$1" "${FILTER_STACKS[@]}"
}

measure_matches() {
  index=$1
  [ -s "$TMP/covers.$index" ] || return 1
  while IFS=$'\t' read -r stack metric; do
    [ -n "${metric:-}" ] || continue
    if metric_selected "$metric" && stack_selected "$stack"; then
      return 0
    fi
  done <"$TMP/covers.$index"
  return 1
}

stack_touches_files() {
  stack=$1
  while IFS=$'\t' read -r root_stack root; do
    [ "$root_stack" = "$stack" ] || continue
    while IFS= read -r file; do
      case "$file" in
        "$root"/*) return 0 ;;
      esac
    done <"$TMP/files"
  done <"$TMP/roots"
  return 1
}

covers_touch_files() {
  index=$1
  [ -s "$TMP/covers.$index" ] || return 1
  while IFS=$'\t' read -r stack metric; do
    [ -n "${metric:-}" ] || continue
    if stack_touches_files "$stack"; then
      return 0
    fi
  done <"$TMP/covers.$index"
  return 1
}

changed_args() {
  staged=0
  ref=origin/main
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --staged)
        staged=1
        shift
        ;;
      --base)
        shift
        [ "$#" -gt 0 ] || usage
        ref=$1
        shift
        ;;
      *)
        usage
        ;;
    esac
  done

  if [ "$staged" -eq 1 ]; then
    git diff --cached --name-only --diff-filter=ACMR >"$TMP/files.raw" ||
      die "git diff --cached failed — run from a git repository"
  else
    base=$(git merge-base HEAD "$ref" 2>/dev/null) ||
      die "cannot find the merge-base of HEAD and $ref — fetch $ref or pass --base <ref>"
    git diff --name-only --diff-filter=ACMR "$base" >"$TMP/files.raw" ||
      die "git diff against $base failed — check the ref"
  fi

  : >"$TMP/files"
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if [ -f "$file" ]; then
      printf '%s\n' "$file" >>"$TMP/files"
    fi
  done <"$TMP/files.raw"
}

do_changed() {
  require_tables
  changed_args "$@"
  discover
  require_measurers
  if [ ! -s "$TMP/files" ]; then
    echo "qa: no changed files to measure"
    return 0
  fi

  : >"$TMP/roots"
  if [ -f qa/stacks.tsv ]; then
    awk -F'\t' '
      NR == 1 { next }
      {
        count = split($3, roots, ",")
        for (i = 1; i <= count; i++) {
          root = roots[i]
          gsub(/^[ \t]+|[ \t]+$/, "", root)
          if (root != "" && root != "-") print $1 "\t" root
        }
      }
    ' qa/stacks.tsv >>"$TMP/roots"
  fi

  describe_all
  : >"$TMP/measures"
  : >"$TMP/metrics"
  : >"$TMP/stacks"
  : >"$TMP/pairs"

  files=()
  while IFS= read -r file; do
    files[${#files[@]}]="$file"
  done <"$TMP/files"

  index=0
  if [ "${#MEASURERS[@]}" -gt 0 ]; then
    for measurer in "${MEASURERS[@]}"; do
      if [ "${MODE[$index]}" = "fast" ] && [ "${CHANGED[$index]}" = "yes" ] && covers_touch_files "$index"; then
        run_measurer "$measurer" "$index" --files "${files[@]}"
        collect_covers "$index"
      fi
      index=$((index + 1))
    done
  fi

  if [ ! -s "$TMP/metrics" ]; then
    echo "qa: no fast changed-aware measurer covers the changed files"
    return 0
  fi
  run_check
}

do_measure() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --metric)
        shift
        [ "$#" -gt 0 ] || usage
        while [ "$#" -gt 0 ] && [ "${1#--}" = "$1" ]; do
          FILTER_METRICS[${#FILTER_METRICS[@]}]="$1"
          shift
        done
        ;;
      --stack)
        shift
        [ "$#" -gt 0 ] || usage
        while [ "$#" -gt 0 ] && [ "${1#--}" = "$1" ]; do
          FILTER_STACKS[${#FILTER_STACKS[@]}]="$1"
          shift
        done
        ;;
      *)
        usage
        ;;
    esac
  done

  require_tables
  discover
  require_measurers
  describe_all
  : >"$TMP/measures"
  : >"$TMP/metrics"
  : >"$TMP/stacks"
  : >"$TMP/pairs"

  index=0
  if [ "${#MEASURERS[@]}" -gt 0 ]; then
    for measurer in "${MEASURERS[@]}"; do
      if measure_matches "$index"; then
        run_measurer "$measurer" "$index"
      fi
      index=$((index + 1))
    done
  fi

  while IFS=$'\t' read -r stack metric key value || [ -n "${stack:-}" ]; do
    [ -n "${value:-}" ] || continue
    metric_selected "$metric" || continue
    stack_selected "$stack" || continue
    printf '%s\t%s\t%s\t%s\n' "$stack" "$metric" "$key" "$value"
  done <"$TMP/measures"
  return 0
}

do_setup() {
  if [ ! -f qa/requirements.txt ]; then
    die "qa/requirements.txt is missing — add the pinned Python requirements"
  fi
  python3 -m venv qa/.venv ||
    die "cannot create qa/.venv — install python3 with the venv module"
  qa/.venv/bin/pip install -r qa/requirements.txt ||
    die "pip install failed — check qa/requirements.txt and the network"
  return 0
}

[ "$#" -gt 0 ] || usage
command=$1
shift

case "$command" in
  fast)
    [ "$#" -eq 0 ] || usage
    do_fast
    exit $?
    ;;
  changed)
    do_changed "$@"
    exit $?
    ;;
  full)
    [ "$#" -eq 0 ] || usage
    do_full
    exit $?
    ;;
  strong)
    [ "$#" -eq 0 ] || usage
    do_full || exit $?
    python3 -I qa/ratchet.py status
    code=$?
    if [ "$code" -eq 0 ]; then
      exit 0
    fi
    if [ "$code" -eq 2 ]; then
      exit 2
    fi
    echo 'qa: status is not strong — fix the listed gaps or see "When the gate is red" in docs/quality.md' >&2
    exit 1
    ;;
  measure)
    FILTER_METRICS=()
    FILTER_STACKS=()
    do_measure "$@"
    exit $?
    ;;
  setup)
    [ "$#" -eq 0 ] || usage
    do_setup
    exit $?
    ;;
  *)
    usage
    ;;
esac
