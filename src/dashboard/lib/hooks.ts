import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'

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
 * Mount ONCE at the App level. Opens the SSE connection and invalidates the
 * matching TanStack Query keys on every state-change event. aiDeck pushes the
 * watcher event in <200ms of the file write, so the UI converges quickly with
 * no polling.
 *
 * Errors and health-ticks are ignored at this layer — health is for liveness
 * probes (handled by EventSource auto-reconnect), errors should surface via
 * the per-query error state if they affect the data the user is looking at.
 */
export function useStateChangeSubscription(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const es = api.subscribeToEvents((evt) => {
      if (evt.kind !== 'state-change') return
      // Aggregate state is invalidated on any change — covers list views.
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
