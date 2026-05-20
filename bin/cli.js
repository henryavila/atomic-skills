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
      scope: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
      port: { type: 'string' },
      'force-build': { type: 'boolean', default: false },
      'aideck-bin': { type: 'string' },
    },
  }));
} catch (err) {
  console.error(`  Error: ${err.message}`);
  process.exit(1);
}

const command = positionals[0];

// Backward compat: --scope project → --project
if (values.scope === 'project') values.project = true;
if (values.scope && values.scope !== 'user' && values.scope !== 'project') {
  console.error('  Error: --scope must be "user" or "project"');
  process.exit(1);
}

if (values.help || !command) {
  console.log(`
  ⚛ Atomic Skills — Stop rewriting prompts.

  Usage:
    npx @henryavila/atomic-skills install    [--yes] [--project] [--ide <ids>|detected] [--all-detected] [--lang <code>]
    npx @henryavila/atomic-skills detect     [--project] [--json]
    npx @henryavila/atomic-skills status
    npx @henryavila/atomic-skills uninstall  [--project]
    npx @henryavila/atomic-skills serve      [--port <N>] [--force-build] [--aideck-bin <path>]

  Options:
    --yes, -y         Accept auto-detected defaults (non-interactive)
    --project         Install to ./ instead of ~/ (default: user scope)
    --ide <ids>       Comma-separated: claude-code,cursor,gemini,codex,opencode,github-copilot
                      Use --ide detected or --all-detected to refresh from installed IDEs
    --lang <code>     Language: en, pt
    --port <N>        (serve) Port for the aideck backend (default 7777)
    --force-build     (serve) Rebuild dashboard bundle even if dist/dashboard exists
    --aideck-bin <p>  (serve) Path to aideck binary or its dist/cli.js. Default: probes
                      $AIDECK_BIN, ../aideck/dist/cli.js, then PATH lookup of "aideck"

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
  const basePath = values.project ? process.cwd() : homedir();
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
  const scope = values.project ? 'project' : (values.scope || null);
  await uninstall(process.cwd(), scope);
} else if (command === 'status') {
  const { status } = await import('../src/status.js');
  status(process.cwd());
} else if (command === 'serve') {
  const { serve } = await import('../src/serve.js');
  await serve({
    port: values.port,
    forceBuild: values['force-build'],
    aideckBin: values['aideck-bin'],
  });
} else {
  console.error(`  Unknown command: ${command}. Run with --help for usage.`);
  process.exit(1);
}
