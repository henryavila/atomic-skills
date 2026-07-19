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
  renderProjectGuidePage,
  buildSiteFiles,
  safeHttpUrl,
  assertSafeKey,
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
      'gemini-commands': {
        name: 'Gemini Commands (internal)',
        dir: '.gemini/commands',
        format: 'command',
      },
    };
    const supportLabel = (id) => (id === 'claude-code' ? 'Tested' : 'Theoretical');
    const html = renderHostsPage({
      ideConfig,
      supportLabel,
      publicIdeIds: ['claude-code', 'gemini'],
    });
    assert.ok(html.includes('badge-tested'));
    assert.ok(html.includes('badge-theoretical'));
    assert.ok(html.includes('Claude Code'));
    assert.ok(html.includes('Gemini CLI'));
    assert.ok(!html.includes('Gemini Commands (internal)'));
    assert.ok(html.includes('TESTED_IDE_IDS'));
  });

  it('landing docs_url rejects non-http(s) schemes in href', () => {
    const bad = renderLandingPage({
      product: { ...product, docs_url: 'javascript:alert(1)' },
      skills: [],
    });
    assert.ok(!bad.includes('href="javascript:'));
    assert.ok(bad.includes('not a valid http(s) URL'));

    const good = renderLandingPage({
      product: { ...product, docs_url: 'https://atomic-skills.henryavila.com' },
      skills: [],
    });
    assert.ok(good.includes('href="https://atomic-skills.henryavila.com/"') || good.includes('href="https://atomic-skills.henryavila.com"'));
  });

  it('assertSafeKey rejects path traversal keys', () => {
    assert.equal(assertSafeKey('demo'), 'demo');
    assert.throws(() => assertSafeKey('../etc'));
    assert.throws(() => assertSafeKey('a/b'));
  });

  it('safeHttpUrl allows only http(s)', () => {
    assert.ok(safeHttpUrl('https://example.com')?.startsWith('https://'));
    assert.equal(safeHttpUrl('javascript:alert(1)'), null);
    assert.equal(safeHttpUrl('data:text/html,hi'), null);
  });

  it('buildSiteFiles emits landing, skills index/detail, empty modules, hosts', () => {
    // Catalog is core-only (installer modules concept removed on main).
    // Site still emits a Modules page as an empty shell for nav stability.
    const catalogData = {
      version: '0.3',
      product,
      core: {
        demo: minimalV02Entry('demo'),
        other: minimalV02Entry('other', { title: 'Other — Skill' }),
        'init-memory': minimalV02Entry('init-memory', {
          title: 'Init Memory',
        }),
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
    assert.ok(!files.has('project/index.html'));

    const modules = files.get('modules/index.html');
    assert.ok(
      modules.includes('No modules') || modules.includes('no modules'),
      'modules page is empty shell under core-only catalog'
    );

    const skillsIndex = files.get('skills/index.html');
    assert.ok(skillsIndex.includes('demo/index.html'));
    assert.ok(skillsIndex.includes('NO TEST WITHOUT EVIDENCE.'));
    assert.ok(skillsIndex.includes('init-memory/index.html'));

    const landing = files.get('index.html');
    // No broken Project link when guide dataset is omitted.
    assert.ok(!landing.includes('href="project/index.html"'));
    assert.ok(!landing.includes('>Project<'));
  });

  it('buildSiteFiles emits project guide when projectGuide dataset is provided', () => {
    const catalogData = {
      version: '0.3',
      product,
      core: { demo: minimalV02Entry('demo') },
    };
    const projectGuide = {
      title: 'Project skill — mental model',
      one_liner: 'Plan ⊃ Phase ⊃ Task',
      iron_law: 'NO IMPLEMENTATION WITHOUT AN ANCHORED INITIATIVE.',
      lede: 'Tracks multi-day work in .atomic-skills/.',
      prefix: '/atomic-skills:project',
      state_root: '.atomic-skills/',
      entities: [
        {
          id: 'plan',
          name: 'Plan',
          summary: 'Multi-phase delivery',
          nests: 'Phases',
        },
      ],
      lifecycle_spine: [
        { id: 'idea', label: 'IDEA', note: 'Capture' },
        { id: 'archive', label: 'ARCHIVE', note: 'Done' },
      ],
      can: ['Reload the frame each session'],
      cannot: ['Never hand-edit .atomic-skills/'],
      command_groups: [
        {
          id: 'view',
          title: 'View',
          commands: [
            {
              name: 'status',
              args: '[--browser]',
              description: 'See state',
            },
          ],
        },
      ],
    };

    const files = buildSiteFiles({ catalogData, projectGuide });
    assert.ok(files.has('project/index.html'));
    const html = files.get('project/index.html');
    assert.ok(html.includes('Project skill — mental model'));
    assert.ok(html.includes('NO IMPLEMENTATION WITHOUT AN ANCHORED INITIATIVE.'));
    assert.ok(html.includes('IDEA'));
    assert.ok(html.includes('Never hand-edit .atomic-skills/'));
    assert.ok(html.includes('/atomic-skills:project status'));
    assert.ok(html.includes('href="../assets/ds.css"'));
    assert.ok(html.includes('class="active"') && html.includes('Project'));
  });

  it('renderProjectGuidePage escapes untrusted dataset text', () => {
    const html = renderProjectGuidePage({
      guide: {
        title: 'Guide <script>',
        entities: [
          {
            name: 'Plan & Co',
            summary: 'Uses <brackets>',
            nests: 'Tasks',
          },
        ],
        can: ['Do <this>'],
        cannot: ['Never & ever'],
        command_groups: [],
        lifecycle_spine: [],
      },
    });
    assert.ok(html.includes('Guide &lt;script&gt;'));
    assert.ok(html.includes('Plan &amp; Co'));
    assert.ok(html.includes('Uses &lt;brackets&gt;'));
    assert.ok(html.includes('Do &lt;this&gt;'));
    assert.ok(html.includes('Never &amp; ever'));
    assert.ok(!html.includes('Guide <script>'));
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

  it('writeDist rejects paths that escape distDir', () => {
    const expected = new Map([
      ['skills/../../../outside.txt', 'nope'],
    ]);
    assert.throws(() => writeDist(expected, { distDir, dsCssSrc }), /escapes|invalid|segment/i);
    assert.ok(!existsSync(join(tmpRoot, 'outside.txt')));
  });

  it('buildSiteFiles rejects unsafe skill keys', () => {
    assert.throws(
      () =>
        buildSiteFiles({
          catalogData: {
            version: '0.3',
            product: catalogBase.product,
            core: {
              '../evil': minimalV02Entry('evil'),
            },
          },
        }),
      /unsafe catalog key/
    );
  });

  it('writeDist then findDistDrift is clean; catalog change is stale', () => {
    const expected = buildExpectedDist({
      catalogData: catalogBase,
      projectGuide: null,
      dsCss: readFileSync(dsCssSrc, 'utf8'),
      pkgVersion: '0.0.1',
    });
    writeDist(expected, { distDir, dsCssSrc });

    assert.ok(existsSync(join(distDir, 'index.html')));
    assert.ok(existsSync(join(distDir, 'skills', 'demo', 'index.html')));
    assert.ok(existsSync(join(distDir, 'assets', 'ds.css')));
    assert.ok(!existsSync(join(distDir, 'project', 'index.html')));
    assert.deepEqual(findDistDrift(expected, distDir), []);

    const changed = buildExpectedDist({
      catalogData: {
        ...catalogBase,
        product: {
          ...catalogBase.product,
          what_is: 'CHANGED product copy that should invalidate dist.',
        },
      },
      projectGuide: null,
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

  it('writeDist emits project/index.html when projectGuide is provided', () => {
    const expected = buildExpectedDist({
      catalogData: catalogBase,
      projectGuide: {
        title: 'Fixture project guide',
        entities: [{ name: 'Plan', summary: 'A plan', nests: 'Phases' }],
        lifecycle_spine: [{ label: 'IDEA', note: 'start' }],
        can: ['can-a'],
        cannot: ['cannot-b'],
        command_groups: [
          {
            title: 'View',
            commands: [{ name: 'status', description: 'view state' }],
          },
        ],
      },
      dsCss: readFileSync(dsCssSrc, 'utf8'),
      pkgVersion: '0.0.1',
    });
    writeDist(expected, { distDir, dsCssSrc });
    const page = join(distDir, 'project', 'index.html');
    assert.ok(existsSync(page));
    const html = readFileSync(page, 'utf8');
    assert.ok(html.includes('Fixture project guide'));
    assert.ok(html.includes('cannot-b'));
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
