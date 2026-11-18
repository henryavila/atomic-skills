#!/usr/bin/env node
/**
 * Adopt release workflow templates with check → diff → write.
 *
 *   node scripts/release/adopt.js --check [--template stage|gh-only] [--target path] [--root dir]
 *   node scripts/release/adopt.js --diff  [...]
 *   node scripts/release/adopt.js --write [...]   # consent = passing --write after --check
 *
 * Exit codes for --check / --diff:
 *   0  target matches pinned template
 *   1  target missing or drifted (or write failed)
 *   2  usage error
 *
 * --write exits 0 after writing; still requires the operator to pass --write
 * explicitly (CLI stand-in for consent). Uninstall of Atomic Skills does not
 * remove adopted consumer files.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, '../..');
const TEMPLATES_DIR = join(PKG_ROOT, 'skills/shared/release-assets/templates');

const TEMPLATES = {
  stage: {
    file: 'publish-stage.yml',
    pin: 'atomic-skills/release-assets/publish-stage@v1',
  },
  'gh-only': {
    file: 'publish-gh-only.yml',
    pin: 'atomic-skills/release-assets/publish-gh-only@v1',
  },
};

function parseArgs(argv) {
  const args = new Set();
  let root = null;
  let template = 'stage';
  let target = '.github/workflows/publish.yml';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') {
      root = argv[++i];
      continue;
    }
    if (a === '--template') {
      template = argv[++i];
      continue;
    }
    if (a === '--target') {
      target = argv[++i];
      continue;
    }
    args.add(a);
  }
  return { args, root, template, target };
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
}

function pinFromTemplate(text, fallback) {
  const m = text.match(/^\s*#\s*pin:\s*(\S+)/m);
  return m ? m[1] : fallback;
}

/**
 * @param {object} options
 * @param {string} options.root
 * @param {string} [options.templateName]
 * @param {string} [options.targetRel]
 * @param {(path: string, enc?: string) => string} [options.readFile]
 * @param {(path: string, data: string) => void} [options.writeFile]
 * @param {(path: string) => boolean} [options.exists]
 * @param {(path: string, opts?: object) => void} [options.mkdir]
 */
export function createAdopt({
  root,
  templateName = 'stage',
  targetRel = '.github/workflows/publish.yml',
  readFile = (p) => readFileSync(p, 'utf8'),
  writeFile = (p, d) => writeFileSync(p, d),
  exists = existsSync,
  mkdir = (p, o) => mkdirSync(p, o),
  templatesDir = TEMPLATES_DIR,
} = {}) {
  if (!root) throw new Error('createAdopt requires root');

  const meta = TEMPLATES[templateName];
  if (!meta) {
    throw new Error(`unknown template "${templateName}" (expected stage|gh-only)`);
  }

  const templatePath = join(templatesDir, meta.file);
  const targetPath = join(root, targetRel);

  function inspect() {
    if (!exists(templatePath)) {
      throw new Error(`template missing: ${templatePath}`);
    }
    const templateText = readFile(templatePath);
    const pin = pinFromTemplate(templateText, meta.pin);
    const targetExists = exists(targetPath);
    if (!targetExists) {
      return {
        template: meta.file,
        pin,
        target: targetRel,
        status: 'missing',
        templateText,
        targetText: null,
      };
    }
    const targetText = readFile(targetPath);
    const status =
      normalize(targetText) === normalize(templateText) ? 'match' : 'drift';
    return {
      template: meta.file,
      pin,
      target: targetRel,
      status,
      templateText,
      targetText,
    };
  }

  function formatCheck(report) {
    return [
      'adopt --check',
      `  template: ${report.template}`,
      `  pin:      ${report.pin}`,
      `  target:   ${report.target}`,
      `  status:   ${report.status}`,
    ].join('\n');
  }

  function formatDiff(report) {
    if (report.status === 'match') {
      return `${formatCheck(report)}\n  (no diff)`;
    }
    if (report.status === 'missing') {
      return [
        formatCheck(report),
        '  would create:',
        ...report.templateText.split('\n').map((l) => `  + ${l}`),
      ].join('\n');
    }
    // Minimal unified-ish diff: show both sides when drifted (enough for gate).
    const lines = [formatCheck(report), '  --- target', '  +++ template'];
    for (const l of report.targetText.split('\n')) lines.push(`  - ${l}`);
    for (const l of report.templateText.split('\n')) lines.push(`  + ${l}`);
    return lines.join('\n');
  }

  function write(report) {
    if (report.status === 'match') {
      return { written: false, ...report };
    }
    mkdir(dirname(targetPath), { recursive: true });
    writeFile(targetPath, report.templateText);
    return { written: true, ...report, statusAfter: 'match' };
  }

  function run(argv = [], io = process) {
    const { args, template, target } = parseArgs(argv);
    const effective =
      template !== templateName || target !== targetRel
        ? createAdopt({
            root,
            templateName: template || templateName,
            targetRel: target || targetRel,
            readFile,
            writeFile,
            exists,
            mkdir,
            templatesDir,
          })
        : {
            inspect,
            formatCheck,
            formatDiff,
            write,
          };

    if (args.has('-h') || args.has('--help')) {
      io.stdout.write(
        [
          'Usage: node scripts/release/adopt.js --check|--diff|--write [--template stage|gh-only] [--target path] [--root dir]',
          'Exit 0 on match; exit 1 on missing/drift (check/diff).',
          'Writing when missing|drift requires --check --diff --write (consent triad).',
        ].join('\n') + '\n',
      );
      return 0;
    }

    const wantCheck = args.has('--check');
    const wantDiff = args.has('--diff');
    const wantWrite = args.has('--write');
    if (!wantCheck && !wantDiff && !wantWrite) {
      io.stderr.write('adopt: pass --check, --diff, or --write\n');
      return 2;
    }

    const report = effective.inspect();
    if (wantWrite) {
      if (report.status !== 'match') {
        if (!wantCheck) {
          io.stderr.write('adopt: refuse write without --check when status is missing|drift\n');
          return 1;
        }
        if (!wantDiff) {
          io.stderr.write('adopt: refuse write without --diff when status is missing|drift\n');
          return 1;
        }
      }
      const result = effective.write(report);
      io.stdout.write(
        [
          effective.formatCheck({ ...report, status: result.statusAfter || report.status }),
          `  written: ${result.written ? 'yes' : 'no (already match)'}`,
          `  pin:     ${report.pin}`,
        ].join('\n') + '\n',
      );
      return 0;
    }

    if (wantDiff) {
      io.stdout.write(effective.formatDiff(report) + '\n');
      return report.status === 'match' ? 0 : 1;
    }

    io.stdout.write(effective.formatCheck(report) + '\n');
    return report.status === 'match' ? 0 : 1;
  }

  return { inspect, formatCheck, formatDiff, write, run, templatePath, targetPath };
}

export function resolveRoot(argv = process.argv.slice(2), fallback = process.cwd()) {
  const { root } = parseArgs(argv);
  return root || fallback;
}

function main() {
  try {
    const argv = process.argv.slice(2);
    const { template, target } = parseArgs(argv);
    const root = resolveRoot(argv);
    const cli = createAdopt({ root, templateName: template, targetRel: target });
    process.exitCode = cli.run(argv);
  } catch (err) {
    process.stderr.write(String(err?.message || err) + '\n');
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) main();
