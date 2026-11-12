import { afterEach, beforeEach, describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function runNode(entrypoint, args, { cwd, home }) {
  return spawnSync(process.execPath, [entrypoint, ...args], {
    cwd,
    env: { ...process.env, HOME: home },
    encoding: 'utf8',
  })
}

describe('consumer resolves package entrypoints from the installed runtime root', () => {
  let root
  let home
  let consumer

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'atomic-skills-consumer-runtime-'))
    home = join(root, 'home')
    consumer = join(root, 'consumer')
    mkdirSync(join(home, '.atomic-skills'), { recursive: true })
    mkdirSync(join(consumer, 'scripts'), { recursive: true })
    writeFileSync(join(home, '.atomic-skills', 'package-root'), `${PACKAGE_ROOT}\n`)
    writeFileSync(
      join(consumer, 'scripts', 'find-plans-missing-ground-truth.js'),
      "throw new Error('CONSUMER_SCRIPT_SENTINEL_LOADED')\n",
    )
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('runs the ground-truth detector from package-root, not the consumer cwd', () => {
    const installedRoot = readFileSync(join(home, '.atomic-skills', 'package-root'), 'utf8').trim()
    const result = runNode(
      join(installedRoot, 'scripts', 'find-plans-missing-ground-truth.js'),
      [consumer],
      { cwd: consumer, home },
    )
    const output = `${result.stdout}\n${result.stderr}`
    assert.equal(result.status, 0, output)
    assert.match(output, /ground-truth review receipt/)
    assert.doesNotMatch(output, /CONSUMER_SCRIPT_SENTINEL_LOADED/)
  })
})
