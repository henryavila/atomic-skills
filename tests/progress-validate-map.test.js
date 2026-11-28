import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const REPO_ROOT = new URL('..', import.meta.url).pathname;
const PROGRESS_PY = join(REPO_ROOT, 'skills/shared/progress-assets/progress.py');
const PYTHON3 = process.env.PROGRESS_TEST_PYTHON || 'python3';

const DRIVER = `import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("progress", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with open(sys.argv[2], encoding="utf-8") as handle:
    cases = json.load(handle)
print(json.dumps([module.validate_map(item["map"]) for item in cases], ensure_ascii=False))
`;

function base() {
  return {
    schemaVersion: 1,
    id: 'app',
    title: 'App do Culto',
    unit: 'cartões',
    milestones: [
      { id: 'fundacao', title: 'Fundação', cards: [{ id: 'F-01', size: 'P' }] },
    ],
  };
}

function withMilestones(milestones, extra = {}) {
  return { ...base(), milestones, ...extra };
}

function card(fields = {}) {
  return { id: 'F-01', size: 'P', ...fields };
}

function oneCard(value, extra = {}) {
  return withMilestones([{ id: 'm', title: 'M', cards: [value] }], extra);
}

const cases = [];
function add(name, map, expected) {
  cases.push({ name, map, expected });
}

add('valid map', base(), []);

const missingSchema = base();
delete missingSchema.schemaVersion;
add('missing schemaVersion', missingSchema, ['$.schemaVersion: required']);

const missingId = base();
delete missingId.id;
add('missing project id', missingId, ['$.id: required']);

const missingTitle = base();
delete missingTitle.title;
add('missing title', missingTitle, ['$.title: required']);

const missingUnit = base();
delete missingUnit.unit;
add('missing unit', missingUnit, ['$.unit: required']);

const missingMilestones = base();
delete missingMilestones.milestones;
add('missing milestones', missingMilestones, ['$.milestones: required']);

add('map is not an object', [], ['$: the map must be a JSON object']);
add('unknown top-level key', { ...base(), extra: true }, ['$.extra: unknown key']);
add('wrong schemaVersion', { ...base(), schemaVersion: 2 },
  ['$.schemaVersion: must be the integer 1']);
add('empty project id', { ...base(), id: '  ' },
  ['$.id: must be a non-empty string']);
add('bad project id', { ...base(), id: 'bad id' },
  ['$.id: must match [A-Za-z0-9._-]{1,64}']);
add('empty title', { ...base(), title: '' },
  ['$.title: must be a non-empty string']);
add('non-string note', { ...base(), note: 4 }, ['$.note: must be a string']);
add('non-array milestones', { ...base(), milestones: {} },
  ['$.milestones: must be an array']);
add('milestone is not an object', withMilestones([null]),
  ['$.milestones[0]: must be an object']);
add('unknown milestone key', withMilestones([
  { id: 'm', title: 'M', cards: [], extra: true },
]), ['$.milestones[0].extra: unknown key']);
add('missing milestone id', withMilestones([{ title: 'M', cards: [] }]),
  ['$.milestones[0].id: required']);
add('empty milestone title', withMilestones([{ id: 'm', title: '', cards: [] }]),
  ['$.milestones[0].title: must be a non-empty string']);
add('bad milestone id', withMilestones([{ id: 'bad id', title: 'M', cards: [] }]),
  ['$.milestones[0].id: must match [A-Za-z0-9._-]{1,64}']);
add('duplicate milestone id', withMilestones([
  { id: 'm', title: 'M', cards: [] },
  { id: 'm', title: 'N', cards: [] },
]), ["$.milestones[1].id: duplicate milestone id 'm'"]);
add('missing milestone cards', withMilestones([{ id: 'm', title: 'M' }]),
  ['$.milestones[0].cards: required']);
add('non-array milestone cards', withMilestones([
  { id: 'm', title: 'M', cards: {} },
]), ['$.milestones[0].cards: must be an array']);
add('card is not an object', oneCard(null),
  ['$.milestones[0].cards[0]: must be an object']);
add('unknown card key', oneCard(card({ extra: true })),
  ['$.milestones[0].cards[0].extra: unknown key']);
add('missing card id', oneCard({ size: 'P' }),
  ['$.milestones[0].cards[0].id: required']);
add('empty card id', oneCard(card({ id: '' })),
  ['$.milestones[0].cards[0].id: must be a non-empty string']);
add('bad card id', oneCard(card({ id: 'bad id' })),
  ['$.milestones[0].cards[0].id: must match [A-Za-z0-9._-]{1,64}']);
add('duplicate card id', withMilestones([
  { id: 'm', title: 'M', cards: [card()] },
  { id: 'n', title: 'N', cards: [card()] },
]), ["$.milestones[1].cards[0].id: duplicate card id 'F-01'"]);
add('card without size or weight', oneCard({ id: 'F-01' }),
  ['$.milestones[0].cards[0]: card needs a size or a weight']);
add('bad card size', oneCard(card({ size: 'X' })),
  ['$.milestones[0].cards[0].size: must be one of P, M or G']);
add('bad card weight', oneCard({ id: 'F-01', weight: '3' }),
  ['$.milestones[0].cards[0].weight: must be a non-negative integer']);
add('every card weighs zero', oneCard({ id: 'F-01', weight: 0 }),
  ['$.milestones: all cards weigh 0; at least one card must weigh more than 0']);
add('empty match array', oneCard(card({ match: [] })),
  ['$.milestones[0].cards[0].match: must not be an empty array']);
add('bad match element', oneCard(card({ match: ['ok', ''] })),
  ['$.milestones[0].cards[0].match[1]: must be a non-empty string']);
add('non-string match', oneCard(card({ match: 1 })),
  ['$.milestones[0].cards[0].match: must be a non-empty string or a non-empty array of them']);
add('non-string done', oneCard(card({ done: 1 })),
  ['$.milestones[0].cards[0].done: must be a string']);
add('non-string validated', oneCard(card({ validated: 1 })),
  ['$.milestones[0].cards[0].validated: must be a string']);
add('non-array deps', oneCard(card({ deps: 'F-02' })),
  ['$.milestones[0].cards[0].deps: must be an array']);
add('bad dep entry', oneCard(card({ deps: [2] })),
  ['$.milestones[0].cards[0].deps[0]: must be a non-empty string']);
add('unknown dependency', oneCard(card({ deps: ['NOPE-1'] })),
  ["$.milestones[0].cards[0].deps: unknown dependency 'NOPE-1'"]);
add('dependency cycle', withMilestones([
  {
    id: 'm',
    title: 'M',
    cards: [
      card({ id: 'X-1', deps: ['X-2'] }),
      card({ id: 'X-2', deps: ['X-1'] }),
    ],
  },
]), ['$.milestones[0].cards[1].deps: dependency cycle: X-1 -> X-2 -> X-1']);
add('several problems keep their order', {
  ...base(),
  extra: 1,
  title: '',
  milestones: [{ id: 'm', title: 'M', cards: [card({ size: 'X' })] }],
}, [
  '$.extra: unknown key',
  '$.title: must be a non-empty string',
  '$.milestones[0].cards[0].size: must be one of P, M or G',
]);

describe('validate_map', () => {
  it('reports every rule with its exact path, text and order', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-validate-map-'));
    try {
      const casesPath = join(root, 'cases.json');
      writeFileSync(casesPath, JSON.stringify(cases));
      const result = spawnSync(PYTHON3, ['-c', DRIVER, PROGRESS_PY, casesPath], {
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      const actual = JSON.parse(result.stdout);
      for (const [index, item] of cases.entries()) {
        assert.deepEqual(actual[index], item.expected, item.name);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
