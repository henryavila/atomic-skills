import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  AGY_MODEL_ALIASES,
  buildModelFlag,
  catalogDiscoveryResult,
  isSafeReviewModelId,
  parseAgyModelsList,
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
      modelClaude: null,
      modelAgy: null,
      askModel: false,
      remainingTokens: ['--mode=codex'],
    });
    assert.deepEqual(parseModelArgs('wip --model gpt-5.5 --allow-dirty'), {
      model: 'gpt-5.5',
      modelCodex: null,
      modelGrok: null,
      modelClaude: null,
      modelAgy: null,
      askModel: false,
      remainingTokens: ['wip', '--allow-dirty'],
    });
    assert.deepEqual(parseModelArgs('plan.md model:gpt-5.4'), {
      model: 'gpt-5.4',
      modelCodex: null,
      modelGrok: null,
      modelClaude: null,
      modelAgy: null,
      askModel: false,
      remainingTokens: ['plan.md'],
    });
  });

  it('parses --ask-model and per-provider model flags', () => {
    const r = parseModelArgs('--ask-model --model-codex=gpt-5.6-sol --model-grok=grok-4.5 --model-agy=pro');
    assert.equal(r.askModel, true);
    assert.equal(r.modelCodex, 'gpt-5.6-sol');
    assert.equal(r.modelGrok, 'grok-4.5');
    assert.equal(r.modelAgy, 'pro');
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


describe("claude model aliases (no live catalog)", () => {
  it("parseClaudeModelsAliases returns stable aliases", async () => {
    const { parseClaudeModelsAliases, rankModelsForReview, parseModelArgs, resolveReviewModel } =
      await import("../src/resolve-review-model.js");
    const models = parseClaudeModelsAliases("");
    assert.ok(models.some((m) => m.slug === "opus"));
    const ranked = rankModelsForReview(models, { provider: "claude" });
    assert.equal(ranked[0].slug, "opus");
    const args = parseModelArgs("--mode=claude --model-claude=sonnet");
    assert.equal(args.modelClaude, "sonnet");
    const res = resolveReviewModel({
      provider: "claude",
      models,
      modelClaude: "sonnet",
    });
    assert.equal(res.modelId, "sonnet");
    assert.equal(res.source, "explicit");
    const def = resolveReviewModel({ provider: "claude", models: [] });
    assert.equal(def.source, "cli-default");
  });
});

describe('parser output tables (pinned before refactor)', () => {
  const codexModel = (slug, overrides = {}) => ({
    slug,
    displayName: slug,
    description: '',
    priority: null,
    visibility: 'list',
    reasoningLevels: [],
    isDefault: false,
    provider: 'codex',
    ...overrides,
  });
  const grokModel = (slug, overrides = {}) => ({
    slug,
    displayName: slug,
    description: '',
    priority: null,
    visibility: 'list',
    reasoningLevels: [],
    isDefault: false,
    provider: 'grok',
    ...overrides,
  });
  const parsedArgs = (overrides = {}) => ({
    model: null,
    modelCodex: null,
    modelGrok: null,
    modelClaude: null,
    modelAgy: null,
    askModel: false,
    remainingTokens: [],
    ...overrides,
  });

  it('parseCodexModelsCatalog table', () => {
    assert.deepEqual(parseCodexModelsCatalog(null), []);
    assert.deepEqual(parseCodexModelsCatalog(''), []);
    assert.deepEqual(parseCodexModelsCatalog('{not json'), []);
    assert.deepEqual(parseCodexModelsCatalog('{"models":[]}'), []);
    assert.deepEqual(parseCodexModelsCatalog('[]'), []);
    assert.deepEqual(parseCodexModelsCatalog({ models: 'no' }), []);
    assert.deepEqual(parseCodexModelsCatalog({ models: [null, 'x', { slug: 'x' }] }), [
      codexModel('x'),
    ]);
    assert.deepEqual(
      parseCodexModelsCatalog([
        { id: 'a' },
        { model: 'b' },
        { slug: ' c ' },
        { slug: '' },
        {},
        {
          slug: 'd',
          priority: 2,
          display_name: null,
          visibility: 'hide',
          supported_reasoning_levels: ['high', { effort: 'low' }, null, 7],
        },
      ]),
      [
        codexModel('a'),
        codexModel('b'),
        codexModel('c'),
        codexModel('d', {
          priority: 2,
          visibility: 'hide',
          reasoningLevels: ['high', 'low'],
        }),
      ],
    );
  });

  it('parseGrokModelsList table', () => {
    assert.deepEqual(parseGrokModelsList(null), []);
    assert.deepEqual(parseGrokModelsList(''), []);
    assert.deepEqual(
      parseGrokModelsList('* grok-a\n- grok-b (default)\n• grok-c (preview)'),
      [
        grokModel('grok-a'),
        grokModel('grok-b', { description: 'CLI default', isDefault: true }),
        grokModel('grok-c'),
      ],
    );
    assert.deepEqual(
      parseGrokModelsList('Default model: grok-z\nAvailable models:\n* grok-z\n* grok-y'),
      [
        grokModel('grok-z', { description: 'CLI default', isDefault: true }),
        grokModel('grok-y'),
      ],
    );
    assert.deepEqual(
      parseGrokModelsList('Available models:\n* grok-a\n* grok-a (default)'),
      [grokModel('grok-a', { description: 'CLI default', isDefault: true })],
    );
    assert.deepEqual(parseGrokModelsList('Default model: solo'), [
      grokModel('solo', { description: 'CLI default', isDefault: true }),
    ]);
    assert.deepEqual(parseGrokModelsList('Default model: solo\n* other'), [
      grokModel('solo', { description: 'CLI default', isDefault: true }),
      grokModel('other'),
    ]);
  });

  it('parseAgyModelsList table', () => {
    const fallback = AGY_MODEL_ALIASES.map((a) => ({
      ...a,
      visibility: 'list',
      reasoningLevels: [],
      provider: 'agy',
    }));
    assert.deepEqual(parseAgyModelsList(null), fallback);
    assert.deepEqual(parseAgyModelsList(''), fallback);
    assert.deepEqual(parseAgyModelsList('  '), fallback);
    assert.deepEqual(
      parseAgyModelsList(
        'gemini-3.8-flash-high\tGemini 3.8 Flash (High)\n' +
          'gemini-3.1-pro-high\tGemini 3.1 Pro (High)\n' +
          'mystery\tMystery\n',
      ),
      [
        {
          slug: 'hybrid',
          displayName: 'Hybrid (Flash Pass 1 + Pro Pass 2)',
          description: 'Recommended: fast sweep + deep reasoning verdict',
          priority: 1,
          visibility: 'list',
          reasoningLevels: [],
          isDefault: true,
          provider: 'agy',
        },
        {
          slug: 'gemini-3.8-flash-high',
          displayName: 'Gemini 3.8 Flash (High)',
          description: 'Fast scan (~8s)',
          priority: 2,
          visibility: 'list',
          reasoningLevels: [],
          isDefault: false,
          provider: 'agy',
        },
        {
          slug: 'gemini-3.1-pro-high',
          displayName: 'Gemini 3.1 Pro (High)',
          description: 'Deep reasoning',
          priority: 3,
          visibility: 'list',
          reasoningLevels: [],
          isDefault: false,
          provider: 'agy',
        },
        {
          slug: 'mystery',
          displayName: 'Mystery',
          description: 'Available in agy',
          priority: 4,
          visibility: 'list',
          reasoningLevels: [],
          isDefault: false,
          provider: 'agy',
        },
      ],
    );
    assert.deepEqual(
      parseAgyModelsList('⠋ Fetching available models\ngemini-x\n').map((m) => m.slug),
      ['hybrid', 'gemini-x'],
    );
    assert.deepEqual(parseAgyModelsList('bare-model\n').map((m) => m.slug), [
      'hybrid',
      'bare-model',
    ]);
  });

  it('parseModelArgs table', () => {
    assert.deepEqual(parseModelArgs('--model='), parsedArgs({ remainingTokens: ['--model='] }));
    assert.deepEqual(
      parseModelArgs('--model --mode=local'),
      parsedArgs({ remainingTokens: ['--mode=local'] }),
    );
    assert.deepEqual(
      parseModelArgs('--model-codex --model-grok=g'),
      parsedArgs({ modelGrok: 'g' }),
    );
    assert.deepEqual(
      parseModelArgs('--mode=codex --model= --model-claude'),
      parsedArgs({ remainingTokens: ['--mode=codex', '--model='] }),
    );
    assert.deepEqual(parseModelArgs('--ask-model=false'), parsedArgs());
    assert.deepEqual(parseModelArgs('--ask-model=no'), parsedArgs());
    assert.deepEqual(parseModelArgs('--ask-model=yes'), parsedArgs({ askModel: true }));
    assert.deepEqual(
      parseModelArgs('--model-agy flash plan.md'),
      parsedArgs({ modelAgy: 'flash', remainingTokens: ['plan.md'] }),
    );
    assert.deepEqual(
      parseModelArgs(['--model-grok', 'grok-4', 'x']),
      parsedArgs({ modelGrok: 'grok-4', remainingTokens: ['x'] }),
    );
    assert.deepEqual(
      parseModelArgs('"quoted value" --model=abc'),
      parsedArgs({ model: 'abc', remainingTokens: ['quoted value'] }),
    );
    assert.deepEqual(
      parseModelArgs('model:GPT plan.md'),
      parsedArgs({ model: 'GPT', remainingTokens: ['plan.md'] }),
    );
    // A bare flag is dropped without clearing a value set earlier.
    assert.deepEqual(parseModelArgs('--model=x --model'), parsedArgs({ model: 'x' }));
    assert.deepEqual(parseModelArgs('model:q --model'), parsedArgs({ model: 'q' }));
    assert.deepEqual(
      parseModelArgs('--model-claude=z --model-codex=y flash --model-codex'),
      parsedArgs({ modelClaude: 'z', modelCodex: 'y', remainingTokens: ['flash'] }),
    );
  });

  it('resolveReviewModel table', () => {
    const codexModels = [
      {
        slug: 'sol',
        displayName: 'Sol',
        description: 'top',
        priority: 1,
        visibility: 'list',
        reasoningLevels: ['high'],
        isDefault: false,
        provider: 'codex',
      },
      {
        slug: 'terra',
        displayName: 'Terra',
        description: '',
        priority: 2,
        visibility: 'list',
        reasoningLevels: [],
        isDefault: false,
        provider: 'codex',
      },
      {
        slug: 'hidden',
        displayName: 'Hidden',
        description: '',
        priority: 0,
        visibility: 'hide',
        reasoningLevels: [],
        isDefault: false,
        provider: 'codex',
      },
    ];
    const grokModels = [
      {
        slug: 'grok-4.5',
        displayName: 'grok-4.5',
        description: 'CLI default',
        priority: null,
        visibility: 'list',
        reasoningLevels: [],
        isDefault: true,
        provider: 'grok',
      },
      {
        slug: 'grok-4',
        displayName: 'grok-4',
        description: '',
        priority: null,
        visibility: 'list',
        reasoningLevels: [],
        isDefault: false,
        provider: 'grok',
      },
    ];
    const unsafeModels = [
      {
        slug: 'bad id',
        displayName: 'bad',
        priority: 1,
        visibility: 'list',
        reasoningLevels: [],
        isDefault: false,
        provider: 'codex',
      },
    ];
    const summarize = (r) => ({
      action: r.action,
      modelId: r.modelId ?? null,
      modelFlag: r.modelFlag ?? null,
      source: r.source ?? null,
      invalidModelId: r.invalidModelId ?? false,
      unknownToCatalog: r.unknownToCatalog ?? false,
      recommended: r.recommended ? r.recommended.slug : null,
      options: r.options ? r.options.map((o) => o.slug) : null,
      top: r.ranked ? r.ranked.map((m) => m.slug) : null,
    });
    const cases = [
      [
        { provider: 'codex', models: codexModels, explicitModel: 'terra' },
        {
          action: 'run',
          modelId: 'terra',
          modelFlag: '--model terra',
          source: 'explicit',
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: 'sol',
          options: null,
          top: ['sol', 'terra'],
        },
      ],
      [
        { provider: 'codex', models: codexModels, explicitModel: 'future' },
        {
          action: 'run',
          modelId: 'future',
          modelFlag: '--model future',
          source: 'explicit',
          invalidModelId: false,
          unknownToCatalog: true,
          recommended: 'sol',
          options: null,
          top: ['sol', 'terra'],
        },
      ],
      [
        { provider: 'codex', models: codexModels, explicitModel: 'cli-default' },
        {
          action: 'run',
          modelId: null,
          modelFlag: '',
          source: 'cli-default',
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: 'sol',
          options: null,
          top: ['sol', 'terra'],
        },
      ],
      [
        { provider: 'codex', models: codexModels, explicitModel: 'a;b' },
        {
          action: 'run',
          modelId: null,
          modelFlag: '',
          source: 'explicit',
          invalidModelId: true,
          unknownToCatalog: false,
          recommended: 'sol',
          options: null,
          top: ['sol', 'terra'],
        },
      ],
      [
        { provider: 'grok', models: grokModels, explicitModel: 'x', modelGrok: 'grok-4' },
        {
          action: 'run',
          modelId: 'grok-4',
          modelFlag: '--model grok-4',
          source: 'explicit',
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: 'grok-4.5',
          options: null,
          top: ['grok-4.5', 'grok-4'],
        },
      ],
      [
        { provider: 'agy', models: [], explicitModel: 'flash' },
        {
          action: 'run',
          modelId: 'gemini-3.8-flash-high',
          modelFlag: '--model gemini-3.8-flash-high',
          source: 'explicit',
          invalidModelId: false,
          unknownToCatalog: true,
          recommended: null,
          options: null,
          top: [],
        },
      ],
      [
        { provider: 'agy', models: [], explicitModel: 'sonnet' },
        {
          action: 'run',
          modelId: 'claude-sonnet-5-5-high',
          modelFlag: '--model claude-sonnet-5-5-high',
          source: 'explicit',
          invalidModelId: false,
          unknownToCatalog: true,
          recommended: null,
          options: null,
          top: [],
        },
      ],
      [
        { provider: 'agy', models: [], modelAgy: 'claude-opus-4-6-thinking' },
        {
          action: 'run',
          modelId: 'claude-opus-5-5-high',
          modelFlag: '--model claude-opus-5-5-high',
          source: 'explicit',
          invalidModelId: false,
          unknownToCatalog: true,
          recommended: null,
          options: null,
          top: [],
        },
      ],
      [
        { provider: 'agy', models: [], explicitModel: 'mystery' },
        {
          action: 'run',
          modelId: 'mystery',
          modelFlag: '--model mystery',
          source: 'explicit',
          invalidModelId: false,
          unknownToCatalog: true,
          recommended: null,
          options: null,
          top: [],
        },
      ],
      [
        { provider: 'codex', models: codexModels, interactive: true },
        {
          action: 'pick',
          modelId: null,
          modelFlag: null,
          source: null,
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: 'sol',
          options: ['sol', 'terra', 'cli-default'],
          top: ['sol', 'terra'],
        },
      ],
      [
        { provider: 'codex', models: [], interactive: true },
        {
          action: 'pick',
          modelId: null,
          modelFlag: null,
          source: null,
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: null,
          options: ['cli-default'],
          top: [],
        },
      ],
      [
        { provider: 'codex', models: codexModels, interactive: true, userChoice: 'terra' },
        {
          action: 'run',
          modelId: 'terra',
          modelFlag: '--model terra',
          source: 'user-pick',
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: 'sol',
          options: null,
          top: ['sol', 'terra'],
        },
      ],
      [
        { provider: 'grok', models: grokModels, userChoice: 'cli-default' },
        {
          action: 'run',
          modelId: null,
          modelFlag: '',
          source: 'cli-default',
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: 'grok-4.5',
          options: null,
          top: ['grok-4.5', 'grok-4'],
        },
      ],
      [
        { provider: 'codex', models: codexModels, userChoice: 'recommended' },
        {
          action: 'run',
          modelId: 'sol',
          modelFlag: '--model sol',
          source: 'recommended',
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: 'sol',
          options: null,
          top: ['sol', 'terra'],
        },
      ],
      [
        { provider: 'codex', models: [], userChoice: 'recommended' },
        {
          action: 'run',
          modelId: null,
          modelFlag: '',
          source: 'cli-default',
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: null,
          options: null,
          top: [],
        },
      ],
      [
        { provider: 'codex', models: unsafeModels, userChoice: 'recommended' },
        {
          action: 'run',
          modelId: null,
          modelFlag: '',
          source: 'recommended',
          invalidModelId: true,
          unknownToCatalog: false,
          recommended: 'bad id',
          options: null,
          top: ['bad id'],
        },
      ],
      [
        { provider: 'grok', models: grokModels, userChoice: 'x$(id)' },
        {
          action: 'run',
          modelId: null,
          modelFlag: '',
          source: 'user-pick',
          invalidModelId: true,
          unknownToCatalog: false,
          recommended: 'grok-4.5',
          options: null,
          top: ['grok-4.5', 'grok-4'],
        },
      ],
      [
        { provider: 'agy', models: [], userChoice: 'pro' },
        {
          action: 'run',
          modelId: 'gemini-3.1-pro-high',
          modelFlag: '--model gemini-3.1-pro-high',
          source: 'user-pick',
          invalidModelId: false,
          unknownToCatalog: true,
          recommended: null,
          options: null,
          top: [],
        },
      ],
      [
        { provider: 'grok', models: grokModels, userChoice: '  ' },
        {
          action: 'run',
          modelId: null,
          modelFlag: '',
          source: 'cli-default',
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: 'grok-4.5',
          options: null,
          top: ['grok-4.5', 'grok-4'],
        },
      ],
      [
        { provider: 'codex', models: codexModels, askModel: true },
        {
          action: 'run',
          modelId: 'sol',
          modelFlag: '--model sol',
          source: 'recommended',
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: 'sol',
          options: null,
          top: ['sol', 'terra'],
        },
      ],
      [
        { provider: 'codex', models: [], askModel: true },
        {
          action: 'run',
          modelId: null,
          modelFlag: '',
          source: 'cli-default',
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: null,
          options: null,
          top: [],
        },
      ],
      [
        { provider: 'grok', models: grokModels, askModel: true, interactive: true },
        {
          action: 'pick',
          modelId: null,
          modelFlag: null,
          source: null,
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: 'grok-4.5',
          options: ['grok-4.5', 'grok-4', 'cli-default'],
          top: ['grok-4.5', 'grok-4'],
        },
      ],
      [
        { provider: 'grok', models: grokModels },
        {
          action: 'run',
          modelId: null,
          modelFlag: '',
          source: 'cli-default',
          invalidModelId: false,
          unknownToCatalog: false,
          recommended: 'grok-4.5',
          options: null,
          top: ['grok-4.5', 'grok-4'],
        },
      ],
    ];
    for (const [input, expected] of cases) {
      assert.deepEqual(summarize(resolveReviewModel(input)), expected, JSON.stringify(input));
    }
  });
});
