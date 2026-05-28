import type {
  Annotation,
  ErrorResponse,
  Highlight,
  IsoTimestamp
} from '../../schemas/common.js'
import type { Initiative, Plan } from '../../schemas/project-status.js'

export type EntityKind = 'plan' | 'initiative'
export type ChangeType = 'add' | 'change' | 'unlink'

export interface BaseEvent {
  id: number
  emittedAt: IsoTimestamp
}

export interface StateChangeEvent extends BaseEvent {
  kind: 'state-change'
  consumer: string
  slug: string
  entityKind: EntityKind
  changeType: ChangeType
  entity?: Plan | Initiative
}

export interface AnnotationAddedEvent extends BaseEvent {
  kind: 'annotation-added'
  consumer: string
  annotation: Annotation
}

export interface HighlightAddedEvent extends BaseEvent {
  kind: 'highlight-added'
  consumer: string
  highlight: Highlight
}

export interface ParseErrorEvent extends BaseEvent {
  kind: 'error'
  consumer?: string
  path: string
  code: ErrorResponse['code']
  message: string
  suggestion?: string
}

export interface HealthTickEvent extends BaseEvent {
  kind: 'health-tick'
  uptimeMs: number
}

export type RuntimeEvent =
  | StateChangeEvent
  | AnnotationAddedEvent
  | HighlightAddedEvent
  | ParseErrorEvent
  | HealthTickEvent

export type RuntimeEventKind = RuntimeEvent['kind']
