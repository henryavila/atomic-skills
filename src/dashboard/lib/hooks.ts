import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import { subscribeToChanges } from './api'

export function useProjectState() {
  return useQuery({
    queryKey: ['state', 'project-status'],
    queryFn: api.getState,
  })
}

export function usePlan(slug: string | undefined) {
  return useQuery({
    queryKey: ['plan', slug],
    queryFn: () => api.getPlan(slug as string),
    enabled: Boolean(slug),
  })
}

export function useInitiative(slug: string | undefined) {
  return useQuery({
    queryKey: ['initiative', slug],
    queryFn: () => api.getInitiative(slug as string),
    enabled: Boolean(slug),
  })
}

/**
 * Mount once at the App level. Subscribes to aideck's SSE stream and
 * invalidates the matching TanStack Query keys whenever an entity changes
 * on disk. The watcher fires within 50-200ms of file write per the aideck
 * contract, so the UI converges quickly without polling.
 */
export function useStateChangeSubscription(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const es = subscribeToChanges((evt) => {
      if (evt.kind !== 'state-change') return
      // Project-state aggregator is always invalidated — it covers any change.
      queryClient.invalidateQueries({ queryKey: ['state', 'project-status'] })
      if (evt.entityKind === 'plan' && evt.slug) {
        queryClient.invalidateQueries({ queryKey: ['plan', evt.slug] })
      }
      if (evt.entityKind === 'initiative' && evt.slug) {
        queryClient.invalidateQueries({ queryKey: ['initiative', evt.slug] })
      }
    })
    return () => es.close()
  }, [queryClient])
}
