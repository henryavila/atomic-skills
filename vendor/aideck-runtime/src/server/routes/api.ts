import { randomUUID } from 'node:crypto'
import { basename, isAbsolute } from 'node:path'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import type { ErrorResponse } from '../../schemas/common.js'
import { annotationTargetSchema } from '../../schemas/validators/common.js'
import { appendJsonlLine } from '../writers/jsonl-append.js'
import {
  annotationsPathFor,
  consumerRoot,
  highlightsPathFor,
  inboxPathFor,
  UnsafeConsumerIdError
} from '../writers/paths.js'
import { listConsumers } from '../projections/consumers.js'
import { buildAllForConsumer, buildForSlug } from '../projections/state.js'
import { projectInbox } from '../projections/inbox.js'
import { projectNextAction } from '../projections/next-action.js'
import { projectHelp } from '../projections/help.js'
import type { EventBus } from '../event-bus.js'

export interface ApiDeps {
  rootDir: string
  eventBus: EventBus
  startedAt: number
  version: string
  demo: boolean
}

function errResp(c: Context, e: ErrorResponse, status: number): Response {
  return c.json({ schemaVersion: '0.1', error: e }, status as Parameters<Context['json']>[1])
}

function statusFor(code: ErrorResponse['code']): number {
  switch (code) {
    case 'slug_not_found':
    case 'consumer_unknown':
    case 'path_not_found':
      return 404
    case 'invalid_input':
    case 'schema_version_mismatch':
      return 400
    case 'precondition_failed':
      return 412
    case 'io_error':
    case 'internal_error':
      return 500
  }
}

async function readBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return null
  }
}

function nextDailyId(prefix: string): string {
  const day = new Date().toISOString().slice(0, 10)
  return `${prefix}-${day}-${randomUUID().slice(0, 8)}`
}

const annotationInputSchema = z
  .object({
    target: annotationTargetSchema,
    author: z.enum(['human', 'ai']),
    body: z.string()
  })
  .strict()

const highlightInputSchema = z
  .object({
    target: annotationTargetSchema,
    reason: z.string(),
    severity: z.enum(['info', 'warn', 'critical']),
    source: z.enum(['human', 'ai'])
  })
  .strict()

const decisionInputSchema = z
  .object({
    target: annotationTargetSchema,
    decision: z.enum(['approve', 'reject', 'block', 'defer']),
    reason: z.string().optional(),
    by: z.enum(['human', 'ai'])
  })
  .strict()

const resolutionInputSchema = z
  .object({
    by: z.enum(['human', 'ai']).default('human'),
    note: z.string().optional()
  })
  .strict()

const ackInputSchema = z
  .object({
    by: z.enum(['human', 'ai']).default('human')
  })
  .strict()

const PROJECT_ID_RE = /^[a-z][a-z0-9-]{0,63}$/

const projectRegistrationInputSchema = z
  .object({
    rootDir: z.string().min(1).refine((value) => isAbsolute(value), 'rootDir must be absolute'),
    projectId: z.string().regex(PROJECT_ID_RE).optional()
  })
  .strict()

interface RegisteredProject {
  projectId: string
  rootDir: string
  registeredAt: string
}

function deriveProjectId(rootDir: string): string {
  const projectId = basename(rootDir)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^[^a-z]+/, '')
    .slice(0, 64)
  return projectId || 'project'
}

export function createApiRouter(deps: ApiDeps): Hono {
  const app = new Hono()
  const projects = new Map<string, RegisteredProject>()

  function registerProject(rootDir: string, projectId = deriveProjectId(rootDir)): RegisteredProject {
    const existing = projects.get(projectId)
    const project = {
      projectId,
      rootDir,
      registeredAt: existing?.registeredAt ?? new Date().toISOString()
    }
    projects.set(projectId, project)
    return project
  }

  function projectOr404(c: Context, projectId: string): RegisteredProject | Response {
    const project = projects.get(projectId)
    if (project) return project
    return errResp(c, {
      code: 'path_not_found',
      message: `project "${projectId}" is not registered`,
      suggestion: 'Register it with POST /api/projects/register'
    }, 404)
  }

  registerProject(deps.rootDir)

  app.get('/api/health', async (c) => {
    const consumers = await listConsumers(deps.rootDir)
    return c.json({
      schemaVersion: '0.1',
      apiVersion: '0.1',
      service: 'aideck',
      version: deps.version,
      status: 'ok',
      uptimeMs: Date.now() - deps.startedAt,
      consumerCount: consumers.length,
      demo: deps.demo,
      modes: ['http', 'sse'] as const,
      rootDir: deps.rootDir,
      projects: Array.from(projects.keys())
    })
  })

  app.get('/api/projects', (c) => {
    return c.json({ schemaVersion: '0.1', projects: Array.from(projects.values()) })
  })

  app.post('/api/projects/register', async (c) => {
    const raw = await readBody(c)
    const parsed = projectRegistrationInputSchema.safeParse(raw)
    if (!parsed.success) {
      return errResp(c, {
        code: 'invalid_input',
        message: parsed.error.issues[0]?.message ?? 'invalid project registration payload'
      }, 400)
    }
    const project = registerProject(parsed.data.rootDir, parsed.data.projectId)
    return c.json({ schemaVersion: '0.1', project })
  })

  app.get('/api/projects/:projectId/state/:consumer', async (c) => {
    const project = projectOr404(c, c.req.param('projectId'))
    if (project instanceof Response) return project
    const id = c.req.param('consumer')
    const r = await buildAllForConsumer(project.rootDir, id)
    if (!r.ok) return errResp(c, r.error, statusFor(r.error.code))
    return c.json({ schemaVersion: '0.1', state: r.value })
  })

  app.get('/api/projects/:projectId/state/:consumer/:slug', async (c) => {
    const project = projectOr404(c, c.req.param('projectId'))
    if (project instanceof Response) return project
    const id = c.req.param('consumer')
    const slug = c.req.param('slug')
    const r = await buildForSlug(project.rootDir, id, slug)
    if (!r.ok) return errResp(c, r.error, statusFor(r.error.code))
    return c.json({ schemaVersion: '0.1', entity: r.value })
  })

  app.get('/api/consumers', async (c) => {
    const consumers = await listConsumers(deps.rootDir)
    return c.json({ schemaVersion: '0.1', consumers })
  })

  app.get('/api/state/:consumer', async (c) => {
    const id = c.req.param('consumer')
    const r = await buildAllForConsumer(deps.rootDir, id)
    if (!r.ok) return errResp(c, r.error, statusFor(r.error.code))
    return c.json({ schemaVersion: '0.1', state: r.value })
  })

  app.get('/api/state/:consumer/:slug', async (c) => {
    const id = c.req.param('consumer')
    const slug = c.req.param('slug')
    const r = await buildForSlug(deps.rootDir, id, slug)
    if (!r.ok) return errResp(c, r.error, statusFor(r.error.code))
    return c.json({ schemaVersion: '0.1', entity: r.value })
  })

  app.get('/api/help', (c) => {
    return c.json({ schemaVersion: '0.1', skills: projectHelp(deps.rootDir) })
  })

  app.get('/api/inbox', async (c) => {
    const consumer = c.req.query('consumer') || undefined
    const since = c.req.query('since') || undefined
    const limitRaw = c.req.query('limit')
    const limit = limitRaw ? Number(limitRaw) : 50
    if (Number.isNaN(limit) || limit <= 0 || limit > 500) {
      return errResp(c, { code: 'invalid_input', message: 'limit must be 1..500' }, 400)
    }
    const proj = await projectInbox(deps.rootDir, { consumer, since, limit })
    return c.json({ schemaVersion: '0.1', ...proj })
  })

  app.get('/api/next-action', async (c) => {
    const consumer = c.req.query('consumer') ?? 'project-status'
    const planSlug = c.req.query('plan') ?? undefined
    const initiativeSlug = c.req.query('initiative') ?? undefined
    const proj = await projectNextAction(deps.rootDir, { consumer, planSlug, initiativeSlug })
    return c.json({ schemaVersion: '0.1', nextAction: proj })
  })

  app.post('/api/annotate', async (c) => {
    const raw = await readBody(c)
    const parsed = annotationInputSchema.safeParse(raw)
    if (!parsed.success) {
      return errResp(c, {
        code: 'invalid_input',
        message: parsed.error.issues[0]?.message ?? 'invalid annotation payload'
      }, 400)
    }
    const consumer = parsed.data.target.consumer
    let dir: string
    try {
      dir = consumerRoot(deps.rootDir, consumer)
    } catch (e) {
      if (e instanceof UnsafeConsumerIdError) {
        return errResp(c, { code: 'invalid_input', message: e.message }, 400)
      }
      throw e
    }
    const path = annotationsPathFor(dir)
    const id = nextDailyId('ann')
    const createdAt = new Date().toISOString()
    const annotation = { schemaVersion: '0.1' as const, ...parsed.data, id, createdAt }
    await appendJsonlLine(path, annotation)
    deps.eventBus.emit({ kind: 'annotation-added', consumer, annotation })
    return c.json({ schemaVersion: '0.1', id, createdAt }, 201)
  })

  app.post('/api/highlight', async (c) => {
    const raw = await readBody(c)
    const parsed = highlightInputSchema.safeParse(raw)
    if (!parsed.success) {
      return errResp(c, {
        code: 'invalid_input',
        message: parsed.error.issues[0]?.message ?? 'invalid highlight payload'
      }, 400)
    }
    const consumer = parsed.data.target.consumer
    let dir: string
    try {
      dir = consumerRoot(deps.rootDir, consumer)
    } catch (e) {
      if (e instanceof UnsafeConsumerIdError) {
        return errResp(c, { code: 'invalid_input', message: e.message }, 400)
      }
      throw e
    }
    const path = highlightsPathFor(dir)
    const id = nextDailyId('hl')
    const createdAt = new Date().toISOString()
    const highlight = { schemaVersion: '0.1' as const, ...parsed.data, id, createdAt }
    await appendJsonlLine(path, highlight)
    deps.eventBus.emit({ kind: 'highlight-added', consumer, highlight })
    return c.json({ schemaVersion: '0.1', id, createdAt }, 201)
  })

  app.post('/api/decision', async (c) => {
    const raw = await readBody(c)
    const parsed = decisionInputSchema.safeParse(raw)
    if (!parsed.success) {
      return errResp(c, {
        code: 'invalid_input',
        message: parsed.error.issues[0]?.message ?? 'invalid decision payload'
      }, 400)
    }
    const consumer = parsed.data.target.consumer
    let dir: string
    try {
      dir = consumerRoot(deps.rootDir, consumer)
    } catch (e) {
      if (e instanceof UnsafeConsumerIdError) {
        return errResp(c, { code: 'invalid_input', message: e.message }, 400)
      }
      throw e
    }
    const path = inboxPathFor(dir)
    const id = nextDailyId('dec')
    const createdAt = new Date().toISOString()
    const decision = { schemaVersion: '0.1' as const, kind: 'decision' as const, ...parsed.data, id, createdAt }
    await appendJsonlLine(path, decision)
    return c.json({ schemaVersion: '0.1', id, createdAt }, 201)
  })

  app.post('/api/annotation/:id/resolve', async (c) => {
    const id = c.req.param('id')
    const raw = (await readBody(c)) ?? {}
    const parsed = resolutionInputSchema.safeParse(raw)
    if (!parsed.success) {
      return errResp(c, { code: 'invalid_input', message: 'invalid resolution payload' }, 400)
    }
    const consumer = c.req.query('consumer') ?? 'project-status'
    let path: string
    try {
      path = inboxPathFor(consumerRoot(deps.rootDir, consumer))
    } catch (e) {
      if (e instanceof UnsafeConsumerIdError) {
        return errResp(c, { code: 'invalid_input', message: e.message }, 400)
      }
      throw e
    }
    const resolution = {
      schemaVersion: '0.1' as const,
      kind: 'resolution' as const,
      refId: id,
      by: parsed.data.by,
      resolvedAt: new Date().toISOString(),
      ...(parsed.data.note ? { note: parsed.data.note } : {})
    }
    await appendJsonlLine(path, resolution)
    return c.json({ schemaVersion: '0.1', resolution }, 201)
  })

  app.post('/api/highlight/:id/acknowledge', async (c) => {
    const id = c.req.param('id')
    const raw = (await readBody(c)) ?? {}
    const parsed = ackInputSchema.safeParse(raw)
    if (!parsed.success) {
      return errResp(c, { code: 'invalid_input', message: 'invalid acknowledgement payload' }, 400)
    }
    const consumer = c.req.query('consumer') ?? 'project-status'
    let path: string
    try {
      path = inboxPathFor(consumerRoot(deps.rootDir, consumer))
    } catch (e) {
      if (e instanceof UnsafeConsumerIdError) {
        return errResp(c, { code: 'invalid_input', message: e.message }, 400)
      }
      throw e
    }
    const ack = {
      schemaVersion: '0.1' as const,
      kind: 'acknowledgement' as const,
      refId: id,
      by: parsed.data.by,
      acknowledgedAt: new Date().toISOString()
    }
    await appendJsonlLine(path, ack)
    return c.json({ schemaVersion: '0.1', acknowledgement: ack }, 201)
  })

  return app
}
