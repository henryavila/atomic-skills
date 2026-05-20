// E.T-009 — end-to-end smoke test for the atomic-skills + aideck chain.
//
// Exercises the full path from canonical file → aideck REST → React bundle:
//   1. Stage a synthetic plan file in a fresh tmp .atomic-skills/plans/
//   2. Spawn aideck (via the sibling repo's dist/cli.js) pointed at that tmp
//      cwd, with --static-dir set to the dashboard build output.
//   3. Wait for the server to bind.
//   4. Assert GET /api/state/project-status returns the plan we just wrote
//      (validates E.T-001 flat layout + envelope shape).
//   5. Assert GET /api/state/project-status/<slug> returns the same plan
//      (validates buildForSlug + path layout).
//   6. Assert GET / returns the dashboard index.html (validates E.T-008
//      part 1 static-dir + SPA serving).
//   7. Assert GET /plans/<slug> also returns index.html (SPA fallback).
//   8. Kill the server.
//
// Skips when aideck dist or dashboard bundle is missing.

import { describe, it, before, after } from 'node:test'
import { strict as assert } from 'node:assert'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'node:net'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const AIDECK_CLI = resolve(REPO_ROOT, '..', 'aideck', 'dist', 'cli.js')
const DASHBOARD_DIR = resolve(REPO_ROOT, 'dist', 'dashboard')

const HAS_AIDECK = existsSync(AIDECK_CLI)
const HAS_DASHBOARD = existsSync(join(DASHBOARD_DIR, 'index.html'))
const SKIP_REASON =
  !HAS_AIDECK
    ? `sibling aideck dist not at ${AIDECK_CLI}`
    : !HAS_DASHBOARD
      ? `dashboard bundle not at ${DASHBOARD_DIR}/index.html — run npm run build:dashboard`
      : false

/** Picks an ephemeral free port to avoid clashing with the user's running aideck. */
async function freePort() {
  return new Promise((resolveP, rejectP) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', rejectP)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      srv.close(() => resolveP(typeof addr === 'object' && addr ? addr.port : 0))
    })
  })
}

async function waitForOk(url, timeoutMs = 5000) {
  const start = Date.now()
  let lastErr
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return res
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
    }
    await delay(50)
  }
  throw new Error(`waitForOk(${url}) timeout: ${lastErr?.message ?? 'unknown'}`)
}

const PLAN_FILE = `---
schemaVersion: '0.1'
slug: smoke-plan
title: 'E.T-009 Smoke Plan'
version: '1.0'
status: active
started: '2026-05-20T00:00:00Z'
lastUpdated: '2026-05-20T00:00:00Z'
currentPhase: F0
parallelismAllowed: false
principles: []
glossary: []
phases:
  - id: F0
    slug: foundation
    title: 'Foundation'
    goal: 'Lay the groundwork'
    dependsOn: []
    subPhaseCount: 0
    status: active
    exitGate:
      summary: 'foundation done'
      criteria: []
references: []
---

# E.T-009 Smoke Plan

End-to-end test fixture. Narrative body here.
`

describe('e2e: atomic-skills + aideck full chain', () => {
  let tmpRoot
  let aideckProc
  let port

  before(async () => {
    if (SKIP_REASON) return // skip suite — `it()` calls below also skip.

    tmpRoot = mkdtempSync(join(tmpdir(), 'as-e2e-'))
    const plansDir = join(tmpRoot, '.atomic-skills', 'plans')
    mkdirSync(plansDir, { recursive: true })
    writeFileSync(join(plansDir, 'smoke-plan.md'), PLAN_FILE)

    port = await freePort()

    aideckProc = spawn(
      'node',
      [AIDECK_CLI, 'serve', '--port', String(port), '--static-dir', DASHBOARD_DIR],
      { cwd: tmpRoot, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    // Surface aideck stderr if the test fails later.
    let stderr = ''
    aideckProc.stderr.on('data', (b) => {
      stderr += String(b)
    })
    aideckProc.on('exit', (code) => {
      if (code !== null && code !== 0) {
        // eslint-disable-next-line no-console
        console.error(`aideck exited with code ${code}:\n${stderr}`)
      }
    })

    // Wait until aideck is listening + the watcher has indexed the plan.
    await waitForOk(`http://127.0.0.1:${port}/api/health`)
    // The chokidar watcher needs a tick after `ready` to surface the
    // initial files; the read API queries the FS directly so by the time
    // health returns OK, the read should also work — but poll the state
    // endpoint until the plan appears (catches slow Linux FS events).
    const start = Date.now()
    while (Date.now() - start < 3000) {
      const r = await fetch(`http://127.0.0.1:${port}/api/state/project-status`)
      const body = await r.json()
      if (body?.state?.plans?.length > 0) return
      await delay(50)
    }
  })

  after(async () => {
    if (aideckProc) {
      aideckProc.kill('SIGINT')
      // Give it a beat to exit cleanly before resolving the test runner.
      await delay(100)
      if (!aideckProc.killed) aideckProc.kill('SIGKILL')
    }
    if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('GET /api/state/project-status returns the plan (envelope + flat layout)', { skip: SKIP_REASON }, async () => {
    const r = await fetch(`http://127.0.0.1:${port}/api/state/project-status`)
    assert.equal(r.status, 200)
    const body = await r.json()
    assert.equal(body.schemaVersion, '0.1')
    assert.ok(body.state, 'envelope must include state')
    assert.equal(body.state.consumer, 'project-status')
    assert.equal(body.state.plans.length, 1)
    assert.equal(body.state.plans[0].slug, 'smoke-plan')
    assert.equal(body.state.plans[0].title, 'E.T-009 Smoke Plan')
  })

  it('GET /api/state/project-status/<slug> returns the entity', { skip: SKIP_REASON }, async () => {
    const r = await fetch(`http://127.0.0.1:${port}/api/state/project-status/smoke-plan`)
    assert.equal(r.status, 200)
    const body = await r.json()
    assert.equal(body.schemaVersion, '0.1')
    assert.ok(body.entity, 'envelope must include entity')
    assert.equal(body.entity.slug, 'smoke-plan')
    assert.equal(body.entity.currentPhase, 'F0')
    assert.equal(body.entity.phases.length, 1)
  })

  it('GET /api/state/project-status/<missing-slug> returns structured 404', { skip: SKIP_REASON }, async () => {
    const r = await fetch(`http://127.0.0.1:${port}/api/state/project-status/does-not-exist`)
    assert.equal(r.status, 404)
    const body = await r.json()
    assert.equal(body.error.code, 'slug_not_found')
  })

  it('GET / serves the dashboard index.html (static-dir mounted)', { skip: SKIP_REASON }, async () => {
    const r = await fetch(`http://127.0.0.1:${port}/`)
    assert.equal(r.status, 200)
    assert.match(r.headers.get('content-type') ?? '', /text\/html/i)
    const text = await r.text()
    assert.match(text, /<title>atomic-skills · dashboard<\/title>/)
    assert.match(text, /<div id="root"><\/div>/)
  })

  it('GET /plans/smoke-plan serves index.html (SPA fallback)', { skip: SKIP_REASON }, async () => {
    const r = await fetch(`http://127.0.0.1:${port}/plans/smoke-plan`)
    assert.equal(r.status, 200)
    const text = await r.text()
    assert.match(text, /<title>atomic-skills · dashboard<\/title>/)
  })

  it('GET /sse opens an event stream (Content-Type: text/event-stream)', { skip: SKIP_REASON }, async () => {
    const controller = new AbortController()
    const r = await fetch(`http://127.0.0.1:${port}/sse`, { signal: controller.signal })
    assert.equal(r.status, 200)
    assert.match(r.headers.get('content-type') ?? '', /text\/event-stream/i)
    controller.abort()
  })
})
