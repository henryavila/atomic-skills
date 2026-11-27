/**
 * Parse JavaScript the way the measured tree may contain it: an ES module
 * first, then a CommonJS script whose top level may return.
 *
 * Both failures are reported, so a caller can name the file and stop instead
 * of falling back to another language's comment syntax.
 */
export function parseJavaScript(espree, source, options = {}) {
  const settings = { ecmaVersion: 'latest', ...options };
  try {
    return espree.parse(source, { ...settings, sourceType: 'module' });
  } catch (moduleError) {
    try {
      return espree.parse(source, {
        ...settings,
        sourceType: 'script',
        ecmaFeatures: { ...(options.ecmaFeatures || {}), globalReturn: true },
      });
    } catch (scriptError) {
      const error = new Error(
        `${moduleError.message} (as a module); ${scriptError.message} (as a script)`,
      );
      error.moduleError = moduleError;
      error.scriptError = scriptError;
      throw error;
    }
  }
}
