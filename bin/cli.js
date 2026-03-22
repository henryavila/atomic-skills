#!/usr/bin/env node

import { argv } from 'node:process';

const command = argv[2];

if (command === 'install') {
  const { install } = await import('../src/install.js');
  await install(process.cwd());
} else if (command === 'uninstall') {
  const { uninstall } = await import('../src/uninstall.js');
  await uninstall(process.cwd());
} else {
  console.log(`
  ⚛ Atomic Skills — Stop rewriting prompts.

  Usage:
    npx atomic-skills install      Install skills for your AI IDEs
    npx atomic-skills uninstall    Remove installed skills

  Docs: https://github.com/henryavila/atomic-skills
  `);
}
