/**
 * Pure sealed phase-writer brief builder (Layer 3).
 *
 * A sealed brief is a self-contained prompt for the code-only phase writer:
 * work-order + code-only fence + claim-report shape. It never includes host
 * chat history.
 *
 * No I/O.
 */

/**
 * @typedef {import('./automate-work-order.js').PhaseWorkOrder} PhaseWorkOrder
 */

/**
 * Default claim-report path relative to plan/repo root.
 * @param {string} planSlug
 * @returns {string}
 */
export function defaultClaimReportPath(planSlug) {
  const slug = String(planSlug || '').trim() || 'plan';
  return `.atomic-skills/status/automate/${slug}-claims.json`;
}

/**
 * Code-only fence summary embedded in every sealed brief.
 * @returns {string}
 */
export function codeOnlyFenceText() {
  return [
    '## Code-only fence (HARD)',
    '',
    'You are a **code-only phase writer**. You MAY:',
    '- Orient on the phase work-order (task ids, paths, scopeBoundary, acceptance, verifier).',
    '- Edit product/source paths inside each task\'s admitted targets (respect scopeBoundary exclusions).',
    '- Run pre-close self-check verifiers for confidence.',
    '- Create **implementation** microcommits with explicit paths only (`rtk git add <paths>` — never `git add .` / `-A`).',
    '- Return a structured **claim report** for every task you attempted.',
    '',
    'You **MUST NOT**:',
    '- Invoke `done`, `phase-done`, finalize, archive, or any project-skill state transition.',
    '- Mutate durable `.atomic-skills/` project state (plan.md, phase initiatives, rollups, lessons, review receipts, handoff).',
    '- Mark tasks `status: done` in initiative YAML (orchestrator closes).',
    '- Self-certify: a claim is confidence, not closure.',
    '- Nest a phase worktree under the plan worktree.',
    '- Depend on host chat history (this sealed brief is the full packet).',
    '',
    'Never claim Layer 4 shipped. Never commit writer-lease secrets.',
  ].join('\n');
}

/**
 * Claim-report shape section for the sealed brief.
 * @param {string} claimReportPath
 * @returns {string}
 */
export function claimReportShapeText(claimReportPath) {
  return [
    '## Claim report (required output)',
    '',
    `Write the claim report JSON to: \`${claimReportPath}\``,
    '',
    'Envelope shape:',
    '```json',
    '{',
    '  "planSlug": "<planSlug>",',
    '  "phaseId": "<phaseId>",',
    '  "worktreePath": "<cwd>",',
    '  "writerBranch": "<branch>",',
    '  "finishedAt": "<ISO>",',
    '  "tasks": [',
    '    {',
    '      "taskId": "T-00N",',
    '      "status": "claimed-pass|claimed-fail|blocked|skipped",',
    '      "commitShas": ["..."],',
    '      "base": null,',
    '      "head": null,',
    '      "paths": ["..."],',
    '      "verifierCommand": "...",',
    '      "exitCode": 0,',
    '      "transcript": "..."',
    '    }',
    '  ]',
    '}',
    '```',
    '',
    'Rules:',
    '- Array key is **`tasks`** (canonical; `claims` is a tolerated alias only).',
    '- Open claims need commit identity: non-empty `commitShas[]` **or** `base`+`head`.',
    '- Open claims need `paths[]` ≥1 non-empty path, `verifierCommand`, `exitCode`, `transcript`.',
    '- `claimed-pass` requires `exitCode === 0`.',
    '- Multi-task exclusivity: do not share bare SHAs across open claims without exclusive `base`+`head` per task.',
    '- Prefer exclusive `base`+`head` per task when multi-task commits share SHAs.',
    '- Do not invent pass for missing work-order tasks.',
  ].join('\n');
}

/**
 * Render work-order as a markdown section (verbatim paths/commands).
 * @param {PhaseWorkOrder} workOrder
 * @returns {string}
 */
export function formatWorkOrderSection(workOrder) {
  const lines = [
    '## Phase work-order',
    '',
    `- **planSlug:** ${workOrder.planSlug}`,
    `- **phaseId:** ${workOrder.phaseId}`,
  ];
  if (workOrder.initiativePath) lines.push(`- **initiativePath:** ${workOrder.initiativePath} (read-only)`);
  if (workOrder.worktreePath) lines.push(`- **worktreePath (cwd):** ${workOrder.worktreePath}`);
  if (workOrder.writerBranch) lines.push(`- **writerBranch:** ${workOrder.writerBranch}`);
  if (workOrder.baseRef) lines.push(`- **baseRef:** ${workOrder.baseRef}`);
  if (workOrder.decisionLogPath) {
    lines.push(
      `- **decisionLogPath:** ${workOrder.decisionLogPath} (informational — host owns append; do not write)`,
    );
  }
  lines.push('', `### Tasks (${workOrder.tasks.length})`, '');

  for (const t of workOrder.tasks) {
    lines.push(`#### ${t.taskId}${t.title ? ` — ${t.title}` : ''}`);
    if (t.status) lines.push(`- status: ${t.status}`);
    lines.push(`- paths: ${JSON.stringify(t.paths)}`);
    lines.push(`- scopeBoundary: ${JSON.stringify(t.scopeBoundary)}`);
    lines.push(`- acceptance: ${JSON.stringify(t.acceptance)}`);
    lines.push(`- verifier: ${JSON.stringify(t.verifier)}`);
    if (t.weight != null) lines.push(`- weight: ${t.weight}`);
    if (t.tags && t.tags.length) lines.push(`- tags: ${JSON.stringify(t.tags)}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Build a sealed brief string from a work-order.
 *
 * @param {{
 *   workOrder: PhaseWorkOrder,
 *   claimReportPath?: string | null,
 *   extraContext?: string | null,
 *   title?: string | null,
 * }} input
 * @returns {string}
 */
export function buildSealedBrief(input) {
  if (input == null || typeof input !== 'object') {
    throw new Error('buildSealedBrief: input is required');
  }
  const workOrder = input.workOrder;
  if (workOrder == null || typeof workOrder !== 'object') {
    throw new Error('buildSealedBrief: workOrder is required');
  }
  if (!workOrder.planSlug || !workOrder.phaseId) {
    throw new Error('buildSealedBrief: workOrder.planSlug and phaseId are required');
  }
  if (!Array.isArray(workOrder.tasks)) {
    throw new Error('buildSealedBrief: workOrder.tasks must be an array');
  }

  const claimPath =
    input.claimReportPath != null && String(input.claimReportPath).trim() !== ''
      ? String(input.claimReportPath).trim()
      : defaultClaimReportPath(workOrder.planSlug);

  const title =
    input.title != null && String(input.title).trim() !== ''
      ? String(input.title).trim()
      : `Phase writer brief — ${workOrder.planSlug} ${workOrder.phaseId}`;

  const parts = [
    `# ${title}`,
    '',
    'You are a **code-only phase writer** implementing plan tasks in an isolated sibling worktree.',
    'This sealed brief is self-contained. **No host chat history is included or authorized.**',
    '',
    codeOnlyFenceText(),
    '',
    formatWorkOrderSection(workOrder),
    claimReportShapeText(claimPath),
    '',
    '## Exit',
    '',
    '1. All listed verifiers green for claimed-pass tasks (self-check).',
    `2. Write claim report to \`${claimPath}\`.`,
    '3. Final message: summary of files changed, commit SHAs, claim report path, any blockers.',
    '4. Do not mark tasks done in YAML. Do not call done/phase-done.',
  ];

  if (input.extraContext != null && String(input.extraContext).trim() !== '') {
    // Extra context is scoped product context only — never chat history.
    parts.push('', '## Scoped context (product excerpts only — not chat history)', '', String(input.extraContext).trim());
  }

  // Explicit ban markers for tests / greppability
  parts.push(
    '',
    '---',
    'sealed-brief: true',
    'host-chat-history: excluded',
  );

  return `${parts.join('\n')}\n`;
}

/**
 * Quick structural check that a brief string looks sealed (for tests/CLI).
 * @param {string} brief
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSealedBriefShape(brief) {
  const errors = [];
  const s = brief == null ? '' : String(brief);
  if (!s.trim()) errors.push('empty brief');
  if (!/Code-only fence/i.test(s)) errors.push('missing code-only fence');
  if (!/Claim report/i.test(s)) errors.push('missing claim report shape');
  if (!/host-chat-history:\s*excluded/i.test(s)) {
    errors.push('missing host-chat-history: excluded marker');
  }
  if (/orchestrator chat history|host chat history pasted/i.test(s) && !/excluded|MUST NOT|no host chat/i.test(s)) {
    errors.push('brief appears to embed host chat history');
  }
  return { ok: errors.length === 0, errors };
}
