import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineWidthVariance } from './wrapping.js';

test('lineWidthVariance: uniform widths produce zero variance', () => {
    assert.equal(lineWidthVariance([100, 100, 100, 100], 300), 0);
});

test('lineWidthVariance: empty input returns 0', () => {
    assert.equal(lineWidthVariance([], 300), 0);
});

test('lineWidthVariance: single line returns 0', () => {
    assert.equal(lineWidthVariance([100], 300), 0);
});

test('lineWidthVariance: outlier increases the score', () => {
    const uniform = lineWidthVariance([100, 100, 100, 100, 100], 300);
    const orphan = lineWidthVariance([20, 100, 100, 100, 100], 300);
    assert.ok(orphan > uniform, `expected orphan ${orphan} > uniform ${uniform}`);
});

test('lineWidthVariance: scales by box width', () => {
    // same stddev, different boxWidth → different normalized variance
    const narrow = lineWidthVariance([10, 50], 100);
    const wide = lineWidthVariance([10, 50], 1000);
    assert.ok(narrow > wide, 'narrower box magnifies variance');
});

test('lineWidthVariance: zero box width returns 0', () => {
    assert.equal(lineWidthVariance([10, 50], 0), 0);
});
