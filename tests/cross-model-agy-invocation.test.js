import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INVOCATION = join(
  ROOT,
  'skills/shared/codex-bridge-assets/providers/agy/invocation-canonical.txt',
);
const PREFLIGHT = join(
  ROOT,
  'skills/shared/codex-bridge-assets/providers/agy/preflight-checks.txt',
);
const SKIP_PERMISSIONS = '--dangerously-skip-permissions';

/** Bash fences whose command actually starts headless `agy -p`. */
function headlessAgyCommands(body) {
  const blocks = [];
  const re = /```bash\n([\s\S]*?)```/g;
  let match;
  while ((match = re.exec(body))) blocks.push(match[1]);
  return blocks.filter((block) => /\bagy\b/.test(block) && /(^|\s)-p(\s|$)/.test(block));
}

describe('agy provider headless invocation', () => {
  it('ships a non-empty invocation-canonical leaf', () => {
    assert.ok(existsSync(INVOCATION), `missing ${INVOCATION}`);
    const body = readFileSync(INVOCATION, 'utf8');
    assert.ok(body.trim().length > 0, 'invocation-canonical must be non-empty');
  });

  it('headless review command includes --dangerously-skip-permissions', () => {
    const body = readFileSync(INVOCATION, 'utf8');
    const commands = headlessAgyCommands(body);
    assert.ok(commands.length >= 1, 'invocation-canonical must contain an agy -p command');
    for (const command of commands) {
      assert.ok(
        command.includes(SKIP_PERMISSIONS),
        `agy headless command must include ${SKIP_PERMISSIONS}:\n${command}`,
      );
    }
  });

  it('headless preflight probe includes --dangerously-skip-permissions', () => {
    assert.ok(existsSync(PREFLIGHT), `missing ${PREFLIGHT}`);
    const body = readFileSync(PREFLIGHT, 'utf8');
    const commands = headlessAgyCommands(body);
    assert.ok(commands.length >= 1, 'preflight must contain an agy -p probe');
    for (const command of commands) {
      assert.ok(
        command.includes(SKIP_PERMISSIONS),
        `agy headless probe must include ${SKIP_PERMISSIONS}:\n${command}`,
      );
    }
  });

  it('review-plan and review-code share the provider leaf (no inlined agy -p)', () => {
    for (const skill of ['review-plan.md', 'review-code.md']) {
      const body = readFileSync(join(ROOT, 'skills/core', skill), 'utf8');
      assert.match(body, /envelope-orchestration\.md/);
      assert.match(body, /providers\/«PROVIDER»\//);
      assert.equal(
        /\bagy\b[\s\S]{0,80}-p\b/.test(body),
        false,
        `${skill} must not inline its own agy -p command`,
      );
    }
  });
});
