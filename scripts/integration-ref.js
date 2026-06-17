export const DEFAULT_INTEGRATION_REF = 'develop';

/**
 * Resolve the effective integration ref from ALREADY-READ, SCHEMA-VALID
 * routing.json content. Pure: no fs / git / network. Never throws.
 *
 * The schema (meta/schemas/routing.schema.json) is the validation gate: it
 * rejects a non-string / empty `integrationRef` BEFORE this resolver runs, so
 * in correct operation the field is either absent or a non-empty string. The
 * resolver's only job is to DISTINGUISH the absent-FILE case (-> not-configured,
 * which is never silently assumed — it is surfaced for the lazy prompt) from a
 * present file (-> the declared ref, or the documented `develop` default when
 * the field is absent). A present-but-non-string value (schema-invalid, hence
 * unreachable post-validation) is tolerated defensively via the `default`
 * branch — it is NEVER promoted to a `declared` ref.
 *
 * @param {object|null|undefined} routingConfig
 *   Parsed routing.json when the file exists; null/undefined when it does NOT.
 * @returns {{ ref: string|null, configured: boolean, source: 'declared'|'default'|'not-configured' }}
 *   - declared      : file present, integrationRef is a non-empty string     -> { ref:<value>, configured:true,  source:'declared' }
 *   - default       : file present, integrationRef absent/empty/non-string   -> { ref:'develop', configured:true,  source:'default' }
 *   - not-configured: file absent (null/undefined)                           -> { ref:null,      configured:false, source:'not-configured' }
 */
export function resolveIntegrationRef(routingConfig) {
  if (routingConfig == null) {
    return { ref: null, configured: false, source: 'not-configured' };
  }

  // Honor only an OWN `integrationRef` — never one inherited from the prototype
  // chain (defensive: a polluted Object.prototype or a non-JSON.parse caller must
  // not leak an inherited ref in as `declared`).
  if (
    Object.hasOwn(routingConfig, 'integrationRef') &&
    typeof routingConfig.integrationRef === 'string' &&
    routingConfig.integrationRef !== ''
  ) {
    return { ref: routingConfig.integrationRef, configured: true, source: 'declared' };
  }

  return { ref: DEFAULT_INTEGRATION_REF, configured: true, source: 'default' };
}
