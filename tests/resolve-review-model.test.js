import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildModelFlag,
  catalogDiscoveryResult,
  isSafeReviewModelId,
  parseCodexModelsCatalog,
  parseGrokModelsList,
  parseModelArgs,
  positionalFromRemaining,
  rankModelsForReview,
  recommendedReviewModel,
  resolveReviewModel,
} from '../src/resolve-review-model.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/cross-model-bridge');

describe('parseCodexModelsCatalog', () => {
  it('parses slim catalog fixture into list models with priority', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES, 'codex-models-catalog-slim.json'), 'utf8'));
    const models = parseCodexModelsCatalog(raw);
    assert.ok(models.length >= 5);
    const sol = models.find((m) => m.slug === 'gpt-5.6-sol');
    assert.ok(sol);
    assert.equal(sol.displayName, 'GPT-5.6-Sol');
    assert.equal(sol.priority, 1);
    assert.equal(sol.visibility, 'list');
    assert.ok(sol.reasoningLevels.includes('high'));
    // hide models are kept but marked
    const auto = models.find((m) => m.slug === 'codex-auto-review');
    assert.ok(auto);
    assert.equal(auto.visibility, 'hide');
  });

  it('accepts JSON string and empty/invalid as []', () => {
    assert.deepEqual(parseCodexModelsCatalog('{"models":[]}'), []);
    assert.deepEqual(parseCodexModelsCatalog(null), []);
    assert.deepEqual(parseCodexModelsCatalog('{not json'), []);
  });
});

describe('parseGrokModelsList', () => {
  it('parses grok models text fixture', () => {
    const text = readFileSync(join(FIXTURES, 'grok-models-list.txt'), 'utf8');
    const models = parseGrokModelsList(text);
    assert.equal(models.length, 3);
    assert.equal(models[0].slug, 'grok-4.5');
    assert.equal(models[0].isDefault, true);
    assert.equal(models[1].slug, 'grok-4');
    assert.equal(models[1].isDefault, false);
    assert.equal(models[2].slug, 'grok-3-mini');
  });

  it('returns empty for blank input', () => {
    assert.deepEqual(parseGrokModelsList(''), []);
    assert.deepEqual(parseGrokModelsList(null), []);
  });
});

describe('rankModelsForReview / recommendedReviewModel', () => {
  it('ranks codex list-visible by priority ascending; hides deprioritized', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES, 'codex-models-catalog-slim.json'), 'utf8'));
    const ranked = rankModelsForReview(parseCodexModelsCatalog(raw), { provider: 'codex' });
    assert.equal(ranked[0].slug, 'gpt-5.6-sol');
    assert.ok(ranked.every((m) => m.visibility !== 'hide'));
    assert.ok(ranked[0].priority <= ranked[ranked.length - 1].priority);
  });

  it('ranks grok with default first', () => {
    const text = readFileSync(join(FIXTURES, 'grok-models-list.txt'), 'utf8');
    const ranked = rankModelsForReview(parseGrokModelsList(text), { provider: 'grok' });
    assert.equal(ranked[0].slug, 'grok-4.5');
    assert.equal(ranked[0].isDefault, true);
  });

  it('recommended is the top-ranked model', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES, 'codex-models-catalog-slim.json'), 'utf8'));
    const rec = recommendedReviewModel(parseCodexModelsCatalog(raw), { provider: 'codex' });
    assert.equal(rec.slug, 'gpt-5.6-sol');
  });
});

describe('isSafeReviewModelId / buildModelFlag', () => {
  it('empty / cli-default → empty flag (provider CLI default)', () => {
    assert.equal(buildModelFlag(null), '');
    assert.equal(buildModelFlag(''), '');
    assert.equal(buildModelFlag('cli-default'), '');
  });

  it('explicit slug → --model <slug>', () => {
    assert.equal(buildModelFlag('gpt-5.6-sol'), '--model gpt-5.6-sol');
    assert.equal(buildModelFlag('grok-4.5'), '--model grok-4.5');
  });

  it('rejects shell metacharacters, whitespace, option-shaped, and control chars', () => {
    assert.equal(isSafeReviewModelId('safe; printf INJECTED'), false);
    assert.equal(isSafeReviewModelId('x$(whoami)'), false);
    assert.equal(isSafeReviewModelId('a|b'), false);
    assert.equal(isSafeReviewModelId('-evil'), false);
    assert.equal(isSafeReviewModelId('has space'), false);
    assert.equal(isSafeReviewModelId('ok\nid'), false);
    assert.equal(buildModelFlag('safe; printf INJECTED'), '');
    assert.equal(buildModelFlag('x$(whoami)'), '');
    assert.equal(buildModelFlag('-evil'), '');
  });

  it('accepts catalog-shaped slugs with dots, plus, underscore, colon', () => {
    assert.equal(isSafeReviewModelId('gpt-5.6-sol'), true);
    assert.equal(isSafeReviewModelId('org/model-name'), true);
    assert.equal(isSafeReviewModelId('gpt-5.4-mini'), true);
  });
});

describe('parseModelArgs', () => {
  it('parses --model= and --model space and model: forms', () => {
    assert.deepEqual(parseModelArgs('--mode=codex --model=gpt-5.6-sol'), {
      model: 'gpt-5.6-sol',
      modelCodex: null,
      modelGrok: null,
      askModel: false,
      remainingTokens: ['--mode=codex'],
    });
    assert.deepEqual(parseModelArgs('wip --model gpt-5.5 --allow-dirty'), {
      model: 'gpt-5.5',
      modelCodex: null,
      modelGrok: null,
      askModel: false,
      remainingTokens: ['wip', '--allow-dirty'],
    });
    assert.deepEqual(parseModelArgs('plan.md model:gpt-5.4'), {
      model: 'gpt-5.4',
      modelCodex: null,
      modelGrok: null,
      askModel: false,
      remainingTokens: ['plan.md'],
    });
  });

  it('parses --ask-model and per-provider model flags', () => {
    const r = parseModelArgs('--ask-model --model-codex=gpt-5.6-sol --model-grok=grok-4.5');
    assert.equal(r.askModel, true);
    assert.equal(r.modelCodex, 'gpt-5.6-sol');
    assert.equal(r.modelGrok, 'grok-4.5');
    assert.equal(r.model, null);
    assert.deepEqual(r.remainingTokens, []);
  });

  it('ignores bare --model without value and keeps the next flag as remaining', () => {
    const r = parseModelArgs('--model --mode=local');
    assert.equal(r.model, null);
    assert.deepEqual(r.remainingTokens, ['--mode=local']);
  });

  it('consumes space-form --model-codex / --model-grok values from remaining', () => {
    const r = parseModelArgs('docs/plan.md --model-codex gpt-5.5 --mode=codex');
    assert.equal(r.modelCodex, 'gpt-5.5');
    assert.deepEqual(r.remainingTokens, ['docs/plan.md', '--mode=codex']);
    assert.equal(positionalFromRemaining(r.remainingTokens), 'docs/plan.md');
  });

  it('positionalFromRemaining joins non-flag tokens for plan_path / git_ref', () => {
    assert.equal(
      positionalFromRemaining(['wip', '--allow-dirty', '--mode=codex']),
      'wip',
    );
    assert.equal(positionalFromRemaining(['main..HEAD']), 'main..HEAD');
    assert.equal(positionalFromRemaining(['--mode=local']), '');
  });
});

describe('resolveReviewModel', () => {
  const codexModels = parseCodexModelsCatalog(
    JSON.parse(readFileSync(join(FIXTURES, 'codex-models-catalog-slim.json'), 'utf8')),
  );
  const grokModels = parseGrokModelsList(
    readFileSync(join(FIXTURES, 'grok-models-list.txt'), 'utf8'),
  );

  it('explicit model wins and builds flag', () => {
    const r = resolveReviewModel({
      provider: 'codex',
      models: codexModels,
      explicitModel: 'gpt-5.5',
      interactive: true,
    });
    assert.equal(r.action, 'run');
    assert.equal(r.modelId, 'gpt-5.5');
    assert.equal(r.source, 'explicit');
    assert.equal(r.modelFlag, '--model gpt-5.5');
    assert.equal(r.recommended.slug, 'gpt-5.6-sol');
  });

  it('explicit model not in catalog still runs (CLI may know newer id) with warning flag', () => {
    const r = resolveReviewModel({
      provider: 'codex',
      models: codexModels,
      explicitModel: 'future-model-99',
      interactive: false,
    });
    assert.equal(r.action, 'run');
    assert.equal(r.modelId, 'future-model-99');
    assert.equal(r.source, 'explicit');
    assert.equal(r.unknownToCatalog, true);
  });

  it('per-provider explicit overrides generic model for that provider', () => {
    const r = resolveReviewModel({
      provider: 'grok',
      models: grokModels,
      explicitModel: 'gpt-5.5',
      modelGrok: 'grok-4',
      interactive: false,
    });
    assert.equal(r.modelId, 'grok-4');
    assert.equal(r.source, 'explicit');
  });

  it('interactive without explicit → pick with recommended first', () => {
    const r = resolveReviewModel({
      provider: 'codex',
      models: codexModels,
      interactive: true,
    });
    assert.equal(r.action, 'pick');
    assert.equal(r.recommended.slug, 'gpt-5.6-sol');
    assert.ok(r.options.length >= 3);
    assert.equal(r.options[0].slug, 'gpt-5.6-sol');
    assert.match(r.options[0].label, /recommended|recomendad/i);
    // cli-default option present
    assert.ok(r.options.some((o) => o.slug === 'cli-default'));
  });

  it('userChoice after pick → run with user-pick source', () => {
    const r = resolveReviewModel({
      provider: 'codex',
      models: codexModels,
      interactive: true,
      userChoice: 'gpt-5.4',
    });
    assert.equal(r.action, 'run');
    assert.equal(r.modelId, 'gpt-5.4');
    assert.equal(r.source, 'user-pick');
    assert.equal(r.modelFlag, '--model gpt-5.4');
  });

  it('userChoice cli-default → empty flag', () => {
    const r = resolveReviewModel({
      provider: 'grok',
      models: grokModels,
      interactive: true,
      userChoice: 'cli-default',
    });
    assert.equal(r.action, 'run');
    assert.equal(r.modelId, null);
    assert.equal(r.modelFlag, '');
    assert.equal(r.source, 'cli-default');
  });

  it('userChoice recommended alias uses top-ranked', () => {
    const r = resolveReviewModel({
      provider: 'codex',
      models: codexModels,
      interactive: true,
      userChoice: 'recommended',
    });
    assert.equal(r.modelId, 'gpt-5.6-sol');
    assert.equal(r.source, 'recommended');
  });

  it('non-interactive without explicit → cli-default empty flag (backward compatible)', () => {
    const r = resolveReviewModel({
      provider: 'codex',
      models: codexModels,
      interactive: false,
    });
    assert.equal(r.action, 'run');
    assert.equal(r.modelId, null);
    assert.equal(r.modelFlag, '');
    assert.equal(r.source, 'cli-default');
  });

  it('--ask-model non-interactive auto-picks recommended', () => {
    const r = resolveReviewModel({
      provider: 'codex',
      models: codexModels,
      askModel: true,
      interactive: false,
    });
    assert.equal(r.action, 'run');
    assert.equal(r.modelId, 'gpt-5.6-sol');
    assert.equal(r.source, 'recommended');
    assert.equal(r.modelFlag, '--model gpt-5.6-sol');
  });

  it('--ask-model interactive without choice → pick', () => {
    const r = resolveReviewModel({
      provider: 'grok',
      models: grokModels,
      askModel: true,
      interactive: true,
    });
    assert.equal(r.action, 'pick');
    assert.equal(r.recommended.slug, 'grok-4.5');
  });

  it('empty models catalog still allows explicit and cli-default', () => {
    const r1 = resolveReviewModel({
      provider: 'codex',
      models: [],
      explicitModel: 'gpt-5.5',
      interactive: false,
    });
    assert.equal(r1.modelId, 'gpt-5.5');
    assert.equal(r1.unknownToCatalog, true);

    const r2 = resolveReviewModel({
      provider: 'codex',
      models: [],
      interactive: false,
    });
    assert.equal(r2.modelFlag, '');
    assert.equal(r2.source, 'cli-default');

    // interactive with empty catalog: pick only cli-default + freeform note
    const r3 = resolveReviewModel({
      provider: 'codex',
      models: [],
      interactive: true,
    });
    assert.equal(r3.action, 'pick');
    assert.ok(r3.options.some((o) => o.slug === 'cli-default'));
    assert.equal(r3.recommended, null);
  });

  it('unsafe explicit model id is rejected (fail-closed modelFlag)', () => {
    const r = resolveReviewModel({
      provider: 'codex',
      models: codexModels,
      explicitModel: 'safe; printf INJECTED',
      interactive: false,
    });
    assert.equal(r.action, 'run');
    assert.equal(r.modelId, null);
    assert.equal(r.modelFlag, '');
    assert.equal(r.invalidModelId, true);
    assert.equal(r.source, 'explicit');
  });

  it('unsafe userChoice is rejected', () => {
    const r = resolveReviewModel({
      provider: 'grok',
      models: grokModels,
      interactive: true,
      userChoice: 'x$(id)',
    });
    assert.equal(r.invalidModelId, true);
    assert.equal(r.modelFlag, '');
    assert.equal(r.modelId, null);
  });
});

describe('catalogDiscoveryResult', () => {
  it('preserves partial models when process fails (nonzero status)', () => {
    const partial = parseGrokModelsList('* grok-4.5 (default)\n');
    const r = catalogDiscoveryResult({
      provider: 'grok',
      models: partial,
      text: 'Available models:\n* grok-4.5 (default)\nerror: partial',
      status: 1,
      spawnError: 'grok models exited 1',
    });
    assert.equal(r.models.length, 1);
    assert.ok(r.error);
    assert.match(r.error, /exited|partial|grok/i);
  });

  it('sets parse error when nonblank output yields zero models and status 0', () => {
    const r = catalogDiscoveryResult({
      provider: 'codex',
      models: [],
      text: '{"not":"a catalog"}',
      status: 0,
      spawnError: null,
    });
    assert.deepEqual(r.models, []);
    assert.ok(r.error);
    assert.match(r.error, /no models parsed/i);
  });

  it('success with models → error null', () => {
    const models = parseCodexModelsCatalog(
      JSON.parse(readFileSync(join(FIXTURES, 'codex-models-catalog-slim.json'), 'utf8')),
    );
    const r = catalogDiscoveryResult({
      provider: 'codex',
      models,
      text: '{"models":[]}',
      status: 0,
      spawnError: null,
    });
    assert.ok(r.models.length > 0);
    assert.equal(r.error, null);
  });

  it('empty stdout + status 0 → empty models, no error (fail-open empty catalog)', () => {
    const r = catalogDiscoveryResult({
      provider: 'codex',
      models: [],
      text: '',
      status: 0,
      spawnError: null,
    });
    assert.deepEqual(r.models, []);
    assert.equal(r.error, null);
  });
});
