import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

export function fsyncDirectory(path) {
  if (process.platform === 'win32') return false;
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return true;
}

export function durableReplace(path, content, { mode = 0o600 } = {}) {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const fd = openSync(temporary, 'wx', mode);
  let writeError = null;
  try {
    writeFileSync(fd, content);
    fsyncSync(fd);
  } catch (error) {
    writeError = error;
  } finally {
    closeSync(fd);
  }
  if (writeError) {
    rmSync(temporary, { force: true });
    throw writeError;
  }
  try {
    renameSync(temporary, path);
    fsyncDirectory(directory);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

/**
 * Append bytes by publishing a complete sibling replacement. A failure while
 * staging can expose only the old file; after rename, readers can observe only
 * the complete new file. The second file sync is intentionally injectable so
 * transactional callers can prove that a visible record is not acknowledged
 * before both the file and directory durability boundaries are crossed.
 */
export function durableAppendFile(path, content, {
  mode = 0o600,
  faultAt,
  beforeFileSync,
} = {}) {
  const directory = dirname(path);
  const previous = existsSync(path) ? readFileSync(path) : Buffer.alloc(0);
  const addition = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const temporary = `${path}.${process.pid}.${randomUUID()}.append-tmp`;
  let fd;
  let published = false;
  try {
    fd = openSync(temporary, 'wx', mode);
    writeFileSync(fd, previous);
    const split = Math.ceil(addition.length / 2);
    if (split > 0) writeFileSync(fd, addition.subarray(0, split));
    faultAt?.({
      point: 'after-partial-append',
      path,
      temporary,
      previousBytes: previous.length,
      appendBytes: addition.length,
    });
    if (split < addition.length) writeFileSync(fd, addition.subarray(split));
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;

    renameSync(temporary, path);
    published = true;
    fd = openSync(path, 'r+');
    beforeFileSync?.();
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    fsyncDirectory(directory);
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    if (!published) rmSync(temporary, { force: true });
    throw error;
  }
}

export function durableUnlink(path) {
  if (!existsSync(path)) return false;
  unlinkSync(path);
  fsyncDirectory(dirname(path));
  return true;
}
