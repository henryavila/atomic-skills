import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parse } from '../src/yaml.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

describe('YAML parser', () => {
  it('parses simple key-value pairs', () => {
    const result = parse('name: as-fix\nversion: 1.0.0');
    assert.strictEqual(result.name, 'as-fix');
    assert.strictEqual(result.version, '1.0.0');
  });

  it('parses nested objects', () => {
    const result = parse('core:\n  fix:\n    name: as-fix');
    assert.strictEqual(result.core.fix.name, 'as-fix');
  });

  it('strips quotes from values', () => {
    const result = parse("description: 'hello world'");
    assert.strictEqual(result.description, 'hello world');
  });

  it('parses multiline strings with pipe', () => {
    const result = parse('desc:\n  pt: |\n    line one\n    line two\n  en: |\n    eng one');
    assert.ok(result.desc.pt.includes('line one'));
    assert.ok(result.desc.pt.includes('line two'));
    assert.ok(result.desc.en.includes('eng one'));
  });

  it('parses the actual module.yaml structure', () => {
    const input = `name: memory
display_name:
  pt: Memória
  en: Memory
description:
  pt: |
    Sistema de memória persistente.
  en: |
    Persistent memory system.
variables:
  memory_path:
    description:
      pt: Diretório da memória
      en: Memory directory
    default: .ai/memory/`;
    const result = parse(input);
    assert.strictEqual(result.name, 'memory');
    assert.strictEqual(result.display_name.pt, 'Memória');
    assert.strictEqual(result.description.pt, 'Sistema de memória persistente.');
    assert.strictEqual(result.variables.memory_path.default, '.ai/memory/');
  });

  it('parses the actual skills.yaml structure', () => {
    const input = `core:
  fix:
    name: as-fix
    description: "Root cause diagnosis + TDD fix."
  resume:
    name: as-resume
    description: "Investigate project context."
modules:
  memory:
    init-memory:
      name: as-init-memory
      description: "Initialize persistent memory."`;
    const result = parse(input);
    assert.strictEqual(result.core.fix.name, 'as-fix');
    assert.strictEqual(result.core.resume.name, 'as-resume');
    assert.strictEqual(result.modules.memory['init-memory'].name, 'as-init-memory');
  });

  it('parses scope field from module.yaml', () => {
    const content = readFileSync(
      join(__dirname, '..', 'skills', 'modules', 'memory', 'module.yaml'), 'utf8');
    const result = parse(content);
    assert.strictEqual(result.scope, 'both');
  });

  it('parses as-status from the real skills manifest', () => {
    const content = readFileSync(
      join(__dirname, '..', 'meta', 'skills.yaml'),
      'utf8'
    );
    const result = parse(content);
    assert.strictEqual(result.core.status.name, 'as-status');
  });
});
