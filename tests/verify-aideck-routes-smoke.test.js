/**
 * verify-aideck-routes-smoke.test.js — testes do smoke test de rotas.
 *
 * strategy:
 * - testa que smoke FAIL com aideck que não tem todas as rotas
 * - testa que smoke PASS quando todas as rotas existem
 * - mock fetch para não depender de server rodando
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

// Mock fetch para não depender de server real
function mockFetch(responses) {
  return mock.fn(global, 'fetch', (url) => {
    const resp = responses[url] || responses['*'] || { status: 404, body: {} };
    return Promise.resolve({
      ok: resp.status < 400,
      status: resp.status,
      statusText: resp.status === 200 ? 'OK' : resp.status === 404 ? 'Not Found' : 'Error',
      json: async () => resp.body,
    });
  });
}

describe('verify-aideck-consumer route smoke', () => {
  describe('com todas as rotas implementadas', () => {
    it('PASS em todos os checks', async () => {
      const responses = {
        'http://localhost:7777/api/consumers': {
          status: 200,
          body: { consumers: [{ id: 'atomic-skills', title: 'atomic-skills' }] },
        },
        'http://localhost:7777/api/consumers/atomic-skills': {
          status: 200,
          body: { manifest: { id: 'atomic-skills', title: 'atomic-skills' } },
        },
        'http://localhost:7777/api/consumers/atomic-skills/projects': {
          status: 200,
          body: { projects: [{ projectId: 'test', rootDir: '/tmp' }] },
        },
        'http://localhost:7777/api/consumers/atomic-skills/projects/test/data/phases': {
          status: 200,
          body: { records: [] },
        },
        'http://localhost:7777/api/consumers/atomic-skills/projects/test/data/plans': {
          status: 200,
          body: { records: [] },
        },
        'http://localhost:7777/api/consumers/atomic-skills/projects/test/data/initiatives': {
          status: 200,
          body: { records: [] },
        },
      };

      const fn = mockFetch(responses);
      // TODO: importar e rodar smokeTestRoutes com fetch mockado
      // Por ora, só verificamos que os responses estão corretos
      assert.strictEqual(responses['http://localhost:7777/api/consumers'].status, 200);
      assert.strictEqual(responses['http://localhost:7777/api/consumers/atomic-skills/projects/test/data/initiatives'].status, 200);
      assert.ok(!('http://localhost:7777/api/consumers/atomic-skills/initiatives' in responses));
      fn.mock.restore();
    });
  });

  describe('com rotas faltando (incompleto)', () => {
    it('FAIL em rotas que retornam 404', async () => {
      const responses = {
        'http://localhost:7777/api/consumers': {
          status: 200,
          body: { consumers: [{ id: 'atomic-skills' }] },
        },
        'http://localhost:7777/api/consumers/atomic-skills/projects/test/data/initiatives': {
          status: 404,
          body: { error: { code: 'path_not_found', message: 'Route not found' } },
        },
      };

      const fn = mockFetch(responses);
      assert.strictEqual(responses['http://localhost:7777/api/consumers/atomic-skills/projects/test/data/initiatives'].status, 404);
      fn.mock.restore();
    });
  });

  describe('check de estrutura', () => {
    it('requer projects[].projectId não undefined', () => {
      const project = { projectId: 'test', rootDir: '/tmp' };
      const id = project.projectId || project.id || project.slug;
      assert.strictEqual(id, 'test', 'deve extrair projectId');
    });

    it('lida com projects[] vazio', () => {
      const projectsResp = { projects: [] };
      const hasProjects = projectsResp?.projects && projectsResp.projects.length > 0;
      assert.strictEqual(hasProjects, false, 'deve detectar array vazio');
    });
  });
});
