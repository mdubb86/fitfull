import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineWidthVariance, getOrComputeTokenMetrics } from './wrapping.js';
import { NodeFontManager } from '../fonts/node-font-manager.js';
import { measureSingleTokenMetrics, inflateForShadow } from '../measure/index.js';
import type { Token } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', '..', 'fonts');
const INTER_BOLD = join(FONTS_DIR, 'Inter-Bold.ttf');

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

test('getOrComputeTokenMetrics: fallback path inflates for the top-level shadow default', async () => {
    // Regression for the bug found in Task 7 review: trimLineWhitespace() clones
    // boundary tokens via spread, so they miss tokenMetricsMap (reference equality)
    // and getOrComputeTokenMetrics() falls back to measureSingleTokenMetrics, which
    // knows nothing about shadows. The shadow's bbox growth was silently dropped for
    // these tokens, letting the fitter pick a scale that lets the shadow bleed past
    // the box.
    //
    // Reviewer repro: token { text: 'Beta ', shadow: {offsetX:0.3, offsetY:0.3} } —
    // expected inflated tightRight ~4.71, observed 4.11 (identical to non-shadow).
    const fonts = await NodeFontManager.create();
    await fonts.loadForTokens(
        [{ text: 'Beta', size: 1, font: INTER_BOLD, weight: 'bold' }],
        { fonts: [INTER_BOLD], _hint: 'api' }
    );

    // Simulates the clone trimLineWhitespace() produces via `{ ...first, text: trimmedText }`:
    // a brand-new Token object with no per-token `shadow`, so it must fall back to the
    // top-level default threaded through by the caller.
    const trimmedClone: Token = { text: 'Beta', size: 1, font: INTER_BOLD, weight: 'bold' };
    const shadow = { offsetX: 0.3, offsetY: 0.3 };

    const baseline = measureSingleTokenMetrics(trimmedClone, fonts);
    const expected = inflateForShadow(baseline, shadow, trimmedClone.size);

    // Fresh, empty map on every call so we always exercise the fallback branch.
    const noShadowResult = getOrComputeTokenMetrics(trimmedClone, new Map(), fonts, undefined);
    const shadowResult = getOrComputeTokenMetrics(trimmedClone, new Map(), fonts, shadow);

    assert.equal(noShadowResult.tightRight, baseline.tightRight,
        'sanity: no shadow -> fallback matches unshadowed measurement');
    assert.equal(shadowResult.tightRight, expected.tightRight,
        `expected inflated tightRight ${expected.tightRight}, got ${shadowResult.tightRight} ` +
        `(bug: fallback dropped the top-level shadow for a boundary-trimmed clone)`);
    assert.ok(shadowResult.tightRight > noShadowResult.tightRight,
        'shadow must widen the fallback-computed tightRight');
});

test('getOrComputeTokenMetrics: per-token shadow overrides the top-level default in the fallback path', async () => {
    const fonts = await NodeFontManager.create();
    await fonts.loadForTokens(
        [{ text: 'Beta', size: 1, font: INTER_BOLD, weight: 'bold' }],
        { fonts: [INTER_BOLD], _hint: 'api' }
    );

    const perTokenShadow = { offsetX: 0.01, offsetY: 0.01 };
    const topLevelShadow = { offsetX: 0.3, offsetY: 0.3 };
    // The trimmed clone preserves `token.shadow` through the spread (`{ ...first, text }`),
    // so a per-token override must still win over the top-level default.
    const trimmedClone: Token = { text: 'Beta', size: 1, font: INTER_BOLD, weight: 'bold', shadow: perTokenShadow };

    const baseline = measureSingleTokenMetrics(trimmedClone, fonts);
    const expected = inflateForShadow(baseline, perTokenShadow, trimmedClone.size);

    const result = getOrComputeTokenMetrics(trimmedClone, new Map(), fonts, topLevelShadow);

    assert.equal(result.tightRight, expected.tightRight,
        'per-token shadow must be used instead of the top-level default');
});
