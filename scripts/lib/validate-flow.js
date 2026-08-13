import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { IMPLEMENTATION_TOKEN_RE } from './render-process-map.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '..', '..', 'meta', 'schemas', 'flow.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

export const SCHEMA_VERSION = '1.0';

function formatValidationError(error) {
  const location = error.instancePath || '/';
  const detail = error.message ?? 'failed validation';
  return `${location} ${detail}`;
}

function formatValidationErrors(errors) {
  return errors.map((error) => `- ${formatValidationError(error)}`).join('\n');
}

function err(instancePath, keyword, message, params = {}) {
  return {
    instancePath,
    schemaPath: `#/${keyword}`,
    keyword,
    params,
    message,
  };
}

function actorIds(doc) {
  const ids = new Set();
  if (!Array.isArray(doc?.actors)) return ids;
  for (const actor of doc.actors) {
    if (typeof actor?.id === 'string') ids.add(actor.id);
  }
  return ids;
}

function collectBranchIds(nodes) {
  const ids = new Set();
  for (const node of Object.values(nodes)) {
    if (node?.type !== 'decision' || !Array.isArray(node.branches)) continue;
    for (const branch of node.branches) {
      if (typeof branch?.id === 'string') ids.add(branch.id);
    }
  }
  return ids;
}

function neighbors(node) {
  if (!node || typeof node !== 'object') return [];
  if (node.type === 'sequence' && typeof node.next === 'string') return [node.next];
  if (node.type === 'decision' && Array.isArray(node.branches)) {
    return node.branches
      .map((branch) => branch?.next)
      .filter((next) => typeof next === 'string');
  }
  return [];
}

function reachableFrom(entry, nodes) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...neighbors(nodes[id]));
  }
  return seen;
}

function graphErrors(doc) {
  const errors = [];
  const actors = actorIds(doc);
  const seenActorIds = new Set();
  if (Array.isArray(doc.actors)) {
    doc.actors.forEach((actor, i) => {
      const id = actor?.id;
      if (typeof id !== 'string') return;
      if (seenActorIds.has(id)) {
        errors.push(err(`/actors/${i}/id`, 'uniqueActorId', `duplicate actor id '${id}'`, { id }));
      } else {
        seenActorIds.add(id);
      }
    });
  }

  const graph = doc.graph;
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) return errors;
  const nodes = graph.nodes && typeof graph.nodes === 'object' && !Array.isArray(graph.nodes)
    ? graph.nodes
    : null;
  if (!nodes) return errors;
  const nodeIds = new Set(Object.keys(nodes));

  if (typeof graph.entry === 'string' && !nodeIds.has(graph.entry)) {
    errors.push(err('/graph/entry', 'entryExists', `entry '${graph.entry}' is not a graph node`, {
      entry: graph.entry,
    }));
  }

  const seenBranchIds = new Set();
  for (const [id, node] of Object.entries(nodes)) {
    if (!node || typeof node !== 'object') continue;

    if (node.type === 'sequence') {
      if (typeof node.next === 'string' && !nodeIds.has(node.next)) {
        errors.push(err(
          `/graph/nodes/${id}/next`,
          'nextExists',
          `next '${node.next}' is not a graph node`,
          { next: node.next },
        ));
      }
      if (Array.isArray(node.messages)) {
        node.messages.forEach((message, i) => {
          for (const field of ['from', 'to']) {
            const ref = message?.[field];
            if (typeof ref === 'string' && !actors.has(ref)) {
              errors.push(err(
                `/graph/nodes/${id}/messages/${i}/${field}`,
                'actorRef',
                `actor '${ref}' is not declared in actors[]`,
                { actor: ref },
              ));
            }
          }
        });
      }
    }

    if (node.type === 'decision') {
      if (typeof node.actor === 'string' && !actors.has(node.actor)) {
        errors.push(err(
          `/graph/nodes/${id}/actor`,
          'actorRef',
          `actor '${node.actor}' is not declared in actors[]`,
          { actor: node.actor },
        ));
      }
      const branches = Array.isArray(node.branches) ? node.branches : [];
      if (branches.length < 2) {
        errors.push(err(
          `/graph/nodes/${id}/branches`,
          'xorMinBranches',
          `xor decision '${id}' must have at least 2 branches`,
          { count: branches.length },
        ));
      }
      const whens = new Set();
      branches.forEach((branch, i) => {
        if (typeof branch?.next === 'string' && !nodeIds.has(branch.next)) {
          errors.push(err(
            `/graph/nodes/${id}/branches/${i}/next`,
            'nextExists',
            `next '${branch.next}' is not a graph node`,
            { next: branch.next },
          ));
        }
        if (typeof branch?.when === 'string') {
          if (whens.has(branch.when)) {
            errors.push(err(
              `/graph/nodes/${id}/branches/${i}/when`,
              'uniqueWhen',
              `duplicate when '${branch.when}' on decision '${id}'`,
              { when: branch.when },
            ));
          } else {
            whens.add(branch.when);
          }
        }
        if (typeof branch?.id === 'string') {
          if (seenBranchIds.has(branch.id)) {
            errors.push(err(
              `/graph/nodes/${id}/branches/${i}/id`,
              'uniqueBranchId',
              `duplicate branch id '${branch.id}'`,
              { id: branch.id },
            ));
          } else {
            seenBranchIds.add(branch.id);
          }
        }
      });
    }
  }

  if (typeof graph.entry === 'string' && nodeIds.has(graph.entry)) {
    const reached = reachableFrom(graph.entry, nodes);
    for (const id of nodeIds) {
      if (!reached.has(id)) {
        errors.push(err(
          `/graph/nodes/${id}`,
          'reachable',
          `node '${id}' is not reachable from entry`,
          { id },
        ));
      }
    }
  }

  const branchIds = collectBranchIds(nodes);
  const states = doc.states;
  if (states && typeof states === 'object' && !Array.isArray(states)) {
    const stateIds = new Set(Object.keys(states.nodes && typeof states.nodes === 'object' ? states.nodes : {}));
    if (typeof states.entry === 'string' && !stateIds.has(states.entry)) {
      errors.push(err(
        '/states/entry',
        'stateEntryExists',
        `states.entry '${states.entry}' is not a state node`,
        { entry: states.entry },
      ));
    }
    if (Array.isArray(states.transitions)) {
      states.transitions.forEach((transition, i) => {
        if (typeof transition?.from === 'string' && !stateIds.has(transition.from)) {
          errors.push(err(
            `/states/transitions/${i}/from`,
            'stateRef',
            `from '${transition.from}' is not a state node`,
            { from: transition.from },
          ));
        }
        if (typeof transition?.to === 'string' && !stateIds.has(transition.to)) {
          errors.push(err(
            `/states/transitions/${i}/to`,
            'stateRef',
            `to '${transition.to}' is not a state node`,
            { to: transition.to },
          ));
        }
        if (typeof transition?.via === 'string' && !branchIds.has(transition.via)) {
          errors.push(err(
            `/states/transitions/${i}/via`,
            'viaBranch',
            `via '${transition.via}' is not a decision branch id`,
            { via: transition.via },
          ));
        }
      });
    }
  }

  const journey = doc.journey;
  if (journey && typeof journey === 'object' && !Array.isArray(journey)) {
    const stageIds = new Set();
    if (Array.isArray(journey.stages)) {
      journey.stages.forEach((stage, i) => {
        if (typeof stage?.id === 'string') stageIds.add(stage.id);
        const copy = stage?.copy;
        if (!copy || typeof copy !== 'object') {
          errors.push(err(
            `/journey/stages/${i}/copy`,
            'dualCopy',
            `journey stages[${i}].copy required`,
          ));
          return;
        }
        for (const lens of ['layperson', 'developer']) {
          const block = copy[lens];
          if (!block || typeof block !== 'object') {
            errors.push(err(
              `/journey/stages/${i}/copy/${lens}`,
              'dualCopy',
              `journey stages[${i}].copy.${lens} required`,
            ));
            continue;
          }
          for (const field of ['name', 'youGain', 'unlocks']) {
            if (typeof block[field] !== 'string' || !block[field].trim()) {
              errors.push(err(
                `/journey/stages/${i}/copy/${lens}/${field}`,
                'dualCopy',
                `journey stages[${i}].copy.${lens}.${field} required`,
              ));
            } else if (IMPLEMENTATION_TOKEN_RE.test(block[field])) {
              errors.push(err(
                `/journey/stages/${i}/copy/${lens}/${field}`,
                'implementationToken',
                `journey stages[${i}].copy.${lens}.${field} contains implementation token (LP lint)`,
              ));
            }
          }
        }
      });
    }
    if (typeof doc.youAreHere === 'string' && doc.youAreHere && !stageIds.has(doc.youAreHere)) {
      errors.push(err(
        '/youAreHere',
        'youAreHere',
        `youAreHere '${doc.youAreHere}' is not a journey stage id`,
        { youAreHere: doc.youAreHere },
      ));
    }
    if (Array.isArray(journey.edges)) {
      journey.edges.forEach((edge, i) => {
        if (typeof edge?.from === 'string' && !stageIds.has(edge.from)) {
          errors.push(err(
            `/journey/edges/${i}/from`,
            'journeyEdge',
            `edges[${i}].from invalid`,
            { from: edge.from },
          ));
        }
        if (typeof edge?.to === 'string' && !stageIds.has(edge.to)) {
          errors.push(err(
            `/journey/edges/${i}/to`,
            'journeyEdge',
            `edges[${i}].to invalid`,
            { to: edge.to },
          ));
        }
      });
    }
  }

  return errors;
}

export function validateFlow(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      errors: [err('', 'type', 'flow must be a plain object')],
    };
  }
  const schemaValid = validate(raw);
  const errors = schemaValid ? [] : [...(validate.errors ?? [])];
  errors.push(...graphErrors(raw));
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function assertValidFlow(raw) {
  const result = validateFlow(raw);
  if (!result.valid) {
    throw new Error(`flow is invalid:\n${formatValidationErrors(result.errors)}`);
  }
  return raw;
}

export { formatValidationErrors };
