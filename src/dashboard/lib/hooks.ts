import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DiscoverCandidate } from './types'
import * as api from './api'

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    staleTime: 60 * 1000,
  })
}

export function useProjectState() {
  return useQuery({
    queryKey: ['state', 'project-status'],
    queryFn: api.getState,
  })
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
    retry: false,
  })
}

export function useProjectScopedState(projectId: string | undefined) {
  return useQuery({
    queryKey: ['state', 'project-status', projectId],
    queryFn: () => api.getProjectState(projectId as string),
    enabled: Boolean(projectId),
  })
}

export function usePlan(slug: string | undefined, projectId?: string) {
  return useQuery({
    queryKey: projectId ? ['plan', projectId, slug] : ['plan', slug],
    queryFn: async () => {
      if (projectId) {
        try { return await api.getProjectPlan(projectId, slug as string) }
        catch { return api.getPlan(slug as string) }
      }
      return api.getPlan(slug as string)
    },
    enabled: Boolean(slug),
  })
}

export function useInitiative(slug: string | undefined, projectId?: string) {
  return useQuery({
    queryKey: projectId ? ['initiative', projectId, slug] : ['initiative', slug],
    queryFn: async () => {
      if (projectId) {
        try { return await api.getProjectInitiative(projectId, slug as string) }
        catch { return api.getInitiative(slug as string) }
      }
      return api.getInitiative(slug as string)
    },
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
      queryClient.invalidateQueries({ queryKey: ['state', 'project-status'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      if (evt.consumer) {
        queryClient.invalidateQueries({ queryKey: ['state', evt.consumer] })
      }
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

// ── Discover hooks ────────────────────────────────────────────────────────

export function useDiscoverRun(projectId?: string) {
  return useQuery({
    queryKey: projectId ? ['state', 'bootstrap-drafts', projectId] : ['state', 'bootstrap-drafts'],
    queryFn: () => api.getDiscoverState(projectId),
    retry: false,
  })
}

export function useDiscoverDecisions(slugs: string[]) {
  return useQuery({
    queryKey: ['discover-decisions', slugs],
    queryFn: () => api.getDiscoverDecisions(slugs),
    enabled: slugs.length > 0,
  })
}

export function usePostDecisions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (entries: Array<{ candidate: DiscoverCandidate; decision: 'approve' | 'reject' }>) => {
      const results = []
      for (const { candidate, decision } of entries) {
        results.push(await api.postDecision(candidate, decision))
      }
      return results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discover-decisions'] })
    },
  })
}
