/**
 * Inline flat config for qa/measure/js-size.
 *
 * No `eslint.config.*` file exists at the repository root: the measurer builds
 * this config from qa/ceilings.tsv and passes it through ESLint's Node API.
 */
export function createConfig(ceilings) {
  return {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      complexity: ['error', ceilings.complexity],
      'max-lines-per-function': [
        'error',
        { max: ceilings['function-lines'], skipBlankLines: true, skipComments: true },
      ],
      'max-params': ['error', ceilings.params],
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  };
}
