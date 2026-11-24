import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';

const HELPER = new URL('./helpers/quiet-test-stdout.js', import.meta.url).href;

// Each case runs in its own Node process so NODE_TEST_CONTEXT is controlled,
// exactly as it is for a test file under `node --test`.
function runChild(source, env) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    env,
  });
}

function envFor(context) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  if (context !== undefined) env.NODE_TEST_CONTEXT = context;
  return env;
}

describe('quietTestStdout', () => {
  it('drops a string, runs its callback, passes a Buffer, and wraps only once', () => {
    const source = `
import { quietTestStdout } from ${JSON.stringify(HELPER)};
const received = [];
let callbacks = 0;
let secondArgCallback = false;
let bufferCallback = false;
let bufferCallbackIntact = false;
const bufCallback = () => { callbacks += 1; bufferCallback = true; };
const saved = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
  received.push(Buffer.isBuffer(chunk) ? 'buffer' : typeof chunk);
  if (Buffer.isBuffer(chunk)) bufferCallbackIntact = encoding === bufCallback;
  if (typeof encoding === 'function') encoding();
  else if (typeof callback === 'function') callback();
  return true;
};
quietTestStdout();
const afterFirst = process.stdout.write;
const stringResult = process.stdout.write('printed by the code under test\\n', () => { callbacks += 1; });
const secondArgResult = process.stdout.write('printed with a second-argument callback\\n', () => { callbacks += 1; secondArgCallback = true; });
const bufferResult = process.stdout.write(Buffer.from([0x41, 0x42]), bufCallback);
quietTestStdout();
const wrappedOnce = process.stdout.write === afterFirst;
await new Promise((resolve) => setTimeout(resolve, 20));
if (!secondArgCallback) throw new Error('a second-argument callback did not run');
if (!bufferCallbackIntact || !bufferCallback) throw new Error('the buffer callback was not passed through intact');
saved(JSON.stringify({ received, callbacks, secondArgCallback, bufferCallback, bufferCallbackIntact, stringResult, secondArgResult, bufferResult, wrappedOnce }) + '\\n');
`;
    const res = runChild(source, envFor('child-v8'));
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(JSON.parse(res.stdout), {
      received: ['buffer'],
      callbacks: 3,
      secondArgCallback: true,
      bufferCallback: true,
      bufferCallbackIntact: true,
      stringResult: true,
      secondArgResult: true,
      bufferResult: true,
      wrappedOnce: true,
    });
  });

  it('does nothing outside the child-v8 test context', () => {
    const source = `
import { quietTestStdout } from ${JSON.stringify(HELPER)};
const before = process.stdout.write;
quietTestStdout();
const saved = process.stdout.write.bind(process.stdout);
saved(JSON.stringify({ unchanged: process.stdout.write === before }) + '\\n');
`;
    const res = runChild(source, envFor());
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(JSON.parse(res.stdout), { unchanged: true });
    const other = runChild(source, envFor('child-v9'));
    assert.equal(other.status, 0, other.stderr);
    assert.deepEqual(JSON.parse(other.stdout), { unchanged: true });
  });
});
