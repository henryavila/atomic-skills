import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  escapeHtml,
  depthPrefix,
  renderLandingPage,
  renderSkillDetail,
  renderHostsPage,
  buildSiteFiles,
} from '../scripts/lib/render-site.js';
import {
  buildExpectedDist,
  findDistDrift,
  writeDist,
} from '../scripts/generate-site.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const minimalV02Entry = (name, overrides = {}) => ({
  name,
  title: `${name} — Demo`,
  description: 'A demo skill used by tests.',
  purpose: 'Prove the site renders catalog fields only.',
  value_pitch: 'Catalog-driven product blurbs without prompt bodies.',
  when_to_use: ['Testing the generator'],
  when_not_to_use: ['Production docs'],
  examples: [{ command: `/atomic-skills:${name}`, description: 'Run the skill' }],
  one_liner: 'Compact demo skill used by unit tests',
  emoji: '🧪',
  version_added: '3.1.0',
  schema_version: '0.2',
  iron_law: 'NO TEST WITHOUT EVIDENCE.',
  ...overrides,
});

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    assert.equal(
      escapeHtml(`<script>alert("x")</script>&'`),
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;'
    );
  });

  it('stringifies nullish as empty', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
  });
});

describe('depthPrefix', () => {
  it('returns empty for root and ../ segments for depth', () => {
    assert.equal(depthPrefix(0), '');
    assert.equal(depthPrefix(1), '../');
    assert.equal(depthPrefix(2), '../../');
  });
});

describe('render helpers', () => {
  const product = {
    what_is: 'Battle-tested skill prompts.',
    what_is_not: ['A prompt pack', 'A model vendor'],
    docs_url: 'https://atomic-skills.henryavila.com',
    install: { primary: 'npx @henryavila/atomic-skills install' },
  };

  it('renderLandingPage includes product fields and nav links', () => {
    const skills = [
      { key: 'demo', entry: minimalV02Entry('demo'), modulePath: null },
    ];
    const html = renderLandingPage({ product, skills, pkgVersion: '2.0.0' });
    assert.ok(html.includes('Battle-tested skill prompts.'));
    assert.ok(html.includes('A prompt pack'));
    assert.ok(html.includes('npx @henryavila/atomic-skills install'));
    assert.ok(html.includes('https://atomic-skills.henryavila.com'));
    assert.ok(html.includes('href="skills/index.html"'));
    assert.ok(html.includes('href="assets/ds.css"'));
    assert.ok(html.includes('v2.0.0'));
  });

  it('renderSkillDetail escapes untrusted catalog text and uses depth-2 CSS', () => {
    const skill = {
      key: 'demo',
      modulePath: null,
      entry: minimalV02Entry('demo', {
        iron_law: 'NO <script> IN PROD.',
        one_liner: 'Uses & angle <brackets>',
      }),
    };
    const html = renderSkillDetail({ skill });
    assert.ok(html.includes('NO &lt;script&gt; IN PROD.'));
    assert.ok(html.includes('Uses &amp; angle &lt;brackets&gt;'));
    assert.ok(!html.includes('NO <script> IN PROD.'));
    assert.ok(html.includes('href="../../assets/ds.css"'));
    assert.ok(html.includes('When to use'));
    assert.ok(html.includes('/atomic-skills:demo'));
    assert.ok(html.includes('Catalog-driven product blurbs'));
  });

  it('renderHostsPage marks Tested vs Theoretical via injected supportLabel', () => {
    const ideConfig = {
      'claude-code': {
        name: 'Claude Code',
        dir: '.claude/commands',
        format: 'command',
      },
      gemini: {
        name: 'Gemini CLI',
        dir: '.gemini/skills',
        format: 'markdown',
      },
    };
    const supportLabel = (id) => (id === 'claude-code' ? 'Tested' : 'Theoretical');
    const html = renderHostsPage({ ideConfig, supportLabel });
    assert.ok(html.includes('badge-tested'));
    assert.ok(html.includes('badge-theoretical'));
    assert.ok(html.includes('Claude Code'));
    assert.ok(html.includes('Gemini CLI'));
    assert.ok(html.includes('TESTED_IDE_IDS'));
  });

  it('buildSiteFiles emits landing, skills index/detail, modules, hosts', () => {
    const catalogData = {
      version: '0.3',
      product,
      core: {
        demo: minimalV02Entry('demo'),
        other: minimalV02Entry('other', { title: 'Other — Skill' }),
      },
      modules: {
        memory: {
          'init-memory': minimalV02Entry('init-memory', {
            title: 'Init Memory',
          }),
        },
      },
      module_meta: {
        memory: {
          title: 'Memory',
          intro: 'Persistent context.',
          features: ['Configurable path'],
        },
      },
    };

    const files = buildSiteFiles({ catalogData, pkgVersion: '9.9.9' });
    assert.ok(files.has('index.html'));
    assert.ok(files.has('skills/index.html'));
    assert.ok(files.has('skills/demo/index.html'));
    assert.ok(files.has('skills/other/index.html'));
    assert.ok(files.has('skills/init-memory/index.html'));
    assert.ok(files.has('modules/index.html'));
    assert.ok(files.has('hosts/index.html'));

    const modules = files.get('modules/index.html');
    assert.ok(modules.includes('Persistent context.'));
    assert.ok(modules.includes('Configurable path'));

    const skillsIndex = files.get('skills/index.html');
    assert.ok(skillsIndex.includes('demo/index.html'));
    assert.ok(skillsIndex.includes('NO TEST WITHOUT EVIDENCE.'));
  });
});

describe('generate-site dist drift check', () => {
  let tmpRoot;
  let distDir;
  let dsCssSrc;

  const catalogBase = {
    version: '0.3',
    product: {
      what_is: 'Fixture product.',
      what_is_not: ['Not real'],
      docs_url: 'https://example.test',
      install: { primary: 'npx fixture install' },
    },
    core: {
      demo: minimalV02Entry('demo'),
    },
    module_meta: {
      memory: { title: 'Memory', intro: 'Intro', features: ['f1'] },
    },
  };

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'gen-site-'));
    distDir = join(tmpRoot, 'site', 'dist');
    dsCssSrc = join(tmpRoot, 'site', 'assets', 'ds.css');
    mkdirSync(dirname(dsCssSrc), { recursive: true });
    writeFileSync(
      dsCssSrc,
      ':root { --bg-canvas: #0a0d12; --fg-default: #e9eef5; --font-sans: system-ui; --font-mono: monospace; --status-success: #4cc28e; }\n'
    );
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('writeDist then findDistDrift is clean; catalog change is stale', () => {
    const expected = buildExpectedDist({
      catalogData: catalogBase,
      dsCss: readFileSync(dsCssSrc, 'utf8'),
      pkgVersion: '0.0.1',
    });
    writeDist(expected, { distDir, dsCssSrc });

    assert.ok(existsSync(join(distDir, 'index.html')));
    assert.ok(existsSync(join(distDir, 'skills', 'demo', 'index.html')));
    assert.ok(existsSync(join(distDir, 'assets', 'ds.css')));
    assert.deepEqual(findDistDrift(expected, distDir), []);

    const changed = buildExpectedDist({
      catalogData: {
        ...catalogBase,
        product: {
          ...catalogBase.product,
          what_is: 'CHANGED product copy that should invalidate dist.',
        },
      },
      dsCss: readFileSync(dsCssSrc, 'utf8'),
      pkgVersion: '0.0.1',
    });
    const drift = findDistDrift(changed, distDir);
    assert.ok(drift.length > 0, 'expected drift after catalog change');
    assert.ok(
      drift.some((line) => /stale: index\.html/.test(line)),
      `expected stale index.html, got: ${drift.join('; ')}`
    );
  });
});

describe('generate-site CLI smoke (project tree)', () => {
  it('npm run check-site exits 0 when dist matches catalog', () => {
    const result = spawnSync(
      process.execPath,
      [join(PROJECT_ROOT, 'scripts', 'generate-site.js'), '--check'],
      {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
      }
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
});
