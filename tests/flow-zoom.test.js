/**
 * Per-process zoom: localStorage key is as-flow-zoom:<slug>.
 * Different processes do not share a scale.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FLOW_ZOOM_KEY_PREFIX,
  FLOW_ZOOM_MIN,
  FLOW_ZOOM_MAX,
  zoomStorageKey,
  clampFlowZoom,
} from '../scripts/lib/flow-zoom.js';

describe('zoomStorageKey', () => {
  it('is unique per process slug', () => {
    assert.equal(FLOW_ZOOM_KEY_PREFIX, 'as-flow-zoom:');
    assert.equal(zoomStorageKey('sugestao-necessidade-pdti'), 'as-flow-zoom:sugestao-necessidade-pdti');
    assert.equal(zoomStorageKey('project-flow'), 'as-flow-zoom:project-flow');
    assert.notEqual(zoomStorageKey('sugestao-necessidade-pdti'), zoomStorageKey('project-flow'));
  });

  it('falls back when slug is empty', () => {
    assert.equal(zoomStorageKey(''), 'as-flow-zoom:default');
    assert.equal(zoomStorageKey(null), 'as-flow-zoom:default');
  });
});

describe('clampFlowZoom', () => {
  it('keeps a value inside the engine range', () => {
    assert.equal(clampFlowZoom(1), 1);
    assert.equal(clampFlowZoom(2.5), 2.5);
    assert.equal(clampFlowZoom(0.3), FLOW_ZOOM_MIN);
    assert.equal(clampFlowZoom(9), FLOW_ZOOM_MAX);
    assert.equal(clampFlowZoom(0.01), FLOW_ZOOM_MIN);
    assert.equal(clampFlowZoom('1.2'), 1.2);
  });

  it('defaults to 1 when the stored value is not a number', () => {
    assert.equal(clampFlowZoom(undefined), 1);
    assert.equal(clampFlowZoom('nope'), 1);
    assert.equal(clampFlowZoom(NaN), 1);
    assert.equal(clampFlowZoom(''), 1);
  });
});
