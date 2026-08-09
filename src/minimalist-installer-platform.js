import { constants, lstatSync } from 'node:fs';
import { posix, win32 } from 'node:path';

const ERR_UNSAFE_PATH_RACE = 'UNSAFE_PATH_RACE';
const ERR_PATH_ESCAPE = 'PATH_ESCAPE';

function pathError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'PathSafetyError';
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Node does not expose O_NOFOLLOW/O_DIRECTORY on Windows. The upstream engine
 * treats their absence as an unsupported platform even though Windows can
 * reject its relevant reparse points with lstat before entering the same
 * path-based, rename-race-limited backend used on macOS.
 */
export function prepareMinimalistInstallerPlatform({
  platform = process.platform,
  fsConstants = constants,
} = {}) {
  if (platform !== 'win32') return { compatibilityMode: null };

  if (typeof fsConstants.O_NOFOLLOW !== 'number') {
    Object.defineProperty(fsConstants, 'O_NOFOLLOW', {
      value: 0,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  }
  if (typeof fsConstants.O_DIRECTORY !== 'number') {
    Object.defineProperty(fsConstants, 'O_DIRECTORY', {
      value: 0,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  }

  return { compatibilityMode: 'windows-reparse-guard' };
}

function relativeComponents(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw pathError(ERR_PATH_ESCAPE, 'Path must be a non-empty relative string');
  }
  if (/^(?:[a-zA-Z]:|[/\\])/.test(relativePath)) {
    throw pathError(ERR_PATH_ESCAPE, `Absolute paths are refused: "${relativePath}"`);
  }
  const parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..' || part.includes('\0'))) {
    throw pathError(ERR_PATH_ESCAPE, `Unsafe relative path is refused: "${relativePath}"`);
  }
  return parts;
}

/**
 * Reject existing Windows symlinks and junctions along a destination path.
 * Missing components are safe at preflight because the engine creates them.
 * The base directory remains the caller-provided trust root, matching the
 * minimalist-installer path-safety contract on Unix.
 */
export function assertWindowsPathHasNoReparsePoints(basePath, relativePath, {
  platform = process.platform,
  lstat = lstatSync,
} = {}) {
  if (platform !== 'win32') return;

  const pathApi = platform === 'win32' ? win32 : posix;
  let current = pathApi.resolve(basePath);
  for (const part of relativeComponents(relativePath)) {
    current = pathApi.join(current, part);
    let stat;
    try {
      stat = lstat(current);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw pathError(
        ERR_UNSAFE_PATH_RACE,
        `Refusing Windows reparse point in installer destination: "${current}"`,
        { path: current },
      );
    }
  }
}

prepareMinimalistInstallerPlatform();
