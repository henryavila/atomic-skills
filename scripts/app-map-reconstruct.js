#!/usr/bin/env node

import { computeReconstruction, persistReconstruction } from '../src/app-map/reconstruct.js';

function usage() {
  return 'Usage: node scripts/app-map-reconstruct.js <appRoot> --delta|--persist [--project-id <id>]';
}

function parseArgs(argv) {
  const args = [...argv];
  const appRoot = args.shift();
  let mode = null;
  let projectId = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--delta' || arg === '--persist') {
      if (mode) throw new Error('Choose only one mode: --delta or --persist');
      mode = arg.slice(2);
      continue;
    }
    if (arg === '--project-id') {
      // `--project-id` como último arg → args[i+1] é undefined; rejeitar junto com
      // a string vazia, senão o flag mal-digitado cai silenciosamente no basename
      // (review F2 #5).
      const value = args[i + 1];
      if (value === undefined || value === '') throw new Error('--project-id requires a non-empty value');
      projectId = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!appRoot || !mode) throw new Error(usage());
  return { appRoot, mode, projectId };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

try {
  const { appRoot, mode, projectId } = parseArgs(process.argv.slice(2));
  const reconstruction = computeReconstruction({ appRoot, projectId });
  if (mode === 'delta') {
    printJson(reconstruction.delta);
  } else {
    printJson(persistReconstruction({ appRoot, projectId, pages: reconstruction.pages }));
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
