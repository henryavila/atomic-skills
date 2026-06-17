export const DEFAULT_INTEGRATION_REF = 'develop';

/**
 * Resolve the effective integration ref from ALREADY-READ routing.json content.
 * Pure: no fs / git / network. Never throws; never assumes silently.
 *
 * @param {object|null|undefined} routingConfig
 *   Parsed routing.json when the file exists; null/undefined when it does NOT.
 * @returns {{ ref: string|null, configured: boolean, source: 'declared'|'default'|'not-configured' }}
 *   - declared      : file present and integrationRef set       -> { ref:<value>, configured:true,  source:'declared' }
 *   - default       : file present, integrationRef absent/empty -> { ref:'develop', configured:true,  source:'default' }
 *   - not-configured: file absent (null/undefined)              -> { ref:null,      configured:false, source:'not-configured' }
 */
export function resolveIntegrationRef(routingConfig) {
  if (routingConfig == null) {
    return { ref: null, configured: false, source: 'not-configured' };
  }

  if (typeof routingConfig.integrationRef === 'string' && routingConfig.integrationRef !== '') {
    return { ref: routingConfig.integrationRef, configured: true, source: 'declared' };
  }

  return { ref: DEFAULT_INTEGRATION_REF, configured: true, source: 'default' };
}
