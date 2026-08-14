/**
 * Isolate os.homedir() for tests.
 *
 * Unix reads HOME. Windows reads USERPROFILE (then HOMEDRIVE+HOMEPATH).
 * Setting only HOME on win32 writes into the real profile.
 */
import { homedir } from 'node:os';
import { parse } from 'node:path';

const HOME_KEYS = ['HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH'];

export function isolateHomedir(fakeHome) {
  const prev = Object.fromEntries(HOME_KEYS.map((k) => [k, process.env[k]]));
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  const { root } = parse(fakeHome);
  if (root && /^[a-zA-Z]:/.test(root)) {
    process.env.HOMEDRIVE = root.slice(0, 2);
    process.env.HOMEPATH = fakeHome.slice(2);
  }
  return () => {
    for (const k of HOME_KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  };
}

export function assertIsolatedHomedir(fakeHome) {
  const actual = homedir();
  if (actual !== fakeHome) {
    throw new Error(`os.homedir()=${actual} !== isolated home=${fakeHome}`);
  }
}
