import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '..', '..', 'meta', 'schemas', 'flow.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

export const SCHEMA_VERSION = '1.0';
export const SUBGRAPH_MAX_DEPTH = 8;

const NEXT_TYPES = new Set(['activity', 'join', 'subprocess', 'event']);
const BRANCH_TYPES = new Set(['xor', 'and']);

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

function isNodeMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function neighbors(node) {
  if (!node || typeof node !== 'object') return [];
  if (NEXT_TYPES.has(node.type) && typeof node.next === 'string') return [node.next];
  if (BRANCH_TYPES.has(node.type) && Array.isArray(node.branches)) {
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

function collectXorBranchIds(nodes, into) {
  if (!isNodeMap(nodes)) return;
  for (const node of Object.values(nodes)) {
    if (node?.type !== 'xor' || !Array.isArray(node.branches)) continue;
    for (const branch of node.branches) {
      if (typeof branch?.id === 'string') into.add(branch.id);
    }
  }
}

function documentXorBranchIds(doc) {
  const ids = new Set();
  collectXorBranchIds(doc?.graph?.nodes, ids);
  const subgraphs = doc?.graph?.subgraphs;
  if (isNodeMap(subgraphs)) {
    for (const subgraph of Object.values(subgraphs)) {
      collectXorBranchIds(subgraph?.nodes, ids);
    }
  }
  return ids;
}

function subgraphIds(doc) {
  const ids = new Set();
  const subgraphs = doc?.graph?.subgraphs;
  if (!isNodeMap(subgraphs)) return ids;
  for (const id of Object.keys(subgraphs)) ids.add(id);
  return ids;
}

function validateMessages(basePath, node, actors, errors) {
  if (!Array.isArray(node?.messages)) return;
  node.messages.forEach((message, i) => {
    for (const field of ['from', 'to']) {
      const ref = message?.[field];
      if (typeof ref === 'string' && !actors.has(ref)) {
        errors.push(err(
          `${basePath}/messages/${i}/${field}`,
          'actorRef',
          `actor '${ref}' is not declared in actors[]`,
          { actor: ref },
        ));
      }
    }
  });
}

function validateNodeMap(basePath, nodes, entry, ctx) {
  const { actors, subgraphs, errors } = ctx;
  const nodeIds = new Set(Object.keys(nodes));

  if (typeof entry === 'string' && !nodeIds.has(entry)) {
    errors.push(err(
      `${basePath}/entry`,
      'entryExists',
      `entry '${entry}' is not a graph node`,
      { entry },
    ));
  }

  const seenBranchIds = ctx.seenBranchIds;

  for (const [id, node] of Object.entries(nodes)) {
    if (!node || typeof node !== 'object') continue;
    const nodePath = `${basePath}/nodes/${id}`;

    validateMessages(nodePath, node, actors, errors);

    if (NEXT_TYPES.has(node.type) && typeof node.next === 'string' && !nodeIds.has(node.next)) {
      errors.push(err(
        `${nodePath}/next`,
        'nextExists',
        `next '${node.next}' is not a graph node`,
        { next: node.next },
      ));
    }

    if (node.type === 'join') {
      const of = node.of;
      if (typeof of === 'string' && nodes[of]?.type !== 'and') {
        errors.push(err(
          `${nodePath}/of`,
          'joinOfAnd',
          `join '${id}' of '${of}' must name an and node`,
          { of },
        ));
      }
    }

    if (node.type === 'subprocess') {
      const ref = node.ref;
      if (typeof ref === 'string' && !subgraphs.has(ref)) {
        errors.push(err(
          `${nodePath}/ref`,
          'subgraphRef',
          `subprocess.ref '${ref}' is not in subgraphs`,
          { ref },
        ));
      }
    }

    if (BRANCH_TYPES.has(node.type)) {
      const branches = Array.isArray(node.branches) ? node.branches : [];
      if (branches.length < 2) {
        errors.push(err(
          `${nodePath}/branches`,
          node.type === 'xor' ? 'xorMinBranches' : 'andMinBranches',
          `${node.type} '${id}' must have at least 2 branches`,
          { count: branches.length },
        ));
      }
      const whens = new Set();
      branches.forEach((branch, i) => {
        if (typeof branch?.next === 'string' && !nodeIds.has(branch.next)) {
          errors.push(err(
            `${nodePath}/branches/${i}/next`,
            'nextExists',
            `next '${branch.next}' is not a graph node`,
            { next: branch.next },
          ));
        }
        if (node.type === 'xor' && typeof branch?.when === 'string') {
          if (whens.has(branch.when)) {
            errors.push(err(
              `${nodePath}/branches/${i}/when`,
              'uniqueWhen',
              `duplicate when '${branch.when}' on xor '${id}'`,
              { when: branch.when },
            ));
          } else {
            whens.add(branch.when);
          }
        }
        if (typeof branch?.id === 'string') {
          if (seenBranchIds.has(branch.id)) {
            errors.push(err(
              `${nodePath}/branches/${i}/id`,
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

  if (typeof entry === 'string' && nodeIds.has(entry)) {
    const reached = reachableFrom(entry, nodes);
    for (const id of nodeIds) {
      if (!reached.has(id)) {
        errors.push(err(
          `${basePath}/nodes/${id}`,
          'reachable',
          `node '${id}' is not reachable from entry`,
          { id },
        ));
      }
    }
  }
}

function walkSubgraphDepth(ref, subgraphs, stack, errors, path) {
  if (!isNodeMap(subgraphs) || !subgraphs[ref]) return;
  if (stack.includes(ref)) {
    errors.push(err(
      path,
      'subgraphCycle',
      `subgraph '${ref}' cycles through ${stack.join(' -> ')}`,
      { ref, stack: [...stack] },
    ));
    return;
  }
  const depth = stack.length + 1;
  if (depth > SUBGRAPH_MAX_DEPTH) {
    errors.push(err(
      path,
      'subgraphDepth',
      `subgraph nest exceeds max depth ${SUBGRAPH_MAX_DEPTH}`,
      { ref, depth, max: SUBGRAPH_MAX_DEPTH },
    ));
    return;
  }
  const nodes = subgraphs[ref]?.nodes;
  if (!isNodeMap(nodes)) return;
  const nextStack = [...stack, ref];
  for (const [id, node] of Object.entries(nodes)) {
    if (node?.type === 'subprocess' && typeof node.ref === 'string') {
      walkSubgraphDepth(
        node.ref,
        subgraphs,
        nextStack,
        errors,
        `/graph/subgraphs/${ref}/nodes/${id}/ref`,
      );
    }
  }
}

function validateSubgraphDepth(doc, errors) {
  const nodes = doc?.graph?.nodes;
  const subgraphs = doc?.graph?.subgraphs;
  if (!isNodeMap(subgraphs)) return;
  if (isNodeMap(nodes)) {
    for (const [id, node] of Object.entries(nodes)) {
      if (node?.type === 'subprocess' && typeof node.ref === 'string') {
        walkSubgraphDepth(node.ref, subgraphs, [], errors, `/graph/nodes/${id}/ref`);
      }
    }
  }
  for (const id of Object.keys(subgraphs)) {
    walkSubgraphDepth(id, subgraphs, [], errors, `/graph/subgraphs/${id}`);
  }
}

function validateMachines(doc, branchIds, errors) {
  if (!Array.isArray(doc.machines)) return;
  const seenMachineIds = new Set();
  doc.machines.forEach((machine, mi) => {
    if (!machine || typeof machine !== 'object') return;
    const base = `/machines/${mi}`;
    if (typeof machine.id === 'string') {
      if (seenMachineIds.has(machine.id)) {
        errors.push(err(`${base}/id`, 'uniqueMachineId', `duplicate machine id '${machine.id}'`, {
          id: machine.id,
        }));
      } else {
        seenMachineIds.add(machine.id);
      }
    }
    const nodes = isNodeMap(machine.nodes) ? machine.nodes : null;
    if (!nodes) return;
    const stateIds = new Set(Object.keys(nodes));
    if (stateIds.size < 1) {
      errors.push(err(`${base}/nodes`, 'machineMinNodes', `machine '${machine.id ?? mi}' must have at least 1 node`));
    }
    if (typeof machine.entry === 'string' && !stateIds.has(machine.entry)) {
      errors.push(err(
        `${base}/entry`,
        'machineEntryExists',
        `machines[${mi}].entry '${machine.entry}' is not a machine node`,
        { entry: machine.entry },
      ));
    }
    if (!Array.isArray(machine.transitions)) return;
    machine.transitions.forEach((transition, ti) => {
      if (!transition || typeof transition !== 'object') return;
      const tPath = `${base}/transitions/${ti}`;
      if (!Object.hasOwn(transition, 'effects')) {
        errors.push(err(
          tPath,
          'effectsRequired',
          `machines[${mi}].transitions[${ti}] must have an effects array`,
        ));
      }
      if (typeof transition.from === 'string' && !stateIds.has(transition.from)) {
        errors.push(err(
          `${tPath}/from`,
          'machineStateRef',
          `from '${transition.from}' is not a machine node`,
          { from: transition.from },
        ));
      }
      if (typeof transition.to === 'string' && !stateIds.has(transition.to)) {
        errors.push(err(
          `${tPath}/to`,
          'machineStateRef',
          `to '${transition.to}' is not a machine node`,
          { to: transition.to },
        ));
      }
      if (typeof transition.via === 'string' && !branchIds.has(transition.via)) {
        errors.push(err(
          `${tPath}/via`,
          'viaBranch',
          `via '${transition.via}' is not an xor branch id`,
          { via: transition.via },
        ));
      }
    });
  });
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
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    validateMachines(doc, new Set(), errors);
    return errors;
  }
  const nodes = isNodeMap(graph.nodes) ? graph.nodes : null;
  const subgraphs = subgraphIds(doc);
  const ctx = {
    actors,
    subgraphs,
    errors,
    seenBranchIds: new Set(),
  };

  if (nodes) {
    validateNodeMap('/graph', nodes, graph.entry, ctx);
  }

  if (isNodeMap(graph.subgraphs)) {
    for (const [id, subgraph] of Object.entries(graph.subgraphs)) {
      if (!subgraph || typeof subgraph !== 'object') continue;
      const subNodes = isNodeMap(subgraph.nodes) ? subgraph.nodes : null;
      if (!subNodes) continue;
      validateNodeMap(`/graph/subgraphs/${id}`, subNodes, subgraph.entry, ctx);
    }
  }

  validateSubgraphDepth(doc, errors);
  validateMachines(doc, documentXorBranchIds(doc), errors);
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
