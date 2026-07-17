import { computeSkillsFileSet } from './skills-file-set.js';

/**
 * SkillsProvider — a pure planner (the Provider contract from
 * @henryavila/minimalist-installer) that maps the atomic-skills config to a single
 * reconcileFileSet effect whose desired file set reproduces installSkills'
 * footprint (skill bodies + shared assets + namespace roots).
 *
 * It never executes effects and never writes revert logic: reversibility is a
 * property of the reconcileFileSet effect + the Driver's journal, not of this
 * provider.
 *
 * P1-A: `config.excludeDesiredPaths` drops unmanaged-desired paths so the
 * reconciler neither rewrites nor claims them (no GREENFIELD_CONFLICT).
 *
 *   createSkillsProvider().plan(config, { basePath }) -> [{ type, args }]
 *
 * @returns {{ plan: (config: object, planCtx: { basePath: string }) => Array<{ type: string, args: object }> }}
 */
export function createSkillsProvider() {
  return {
    plan(config, { basePath }) {
      let desired = computeSkillsFileSet(config);
      if (Array.isArray(config.excludeDesiredPaths) && config.excludeDesiredPaths.length > 0) {
        const skip = new Set(config.excludeDesiredPaths);
        desired = desired.filter((f) => f && !skip.has(f.path));
      }
      return [{ type: 'reconcileFileSet', args: { basePath, desired } }];
    },
  };
}
