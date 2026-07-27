/**
 * Pure plan-end intent vs delivered surface collectors (F2 / P4).
 *
 * Builds intent surface (phase goals, businessIntent, task acceptance, exit
 * criteria) and delivered surface (task done status, claim SHAs, output paths)
 * from plan/initiative-shaped objects plus an optional git SHA list.
 *
 * Also exports a markdown brief section ("Intent vs delivered" checklist) for
 * the cross-model plan-end review prompt, and row scoring helpers for the
 * machine-checkable receipt field `intentVsDelivered`.
 *
 * Scope: pure read. No network. No finalize side effects. No I/O.
 */

/** @typedef {'matched' | 'partial' | 'missing' | 'extra'} IntentVsDeliveredStatus */

export const INTENT_VS_DELIVERED_STATUSES = Object.freeze([
  'matched',
  'partial',
  'missing',
  'extra',
]);

/**
 * @typedef {{
 *   id: string,
 *   kind: string,
 *   text: string,
 *   phaseId?: string,
 *   taskId?: string,
 *   field?: string,
 *   source?: string,
 * }} IntentItem
 *
 * @typedef {{ items: IntentItem[] }} IntentSurface
 *
 * @typedef {{
 *   id: string,
 *   kind: string,
 *   text?: string,
 *   phaseId?: string,
 *   taskId?: string,
 *   status?: string,
 *   done?: boolean,
 *   commitShas?: string[],
 *   paths?: string[],
 *   path?: string,
 * }} DeliveredItem
 *
 * @typedef {{
 *   items: DeliveredItem[],
 *   commitShas: string[],
 *   paths: string[],
 * }} DeliveredSurface
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   status: IntentVsDeliveredStatus,
 *   intentId?: string,
 *   deliveredId?: string,
 *   phaseId?: string,
 *   taskId?: string,
 *   note?: string,
 * }} IntentVsDeliveredRow
 */

/**
 * @param {unknown} v
 * @returns {string}
 */
function asTrimmed(v) {
  if (v == null) return '';
  return String(v).trim();
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function asStringList(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => {
        if (x == null) return '';
        if (typeof x === 'string') return x.trim();
        if (typeof x === 'object') {
          const o = /** @type {Record<string, unknown>} */ (x);
          const t =
            o.description ?? o.text ?? o.criterion ?? o.id ?? o.title ?? '';
          return String(t).trim();
        }
        return String(x).trim();
      })
      .filter((s) => s !== '');
  }
  const s = asTrimmed(raw);
  return s === '' ? [] : [s];
}

/**
 * Flatten businessIntent spine fields into intent items.
 *
 * @param {unknown} bi
 * @param {{ phaseId?: string, source?: string, idPrefix: string }} ctx
 * @returns {IntentItem[]}
 */
function itemsFromBusinessIntent(bi, ctx) {
  if (bi == null || typeof bi !== 'object' || Array.isArray(bi)) return [];
  const o = /** @type {Record<string, unknown>} */ (bi);
  /** @type {IntentItem[]} */
  const out = [];
  for (const field of [
    'value',
    'workflow',
    'rules',
    'outOfScope',
    'doneWhen',
  ]) {
    const text = asTrimmed(o[field]);
    if (text === '') continue;
    /** @type {IntentItem} */
    const item = {
      id: `${ctx.idPrefix}:bi:${field}`,
      kind: 'business-intent',
      field,
      text,
      source: ctx.source || 'businessIntent',
    };
    if (ctx.phaseId) item.phaseId = ctx.phaseId;
    out.push(item);
  }
  return out;
}

/**
 * @param {unknown} phase
 * @param {string} fallbackId
 * @returns {IntentItem[]}
 */
function itemsFromPhase(phase, fallbackId) {
  if (phase == null || typeof phase !== 'object' || Array.isArray(phase)) {
    return [];
  }
  const p = /** @type {Record<string, unknown>} */ (phase);
  const phaseId = asTrimmed(p.id) || asTrimmed(p.phaseId) || fallbackId;
  /** @type {IntentItem[]} */
  const out = [];

  const goal = asTrimmed(p.goal) || asTrimmed(p.title) || asTrimmed(p.objective);
  if (goal) {
    out.push({
      id: `${phaseId}:goal`,
      kind: 'phase-goal',
      phaseId,
      text: goal,
      source: 'phase.goal',
    });
  }

  out.push(
    ...itemsFromBusinessIntent(p.businessIntent, {
      phaseId,
      source: 'phase.businessIntent',
      idPrefix: phaseId,
    }),
  );

  const exitLists = [
    ...asStringList(p.exitCriteria),
    ...asStringList(p.exit_criteria),
  ];
  if (p.exitGate != null && typeof p.exitGate === 'object') {
    const eg = /** @type {Record<string, unknown>} */ (p.exitGate);
    exitLists.push(...asStringList(eg.criteria));
  }
  if (p.exit_gate != null && typeof p.exit_gate === 'object') {
    const eg = /** @type {Record<string, unknown>} */ (p.exit_gate);
    exitLists.push(...asStringList(eg.criteria));
  }
  exitLists.forEach((text, i) => {
    out.push({
      id: `${phaseId}:exit:${i}`,
      kind: 'exit-criteria',
      phaseId,
      text,
      source: 'exitCriteria',
    });
  });

  return out;
}

/**
 * @param {unknown} task
 * @param {string} [phaseId]
 * @returns {IntentItem[]}
 */
function itemsFromTaskAcceptance(task, phaseId) {
  if (task == null || typeof task !== 'object' || Array.isArray(task)) {
    return [];
  }
  const t = /** @type {Record<string, unknown>} */ (task);
  const taskId = asTrimmed(t.id) || asTrimmed(t.taskId) || '';
  const pid =
    asTrimmed(t.phaseId) || asTrimmed(phaseId) || asTrimmed(t.phase) || '';
  const acceptance = asStringList(t.acceptance);
  /** @type {IntentItem[]} */
  const out = [];
  acceptance.forEach((text, i) => {
    /** @type {IntentItem} */
    const item = {
      id: `${pid || 'plan'}:${taskId || 'task'}:acc:${i}`,
      kind: 'task-acceptance',
      text,
      source: 'task.acceptance',
    };
    if (pid) item.phaseId = pid;
    if (taskId) item.taskId = taskId;
    out.push(item);
  });
  return out;
}

/**
 * Build intent surface from plan/initiative-shaped objects.
 *
 * Accepts phase goals, plan/phase businessIntent spine, task acceptance, and
 * exit criteria when provided. Missing fields are skipped (no throw).
 *
 * @param {{
 *   plan?: {
 *     businessIntent?: unknown,
 *     phases?: unknown[],
 *     title?: string,
 *     goal?: string,
 *   } | null,
 *   initiatives?: unknown[] | null,
 *   phases?: unknown[] | null,
 *   tasks?: unknown[] | null,
 *   businessIntent?: unknown,
 *   exitCriteria?: unknown,
 * } | null | undefined} [input]
 * @returns {IntentSurface}
 */
export function buildIntentSurface(input = {}) {
  if (input == null || typeof input !== 'object') {
    return { items: [] };
  }
  /** @type {IntentItem[]} */
  const items = [];

  const plan =
    input.plan != null && typeof input.plan === 'object' && !Array.isArray(input.plan)
      ? /** @type {Record<string, unknown>} */ (input.plan)
      : null;

  if (plan) {
    items.push(
      ...itemsFromBusinessIntent(plan.businessIntent, {
        source: 'plan.businessIntent',
        idPrefix: 'plan',
      }),
    );
    const planGoal = asTrimmed(plan.goal) || asTrimmed(plan.title);
    if (planGoal && !Array.isArray(plan.phases)) {
      items.push({
        id: 'plan:goal',
        kind: 'phase-goal',
        text: planGoal,
        source: 'plan.goal',
      });
    }
    if (Array.isArray(plan.phases)) {
      plan.phases.forEach((ph, i) => {
        items.push(...itemsFromPhase(ph, `F${i}`));
      });
    }
  }

  if (input.businessIntent != null) {
    items.push(
      ...itemsFromBusinessIntent(input.businessIntent, {
        source: 'input.businessIntent',
        idPrefix: 'input',
      }),
    );
  }

  const topPhases = Array.isArray(input.phases) ? input.phases : [];
  topPhases.forEach((ph, i) => {
    items.push(...itemsFromPhase(ph, `P${i}`));
  });

  for (const text of asStringList(input.exitCriteria)) {
    items.push({
      id: `input:exit:${items.length}`,
      kind: 'exit-criteria',
      text,
      source: 'input.exitCriteria',
    });
  }

  const initiatives = Array.isArray(input.initiatives) ? input.initiatives : [];
  for (const init of initiatives) {
    if (init == null || typeof init !== 'object' || Array.isArray(init)) continue;
    const o = /** @type {Record<string, unknown>} */ (init);
    const phaseId = asTrimmed(o.phaseId) || asTrimmed(o.id) || '';
    items.push(
      ...itemsFromBusinessIntent(o.businessIntent, {
        phaseId: phaseId || undefined,
        source: 'initiative.businessIntent',
        idPrefix: phaseId || 'init',
      }),
    );
    const goal = asTrimmed(o.goal) || asTrimmed(o.objective);
    if (goal) {
      /** @type {IntentItem} */
      const g = {
        id: `${phaseId || 'init'}:goal`,
        kind: 'phase-goal',
        text: goal,
        source: 'initiative.goal',
      };
      if (phaseId) g.phaseId = phaseId;
      // Avoid duplicate when plan.phases already contributed the same phase goal.
      if (
        !items.some(
          (it) =>
            it.kind === 'phase-goal' &&
            it.phaseId === phaseId &&
            it.text === goal,
        )
      ) {
        items.push(g);
      }
    }
    const tasks = Array.isArray(o.tasks) ? o.tasks : [];
    for (const task of tasks) {
      items.push(...itemsFromTaskAcceptance(task, phaseId));
    }
  }

  const topTasks = Array.isArray(input.tasks) ? input.tasks : [];
  for (const task of topTasks) {
    items.push(...itemsFromTaskAcceptance(task));
  }

  return { items };
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function collectShas(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => asTrimmed(s)).filter((s) => s !== '');
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function collectPaths(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((p) => asTrimmed(p)).filter((s) => s !== '');
  }
  const s = asTrimmed(raw);
  return s === '' ? [] : [s];
}

/**
 * @param {unknown} status
 * @returns {boolean}
 */
function isDoneStatus(status) {
  const s = asTrimmed(status).toLowerCase();
  return s === 'done' || s === 'closed' || s === 'completed' || s === 'claimed-pass';
}

/**
 * Build delivered surface from task evidence, claim SHAs, and output paths.
 *
 * @param {{
 *   tasks?: unknown[] | null,
 *   claims?: unknown[] | null,
 *   commitShas?: string[] | null,
 *   outputs?: string[] | null,
 *   paths?: string[] | null,
 * } | null | undefined} [input]
 * @returns {DeliveredSurface}
 */
export function buildDeliveredSurface(input = {}) {
  if (input == null || typeof input !== 'object') {
    return { items: [], commitShas: [], paths: [] };
  }

  /** @type {DeliveredItem[]} */
  const items = [];
  /** @type {Set<string>} */
  const shaSet = new Set();
  /** @type {Set<string>} */
  const pathSet = new Set();

  for (const sha of collectShas(input.commitShas)) {
    shaSet.add(sha);
  }
  for (const p of collectPaths(input.paths)) {
    pathSet.add(p);
  }
  for (const p of collectPaths(input.outputs)) {
    pathSet.add(p);
    items.push({
      id: `output:${p}`,
      kind: 'output-path',
      path: p,
      text: p,
    });
  }

  /**
   * @param {unknown} raw
   * @param {'task' | 'claim'} role
   */
  function ingestEvidence(raw, role) {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return;
    const t = /** @type {Record<string, unknown>} */ (raw);
    const taskId = asTrimmed(t.id) || asTrimmed(t.taskId) || '';
    const phaseId = asTrimmed(t.phaseId) || asTrimmed(t.phase) || '';
    const status = asTrimmed(t.status) || '';
    const done = t.done === true || isDoneStatus(status);
    const shas = [
      ...collectShas(t.commitShas),
      ...collectShas(t.claimShas),
    ];
    // base/head range also contributes identity
    const base = asTrimmed(t.base);
    const head = asTrimmed(t.head);
    if (base) shas.push(base);
    if (head) shas.push(head);
    for (const s of shas) shaSet.add(s);

    const paths = [
      ...collectPaths(t.paths),
      ...collectPaths(t.outputs),
      ...collectPaths(t.outputPaths),
    ];
    for (const p of paths) pathSet.add(p);

    /** @type {DeliveredItem} */
    const item = {
      id: `${role}:${phaseId || 'plan'}:${taskId || items.length}`,
      kind: role === 'claim' ? 'claim' : done ? 'task-done' : 'task',
      status: status || (done ? 'done' : undefined),
      done,
      commitShas: shas,
      paths,
    };
    if (phaseId) item.phaseId = phaseId;
    if (taskId) item.taskId = taskId;
    if (taskId || status || shas.length || paths.length) {
      item.text = [
        taskId && `task ${taskId}`,
        status && `status=${status}`,
        shas.length && `shas=${shas.length}`,
        paths.length && `paths=${paths.length}`,
      ]
        .filter(Boolean)
        .join(' ');
      items.push(item);
    }

    for (const p of collectPaths(t.outputs)) {
      items.push({
        id: `output:${phaseId || 'plan'}:${taskId || '?'}:${p}`,
        kind: 'output-path',
        path: p,
        text: p,
        phaseId: phaseId || undefined,
        taskId: taskId || undefined,
      });
    }
  }

  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  for (const t of tasks) ingestEvidence(t, 'task');

  const claims = Array.isArray(input.claims) ? input.claims : [];
  for (const c of claims) ingestEvidence(c, 'claim');

  return {
    items,
    commitShas: [...shaSet],
    paths: [...pathSet],
  };
}

/**
 * Escape a cell for a markdown table.
 * @param {unknown} s
 * @returns {string}
 */
function mdCell(s) {
  return String(s ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');
}

/**
 * Score intent items against delivered evidence into receipt rows.
 *
 * Heuristic (pure, deterministic):
 * - task-acceptance: matched if same taskId has done evidence + ≥1 SHA;
 *   partial if done without SHA or SHA without done; missing otherwise.
 * - phase-goal / exit-criteria / business-intent: matched if every task in
 *   that phase is done with SHAs; partial if some; missing if none (or no
 *   phase tasks known).
 * - extra: delivered done tasks / output paths with no intent counterpart.
 *
 * @param {IntentSurface | null | undefined} intent
 * @param {DeliveredSurface | null | undefined} delivered
 * @returns {IntentVsDeliveredRow[]}
 */
export function buildIntentVsDeliveredRows(intent, delivered) {
  const intentItems = intent?.items && Array.isArray(intent.items) ? intent.items : [];
  const deliveredItems =
    delivered?.items && Array.isArray(delivered.items) ? delivered.items : [];

  /** @type {Map<string, DeliveredItem[]>} */
  const byTask = new Map();
  for (const d of deliveredItems) {
    const key = `${d.phaseId || ''}::${d.taskId || ''}`;
    if (!d.taskId) continue;
    if (!byTask.has(key)) byTask.set(key, []);
    byTask.get(key).push(d);
  }

  /**
   * @param {string | undefined} phaseId
   * @param {string | undefined} taskId
   */
  function taskEvidence(phaseId, taskId) {
    if (!taskId) return [];
    const exact = byTask.get(`${phaseId || ''}::${taskId}`);
    if (exact && exact.length) return exact;
    // Fall back to taskId-only match when phase not on claim.
    /** @type {DeliveredItem[]} */
    const loose = [];
    for (const [k, list] of byTask) {
      if (k.endsWith(`::${taskId}`)) loose.push(...list);
    }
    return loose;
  }

  /**
   * @param {DeliveredItem[]} ev
   * @returns {IntentVsDeliveredStatus}
   */
  function scoreTaskEvidence(ev) {
    if (!ev.length) return 'missing';
    const anyDone = ev.some((e) => e.done === true || isDoneStatus(e.status));
    const anySha = ev.some(
      (e) => Array.isArray(e.commitShas) && e.commitShas.length > 0,
    );
    if (anyDone && anySha) return 'matched';
    if (anyDone || anySha) return 'partial';
    return 'missing';
  }

  /**
   * @param {string | undefined} phaseId
   */
  function phaseTaskScore(phaseId) {
    /** @type {DeliveredItem[]} */
    const phaseTasks = deliveredItems.filter(
      (d) =>
        d.taskId &&
        (d.kind === 'task-done' || d.kind === 'task' || d.kind === 'claim') &&
        (!phaseId || d.phaseId === phaseId),
    );
    if (!phaseTasks.length) {
      // No task-level evidence for this phase — use any SHA/path as partial.
      if (
        (delivered?.commitShas && delivered.commitShas.length) ||
        (delivered?.paths && delivered.paths.length)
      ) {
        return 'partial';
      }
      return 'missing';
    }
    const statuses = phaseTasks.map((t) => scoreTaskEvidence([t]));
    if (statuses.every((s) => s === 'matched')) return 'matched';
    if (statuses.every((s) => s === 'missing')) return 'missing';
    return 'partial';
  }

  /** @type {IntentVsDeliveredRow[]} */
  const rows = [];
  /** @type {Set<string>} */
  const coveredTaskKeys = new Set();

  intentItems.forEach((it, idx) => {
    /** @type {IntentVsDeliveredStatus} */
    let status = 'missing';
    /** @type {string | undefined} */
    let note;
    /** @type {string | undefined} */
    let deliveredId;

    if (it.kind === 'task-acceptance' && it.taskId) {
      const ev = taskEvidence(it.phaseId, it.taskId);
      status = scoreTaskEvidence(ev);
      if (ev[0]) deliveredId = ev[0].id;
      coveredTaskKeys.add(`${it.phaseId || ''}::${it.taskId}`);
      note =
        status === 'matched'
          ? 'task done with claim SHA(s)'
          : status === 'partial'
            ? 'task evidence incomplete (done xor SHAs)'
            : 'no done/claim evidence for task';
    } else {
      status = phaseTaskScore(it.phaseId);
      note =
        status === 'matched'
          ? 'phase tasks fully evidenced'
          : status === 'partial'
            ? 'phase partially evidenced'
            : 'no delivery evidence for phase/item';
    }

    rows.push({
      id: `ivd:${it.id || idx}`,
      label: it.text,
      status,
      intentId: it.id,
      deliveredId,
      phaseId: it.phaseId,
      taskId: it.taskId,
      note,
    });
  });

  // Extra: delivered done tasks with no intent acceptance counterpart.
  for (const d of deliveredItems) {
    if (!d.taskId) continue;
    if (!(d.done === true || isDoneStatus(d.status))) continue;
    if (d.kind === 'output-path') continue;
    const key = `${d.phaseId || ''}::${d.taskId}`;
    if (coveredTaskKeys.has(key)) continue;
    // Also skip if any intent item referenced this taskId
    const intentMentions = intentItems.some(
      (it) => it.taskId === d.taskId && (!it.phaseId || it.phaseId === d.phaseId),
    );
    if (intentMentions) continue;
    rows.push({
      id: `ivd:extra:${d.id}`,
      label: d.text || `delivered ${d.taskId}`,
      status: 'extra',
      deliveredId: d.id,
      phaseId: d.phaseId,
      taskId: d.taskId,
      note: 'delivered task without matching intent acceptance',
    });
  }

  // Extra output paths not referenced by any intent text (informational).
  for (const d of deliveredItems) {
    if (d.kind !== 'output-path') continue;
    const p = d.path || d.text || '';
    if (!p) continue;
    const mentioned = intentItems.some((it) => it.text.includes(p));
    if (mentioned) continue;
    // Only add a few extras for outputs that look unplanned — keep one row per path
    // when no taskId linkage existed in intent at all.
    if (d.taskId && coveredTaskKeys.has(`${d.phaseId || ''}::${d.taskId}`)) {
      continue;
    }
  }

  return rows;
}

/**
 * Markdown brief section for the plan-end cross-model review prompt.
 * Forces the reviewer to score intended vs delivered (not only a generic diff).
 *
 * @param {IntentSurface | null | undefined} intent
 * @param {DeliveredSurface | null | undefined} delivered
 * @param {{ rows?: IntentVsDeliveredRow[] | null }} [opts]
 * @returns {string}
 */
export function buildIntentVsDeliveredBrief(intent, delivered, opts = {}) {
  const intentItems = intent?.items && Array.isArray(intent.items) ? intent.items : [];
  const deliveredItems =
    delivered?.items && Array.isArray(delivered.items) ? delivered.items : [];
  const commitShas = delivered?.commitShas && Array.isArray(delivered.commitShas)
    ? delivered.commitShas
    : [];
  const paths =
    delivered?.paths && Array.isArray(delivered.paths) ? delivered.paths : [];

  const rows =
    opts.rows != null && Array.isArray(opts.rows)
      ? opts.rows
      : buildIntentVsDeliveredRows(intent, delivered);

  const lines = [
    '## Intent vs delivered',
    '',
    'Plan-end cross-model review answers: **did we build what we planned?**',
    'Score each row as `matched` | `partial` | `missing` | `extra`. Generic code',
    'diff review alone does **not** satisfy the intent-vs-delivered gate.',
    '',
    '### Intent surface (planned)',
    '',
  ];

  if (intentItems.length === 0) {
    lines.push('_No intent items collected._', '');
  } else {
    lines.push('| # | kind | phase | task | text |');
    lines.push('|---|------|-------|------|------|');
    intentItems.forEach((it, i) => {
      lines.push(
        `| ${i + 1} | ${mdCell(it.kind)} | ${mdCell(it.phaseId || '')} | ${mdCell(it.taskId || '')} | ${mdCell(it.text)} |`,
      );
    });
    lines.push('');
  }

  lines.push('### Delivered surface (actual)', '');
  if (deliveredItems.length === 0 && commitShas.length === 0 && paths.length === 0) {
    lines.push('_No delivered evidence collected._', '');
  } else {
    lines.push(
      `- **commit SHAs (${commitShas.length}):** ${
        commitShas.length
          ? commitShas
              .slice(0, 20)
              .map((s) => `\`${s}\``)
              .join(', ') + (commitShas.length > 20 ? ' …' : '')
          : '_(none)_'
      }`,
    );
    lines.push(
      `- **paths (${paths.length}):** ${
        paths.length
          ? paths
              .slice(0, 30)
              .map((p) => `\`${p}\``)
              .join(', ') + (paths.length > 30 ? ' …' : '')
          : '_(none)_'
      }`,
    );
    lines.push('');
    lines.push('| # | kind | phase | task | status | shas |');
    lines.push('|---|------|-------|------|--------|------|');
    deliveredItems.forEach((d, i) => {
      const shaN = Array.isArray(d.commitShas) ? d.commitShas.length : 0;
      lines.push(
        `| ${i + 1} | ${mdCell(d.kind)} | ${mdCell(d.phaseId || '')} | ${mdCell(d.taskId || '')} | ${mdCell(d.status || (d.done ? 'done' : ''))} | ${shaN} |`,
      );
    });
    lines.push('');
  }

  lines.push('### Intent vs delivered checklist', '');
  if (rows.length === 0) {
    lines.push(
      '_Empty checklist — under automate this fails `planEndReviewOk` (empty `intentVsDelivered`)._',
      '',
    );
  } else {
    lines.push('| # | status | label | note |');
    lines.push('|---|--------|-------|------|');
    rows.forEach((r, i) => {
      lines.push(
        `| ${i + 1} | ${mdCell(r.status)} | ${mdCell(r.label)} | ${mdCell(r.note || '')} |`,
      );
    });
    lines.push('');
    lines.push(
      'Receipt field: stamp non-empty `intentVsDelivered` rows (status one of',
      '`matched` | `partial` | `missing` | `extra`) on the plan-end receipt.',
      '',
    );
  }

  return lines.join('\n');
}
