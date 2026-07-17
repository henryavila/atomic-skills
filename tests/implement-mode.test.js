import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  parseImplementMode,
  isAutomateActive,
  IMPLEMENT_MODES,
} from '../src/implement-mode.js';

describe('parseImplementMode', () => {
  it('accepts --mode=automate token and returns mode automate', () => {
    const result = parseImplementMode(['implement', '--mode=automate', 'my-plan']);
    assert.equal(result.mode, 'automate');
    assert.equal(result.clearExecutionMode, false);
  });

  it('accepts mode:automate token and returns mode automate', () => {
    const result = parseImplementMode('mode:automate my-plan');
    assert.equal(result.mode, 'automate');
  });

  it('accepts --mode automate (space-separated) form', () => {
    const result = parseImplementMode(['--mode', 'automate']);
    assert.equal(result.mode, 'automate');
  });

  it('absent mode returns default without treating automate as on', () => {
    const result = parseImplementMode(['my-plan']);
    assert.ok(result.mode === 'default' || result.mode === 'mode1');
    assert.notEqual(result.mode, 'automate');
    assert.equal(isAutomateActive({ cliMode: result.mode }), false);
  });

  it('--mode=1 returns mode1 / default without automate on', () => {
    const result = parseImplementMode(['--mode=1']);
    assert.ok(result.mode === 'default' || result.mode === 'mode1' || result.mode === '1');
    assert.notEqual(result.mode, 'automate');
    assert.equal(isAutomateActive({ cliMode: result.mode }), false);
  });

  it('empty / missing argv yields default', () => {
    assert.notEqual(parseImplementMode([]).mode, 'automate');
    assert.notEqual(parseImplementMode('').mode, 'automate');
    assert.notEqual(parseImplementMode(undefined).mode, 'automate');
  });

  it('rejects unknown mode with a clear error (not ignored)', () => {
    assert.throws(
      () => parseImplementMode(['--mode=banana']),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(String(err.message), /unknown|invalid|mode/i);
        assert.match(String(err.message), /banana/i);
        return true;
      },
    );
  });

  it('detects --clear-execution-mode flag', () => {
    const result = parseImplementMode(['--clear-execution-mode', 'my-plan']);
    assert.equal(result.clearExecutionMode, true);
  });

  it('known modes are frozen and include automate', () => {
    assert.ok(IMPLEMENT_MODES.includes('automate'));
    assert.throws(() => {
      // @ts-expect-error frozen
      IMPLEMENT_MODES.push('hack');
    });
  });
});

describe('isAutomateActive — CLI vs stamp vs clear precedence', () => {
  it('OFF by default when nothing set', () => {
    assert.equal(isAutomateActive({}), false);
    assert.equal(isAutomateActive({ cliMode: undefined, planExecutionMode: undefined }), false);
    assert.equal(isAutomateActive({ cliMode: 'default' }), false);
    assert.equal(isAutomateActive({ cliMode: 'mode1' }), false);
    assert.equal(isAutomateActive({ cliMode: '1' }), false);
  });

  it('cliMode === automate → true', () => {
    assert.equal(
      isAutomateActive({ cliMode: 'automate', planExecutionMode: undefined }),
      true,
    );
  });

  it('stamp-alone re-entry: planExecutionMode automate with no clear → true', () => {
    assert.equal(
      isAutomateActive({
        cliMode: undefined,
        planExecutionMode: 'automate',
        clearExecutionMode: false,
      }),
      true,
    );
    assert.equal(
      isAutomateActive({
        cliMode: 'default',
        planExecutionMode: 'automate',
      }),
      true,
    );
  });

  it('clear flag true → false even when CLI or stamp would enable automate', () => {
    assert.equal(
      isAutomateActive({
        cliMode: 'automate',
        planExecutionMode: 'automate',
        clearExecutionMode: true,
      }),
      false,
    );
    assert.equal(
      isAutomateActive({
        cliMode: undefined,
        planExecutionMode: 'automate',
        clearExecutionMode: true,
      }),
      false,
    );
  });

  it('stamp alone with clear false keeps automate active', () => {
    assert.equal(
      isAutomateActive({
        planExecutionMode: 'automate',
        clearExecutionMode: false,
      }),
      true,
    );
  });

  it('non-automate stamp does not activate', () => {
    assert.equal(
      isAutomateActive({ planExecutionMode: 'mode1' }),
      false,
    );
    assert.equal(
      isAutomateActive({ planExecutionMode: '' }),
      false,
    );
  });

  it('precedence matrix snapshot', () => {
    /** @type {Array<{input: Parameters<typeof isAutomateActive>[0], want: boolean}>} */
    const matrix = [
      { input: {}, want: false },
      { input: { cliMode: 'automate' }, want: true },
      { input: { planExecutionMode: 'automate' }, want: true },
      { input: { cliMode: 'automate', planExecutionMode: 'automate' }, want: true },
      { input: { clearExecutionMode: true }, want: false },
      { input: { cliMode: 'automate', clearExecutionMode: true }, want: false },
      { input: { planExecutionMode: 'automate', clearExecutionMode: true }, want: false },
      {
        input: {
          cliMode: 'automate',
          planExecutionMode: 'automate',
          clearExecutionMode: true,
        },
        want: false,
      },
      { input: { cliMode: 'mode1', planExecutionMode: 'automate' }, want: true },
      { input: { cliMode: '1', planExecutionMode: undefined }, want: false },
    ];
    for (const row of matrix) {
      assert.equal(
        isAutomateActive(row.input),
        row.want,
        `isAutomateActive(${JSON.stringify(row.input)})`,
      );
    }
  });
});
