import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  parseImplementMode,
  isAutomateActive,
  IMPLEMENT_MODES,
  PLAN_EXECUTION_MODES,
  stampExecutionMode,
  clearExecutionModeStamp,
  hasAutomateStamp,
  isPlanExecutionMode,
} from '../src/implement-mode.js';

describe('parseImplementMode', () => {
  it('accepts --mode=automate token and returns mode automate', () => {
    const result = parseImplementMode(['implement', '--mode=automate', 'my-plan']);
    assert.equal(result.mode, 'automate');
    assert.equal(result.clearExecutionMode, false);
    assert.equal(result.modeExplicit, true);
  });

  it('accepts mode:automate token and returns mode automate', () => {
    const result = parseImplementMode('mode:automate my-plan');
    assert.equal(result.mode, 'automate');
    assert.equal(result.modeExplicit, true);
  });

  it('accepts --mode automate (space-separated) form', () => {
    const result = parseImplementMode(['--mode', 'automate']);
    assert.equal(result.mode, 'automate');
    assert.equal(result.modeExplicit, true);
  });

  it('absent mode returns undefined (modeExplicit false) — not synthetic default', () => {
    const result = parseImplementMode(['my-plan']);
    assert.equal(result.mode, undefined);
    assert.equal(result.modeExplicit, false);
    // F0: bare implement / no CLI mode → automate default ON
    assert.equal(isAutomateActive({ cliMode: result.mode }), true);
  });

  it('F1: parseImplementMode without mode flag + stamp automate → isAutomateActive true', () => {
    const result = parseImplementMode(['plan']);
    assert.equal(result.mode, undefined);
    assert.equal(result.modeExplicit, false);
    assert.equal(
      isAutomateActive({
        cliMode: result.mode,
        planExecutionMode: 'automate',
        clearExecutionMode: result.clearExecutionMode,
      }),
      true,
      'stamp re-entry must not be broken by synthetic cliMode default',
    );
  });

  it('--mode=1 returns mode1 / default without automate on', () => {
    const result = parseImplementMode(['--mode=1']);
    assert.ok(result.mode === 'default' || result.mode === 'mode1' || result.mode === '1');
    assert.notEqual(result.mode, 'automate');
    assert.equal(result.modeExplicit, true);
    assert.equal(isAutomateActive({ cliMode: result.mode }), false);
  });

  it('empty / missing argv yields undefined mode (not automate)', () => {
    assert.equal(parseImplementMode([]).mode, undefined);
    assert.equal(parseImplementMode([]).modeExplicit, false);
    assert.equal(parseImplementMode('').mode, undefined);
    assert.equal(parseImplementMode(undefined).mode, undefined);
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

  it('rejects empty --mode= and blank mode with clear error', () => {
    assert.throws(
      () => parseImplementMode(['--mode=']),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(String(err.message), /unknown|invalid|mode|empty|missing/i);
        return true;
      },
    );
    assert.throws(
      () => parseImplementMode(['--mode', '']),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(String(err.message), /unknown|invalid|mode|empty|missing/i);
        return true;
      },
    );
    assert.throws(
      () => parseImplementMode(['mode:']),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(String(err.message), /unknown|invalid|mode|empty|missing/i);
        return true;
      },
    );
    assert.throws(
      () => parseImplementMode(['--mode=   ']),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(String(err.message), /unknown|invalid|mode|empty|missing/i);
        return true;
      },
    );
  });

  it('accepts mode2/2/codex as known non-automate reserved modes', () => {
    for (const token of ['2', 'mode2', 'codex']) {
      const result = parseImplementMode([`--mode=${token}`]);
      assert.equal(result.mode, '2', `token ${token}`);
      assert.equal(result.modeExplicit, true);
      assert.equal(isAutomateActive({ cliMode: result.mode }), false);
    }
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
  it('ON by default when nothing set (F0 automate-default)', () => {
    assert.equal(isAutomateActive({}), true);
    assert.equal(isAutomateActive({ cliMode: undefined, planExecutionMode: undefined }), true);
    assert.equal(isAutomateActive({ cliMode: null, planExecutionMode: null }), true);
    // Explicit Mode 1 escape remains off
    assert.equal(isAutomateActive({ cliMode: 'default' }), false);
    assert.equal(isAutomateActive({ cliMode: 'mode1' }), false);
    assert.equal(isAutomateActive({ cliMode: '1' }), false);
  });

  it('F0: absent CLI mode and no stamp yields isAutomateActive true', () => {
    assert.equal(
      isAutomateActive({ cliMode: undefined, planExecutionMode: undefined }),
      true,
    );
    const parsed = parseImplementMode(['my-plan']);
    assert.equal(
      isAutomateActive({
        cliMode: parsed.mode,
        planExecutionMode: undefined,
        clearExecutionMode: parsed.clearExecutionMode,
      }),
      true,
    );
  });

  it('F0: explicit --mode=1 / mode:1 yields isAutomateActive false', () => {
    for (const argv of [['--mode=1'], ['mode:1'], ['--mode', '1'], ['--mode=mode1']]) {
      const parsed = parseImplementMode(argv);
      assert.equal(
        isAutomateActive({ cliMode: parsed.mode, clearExecutionMode: parsed.clearExecutionMode }),
        false,
        `argv ${JSON.stringify(argv)}`,
      );
    }
  });

  it('cliMode === automate → true', () => {
    assert.equal(
      isAutomateActive({ cliMode: 'automate', planExecutionMode: undefined }),
      true,
    );
  });

  it('stamp-alone re-entry: planExecutionMode automate with no clear and no cli → true', () => {
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
        planExecutionMode: 'automate',
        clearExecutionMode: false,
      }),
      true,
    );
  });

  it('explicit non-automate CLI overrides stamp automate → false', () => {
    assert.equal(
      isAutomateActive({
        cliMode: 'default',
        planExecutionMode: 'automate',
      }),
      false,
    );
    assert.equal(
      isAutomateActive({
        cliMode: 'mode1',
        planExecutionMode: 'automate',
      }),
      false,
    );
    assert.equal(
      isAutomateActive({
        cliMode: '1',
        planExecutionMode: 'automate',
      }),
      false,
    );
    // --mode=1 + stamp automate → false (M4)
    const parsed = parseImplementMode(['--mode=1']);
    assert.equal(
      isAutomateActive({
        cliMode: parsed.mode,
        planExecutionMode: 'automate',
        clearExecutionMode: parsed.clearExecutionMode,
      }),
      false,
    );
  });

  it('explicit mode2/2/codex CLI overrides stamp automate → false', () => {
    for (const mode of ['2', 'mode2', 'codex']) {
      assert.equal(
        isAutomateActive({
          cliMode: mode,
          planExecutionMode: 'automate',
        }),
        false,
        `cliMode ${mode}`,
      );
    }
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

  it('non-automate stamp keeps automate off; blank stamp falls through to default ON', () => {
    assert.equal(
      isAutomateActive({ planExecutionMode: 'mode1' }),
      false,
    );
    assert.equal(
      isAutomateActive({ planExecutionMode: '1' }),
      false,
    );
    // Blank/absent stamp → automate-default (F0)
    assert.equal(
      isAutomateActive({ planExecutionMode: '' }),
      true,
    );
  });

  it('precedence matrix snapshot (F0 automate-default)', () => {
    /** @type {Array<{input: Parameters<typeof isAutomateActive>[0], want: boolean}>} */
    const matrix = [
      // F0: no-CLI no-stamp → automate default ON
      { input: {}, want: true },
      { input: { cliMode: undefined, planExecutionMode: undefined }, want: true },
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
      // M4: explicit non-automate CLI overrides stamp / default
      { input: { cliMode: 'mode1', planExecutionMode: 'automate' }, want: false },
      { input: { cliMode: '1', planExecutionMode: 'automate' }, want: false },
      { input: { cliMode: 'default', planExecutionMode: 'automate' }, want: false },
      { input: { cliMode: '2', planExecutionMode: 'automate' }, want: false },
      { input: { cliMode: '1', planExecutionMode: undefined }, want: false },
      // stamp-alone (no cliMode) still activates
      { input: { cliMode: undefined, planExecutionMode: 'automate' }, want: true },
      // non-automate stamp alone stays off even under default-ON
      { input: { planExecutionMode: 'mode1' }, want: false },
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

describe('executionMode stamp + clear path (T-009)', () => {
  it('PLAN_EXECUTION_MODES includes automate and is frozen', () => {
    assert.ok(PLAN_EXECUTION_MODES.includes('automate'));
    assert.ok(isPlanExecutionMode('automate'));
    assert.equal(isPlanExecutionMode('banana'), false);
    assert.throws(() => {
      // @ts-expect-error frozen
      PLAN_EXECUTION_MODES.push('hack');
    });
  });

  it('stampExecutionMode sets executionMode automate immutably after confirm path', () => {
    const plan = { slug: 'demo', status: 'active', title: 'Demo' };
    const stamped = stampExecutionMode(plan, 'automate');
    assert.equal(stamped.executionMode, 'automate');
    assert.equal('executionMode' in plan, false, 'original plan not mutated');
    assert.equal(hasAutomateStamp(stamped), true);
    assert.equal(
      isAutomateActive({ planExecutionMode: stamped.executionMode }),
      true,
      'stamp alone → isAutomateActive true',
    );
  });

  it('stamp alone keeps isAutomateActive true; unstamp alone falls to default ON (F0)', () => {
    const stamped = stampExecutionMode({ slug: 'p' }, 'automate');
    assert.equal(
      isAutomateActive({
        cliMode: undefined,
        planExecutionMode: stamped.executionMode,
        clearExecutionMode: false,
      }),
      true,
    );
    const cleared = clearExecutionModeStamp(stamped);
    assert.equal('executionMode' in cleared, false);
    assert.equal(hasAutomateStamp(cleared), false);
    // F0: removing the stamp does not opt into Mode 1 — bare session is automate-default
    assert.equal(
      isAutomateActive({
        planExecutionMode: cleared.executionMode,
        clearExecutionMode: false,
      }),
      true,
    );
    // Session leave requires clear flag (or explicit Mode 1 CLI)
    assert.equal(
      isAutomateActive({
        planExecutionMode: cleared.executionMode,
        clearExecutionMode: true,
      }),
      false,
    );
    // Original stamped object unchanged
    assert.equal(stamped.executionMode, 'automate');
  });

  it('clear path: --clear-execution-mode parse + clearExecutionModeStamp', () => {
    const parsed = parseImplementMode(['--clear-execution-mode', 'my-plan']);
    assert.equal(parsed.clearExecutionMode, true);
    const stamped = stampExecutionMode({ slug: 'my-plan' }, 'automate');
    assert.equal(
      isAutomateActive({
        planExecutionMode: stamped.executionMode,
        clearExecutionMode: parsed.clearExecutionMode,
      }),
      false,
    );
    const next = clearExecutionModeStamp(stamped);
    // Session clear flag keeps automate off even after unstamp
    assert.equal(
      isAutomateActive({
        planExecutionMode: next.executionMode,
        clearExecutionMode: parsed.clearExecutionMode,
      }),
      false,
    );
    // Without the session clear flag, unstamp alone is default-ON (F0)
    assert.equal(
      isAutomateActive({ planExecutionMode: next.executionMode }),
      true,
    );
  });

  it('default stampExecutionMode mode is automate', () => {
    assert.equal(stampExecutionMode({}).executionMode, 'automate');
  });

  it('rejects unknown stamp modes', () => {
    assert.throws(
      () => stampExecutionMode({}, 'banana'),
      /unknown|executionMode/i,
    );
  });

  it('clearExecutionModeStamp on null/empty yields empty object', () => {
    assert.deepEqual(clearExecutionModeStamp(null), {});
    assert.deepEqual(clearExecutionModeStamp(undefined), {});
  });
});
