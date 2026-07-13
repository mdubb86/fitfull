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

test('blur inflates symmetrically by 2 * blur * tokenSize on all sides', () => {
    const shadow: Shadow = { offsetX: 0, offsetY: 0, blur: 0.02 };
    const out = inflateForShadow(base, shadow, 1);
    const extra = 2 * 0.02; // 0.04
    assert.equal(out.advanceWidth, 10 + 2 * extra);
    assert.equal(out.leftBearing, 1 - extra);
    assert.equal(out.tightRight, 9 + extra);
    assert.equal(out.tightTop, -8 - extra);
    assert.equal(out.tightBottom, 2 + extra);
});

test('offset + blur combine additively', () => {
    const shadow: Shadow = { offsetX: 0.05, offsetY: 0.03, blur: 0.02 };
    const out = inflateForShadow(base, shadow, 1);
    const blurExtra = 2 * 0.02;
    // Group additions to match the impl's evaluation order — the sums are
    // mathematically identical, but IEEE-754 rounding differs by 1 ULP if
    // the parenthesization changes. (Long-standing follow-up: switch all
    // these to epsilon comparisons and restore natural impl grouping.)
    const leftExtra = 0 + blurExtra;
    const rightExtra = 0.05 + blurExtra;
    assert.equal(out.advanceWidth, 10 + (leftExtra + rightExtra));
    assert.equal(out.tightRight, 9 + 0.05 + blurExtra);
    assert.equal(out.leftBearing, 1 - blurExtra);
    assert.equal(out.tightTop, -8 - blurExtra);
    assert.equal(out.tightBottom, 2 + 0.03 + blurExtra);
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
