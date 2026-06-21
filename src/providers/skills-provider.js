import { computeSkillsFileSet } from './skills-file-set.js';

/**
 * SkillsProvider — a pure planner (the Provider contract from
 * @henryavila/tooling-installer) that maps the atomic-skills config to a single
 * reconcileFileSet effect whose desired file set reproduces installSkills'
 * footprint (skill bodies + shared assets + namespace roots).
 *
 * It never executes effects and never writes revert logic: reversibility is a
 * property of the reconcileFileSet effect + the Driver's journal, not of this
 * provider.
 *
 *   createSkillsProvider().plan(config, { basePath }) -> [{ type, args }]
 *
 * @returns {{ plan: (config: object, planCtx: { basePath: string }) => Array<{ type: string, args: object }> }}
 */
export function createSkillsProvider() {
  return {
    plan(config, { basePath }) {
      const desired = computeSkillsFileSet(config);
      return [{ type: 'reconcileFileSet', args: { basePath, desired } }];
    },
  };
}
