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
      port: { type: 'string' },
      'aideck-bin': { type: 'string' },
      demo: { type: 'boolean', default: false },
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
    npx @henryavila/atomic-skills install    [--yes] [--project] [--ide <ids>|detected] [--all-detected] [--lang <code>]
    npx @henryavila/atomic-skills detect     [--project] [--json]
    npx @henryavila/atomic-skills status     [--project]
    npx @henryavila/atomic-skills uninstall  [--yes] [--project]
    npx @henryavila/atomic-skills serve      [--demo] [--port <N>] [--aideck-bin <path>]

  Options:
    --yes, -y         Non-interactive: (install) accept auto-detected defaults;
                      (uninstall) skip the confirmation prompt
    --project         Skip scope picker and install to the current repo's Git root
    --ide <ids>       Comma-separated: claude-code,cursor,gemini,codex,opencode,github-copilot,grok
                      Use --ide detected or --all-detected to refresh from installed IDEs
    --lang <code>     Communication language for all skills (e.g. en, pt, es, fr, ja)
    --demo            (serve) Stage demo fixtures (a sample plan + initiative)
                      in a tmp dir and serve from there. Useful for first
                      look without bootstrapping your own .atomic-skills/.
    --port <N>        (serve) Port for the aideck backend (default 7777)
    --aideck-bin <p>  (serve) Path to aideck binary or its dist/cli.js. Default: probes
                      $AIDECK_BIN, installed launcher shim, the @henryavila/aideck
                      package, ../aideck/dist/cli.js, then PATH lookup of "aideck"

  Docs: https://github.com/henryavila/atomic-skills
  `);
} else if (command === 'install') {
  if (values.ide && values['all-detected']) {
    console.error('  Error: use either --ide or --all-detected, not both');
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
  const { uninstall } = await import('../src/uninstall.js');
  await uninstall(process.cwd(), {
    scope: values.project ? 'project' : null,
    yes: values.yes,
  });
} else if (command === 'status') {
  const { status } = await import('../src/status.js');
  status(process.cwd(), { forceProject: values.project });
} else if (command === 'serve') {
  const { serve } = await import('../src/serve.js');
  await serve({
    port: values.port,
    aideckBin: values['aideck-bin'],
    demo: values.demo,
  });
} else {
  console.error(`  Unknown command: ${command}. Run with --help for usage.`);
  process.exit(1);
}
