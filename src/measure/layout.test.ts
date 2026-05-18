import { test, describe } from 'node:test';
import assert from 'node:assert';
import { computeVerticalLayout } from './layout.js';

const EPS = 1e-9;
function approx(actual: number, expected: number, msg?: string) {
    assert.ok(
        Math.abs(actual - expected) < EPS,
        msg ?? `expected ${actual} ≈ ${expected}`
    );
}
function approxAll(actual: number[], expected: number[]) {
    assert.strictEqual(actual.length, expected.length, `length ${actual.length} ≠ ${expected.length}`);
    for (let i = 0; i < actual.length; i++) {
        approx(actual[i], expected[i], `[${i}]: ${actual[i]} ≠ ${expected[i]}`);
    }
}

describe('computeVerticalLayout', () => {
    test('empty input returns zeros', () => {
        const result = computeVerticalLayout([], 1);
        assert.deepStrictEqual(result.baselines, []);
        approx(result.minY, 0);
        approx(result.maxY, 0);
        approx(result.height, 0);
    });

    test('single line: baseline at 0, bounds from tight extents', () => {
        const result = computeVerticalLayout(
            [{ ascent: 10, descent: -2, tightTop: -8, tightBottom: 2 }],
            1
        );
        approxAll(result.baselines, [0]);
        approx(result.minY, -8);
        approx(result.maxY, 2);
        approx(result.height, 10);
    });

    test('two uniform-size lines, lineSpacing 1', () => {
        // Same ascent/descent on both lines → baseline gap = (ascent - descent) * 1 = 12
        const line = { ascent: 10, descent: -2, tightTop: -8, tightBottom: 2 };
        const result = computeVerticalLayout([line, line], 1);
        approxAll(result.baselines, [0, 12]);
        approx(result.minY, -8);             // line 0's top
        approx(result.maxY, 14);             // line 1's bottom (12 + 2)
        approx(result.height, 22);
    });

    test('two mixed-size lines: gap accounts for ascent difference (bug case)', () => {
        // The bug: old calculateTotalHeight assumed baseline gap = (prev.ascent - prev.descent) * lineSpacing.
        // Correct gap also adds (current.ascent - prev.ascent) because measureLine puts each line's
        // baseline at y = maxAscent within its own logical box.
        const line0 = { ascent: 1, descent: -0.25, tightTop: -0.75, tightBottom: 0.25 };
        const line1 = { ascent: 2, descent: -0.5,  tightTop: -1.5,  tightBottom: 0.5 };
        const result = computeVerticalLayout([line0, line1], 1);

        // baseline gap = (1 - (-0.25)) * 1 + (2 - 1) = 1.25 + 1 = 2.25
        approxAll(result.baselines, [0, 2.25]);
        // line 0 top = -0.75, line 1 top = 2.25 - 1.5 = 0.75 → minY = -0.75
        approx(result.minY, -0.75);
        // line 0 bottom = 0.25, line 1 bottom = 2.25 + 0.5 = 2.75 → maxY = 2.75
        approx(result.maxY, 2.75);
        approx(result.height, 3.5);
    });

    test('three lines where the middle line has the extreme bottom', () => {
        // Middle line has an exaggerated descender that beats the last line's bottom.
        // Confirms the all-lines scan, not just first/last endpoints.
        const small = { ascent: 1, descent: -0.2, tightTop: -0.7, tightBottom: 0.2 };
        const middle = { ascent: 1, descent: -0.2, tightTop: -0.7, tightBottom: 2.0 };
        const result = computeVerticalLayout([small, middle, small], 1);

        // gap 0→1 = (1 - (-0.2)) * 1 + (1 - 1) = 1.2; gap 1→2 = (1 - (-0.2)) * 1 + 0 = 1.2
        approxAll(result.baselines, [0, 1.2, 2.4]);
        // minY: line 0 top = -0.7, line 1 top = 1.2 - 0.7 = 0.5, line 2 top = 2.4 - 0.7 = 1.7
        approx(result.minY, -0.7);
        // maxY: line 0 bottom = 0.2, line 1 bottom = 1.2 + 2.0 = 3.2 ←, line 2 bottom = 2.4 + 0.2 = 2.6
        approx(result.maxY, 3.2);
        approx(result.height, 3.9);
    });

    test('lineSpacing > 1 scales the baseline-to-baseline gap', () => {
        const line = { ascent: 10, descent: -2, tightTop: -8, tightBottom: 2 };
        const result = computeVerticalLayout([line, line], 1.5);
        // gap = (10 - (-2)) * 1.5 + 0 = 18
        approxAll(result.baselines, [0, 18]);
        approx(result.minY, -8);
        approx(result.maxY, 20);
        approx(result.height, 28);
    });

    test('lineSpacing applies only to the prev-line-height portion of the gap, not the ascent correction', () => {
        // With mixed sizes, the formula is:
        //   gap = (prev.ascent - prev.descent) * lineSpacing + (current.ascent - prev.ascent)
        // The (current.ascent - prev.ascent) term is the baseline shift inside each line's box,
        // independent of lineSpacing.
        const line0 = { ascent: 1, descent: -0.25, tightTop: -0.75, tightBottom: 0.25 };
        const line1 = { ascent: 2, descent: -0.5,  tightTop: -1.5,  tightBottom: 0.5 };
        const result = computeVerticalLayout([line0, line1], 2);
        // gap = (1.25) * 2 + 1 = 3.5
        approxAll(result.baselines, [0, 3.5]);
        // minY: line 0 top = -0.75; line 1 top = 3.5 - 1.5 = 2.0; minY = -0.75
        approx(result.minY, -0.75);
        // maxY: line 0 bottom = 0.25; line 1 bottom = 3.5 + 0.5 = 4.0
        approx(result.maxY, 4);
        approx(result.height, 4.75);
    });
});
