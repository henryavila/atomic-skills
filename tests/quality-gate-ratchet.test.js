import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RATCHET_PY = join(REPO_ROOT, 'skills/shared/quality-gate-assets/ratchet.py');

const STACKS = [
  'stack\tlanguage\troots\tgenerated\ttests\tgroup',
  'web\tts\tweb/src\t-\t-\tserver',
  'api\tpy\tapi/app\t-\t-\tserver',
  'ios-app\tswift\tios/App\t-\t-\tios',
  'ios-bike\tswift\tios/Bike\t-\t-\tios',
].join('\n') + '\n';

const CEILINGS = [
  'metric\tceiling\tapplies_to',
  'cc\t10\tpy,ts,swift',
  'file\t400\tpy,ts,swift',
  'tz-literal\t0\tpy',
].join('\n') + '\n';

const DIMENSIONS = ['dimension\tmetric', 'size\tcc', 'size\tfile', 'typing\ttz-literal'].join('\n') + '\n';

const EXCEPTIONS_HEADER = 'stack\tmetric\tkey\tlimit\treason\n';

describe('ratchet.py', () => {
  let tmp;
  let root;
  let base;

  /** Write a ratchet root: config files plus `debt` as {"<stack>.<metric>": "key\tvalue\n..."}. */
  function writeRoot(dir, { debt = {}, exceptions = '', ceilings = CEILINGS, moves = null } = {}) {
    mkdirSync(join(dir, 'debt'), { recursive: true });
    writeFileSync(join(dir, 'stacks.tsv'), STACKS);
    writeFileSync(join(dir, 'ceilings.tsv'), ceilings);
    writeFileSync(join(dir, 'dimensions.tsv'), DIMENSIONS);
    writeFileSync(join(dir, 'exceptions.tsv'), EXCEPTIONS_HEADER + exceptions);
    for (const [name, body] of Object.entries(debt)) {
      writeFileSync(join(dir, 'debt', `${name}.tsv`), body);
    }
    if (moves !== null) writeFileSync(join(dir, 'moves.tsv'), `metric\tfrom\tto\tvalue\n${moves}`);
  }

  function measures(lines) {
    const file = join(tmp, `measures-${Math.random().toString(36).slice(2)}.tsv`);
    writeFileSync(file, lines.length ? `${lines.join('\n')}\n` : '');
    return file;
  }

  function run(args, { rootDir = root } = {}) {
    const result = spawnSync('python3', ['-I', RATCHET_PY, '--root', rootDir, ...args], { encoding: 'utf8' });
    return { status: result.status, out: result.stdout, err: result.stderr };
  }

  function debtFile(name, dir = root) {
    return readFileSync(join(dir, 'debt', `${name}.tsv`), 'utf8');
  }

  /** The failure lines of a run: every stdout line that starts with FAIL. */
  function failures(result) {
    return result.out.split('\n').filter((line) => line.startsWith('FAIL'));
  }

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ratchet-'));
    root = join(tmp, 'head', 'qa');
    base = join(tmp, 'base', 'qa');
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe('check', () => {
    const scope = ['--stack', 'web', '--metric', 'cc'];

    it('passes an item recorded at the same value', () => {
      writeRoot(root, { debt: { 'web.cc': 'a::f\t12\n' } });
      const result = run(['check', '--measures', measures(['web\tcc\ta::f\t12']), ...scope]);
      assert.equal(result.status, 0, result.out + result.err);
      assert.deepEqual(failures(result), []);
    });

    it('fails an item that got worse', () => {
      writeRoot(root, { debt: { 'web.cc': 'a::f\t12\n' } });
      const result = run(['check', '--measures', measures(['web\tcc\ta::f\t13']), ...scope]);
      assert.equal(result.status, 1);
      assert.equal(failures(result).length, 1);
      assert.match(failures(result)[0], /web\.cc\ta::f\tworse\t13\t12/);
    });

    it('fails a new item and says how many recorded items can be lowered', () => {
      writeRoot(root, { debt: { 'web.cc': 'a::f\t12\n' } });
      const result = run(['check', '--measures', measures(['web\tcc\ta::g\t11']), ...scope]);
      assert.equal(result.status, 1);
      assert.equal(failures(result).length, 1);
      assert.match(failures(result)[0], /web\.cc\ta::g\tnew\t11/);
      assert.match(result.out, /can lower: 1 item/);
    });

    it('passes an item that improved', () => {
      writeRoot(root, { debt: { 'web.cc': 'a::f\t12\n' } });
      const result = run(['check', '--measures', measures(['web\tcc\ta::f\t11']), ...scope]);
      assert.equal(result.status, 0, result.out);
      assert.match(result.out, /can lower: 1 item/);
    });

    it('passes when a recorded item is no longer measured', () => {
      writeRoot(root, { debt: { 'web.cc': 'a::f\t12\n' } });
      const result = run(['check', '--measures', measures([]), ...scope]);
      assert.equal(result.status, 0, result.out);
      assert.match(result.out, /can lower: 1 item/);
    });

    it('passes an exception within its limit and fails one above it', () => {
      const exceptions = 'web\tfile\ta::*\t600\tdata catalogue\n';
      writeRoot(root, { debt: { 'web.file': '' }, exceptions });
      const fileScope = ['--stack', 'web', '--metric', 'file'];
      const within = run(['check', '--measures', measures(['web\tfile\ta::*\t500']), ...fileScope]);
      assert.equal(within.status, 0, within.out);
      const above = run(['check', '--measures', measures(['web\tfile\ta::*\t601']), ...fileScope]);
      assert.equal(above.status, 1);
      assert.equal(failures(above).length, 1);
      assert.match(failures(above)[0], /web\.file\ta::\*\texception-exceeded\t601\t600/);
    });

    it('treats a renamed item as new', () => {
      writeRoot(root, { debt: { 'web.cc': 'a::f\t12\n' } });
      const result = run(['check', '--measures', measures(['web\tcc\tb::f\t12']), ...scope]);
      assert.equal(result.status, 1);
      assert.match(failures(result)[0], /b::f\tnew/);
    });

    it('reports a stack that is not frozen without failing', () => {
      writeRoot(root);
      const result = run(['check', '--measures', measures(['web\tcc\ta::f\t12']), ...scope]);
      assert.equal(result.status, 0, result.out);
      assert.match(result.out, /not frozen: web \(1 item/);
    });

    it('fails more exceptions than the limit and an exception without a reason', () => {
      const eleven = Array.from({ length: 11 }, (_, i) => `web\tfile\tf${i}::*\t500\tcatalogue\n`).join('');
      writeRoot(root, { debt: { 'web.file': '' }, exceptions: eleven });
      const many = run(['check', '--measures', measures([]), '--stack', 'web']);
      assert.equal(many.status, 1);
      assert.match(failures(many).join('\n'), /more than 10 exceptions in web/);

      writeRoot(root, { debt: { 'web.file': '' }, exceptions: 'web\tfile\ta::*\t500\t\n' });
      const blank = run(['check', '--measures', measures([]), '--stack', 'web']);
      assert.equal(blank.status, 1);
      assert.match(failures(blank).join('\n'), /exception without a reason/);
    });

    it('honours --max-exceptions', () => {
      const two = 'web\tfile\ta::*\t500\tx\nweb\tfile\tb::*\t500\ty\n';
      writeRoot(root, { debt: { 'web.file': '' }, exceptions: two });
      const result = run(['check', '--measures', measures([]), '--stack', 'web', '--max-exceptions', '1']);
      assert.equal(result.status, 1);
      assert.match(failures(result).join('\n'), /more than 1 exceptions in web/);
    });

    it('rejects a measure for an unknown stack as a usage error', () => {
      writeRoot(root);
      const result = run(['check', '--measures', measures(['nope\tcc\ta::f\t12'])]);
      assert.equal(result.status, 2);
    });
  });

  describe('lower', () => {
    it('lowers improved items, drops absent ones and never adds or raises', () => {
      writeRoot(root, { debt: { 'web.cc': 'a::f\t12\na::gone\t20\na::h\t15\n' } });
      const file = measures(['web\tcc\ta::f\t11', 'web\tcc\ta::h\t18', 'web\tcc\ta::new\t30']);
      const result = run(['lower', '--measures', file, '--stack', 'web', '--metric', 'cc']);
      assert.equal(result.status, 0, result.out + result.err);
      assert.equal(debtFile('web.cc'), 'a::f\t11\na::h\t15\n');
    });

    it('empties the file when nothing is measured', () => {
      writeRoot(root, { debt: { 'web.cc': 'a::f\t12\n' } });
      run(['lower', '--measures', measures([]), '--stack', 'web', '--metric', 'cc']);
      assert.equal(debtFile('web.cc'), '');
    });

    it('leaves stacks and metrics outside the scope untouched', () => {
      writeRoot(root, { debt: { 'web.cc': 'a::f\t12\n', 'web.file': 'a::*\t500\n', 'api.cc': 'x::y\t14\n' } });
      run(['lower', '--measures', measures([]), '--stack', 'web', '--metric', 'cc']);
      assert.equal(debtFile('web.cc'), '');
      assert.equal(debtFile('web.file'), 'a::*\t500\n');
      assert.equal(debtFile('api.cc'), 'x::y\t14\n');
    });

    it('does nothing on a stack that is not frozen', () => {
      writeRoot(root);
      const result = run(['lower', '--measures', measures(['web\tcc\ta::f\t12']), '--stack', 'web']);
      assert.equal(result.status, 0);
      assert.equal(existsSync(join(root, 'debt', 'web.cc.tsv')), false);
    });
  });

  describe('freeze', () => {
    it('writes one sorted file per applicable metric, empty when there is no item', () => {
      writeRoot(root);
      const file = measures(['web\tcc\tb::x\t3.0', 'web\tcc\ta::y\t2.5']);
      const result = run(['freeze', '--measures', file, '--stack', 'web']);
      assert.equal(result.status, 0, result.out + result.err);
      assert.equal(debtFile('web.cc'), 'a::y\t2.5\nb::x\t3\n');
      assert.equal(debtFile('web.file'), '');
      assert.equal(existsSync(join(root, 'debt', 'web.tz-literal.tsv')), false, 'tz-literal does not apply to ts');
    });

    it('never rewrites a file that already exists', () => {
      writeRoot(root, { debt: { 'web.cc': 'a::f\t12\n' } });
      const result = run(['freeze', '--measures', measures(['web\tcc\ta::g\t99']), '--stack', 'web']);
      assert.equal(result.status, 0);
      assert.equal(debtFile('web.cc'), 'a::f\t12\n');
      assert.match(result.out, /already frozen: .*web\.cc\.tsv/);
    });
  });

  describe('diff', () => {
    function diff(branch, extra = []) {
      return run(['diff', '--base', base, '--branch', branch, ...extra]);
    }

    it('fails a new debt line', () => {
      writeRoot(base, { debt: { 'web.cc': 'a::f\t12\n' } });
      writeRoot(root, { debt: { 'web.cc': 'a::f\t12\na::g\t11\n' } });
      const result = diff('feat/x');
      assert.equal(result.status, 1);
      assert.equal(failures(result).length, 1);
      assert.match(failures(result)[0], /web\.cc\ta::g\tnew debt line/);
    });

    it('fails a raised value', () => {
      writeRoot(base, { debt: { 'web.cc': 'a::f\t12\n' } });
      writeRoot(root, { debt: { 'web.cc': 'a::f\t13\n' } });
      const result = diff('feat/x');
      assert.equal(result.status, 1);
      assert.equal(failures(result).length, 1);
      assert.match(failures(result)[0], /web\.cc\ta::f\tdebt value raised/);
    });

    it('passes a removed line', () => {
      writeRoot(base, { debt: { 'web.cc': 'a::f\t12\n' } });
      writeRoot(root, { debt: { 'web.cc': '' } });
      const result = diff('feat/x');
      assert.equal(result.status, 0, result.out);
    });

    it('accepts the first freeze of a stack on its own freeze branch, by group or by stack name', () => {
      writeRoot(base);
      writeRoot(root, { debt: { 'ios-app.cc': 'a::f\t12\n' } });
      assert.equal(diff('qa/freeze-ios').status, 0);
      assert.equal(diff('qa/freeze-ios-app').status, 0);
    });

    it('fails a freeze of a stack outside the freeze branch', () => {
      writeRoot(base);
      writeRoot(root, { debt: { 'web.cc': 'a::f\t12\n' } });
      const result = diff('qa/freeze-ios');
      assert.equal(result.status, 1);
      assert.equal(failures(result).length, 1);
      assert.match(failures(result)[0], /new debt line/);
    });

    it('fails a second freeze of a stack already frozen in the base', () => {
      writeRoot(base, { debt: { 'ios-app.cc': '' } });
      writeRoot(root, { debt: { 'ios-app.cc': '', 'ios-app.file': 'a::*\t500\n' } });
      const result = diff('qa/freeze-ios');
      assert.equal(result.status, 1);
    });

    it('accepts a recorded move on a quality branch', () => {
      writeRoot(base, { debt: { 'web.cc': 'web/src/a.ts::f\t12\n' } });
      writeRoot(root, {
        debt: { 'web.cc': 'web/src/b.ts::f\t12\n' },
        moves: 'cc\tweb/src/a.ts::f\tweb/src/b.ts::f\t12\n',
      });
      const result = diff('qa/split-a');
      assert.equal(result.status, 0, result.out);
    });

    it('fails a move whose destination is above the origin', () => {
      writeRoot(base, { debt: { 'web.cc': 'web/src/a.ts::f\t12\n' } });
      writeRoot(root, {
        debt: { 'web.cc': 'web/src/b.ts::f\t13\n' },
        moves: 'cc\tweb/src/a.ts::f\tweb/src/b.ts::f\t13\n',
      });
      const result = diff('qa/split-a');
      assert.equal(result.status, 1);
      assert.equal(failures(result).length, 1);
      assert.match(failures(result)[0], /debt value raised/);
    });

    it('fails a debt line above the value its move recorded', () => {
      writeRoot(base, { debt: { 'web.cc': 'web/src/a.ts::f\t12\n' } });
      writeRoot(root, {
        debt: { 'web.cc': 'web/src/b.ts::f\t13\n' },
        moves: 'cc\tweb/src/a.ts::f\tweb/src/b.ts::f\t12\n',
      });
      const result = diff('qa/split-a');
      assert.equal(result.status, 1);
      assert.equal(failures(result).length, 1);
      assert.match(failures(result)[0], /debt value raised/);
    });

    it('treats a move on a product branch as a new line', () => {
      writeRoot(base, { debt: { 'web.cc': 'web/src/a.ts::f\t12\n' } });
      writeRoot(root, {
        debt: { 'web.cc': 'web/src/b.ts::f\t12\n' },
        moves: 'cc\tweb/src/a.ts::f\tweb/src/b.ts::f\t12\n',
      });
      const result = diff('feat/x');
      assert.equal(result.status, 1);
      assert.equal(failures(result).length, 1);
      assert.match(failures(result)[0], /new debt line/);
    });

    it('accepts one origin split into several destinations up to the original sum', () => {
      writeRoot(base, { debt: { 'web.file': 'web/src/a.ts::*\t9\n' } });
      const moves = 'file\tweb/src/a.ts::*\tweb/src/b.ts::*\t5\nfile\tweb/src/a.ts::*\tweb/src/c.ts::*\t4\n';
      writeRoot(root, { debt: { 'web.file': 'web/src/b.ts::*\t5\nweb/src/c.ts::*\t4\n' }, moves });
      assert.equal(diff('qa/split-a').status, 0);

      const over = 'file\tweb/src/a.ts::*\tweb/src/b.ts::*\t5\nfile\tweb/src/a.ts::*\tweb/src/c.ts::*\t5\n';
      writeRoot(root, { debt: { 'web.file': 'web/src/b.ts::*\t5\nweb/src/c.ts::*\t5\n' }, moves: over });
      const result = diff('qa/split-a');
      assert.equal(result.status, 1);
      assert.equal(failures(result).length, 1);
      assert.match(failures(result)[0], /debt value raised/);
    });

    it('fails a move onto a destination that already existed in the base', () => {
      writeRoot(base, { debt: { 'web.cc': 'web/src/a.ts::f\t12\nweb/src/b.ts::f\t12\n' } });
      writeRoot(root, {
        debt: { 'web.cc': 'web/src/b.ts::f\t12\n' },
        moves: 'cc\tweb/src/a.ts::f\tweb/src/b.ts::f\t12\n',
      });
      const result = diff('qa/split-a');
      assert.equal(result.status, 1);
      assert.equal(failures(result).length, 1);
      assert.match(failures(result)[0], /new debt line/);
    });

    it('fails a move whose origin is still in the debt', () => {
      writeRoot(base, { debt: { 'web.cc': 'web/src/a.ts::f\t12\n' } });
      writeRoot(root, {
        debt: { 'web.cc': 'web/src/a.ts::f\t12\nweb/src/b.ts::f\t12\n' },
        moves: 'cc\tweb/src/a.ts::f\tweb/src/b.ts::f\t12\n',
      });
      const result = diff('qa/split-a');
      assert.equal(result.status, 1);
      assert.equal(failures(result).length, 1);
      assert.match(failures(result)[0], /new debt line/);
    });

    it('accepts a move from one stack to another', () => {
      writeRoot(base, { debt: { 'ios-app.cc': 'ios/App/a.swift::f\t12\n', 'ios-bike.cc': '' } });
      writeRoot(root, {
        debt: { 'ios-app.cc': '', 'ios-bike.cc': 'ios/Bike/b.swift::f\t12\n' },
        moves: 'cc\tios/App/a.swift::f\tios/Bike/b.swift::f\t12\n',
      });
      const result = diff('qa/share-code');
      assert.equal(result.status, 0, result.out);
    });

    it('does not accept a move already present in the base a second time', () => {
      const moves = 'cc\tweb/src/a.ts::f\tweb/src/b.ts::f\t12\n';
      writeRoot(base, { debt: { 'web.cc': 'web/src/b.ts::f\t12\n' }, moves });
      writeRoot(root, { debt: { 'web.cc': 'web/src/b.ts::f\t12\nweb/src/c.ts::f\t12\n' }, moves });
      const result = diff('qa/x');
      assert.equal(result.status, 1);
      assert.match(failures(result)[0], /web\/src\/c\.ts::f\tnew debt line/);
    });

    it('accepts the debt file of a metric that starts to apply to a language', () => {
      writeRoot(base, { debt: { 'web.cc': '', 'api.tz-literal': 'x::y\t2\n' } });
      const ceilings = CEILINGS.replace('tz-literal\t0\tpy', 'tz-literal\t0\tpy,ts');
      writeRoot(root, {
        debt: { 'web.cc': '', 'api.tz-literal': 'x::y\t2\n', 'web.tz-literal': 'a::*\t3\n' },
        ceilings,
      });
      assert.equal(diff('feat/tz-measurer').status, 0);
    });

    it('fails a new debt file when the metric already applied to that language', () => {
      writeRoot(base, { debt: { 'web.cc': '' } });
      writeRoot(root, { debt: { 'web.cc': '', 'web.file': 'a::*\t500\n' } });
      const result = diff('feat/x');
      assert.equal(result.status, 1);
      assert.match(failures(result)[0], /new debt line/);
    });

    it('fails a raised ceiling', () => {
      writeRoot(base, { debt: { 'web.cc': '' } });
      writeRoot(root, { debt: { 'web.cc': '' }, ceilings: CEILINGS.replace('cc\t10', 'cc\t12') });
      const result = diff('qa/x');
      assert.equal(result.status, 1);
      assert.match(failures(result)[0], /ceiling raised/);
    });
  });

  describe('move', () => {
    it('rewrites the debt, resolves the destination stack and records the move', () => {
      writeRoot(root, { debt: { 'ios-app.cc': 'ios/App/a.swift::f\t12\n', 'ios-bike.cc': '' } });
      const result = run(['move', '--metric', 'cc', '--from', 'ios/App/a.swift::f', '--to', 'ios/Bike/b.swift::f=12']);
      assert.equal(result.status, 0, result.out + result.err);
      assert.equal(debtFile('ios-app.cc'), '');
      assert.equal(debtFile('ios-bike.cc'), 'ios/Bike/b.swift::f\t12\n');
      const moves = readFileSync(join(root, 'moves.tsv'), 'utf8');
      assert.match(moves, /^cc\tios\/App\/a\.swift::f\tios\/Bike\/b\.swift::f\t12$/m);
    });

    it('refuses a sum above the origin, an unknown origin and an existing destination', () => {
      const debt = { 'web.cc': 'web/src/a.ts::f\t12\nweb/src/c.ts::f\t11\n' };
      writeRoot(root, { debt });
      const over = run(['move', '--metric', 'cc', '--from', 'web/src/a.ts::f', '--to', 'web/src/b.ts::f=13']);
      assert.equal(over.status, 2);
      const unknown = run(['move', '--metric', 'cc', '--from', 'web/src/zz.ts::f', '--to', 'web/src/b.ts::f=1']);
      assert.equal(unknown.status, 2);
      const taken = run(['move', '--metric', 'cc', '--from', 'web/src/a.ts::f', '--to', 'web/src/c.ts::f=12']);
      assert.equal(taken.status, 2);
      assert.equal(debtFile('web.cc'), debt['web.cc'], 'a refused move changes nothing');
    });
  });

  describe('status', () => {
    it('exits 0 only when every cell is strong', () => {
      const debt = {};
      for (const stack of ['web', 'ios-app', 'ios-bike']) {
        debt[`${stack}.cc`] = '';
        debt[`${stack}.file`] = '';
      }
      Object.assign(debt, { 'api.cc': '', 'api.file': '', 'api.tz-literal': '' });
      writeRoot(root, { debt });
      const strong = run(['status']);
      assert.match(strong.out, /api\ttyping\tstrong/);
      assert.match(strong.out, /web\ttyping\tno measurer/);
      assert.equal(strong.status, 1, 'web has no measurer for typing');

      writeRoot(root, { debt: { ...debt, 'api.cc': 'x::y\t14\n' } });
      const owing = run(['status']);
      assert.match(owing.out, /api\tsize\tdebt 1/);
      assert.equal(owing.status, 1);
    });

    it('shows a stack that is not frozen and exits 1', () => {
      writeRoot(root, { debt: { 'api.cc': '', 'api.file': '', 'api.tz-literal': '' } });
      const result = run(['status']);
      assert.match(result.out, /web\tsize\tnot frozen/);
      assert.match(result.out, /api\tsize\tstrong/);
      assert.equal(result.status, 1);
    });

    it('exits 0 when every stack is strong in every dimension', () => {
      mkdirSync(join(root, 'debt'), { recursive: true });
      writeFileSync(join(root, 'stacks.tsv'), 'stack\tlanguage\troots\tgenerated\ttests\tgroup\napi\tpy\tapi/app\t-\t-\tserver\n');
      writeFileSync(join(root, 'ceilings.tsv'), CEILINGS);
      writeFileSync(join(root, 'dimensions.tsv'), DIMENSIONS);
      writeFileSync(join(root, 'exceptions.tsv'), EXCEPTIONS_HEADER);
      for (const metric of ['cc', 'file', 'tz-literal']) writeFileSync(join(root, 'debt', `api.${metric}.tsv`), '');
      const result = run(['status']);
      assert.equal(result.status, 0, result.out + result.err);
    });
  });
});
