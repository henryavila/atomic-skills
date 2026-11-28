import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, DELEGATE_PY, PYTHON3 } from './helpers/delegate-runner-kit.js';

// The severity of a review finding is computed by the runner from six answers,
// with the table of severity-rubric.md. These tests call the runner's own
// functions; the document is read as the reviewer reads it.
const RUBRIC_PATH = join(REPO_ROOT, 'skills/shared/delegate-assets/severity-rubric.md');

function py(code, ...args) {
  const prelude = `import importlib.util, json, sys
spec = importlib.util.spec_from_file_location('delegate', ${JSON.stringify(DELEGATE_PY)})
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
`;
  const res = spawnSync(PYTHON3, ['-B', '-c', prelude + code, ...args], { encoding: 'utf8', timeout: 60000 });
  assert.equal(res.status, 0, res.stderr);
  return JSON.parse(res.stdout);
}

function severities(cases) {
  return py('print(json.dumps([d.compute_severity(a) for a in json.loads(sys.argv[1])]))',
    JSON.stringify(cases));
}

function parseReview(text) {
  return py('print(json.dumps(d.parse_review(sys.argv[1])))', text);
}

// ---- reading the document ------------------------------------------------

function section(text, heading) {
  const start = text.indexOf(`\n## ${heading}`);
  assert.ok(start >= 0, `severity-rubric.md has no "## ${heading}" section`);
  const rest = text.slice(start + 1);
  const end = rest.slice(3).search(/^## /m);
  return end === -1 ? rest : rest.slice(0, end + 3);
}

function tableRows(text) {
  return text.split('\n').filter((line) => line.startsWith('|')).slice(2)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

function ticks(text) {
  return [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

function documentRubric() {
  const text = readFileSync(RUBRIC_PATH, 'utf8');
  const questions = section(text, 'The six answers');
  const answers = {};
  let kinds = null;
  for (const block of questions.split(/^### /m).slice(1)) {
    const heading = block.split('\n')[0];
    const match = heading.match(/^\d+\. `(\w+)` — (.*)$/);
    assert.ok(match, `unreadable question heading: ${heading}`);
    const [, key, rest] = match;
    if (key === 'kind') {
      kinds = tableRows(block).map((row) => ticks(row[0])[0]);
      answers.kind = kinds;
      continue;
    }
    const words = ticks(rest);
    if (/another finding/.test(rest)) words.push('another finding');
    if (/a quote/.test(rest)) words.push('a quote');
    answers[key] = words;
  }
  const reachBlock = questions.split(/^### /m).find((block) => block.includes('`reach`'));
  const reachKinds = ticks(reachBlock.match(/Only for ([^.]*)\./)[1]);

  const table = tableRows(section(text, 'How the severity is computed')).map(([cell, resultCell]) => {
    const when = {};
    let lowers = null;
    let current = null;
    const add = (key, value) => { (when[key] ||= []).push(value); };
    for (const token of ticks(cell)) {
      const pair = token.match(/^(\w+)=(.+)$/);
      if (pair) { add(pair[1], pair[2]); current = pair[1]; continue; }
      if (token === 'dup' && /another finding/.test(cell)) { add('dup', 'another finding'); continue; }
      if (token === 'card' && /a quote/.test(cell)) { add('card', 'a quote'); continue; }
      if (token === 'reach') { current = 'reach'; continue; }
      if (/row below gives/.test(cell) && ['major', 'medium', 'minor'].includes(token)) { lowers = token; continue; }
      if (kinds.includes(token) && current !== 'reach') { add('kind', token); continue; }
      if (current === 'reach') { add('reach', token); continue; }
      throw new Error(`unread token \`${token}\` in table row: ${cell}`);
    }
    const result = ticks(resultCell)[0] || resultCell.match(/^[\w-]+/)[0];
    return lowers ? { when, lowers, result } : { when, result };
  });
  return { answers, reach_kinds: reachKinds, table };
}

// The document's table applied as the document states it: the first row that
// matches; the `proof=none` row turns a `major` from the rows below into its result.
function documentSeverity(table, answers) {
  const seen = { ...answers,
    dup: answers.dup === 'none' ? 'none' : 'another finding',
    card: answers.card === 'none' ? 'none' : 'a quote' };
  for (let i = 0; i < table.length; i++) {
    const row = table[i];
    if (!Object.entries(row.when).every(([key, values]) => values.includes(seen[key]))) continue;
    if (row.lowers) {
      const below = documentSeverity(table.slice(i + 1), answers);
      return below === row.lowers ? row.result : below;
    }
    return row.result;
  }
  return null;
}

const QUOTE = 'the runner refuses the review before launching';
const BASE = { origin: 'diff', dup: 'none', card: 'none', kind: 'behaviour', reach: 'normal', proof: 'shown' };
const answer = (over) => ({ ...BASE, ...over });

describe('delegate severity rubric', () => {
  describe('the table, one row at a time', () => {
    const rows = [
      ['row 1: origin=base is pre-existing', [[{ origin: 'base' }, 'pre-existing']]],
      ['row 2: a dup of another finding is merged', [[{ dup: 'F02' }, 'merged']]],
      ['row 3: proof=none turns a major into medium', [[{ proof: 'none' }, 'medium']]],
      ['row 4: a card quote is major whatever the kind', [
        [{ card: QUOTE, kind: 'style', reach: '-' }, 'major'],
        [{ card: QUOTE, kind: 'behaviour', reach: 'none' }, 'major'],
      ]],
      ['row 5: access or data reached normally or at an edge is major', [
        [{ kind: 'access', reach: 'normal' }, 'major'], [{ kind: 'access', reach: 'edge' }, 'major'],
        [{ kind: 'data', reach: 'normal' }, 'major'], [{ kind: 'data', reach: 'edge' }, 'major'],
      ]],
      ['row 6: access or data that nothing reaches is medium', [
        [{ kind: 'access', reach: 'none' }, 'medium'], [{ kind: 'data', reach: 'none' }, 'medium'],
      ]],
      ['row 7: behaviour reached normally is major', [[{ kind: 'behaviour', reach: 'normal' }, 'major']]],
      ['row 8: behaviour at an edge is medium', [[{ kind: 'behaviour', reach: 'edge' }, 'medium']]],
      ['row 9: behaviour that nothing reaches is minor', [[{ kind: 'behaviour', reach: 'none' }, 'minor']]],
      ['row 10: test-void is major', [[{ kind: 'test-void', reach: '-' }, 'major']]],
      ['row 11: doc-false is major', [[{ kind: 'doc-false', reach: '-' }, 'major']]],
      ['row 12: test-gap and upkeep are medium', [
        [{ kind: 'test-gap', reach: '-' }, 'medium'], [{ kind: 'upkeep', reach: '-' }, 'medium'],
      ]],
      ['row 13: doc-loose and style are minor', [
        [{ kind: 'doc-loose', reach: '-' }, 'minor'], [{ kind: 'style', reach: '-' }, 'minor'],
      ]],
    ];
    for (const [name, cases] of rows) {
      it(name, () => {
        assert.deepEqual(severities(cases.map(([over]) => answer(over))), cases.map(([, expected]) => expected));
      });
    }
  });

  describe('the order of the rows', () => {
    it('origin=base wins over every other answer', () => {
      assert.deepEqual(severities([
        answer({ origin: 'base', dup: 'F02', card: QUOTE, kind: 'access', reach: 'normal', proof: 'none' }),
        answer({ origin: 'base', dup: 'F02', card: QUOTE, kind: 'data', reach: 'normal', proof: 'shown' }),
        answer({ origin: 'base', kind: 'style', reach: '-' }),
      ]), ['pre-existing', 'pre-existing', 'pre-existing']);
    });

    it('dup wins over every row below it', () => {
      assert.deepEqual(severities([
        answer({ dup: 'F02', card: QUOTE, kind: 'data', reach: 'normal', proof: 'shown' }),
        answer({ dup: 'F02', card: QUOTE, kind: 'doc-false', reach: '-', proof: 'none' }),
        answer({ dup: 'F02', kind: 'style', reach: '-' }),
      ]), ['merged', 'merged', 'merged']);
    });

    it('proof=none lowers every row that gives major to medium', () => {
      assert.deepEqual(severities([
        answer({ card: QUOTE, kind: 'style', reach: '-', proof: 'none' }),
        answer({ kind: 'access', reach: 'normal', proof: 'none' }),
        answer({ kind: 'data', reach: 'edge', proof: 'none' }),
        answer({ kind: 'behaviour', reach: 'normal', proof: 'none' }),
        answer({ kind: 'test-void', reach: '-', proof: 'none' }),
        answer({ kind: 'doc-false', reach: '-', proof: 'none' }),
      ]), ['medium', 'medium', 'medium', 'medium', 'medium', 'medium']);
    });

    it('proof=none does not touch a row that gives medium or minor', () => {
      assert.deepEqual(severities([
        answer({ kind: 'access', reach: 'none', proof: 'none' }),
        answer({ kind: 'behaviour', reach: 'edge', proof: 'none' }),
        answer({ kind: 'behaviour', reach: 'none', proof: 'none' }),
        answer({ kind: 'test-gap', reach: '-', proof: 'none' }),
        answer({ kind: 'upkeep', reach: '-', proof: 'none' }),
        answer({ kind: 'doc-loose', reach: '-', proof: 'none' }),
        answer({ kind: 'style', reach: '-', proof: 'none' }),
      ]), ['medium', 'medium', 'minor', 'medium', 'medium', 'minor', 'minor']);
    });
  });

  describe('the document and the code', () => {
    it('the table of severity-rubric.md is the table the runner applies', () => {
      const fromCode = py('print(json.dumps(d.SEVERITY_RUBRIC["table"]))');
      assert.deepEqual(fromCode, documentRubric().table);
    });

    it('the allowed words of severity-rubric.md are the words the runner accepts', () => {
      const rubric = documentRubric();
      const fromCode = py('print(json.dumps({"answers": d.SEVERITY_RUBRIC["answers"], '
        + '"reach_kinds": d.SEVERITY_RUBRIC["reach_kinds"]}))');
      assert.deepEqual(fromCode, { answers: rubric.answers, reach_kinds: rubric.reach_kinds });
      assert.deepEqual(Object.keys(fromCode.answers), ['origin', 'dup', 'card', 'kind', 'reach', 'proof']);
    });

    it('every combination of answers gets the class the document gives it', () => {
      const { answers: words, table } = documentRubric();
      const values = { ...words, dup: ['none', 'F02'], card: ['none', QUOTE] };
      let combos = [{}];
      for (const key of ['origin', 'dup', 'card', 'kind', 'reach', 'proof']) {
        combos = combos.flatMap((partial) => values[key].map((value) => ({ ...partial, [key]: value })));
      }
      const computed = severities(combos);
      combos.forEach((combo, i) => {
        assert.equal(computed[i], documentSeverity(table, combo), JSON.stringify(combo));
      });
    });
  });

  describe('reading a review', () => {
    const line = (id, over = {}, location = 'src/a.js:12', text = 'the parser drops the last line') => {
      const a = answer(over);
      return `${id} | ${location} | origin=${a.origin} | dup=${a.dup} | card=${a.card} | kind=${a.kind} `
        + `| reach=${a.reach} | proof=${a.proof} | ${text} | ran \`node a.js | tail -1\`: printed nothing`;
    };
    const ZERO = { major: 0, medium: 0, minor: 0, pre_existing: 0, merged: 0, unclassified: 0 };

    it('reads a well-formed line and computes its severity', () => {
      const review = parseReview(`Checked src/a.js.\n${line('F01')}\nFINDINGS 1\n`);
      assert.equal(review.severity_source, 'computed');
      assert.equal(review.complete, true);
      assert.deepEqual(review.findings, [{
        id: 'F01', location: 'src/a.js:12', severity: 'major',
        answers: { origin: 'diff', dup: 'none', card: 'none', kind: 'behaviour', reach: 'normal', proof: 'shown' },
      }]);
      assert.deepEqual(review.counts, { ...ZERO, major: 1 });
      assert.equal(review.findings_mismatch, false);
      assert.deepEqual(review.summary_lines,
        ['major | F01 | src/a.js:12 | kind=behaviour reach=normal proof=shown | the parser drops the last line']);
      assert.equal(review.total_line, 'TOTAL major=1 medium=0 minor=0');
    });

    it('lists pre-existing and merged findings without counting them', () => {
      const review = parseReview([
        line('F01', { kind: 'doc-false', reach: '-' }, 'README.md:4', 'the flag is documented as --all'),
        line('F02', { origin: 'base' }, 'src/old.js:3'),
        line('F03', { dup: 'F01', kind: 'doc-loose', reach: '-' }, 'docs/x.md:9'),
        'FINDINGS 3',
      ].join('\n'));
      assert.deepEqual(review.counts, { ...ZERO, major: 1, pre_existing: 1, merged: 1 });
      assert.deepEqual(review.findings.map((f) => f.severity), ['major', 'pre-existing', 'merged']);
      assert.deepEqual(review.summary_lines, [
        'major | F01 | README.md:4 | kind=doc-false reach=- proof=shown | the flag is documented as --all',
        'pre-existing | F02 | src/old.js:3 | origin=base kind=behaviour reach=normal proof=shown | the parser drops the last line',
        'merged | F03 | docs/x.md:9 | dup=F01 kind=doc-loose reach=- proof=shown | the parser drops the last line',
      ]);
      assert.equal(review.total_line, 'TOTAL major=1 medium=0 minor=0');
    });

    it('makes a finding with an unknown word unclassified, counted as medium, without guessing', () => {
      const review = parseReview([
        line('F01', { kind: 'bug' }),
        line('F02', { kind: 'Behaviour' }),
        line('F03', { proof: 'ran' }),
        'FINDINGS 3',
      ].join('\n'));
      assert.deepEqual(review.findings.map((f) => f.severity), ['unclassified', 'unclassified', 'unclassified']);
      assert.deepEqual(review.counts, { ...ZERO, medium: 3, unclassified: 3 });
      assert.match(review.findings[0].problems.join(' '), /kind=bug/);
      assert.match(review.findings[1].problems.join(' '), /kind=Behaviour/);
      assert.match(review.findings[2].problems.join(' '), /proof=ran/);
      assert.match(review.summary_lines[0], /^unclassified \| F01 \| src\/a\.js:12 \| /);
      assert.equal(review.total_line, 'TOTAL major=0 medium=3 minor=0');
    });

    it('makes a finding with a missing answer unclassified', () => {
      const missing = line('F01').replace(' | reach=normal', '');
      const review = parseReview(`${missing}\nFINDINGS 1\n`);
      assert.equal(review.findings[0].severity, 'unclassified');
      assert.match(review.findings[0].problems.join(' '), /reach/);
      assert.equal(review.findings[0].answers.reach, undefined);
      assert.deepEqual(review.counts, { ...ZERO, medium: 1, unclassified: 1 });
    });

    it('takes reach only for access, data and behaviour, and `-` for every other kind', () => {
      const review = parseReview([
        line('F01', { kind: 'behaviour', reach: '-' }),
        line('F02', { kind: 'doc-false', reach: 'normal' }),
        line('F03', { kind: 'doc-false', reach: '-' }),
        'FINDINGS 3',
      ].join('\n'));
      assert.deepEqual(review.findings.map((f) => f.severity), ['unclassified', 'unclassified', 'major']);
    });

    it('merges a dup only into an existing finding that is not merged itself', () => {
      const review = parseReview([
        line('F01'),
        line('F02', { dup: 'F01', kind: 'doc-loose', reach: '-' }),
        line('F03', { dup: 'F02', kind: 'style', reach: '-' }),
        line('F04', { dup: 'F05', kind: 'test-gap', reach: '-' }),
        line('F05', { origin: 'base' }),
        'FINDINGS 5',
      ].join('\n'));
      // F03 points to F02, which is merged: F03 is classified by its other answers.
      // F05 is pre-existing, not merged, so F04 merges into it.
      assert.deepEqual(review.findings.map((f) => f.severity), ['major', 'merged', 'minor', 'merged', 'pre-existing']);
      assert.match(review.findings[2].dup_not_merged, /merged/);
      assert.equal(review.findings[1].dup_not_merged, undefined);
      assert.deepEqual(review.counts, { ...ZERO, major: 1, minor: 1, merged: 2, pre_existing: 1 });
    });

    it('merges nothing for a dup that names itself, names no finding, or goes round in a circle', () => {
      const review = parseReview([
        line('F01', { dup: 'F01' }),
        line('F02', { dup: 'F09', kind: 'style', reach: '-' }),
        line('F03', { dup: 'F04' }),
        line('F04', { dup: 'F03', kind: 'test-gap', reach: '-' }),
        line('F05', { dup: 'F06', kind: 'data', reach: 'none' }),
        line('F06', { dup: 'F07', kind: 'doc-loose', reach: '-' }),
        line('F07', { dup: 'F05', kind: 'test-void', reach: '-' }),
        line('F08', { dup: 'F03', kind: 'upkeep', reach: '-' }),
        'FINDINGS 8',
      ].join('\n'));
      // Each is classified by its other answers; F08 points to F03, which exists
      // and is not merged, so F08 is merged.
      assert.deepEqual(review.findings.map((f) => f.severity),
        ['major', 'minor', 'major', 'medium', 'medium', 'minor', 'major', 'merged']);
      assert.deepEqual(review.findings.map((f) => f.answers.dup),
        ['F01', 'F09', 'F04', 'F03', 'F06', 'F07', 'F05', 'F03'], 'the answers are recorded as given');
      assert.match(review.findings[0].dup_not_merged, /itself/);
      assert.match(review.findings[1].dup_not_merged, /no such finding/);
      for (const i of [2, 3, 4, 5, 6]) assert.match(review.findings[i].dup_not_merged, /circular/);
      assert.equal(review.findings[7].dup_not_merged, undefined);
      assert.ok(review.summary_lines[1].startsWith('minor | F02 | src/a.js:12 | dup=F09 (not merged: no such finding) kind=style'),
        review.summary_lines[1]);
      assert.deepEqual(review.counts, { ...ZERO, major: 3, medium: 2, minor: 2, merged: 1 });
    });

    it('makes a dup that is neither none nor a finding id unclassified', () => {
      const review = parseReview(`${line('F01', { dup: 'maybe' })}\nFINDINGS 1\n`);
      assert.equal(review.findings[0].severity, 'unclassified');
      assert.match(review.findings[0].problems.join(' '), /dup=maybe/);
    });

    it('reads an empty card quote as none, and a quote with a pipe as one quote', () => {
      const review = parseReview([
        line('F01', { card: '""', reach: 'edge' }),
        line('F02', { card: '', reach: 'edge' }),
        line('F03', { card: '"run `npm test | tail` and see it pass"', kind: 'style', reach: '-' }),
        line('F04', { card: 'None', reach: 'edge' }),
        'FINDINGS 4',
      ].join('\n'));
      assert.deepEqual(review.findings.map((f) => f.severity), ['medium', 'medium', 'major', 'unclassified']);
      assert.equal(review.findings[0].answers.card, 'none');
      assert.equal(review.findings[1].answers.card, 'none');
      assert.equal(review.findings[2].answers.card, 'run `npm test | tail` and see it pass');
      assert.equal(review.findings[2].answers.kind, 'style');
    });

    it('counts from the lines and records a FINDINGS number that disagrees', () => {
      const review = parseReview(`${line('F01')}\n${line('F02', { kind: 'style', reach: '-' })}\nFINDINGS 3\n`);
      assert.equal(review.findings_mismatch, true);
      assert.equal(review.findings_claimed, 3);
      assert.deepEqual(review.counts, { ...ZERO, major: 1, minor: 1 });
      assert.equal(review.total_line, 'TOTAL major=1 medium=0 minor=1');
    });

    it('takes FINDINGS 0 with no finding lines as a complete clean review', () => {
      const review = parseReview('Read src/a.js and ran npm test; nothing wrong.\nFINDINGS 0\n');
      assert.equal(review.complete, true);
      assert.equal(review.severity_source, 'computed');
      assert.deepEqual(review.findings, []);
      assert.deepEqual(review.counts, ZERO);
      assert.equal(review.findings_mismatch, false);
      assert.deepEqual(review.summary_lines, []);
      assert.equal(review.total_line, 'TOTAL major=0 medium=0 minor=0');
    });

    it('does not take FINDINGS above 0 with no readable finding line as complete, even beside a TOTAL', () => {
      assert.equal(parseReview('Checked src/a.js.\nFINDINGS 2\n').complete, false);
      assert.equal(parseReview('Checked src/a.js.\n**F01** major issue in a.js\nFINDINGS 1\n').complete, false);
      assert.equal(parseReview('Checked src/a.js.\nFINDINGS 2\nTOTAL major=0 medium=0 minor=0\n').complete, false);
    });

    it('reads finding lines with leading markdown decoration', () => {
      const review = parseReview([
        line('**F01**'),
        line('- F02', { kind: 'style', reach: '-' }),
        line('`F03`', { kind: 'test-gap', reach: '-' }),
        line('- **F04**', { dup: 'F01', kind: 'doc-loose', reach: '-' }),
        'FINDINGS 4',
      ].join('\n'));
      assert.equal(review.complete, true);
      assert.equal(review.findings_mismatch, false);
      assert.deepEqual(review.findings.map((f) => [f.id, f.location, f.severity]), [
        ['F01', 'src/a.js:12', 'major'], ['F02', 'src/a.js:12', 'minor'],
        ['F03', 'src/a.js:12', 'medium'], ['F04', 'src/a.js:12', 'merged'],
      ]);
      const old = parseReview('**R01** | major | a.js:1 | bug | ran it | fix\n`R02` | minor | b.js:2 | nit | read | rename\n'
        + 'TOTAL major=1 medium=0 minor=1\n');
      assert.deepEqual(old.findings.map((f) => [f.id, f.severity]), [['R01', 'major'], ['R02', 'minor']]);
      assert.equal(old.findings_mismatch, false);
    });

    it('does not take an answer without FINDINGS or TOTAL as complete', () => {
      assert.equal(parseReview('Read src/a.js; nothing wrong.\n').complete, false);
      assert.equal(parseReview(`${line('F01')}\n`).complete, false);
      assert.equal(parseReview('FINDINGS <number of finding lines>\n').complete, false);
    });

    it('counts an old-format review from its lines when its TOTAL is wrong', () => {
      const review = parseReview('R01 | medium | a.js:3 | issue | saw | fix\nTOTAL major=3 medium=0 minor=0\n');
      assert.equal(review.complete, true);
      assert.equal(review.severity_source, 'reviewer');
      assert.deepEqual(review.counts, { ...ZERO, medium: 1 });
      assert.equal(review.findings_mismatch, true);
      assert.deepEqual(review.findings_claimed, { major: 3, medium: 0, minor: 0 });
      assert.deepEqual(review.findings, [{ id: 'R01', location: 'a.js:3', severity: 'medium' }]);
      assert.deepEqual(review.summary_lines, ['R01 | medium | a.js:3 | issue | saw | fix']);
      assert.equal(review.total_line, 'TOTAL major=0 medium=1 minor=0');
    });

    it('accepts a correct old-format review as it is', () => {
      const review = parseReview('R01 | major | a.js:1 | bug | ran it | fix\n'
        + 'R02 | minor | b.js:2 | nit | read it | rename\nTOTAL major=1 medium=0 minor=1\n');
      assert.equal(review.complete, true);
      assert.equal(review.severity_source, 'reviewer');
      assert.equal(review.findings_mismatch, false);
      assert.deepEqual(review.counts, { ...ZERO, major: 1, minor: 1 });
      assert.equal(review.total_line, 'TOTAL major=1 medium=0 minor=1');
    });
  });
});
