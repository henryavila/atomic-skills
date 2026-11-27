/**
 * Function symbols for qa/measure/js-size.
 *
 * A symbol is the qualified name of a function in its file:
 *   - `Class.method` for a method, `Class.#private` for a private method;
 *   - `Class.get x` and `Class.set x` for accessors;
 *   - `outer>inner` for a function nested in a function;
 *   - the variable, property or function expression name when a function
 *     expression or arrow has one;
 *   - `<anonymous>` under the enclosing symbol when it has no name;
 *   - `<computed>` for a computed property key that is not a string or number
 *     literal;
 *   - `#2`, `#3` after a symbol that already appeared in the same file,
 *     in source order.
 *
 * The walk is a pre-order traversal, so entries come out in source order.
 */

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const CLASS_TYPES = new Set(['ClassDeclaration', 'ClassExpression']);

function literalName(key) {
  if (!key || key.type !== 'Literal') return null;
  if (typeof key.value === 'string' || typeof key.value === 'number') return String(key.value);
  return null;
}

function keyName(key, computed = false) {
  if (!key) return null;
  if (computed) return literalName(key) ?? '<computed>';
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'PrivateIdentifier') return `#${key.name}`;
  return literalName(key);
}

/** The name a function expression or arrow takes from its parent. */
function assignedName(node, parent) {
  if (!parent) return null;
  if (parent.type === 'VariableDeclarator' && parent.init === node && parent.id.type === 'Identifier') {
    return parent.id.name;
  }
  if (parent.type === 'Property' && parent.key === node) {
    return keyName(parent.key, parent.computed);
  }
  if (parent.type === 'Property' && parent.value === node) {
    return keyName(parent.key, parent.computed);
  }
  if (parent.type === 'PropertyDefinition' && parent.value === node) {
    return keyName(parent.key, parent.computed);
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
    const name = keyName(parent.key, parent.computed) || '<anonymous>';
    if (parent.type === 'MethodDefinition' && (parent.kind === 'get' || parent.kind === 'set')) {
      return `${parent.kind} ${name}`;
    }
    return name;
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
        const declared = node.id ? node.id.name : null;
        const base = assigned || declared || '<anonymous>';
        full = context.fnSymbol ? `${context.fnSymbol}>${base}` : base;
      }
      const symbol = unique(full);
      entries.push({
        symbol,
        start: { line: node.loc.start.line, column: node.loc.start.column },
        end: { line: node.loc.end.line, column: node.loc.end.column },
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

/**
 * The innermost function whose own range holds the rule's reported range.
 *
 * ESLint may report at the function head, at a class member or at a property
 * key, which can start before the function value. The reported range ends at
 * the function it describes, so matching either end keeps a computed key
 * function apart from the function used as its value: the key's report ends at
 * the key, the value's report ends at the value.
 */
export function functionAtStart(entries, message) {
  const start = { line: message.line, column: message.column - 1 }; // ESLint columns are 1-based.
  const end = message.endLine && message.endColumn
    ? { line: message.endLine, column: message.endColumn - 1 }
    : start;

  const holds = (entry, position) =>
    compare(entry.start, position) <= 0 && compare(position, entry.end) <= 0;

  let best = null;
  for (const entry of entries) {
    if (!holds(entry, start) && !holds(entry, end)) continue;
    if (!best) {
      best = entry;
      continue;
    }
    const order = compare(entry.start, best.start);
    if (order > 0) {
      best = entry;
    } else if (order === 0 && compare(entry.end, best.end) < 0) {
      best = entry;
    }
  }
  return best;
}

/** The innermost function that contains a position, or null for module code. */
export function enclosingFunction(entries, message) {
  const position = { line: message.line, column: message.column - 1 };
  let best = null;
  let bestStart = null;
  for (const entry of entries) {
    if (compare(entry.start, position) <= 0 && compare(position, entry.end) <= 0) {
      if (!best || compare(entry.start, bestStart) > 0) {
        best = entry;
        bestStart = entry.start;
      }
    }
  }
  return best;
}
