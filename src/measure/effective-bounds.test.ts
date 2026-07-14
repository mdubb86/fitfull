import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TokenMetrics, Shadow } from '../types.js';
import { inflateForShadow } from './effective-bounds.js';

// Baseline metrics used across cases. Values chosen so that
// each field is distinct and easy to eyeball in assertions.
const base: TokenMetrics = {
    advanceWidth: 10,
    kerningDelta: 0,
    leftBearing: 1,
    tightRight: 9,
    tightTop: -8,     // above baseline
    tightBottom: 2,   // below baseline
    ascent: 10,
    descent: -3,
};

test('undefined shadow returns metrics unchanged', () => {
    const out = inflateForShadow(base, undefined, 1);
    assert.deepEqual(out, base);
});

test('positive offsetX grows advanceWidth and tightRight; leftBearing unchanged', () => {
    const shadow: Shadow = { offsetX: 0.05, offsetY: 0 };
    const out = inflateForShadow(base, shadow, 1);
    // 0.05 em × 1 unit-size = 0.05
    assert.equal(out.advanceWidth, 10 + 0.05);
    assert.equal(out.tightRight, 9 + 0.05);
    assert.equal(out.leftBearing, 1);
});

test('negative offsetX grows advanceWidth and shifts leftBearing further left', () => {
    const shadow: Shadow = { offsetX: -0.1, offsetY: 0 };
    const out = inflateForShadow(base, shadow, 1);
    // 0.1 em × 1 unit-size = 0.1 on the left
    assert.equal(out.advanceWidth, 10 + 0.1);
    assert.equal(out.leftBearing, 1 - 0.1);
    assert.equal(out.tightRight, 9);
});

test('positive offsetY grows tightBottom', () => {
    const shadow: Shadow = { offsetX: 0, offsetY: 0.05 };
    const out = inflateForShadow(base, shadow, 1);
    assert.equal(out.tightTop, -8);
    assert.equal(out.tightBottom, 2 + 0.05);
});

test('negative offsetY grows tightTop (moves upward)', () => {
    const shadow: Shadow = { offsetX: 0, offsetY: -0.05 };
    const out = inflateForShadow(base, shadow, 1);
    assert.equal(out.tightTop, -8 - 0.05);
    assert.equal(out.tightBottom, 2);
});

test('blur alone does not inflate — blur is a soft presentation effect not counted at fit time', () => {
    const shadow: Shadow = { offsetX: 0, offsetY: 0, blur: 0.02 };
    const out = inflateForShadow(base, shadow, 1);
    // Everything passes through unchanged when only blur is set.
    assert.equal(out.advanceWidth, base.advanceWidth);
    assert.equal(out.leftBearing, base.leftBearing);
    assert.equal(out.tightRight, base.tightRight);
    assert.equal(out.tightTop, base.tightTop);
    assert.equal(out.tightBottom, base.tightBottom);
});

test('blur is ignored even when combined with offset', () => {
    const shadow: Shadow = { offsetX: 0.05, offsetY: 0.03, blur: 0.02 };
    const out = inflateForShadow(base, shadow, 1);
    // Only offset counts. Blur value is ignored at fit time.
    assert.equal(out.advanceWidth, 10 + 0.05);
    assert.equal(out.tightRight, 9 + 0.05);
    assert.equal(out.leftBearing, 1);
    assert.equal(out.tightTop, -8);
    assert.equal(out.tightBottom, 2 + 0.03);
});

test('tokenSize scales the em-relative offset', () => {
    const shadow: Shadow = { offsetX: 0.05, offsetY: 0 };
    const out = inflateForShadow(base, shadow, 2);
    // 0.05 em × 2 = 0.1
    assert.equal(out.tightRight, 9 + 0.1);
    assert.equal(out.advanceWidth, 10 + 0.1);
});

test('kerningDelta, ascent, descent pass through unchanged', () => {
    const withKern: TokenMetrics = { ...base, kerningDelta: 0.3 };
    const shadow: Shadow = { offsetX: 0.05, offsetY: 0.05, blur: 0.01 };
    const out = inflateForShadow(withKern, shadow, 1);
    assert.equal(out.kerningDelta, 0.3);
    assert.equal(out.ascent, base.ascent);
    assert.equal(out.descent, base.descent);
});
