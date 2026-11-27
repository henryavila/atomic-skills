/**
 * Function symbols for qa/measure/js-size.
 *
 * A symbol is the qualified name of a function in its file:
 *   - `Class.method` for a method;
 *   - `outer>inner` for a function nested in a function;
 *   - the variable or property name when a function expression or arrow is
 *     assigned to one;
 *   - `<anonymous>` under the enclosing symbol when it has no name;
 *   - `#2`, `#3` after a symbol that already appeared in the same file,
 *     in source order.
 *
 * The walk is a pre-order traversal, so entries come out in source order.
 */

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const CLASS_TYPES = new Set(['ClassDeclaration', 'ClassExpression']);

function keyName(key) {
  if (!key) return null;
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal') return String(key.value);
  return null;
}

/** The name a function expression or arrow takes from its parent. */
function assignedName(node, parent) {
  if (!parent) return null;
  if (parent.type === 'VariableDeclarator' && parent.init === node && parent.id.type === 'Identifier') {
    return parent.id.name;
  }
  if (parent.type === 'Property' && parent.value === node && !parent.computed) {
    return keyName(parent.key);
  }
  if (parent.type === 'PropertyDefinition' && parent.value === node && !parent.computed) {
    return keyName(parent.key);
  }
  if (parent.type === 'AssignmentExpression' && parent.right === node) {
    if (parent.left.type === 'Identifier') return parent.left.name;
    if (parent.left.type === 'MemberExpression' && !parent.left.computed) {
      return keyName(parent.left.property);
    }
  }
  if (parent.type === 'AssignmentPattern' && parent.right === node && parent.left.type === 'Identifier') {
    return parent.left.name;
  }
  return null;
}

function methodName(node, parent) {
  if (!parent) return null;
  if ((parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && parent.value === node) {
    return parent.computed ? '<anonymous>' : keyName(parent.key) || '<anonymous>';
  }
  return null;
}

/**
 * @param {object} ast an espree Program with `loc`
 * @returns {Array<{symbol: string, start: {line: number, column: number}, end: {line: number, column: number}}>}
 */
export function collectFunctions(ast) {
  const entries = [];
  const seen = new Map();

  function unique(base) {
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}#${count}`;
  }

  function walk(node, parent, context) {
    if (!node || typeof node.type !== 'string') return;

    let next = context;

    if (CLASS_TYPES.has(node.type)) {
      const bare = (node.id && node.id.name) || assignedName(node, parent) || '<anonymous>';
      const prefix = context.fnSymbol || context.classSymbol;
      next = { ...context, classSymbol: prefix ? `${prefix}>${bare}` : bare };
    }

    if (FUNCTION_TYPES.has(node.type)) {
      const method = methodName(node, parent);
      const assigned = assignedName(node, parent);
      let full;
      if (method) {
        full = context.classSymbol ? `${context.classSymbol}.${method}` : method;
      } else {
        const declared = node.type === 'FunctionDeclaration' && node.id ? node.id.name : null;
        const base = assigned || declared || '<anonymous>';
        full = context.fnSymbol ? `${context.fnSymbol}>${base}` : base;
      }
      const symbol = unique(full);
      entries.push({
        symbol,
        start: { line: node.loc.start.line, column: node.loc.start.column },
        end: { line: node.loc.end.line, column: node.loc.end.column },
        // ESLint reports a named function at its head (the class member or the
        // property key), which can start before the function value.
        reportStart: (method || assigned) && parent
          ? { line: parent.loc.start.line, column: parent.loc.start.column }
          : undefined,
      });
      next = { fnSymbol: symbol, classSymbol: null };
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child.type === 'string') walk(child, node, next);
        }
      } else if (value && typeof value.type === 'string') {
        walk(value, node, next);
      }
    }
  }

  walk(ast, null, { fnSymbol: null, classSymbol: null });
  return entries;
}

function compare(left, right) {
  return left.line - right.line || left.column - right.column;
}

/** The function whose start is exactly the rule's reported position. */
export function functionAtStart(entries, message) {
  const line = message.line;
  const column = message.column - 1; // ESLint columns are 1-based; espree loc is 0-based.
  return (
    entries.find((entry) => {
      const start = entry.reportStart || entry.start;
      return start.line === line && start.column === column;
    }) || null
  );
}

/** The innermost function that contains a position, or null for module code. */
export function enclosingFunction(entries, message) {
  const position = { line: message.line, column: message.column - 1 };
  let best = null;
  let bestStart = null;
  for (const entry of entries) {
    const start = entry.reportStart || entry.start;
    if (compare(start, position) <= 0 && compare(position, entry.end) <= 0) {
      if (!best || compare(start, bestStart) > 0) {
        best = entry;
        bestStart = start;
      }
    }
  }
  return best;
}
