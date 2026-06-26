import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMPLEMENT = join(__dirname, '..', 'skills', 'core', 'implement.md');

describe('implement skill microcommit contract', () => {
  it('requires a real microcommit checkpoint after every verified task close', () => {
    const content = readFileSync(IMPLEMENT, 'utf8');

    assert.match(content, /MICROCOMMITS ARE THE SNAPSHOT/);
    assert.match(content, /after every verified task close/i);
    assert.match(content, /rtk git add <explicit-paths>/);
    assert.match(content, /rtk git commit -m "feat\(T-NNN\): <summary>"/);
    assert.match(content, /rtk git commit -m "chore\(project\): close <task-id>"/);
    assert.match(content, /Never use `git add \.` or `git add -A`/);
    assert.match(content, /A handoff that records dirty files is a crash report, not a successful checkpoint/);
  });
});
