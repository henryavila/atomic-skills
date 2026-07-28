/**
 * foreign-plan-parse.js — heuristic extraction of phases/tasks from freeform markdown.
 *
 * Classifies structure quality (S0–S3) and extracts candidate tasks for the
 * admit pass. Never invents verifiers. SPEC gaps are reported, not filled.
 */

/**
 * @typedef {'S0'|'S1'|'S2'|'S3'} StructureClass
 */

function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

/**
 * @param {string} markdown
 * @returns {StructureClass}
 */
export function classifyStructure(markdown) {
  const md = String(markdown || '');
  const hasPhase = /^##\s+(F\d+|Phase\s+\d+|Fase\s+\d+)\b/im.test(md);
  const hasTaskH3 = /^###\s+(T[\d.]+|T-\d+)/im.test(md);
  const hasSpecField =
    /^\s*-\s*\*?\*?Files\*?\*?:/im.test(md) ||
    /^\s*-\s*\*?\*?scopeBoundary\*?\*?:/im.test(md) ||
    /^\s*-\s*\*?\*?acceptance\*?\*?:/im.test(md) ||
    /^\s*-\s*\*?\*?verifier\*?\*?:/im.test(md);
  const hasCheckbox = /^\s*[-*]\s+\[[ xX]\]\s+/m.test(md);

  if (hasPhase && hasTaskH3 && hasSpecField) return 'S0';
  if (hasPhase && (hasTaskH3 || hasCheckbox)) return 'S1';
  if (hasCheckbox || hasTaskH3) return 'S2';
  return 'S3';
}

/**
 * Parse markdown into candidate phases/tasks for work-order seeding.
 * @param {string} markdown
 * @param {{ sourcePath?: string }} [opts]
 * @returns {{
 *   structureClass: StructureClass,
 *   phases: Array<{ id: string, title: string, status: string, tasks: object[] }>,
 *   warnings: string[],
 * }}
 */
export function parseForeignPlanMarkdown(markdown, opts = {}) {
  const md = String(markdown || '');
  const structureClass = classifyStructure(md);
  const warnings = [];
  const lines = md.split(/\r?\n/);

  /** @type {Array<{ id: string, title: string, status: string, tasks: object[] }>} */
  const phases = [];
  let phase = null;
  let task = null;

  const flushTask = () => {
    if (task && phase) {
      phase.tasks.push(finalizeTask(task));
      task = null;
    }
  };
  const flushPhase = () => {
    flushTask();
    if (phase) {
      phases.push(phase);
      phase = null;
    }
  };

  for (const line of lines) {
    const phaseMatch = line.match(/^##\s+((?:F\d+|Phase\s+\d+|Fase\s+\d+))\b(?:\s*[—–\-:]\s*(.*))?$/i);
    if (phaseMatch) {
      flushPhase();
      const rawId = phaseMatch[1].replace(/\s+/g, '');
      const id = /^F\d+/i.test(rawId)
        ? rawId.toUpperCase().replace(/^F/, 'F')
        : rawId.replace(/phase/i, 'P').replace(/fase/i, 'P').replace(/\s+/g, '');
      const normalizedId = id.match(/^F\d+$/i)
        ? id.toUpperCase()
        : id.match(/^P\d+$/i)
          ? id.toUpperCase()
          : `P${phases.length}`;
      phase = {
        id: normalizedId,
        title: text(phaseMatch[2]) || normalizedId,
        status: 'pending',
        tasks: [],
      };
      continue;
    }

    // Generic ## as phase if we already saw plan-like structure and no F/Phase yet
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2 && !phase && structureClass === 'S3') {
      // defer — S3 handled below as single synthetic phase
      continue;
    }
    if (h2 && phase === null && phases.length === 0 && structureClass !== 'S3') {
      // treat first non-matching H2 as synthetic phase only when checkboxes follow — skip
    }

    const taskH3 = line.match(/^###\s+(?:((?:T[\d.]+|T-\d+))\s*[—–\-:]\s*)?(.+)$/i);
    if (taskH3 && phase) {
      flushTask();
      const id = text(taskH3[1]) || `T-${String(phase.tasks.length + 1).padStart(3, '0')}`;
      task = {
        id: normalizeTaskId(id, phase),
        title: text(taskH3[2]) || id,
        status: 'pending',
        outputs: [],
        scopeBoundary: [],
        acceptance: [],
        verifier: null,
        _buf: { files: null, scope: null, acceptance: null, verifier: null },
      };
      continue;
    }

    // Checkbox items become tasks when inside a phase or as flat list
    const check = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (check) {
      if (!phase) {
        phase = {
          id: 'P0',
          title: 'Imported checklist',
          status: 'pending',
          tasks: [],
        };
      }
      flushTask();
      const done = check[1].toLowerCase() === 'x';
      const title = text(check[2]);
      task = {
        id: `T-${String(phase.tasks.length + 1).padStart(3, '0')}`,
        title,
        status: done ? 'done' : 'pending',
        outputs: [],
        scopeBoundary: [],
        acceptance: [],
        verifier: null,
        _buf: { files: null, scope: null, acceptance: null, verifier: null },
      };
      // checkbox tasks usually have no trailing SPEC — flush immediately unless next lines are fields
      continue;
    }

    if (task) {
      const files = line.match(/^\s*-\s*\*?\*?Files?\*?\*?:\s*(.+)$/i);
      if (files) {
        task._buf.files = files[1];
        continue;
      }
      const scope = line.match(/^\s*-\s*\*?\*?scopeBoundary\*?\*?:\s*(.+)$/i);
      if (scope) {
        task._buf.scope = scope[1];
        continue;
      }
      const acc = line.match(/^\s*-\s*\*?\*?acceptance\*?\*?:\s*(.+)$/i);
      if (acc) {
        task._buf.acceptance = acc[1];
        continue;
      }
      const ver = line.match(/^\s*-\s*\*?\*?verifier\*?\*?:\s*(.+)$/i);
      if (ver) {
        task._buf.verifier = ver[1];
        continue;
      }
    }
  }
  flushPhase();

  // S3 / empty: single synthetic phase with no tasks — admit pass must invent with operator
  if (phases.length === 0) {
    warnings.push(
      structureClass === 'S3'
        ? 'Narrative plan (S3): no phases/tasks extracted — admit pass must decompose with operator'
        : 'No phases extracted — admit pass required',
    );
    phases.push({
      id: 'P0',
      title: text(opts.sourcePath) || 'Imported plan',
      status: 'pending',
      tasks: [],
    });
  }

  // Flush dangling checkbox tasks that were left as `task` without phase push of fields
  // (already handled by flushPhase)

  // Auto-number empty task lists warning
  for (const p of phases) {
    if (p.tasks.length === 0) {
      warnings.push(`Phase ${p.id} has no tasks — fill during admit pass`);
    }
  }

  return { structureClass, phases, warnings };
}

function normalizeTaskId(id, phase) {
  const t = text(id);
  if (/^T-\d+$/i.test(t)) return t.toUpperCase().replace(/^t-/, 'T-');
  if (/^T[\d.]+$/i.test(t)) return t.toUpperCase();
  return t || `T-${String(phase.tasks.length + 1).padStart(3, '0')}`;
}

function finalizeTask(task) {
  const buf = task._buf || {};
  const outputs = parseFiles(buf.files);
  const scopeBoundary = parseListish(buf.scope);
  const acceptance = parseListish(buf.acceptance);
  const verifier = parseVerifier(buf.verifier);

  return {
    id: task.id,
    title: task.title,
    status: task.status || 'pending',
    outputs,
    scopeBoundary,
    acceptance,
    verifier,
    evidence: task.status === 'done' ? { passed: true, kind: 'checkbox-imported', note: 'imported checked item — re-verify before trust' } : null,
  };
}

function parseFiles(raw) {
  if (!text(raw)) return [];
  return String(raw)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((path) => ({ path: path.replace(/^`|`$/g, '') }));
}

function parseListish(raw) {
  if (!text(raw)) return [];
  // semicolon or "and" separated; also honor already-single item
  return String(raw)
    .split(/;|\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseVerifier(raw) {
  if (!text(raw)) return null;
  const s = text(raw);
  // kind shell: `cmd` or { kind: shell, command: "..." }
  const kindShell = s.match(/kind\s*[:=]\s*shell/i);
  const cmdMatch = s.match(/command\s*[:=]\s*["'`]?([^"'`]+)["'`]?/i) || s.match(/`([^`]+)`/);
  if (kindShell || cmdMatch) {
    return {
      kind: 'shell',
      command: cmdMatch ? cmdMatch[1].trim() : s,
      expectExitCode: 0,
    };
  }
  if (/kind\s*[:=]\s*test/i.test(s)) {
    return { kind: 'test', runner: 'npm test', pattern: s };
  }
  // bare command
  if (s.length < 200 && !/\s{2,}/.test(s)) {
    return { kind: 'shell', command: s, expectExitCode: 0 };
  }
  return { kind: 'shell', command: s, expectExitCode: 0 };
}
