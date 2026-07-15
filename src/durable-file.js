import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
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

export function durableUnlink(path) {
  if (!existsSync(path)) return false;
  unlinkSync(path);
  fsyncDirectory(dirname(path));
  return true;
}
