import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TokenMetrics, Shadow } from '../types.js';
import { inflateForShadow, shadowVisibleSigma, PERCEPTIBILITY_THRESHOLD } from './effective-bounds.js';

const EPS = 1e-9;
function close(a: number, b: number): boolean { return Math.abs(a - b) < EPS; }

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

test('shadowVisibleSigma is alpha-aware — σ derived from alpha to reach the perceptibility threshold', () => {
    const T = PERCEPTIBILITY_THRESHOLD;
    const expected = (alpha: number) => alpha <= T ? 0 : Math.sqrt(-2 * Math.log(T / alpha));
    // No color → assume opaque → uses full σ derived from alpha=1.
    assert.ok(close(shadowVisibleSigma(undefined),         expected(1)));
    assert.ok(close(shadowVisibleSigma('#000000'),         expected(1)));
    assert.ok(close(shadowVisibleSigma('rgba(0,0,0,1)'),   expected(1)));
    // Semi-transparent → smaller σ.
    assert.ok(close(shadowVisibleSigma('rgba(0,0,0,0.75)'), expected(0.75)));
    // Alpha ≤ threshold → no reservation (peak already at/below threshold).
    assert.equal(shadowVisibleSigma('rgba(0,0,0,0.1)'), 0);
    assert.equal(shadowVisibleSigma(`rgba(0,0,0,${T})`), 0);
    // 8-hex alpha channel: 0xE0/255 ≈ 0.878 (above 0.5 threshold).
    assert.ok(close(shadowVisibleSigma('#000000E0'),       expected(0xE0 / 255)));
});

test('blur alone inflates symmetrically by σ * blur * tokenSize', () => {
    const shadow: Shadow = { offsetX: 0, offsetY: 0, blur: 0.02 };
    const out = inflateForShadow(base, shadow, 1);
    // Opaque (no color → alpha=1 → σ ≈ 3.03), blur=0.02 tokenSize=1 → tail ≈ 0.0607.
    const tail = shadowVisibleSigma(undefined) * 0.02 * 1;
    assert.ok(close(out.advanceWidth, 10 + 2 * tail));
    assert.ok(close(out.leftBearing,  1 - tail));
    assert.ok(close(out.tightRight,   9 + tail));
    assert.ok(close(out.tightTop,    -8 - tail));
    assert.ok(close(out.tightBottom,  2 + tail));
});

test('lower alpha → smaller tail (text shrinks less for faint shadows)', () => {
    const opaque: Shadow = { offsetX: 0, offsetY: 0, blur: 0.02, color: 'rgba(0,0,0,1)' };
    const faint:  Shadow = { offsetX: 0, offsetY: 0, blur: 0.02, color: 'rgba(0,0,0,0.1)' };
    const outOpaque = inflateForShadow(base, opaque, 1);
    const outFaint  = inflateForShadow(base, faint, 1);
    assert.ok(outOpaque.tightRight > outFaint.tightRight,
        `opaque tail (${outOpaque.tightRight - 9}) should exceed faint tail (${outFaint.tightRight - 9})`);
});

test('blur + offset combined: same-sign side gets offset + tail, opposite gets max(0, tail - offset)', () => {
    const shadow: Shadow = { offsetX: 0.05, offsetY: 0.03, blur: 0.02 };
    const out = inflateForShadow(base, shadow, 1);
    const tail = shadowVisibleSigma(undefined) * 0.02 * 1; // ≈ 0.0607
    // Right side (offset side, sx=+0.05): rightExtra = max(0, tail + sx) = tail + 0.05.
    // Left side (opposite, sxNeg=0, sxPos=0.05): leftExtra = max(0, tail - sx) = tail - 0.05 (positive since tail > sx).
    const leftExtra  = Math.max(0, tail - 0.05);
    const rightExtra = Math.max(0, tail + 0.05);
    const topExtra    = Math.max(0, tail - 0.03);
    const bottomExtra = Math.max(0, tail + 0.03);
    assert.ok(close(out.advanceWidth, 10 + leftExtra + rightExtra));
    assert.ok(close(out.tightRight,   9 + rightExtra));
    assert.ok(close(out.leftBearing,  1 - leftExtra));
    assert.ok(close(out.tightTop,    -8 - topExtra));
    assert.ok(close(out.tightBottom,  2 + bottomExtra));
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
