#!/usr/bin/env node

import { parseArgs } from 'node:util';

let values, positionals;
try {
  ({ values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      yes: { type: 'boolean', short: 'y', default: false },
      project: { type: 'boolean', default: false },
      ide: { type: 'string' },
      lang: { type: 'string' },
      json: { type: 'boolean', default: false },
      'all-detected': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      repair: { type: 'boolean', default: false },
      'force-incomplete': { type: 'boolean', default: false },
      'force-adopt': { type: 'boolean', default: false },
    },
  }));
} catch (err) {
  console.error(`  Error: ${err.message}`);
  process.exit(1);
}

const command = positionals[0];

if (values.help || !command) {
  console.log(`
  ⚛ Atomic Skills — Stop rewriting prompts.

  Usage:
    npx @henryavila/atomic-skills install    [--yes] [--project] [--ide <ids>|detected] [--all-detected] [--lang <code>] [--repair] [--force-adopt]
    npx @henryavila/atomic-skills detect     [--project] [--json]
    npx @henryavila/atomic-skills status     [--project]
    npx @henryavila/atomic-skills uninstall  [--yes] [--project] [--force-incomplete]

  Options:
    --yes, -y         Non-interactive: (install) accept auto-detected defaults;
                      (uninstall) skip the confirmation prompt
    --project         Skip scope picker and install to the current repo's Git root
    --ide <ids>       Comma-separated: claude-code,cursor,antigravity,codex,opencode,github-copilot,grok
                      Use --ide detected or --all-detected to refresh from installed IDEs
    --lang <code>     Communication language for all skills (e.g. en, pt, es, fr, ja)
    --repair          (install) Recover from an incomplete installer transaction:
                      scans user+project for incomplete; refuse silent resume on
                      pre-U journals (use uninstall --force-incomplete); post-U is
                      reverse-only (clears incomplete — re-run install separately;
                      does not auto-reinstall)
    --force-adopt     (install) Reclaim foreign/user content at desired skill paths
                      (default: leave unmanaged-desired paths untouched and report them)
    --force-incomplete (uninstall) Best-effort reverse of journaled effects when the
                      install is stuck incomplete; routes to the incomplete scope;
                      writes a residual recovery ledger (never hand-edit manifest JSON);
                      exits non-zero if reverse fails or incomplete is retained

    Docs: https://github.com/henryavila/atomic-skills
  `);
} else if (command === 'install') {
  if (values.ide && values['all-detected']) {
    console.error('  Error: use either --ide or --all-detected, not both');
    process.exit(1);
  }
  if (values['force-incomplete']) {
    console.error('  Error: --force-incomplete is for uninstall only (use install --repair)');
    process.exit(1);
  }
  const { install } = await import('../src/install.js');
  const useDetected = values.ide === 'detected' || values['all-detected'];
  await install(process.cwd(), {
    yes: values.yes,
    project: values.project,
    ide: values.ide && values.ide !== 'detected' ? values.ide.split(',') : null,
    lang: values.lang,
    allDetected: useDetected,
    repair: values.repair,
    forceAdopt: values['force-adopt'],
  });
} else if (command === 'detect') {
  const { homedir } = await import('node:os');
  const pc = (await import('picocolors')).default;
  const { detectIDEState } = await import('../src/detect.js');
  let basePath = homedir();
  if (values.project) {
    const { resolveProjectScopeTarget } = await import('../src/scope.js');
    const target = resolveProjectScopeTarget(process.cwd());
    if (!target.ok) {
      console.error(`  Error: ${target.reason}`);
      process.exit(1);
    }
    basePath = target.path;
  }
  const state = detectIDEState(basePath);
  if (values.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`Supported: ${state.supported.join(', ')}`);
    console.log(`Detected:  ${state.detected.length > 0 ? state.detected.join(', ') : pc.yellow('(none)')}`);
    console.log(`Effective: ${state.effective.length > 0 ? state.effective.join(', ') : pc.yellow('(none)')}`);
  }
} else if (command === 'uninstall') {
  if (values.repair) {
    console.error('  Error: --repair is for install only (use uninstall --force-incomplete)');
    process.exit(1);
  }
  const { uninstall } = await import('../src/uninstall.js');
  await uninstall(process.cwd(), {
    scope: values.project ? 'project' : null,
    yes: values.yes,
    forceIncomplete: values['force-incomplete'],
  });
} else if (command === 'status') {
  const { status } = await import('../src/status.js');
  status(process.cwd(), { forceProject: values.project });
} else {
  console.error(`  Unknown command: ${command}. Run with --help for usage.`);
  process.exit(1);
}
