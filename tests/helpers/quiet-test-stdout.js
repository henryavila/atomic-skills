// Node's test reporter writes Buffer chunks of serialized events to stdout in
// a child test process. Code under test that prints strings to the same stream
// would make the reporter try to deserialize those strings as events
// ("Unable to deserialize cloned data"). Drop only strings, and only inside
// the test child; everything else reaches the original write unchanged.
const WRAPPED = Symbol.for('atomic-skills.quiet-test-stdout');

export function quietTestStdout() {
  if (process.env.NODE_TEST_CONTEXT !== 'child-v8') return;
  if (process.stdout[WRAPPED]) return;
  const original = process.stdout.write;
  process.stdout.write = function write(chunk, encoding, callback) {
    if (typeof chunk === 'string') {
      if (typeof encoding === 'function') callback = encoding;
      if (typeof callback === 'function') callback();
      return true;
    }
    return original.call(process.stdout, chunk, encoding, callback);
  };
  process.stdout[WRAPPED] = true;
}
