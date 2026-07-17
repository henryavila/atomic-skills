import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SRC_DIR = dirname(fileURLToPath(import.meta.url))

/** Package root containing src/, scripts/, skills/, and package dependencies. */
export const PACKAGE_ROOT = resolve(SRC_DIR, '..')

/** Resolve a package-owned path independently from the consumer's cwd. */
export function resolvePackagePath(...segments) {
  return resolve(PACKAGE_ROOT, ...segments)
}

/** Resolve a user-supplied path relative to the consuming repository. */
export function resolveConsumerPath(input, cwd = process.cwd()) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('consumer path must be a non-empty string')
  }
  return resolve(cwd, input)
}

/** True only when a module is the process entrypoint, including paths with spaces. */
export function isDirectExecution(moduleUrl, argvEntry = process.argv[1]) {
  if (!argvEntry) return false
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href
}
