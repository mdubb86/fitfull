import { test, describe } from 'node:test';
import assert from 'node:assert';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Fitfull } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', 'fonts');
const INTER_REGULAR = join(FONTS_DIR, 'Inter-Regular.ttf');
const INTER_BOLD = join(FONTS_DIR, 'Inter-Bold.ttf');
const PLAYFAIR_ITALIC = join(FONTS_DIR, 'PlayfairDisplay-Italic.woff2');

describe('Fitfull', () => {
    test('fit with text input returns svg and layout', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'Hello World',
            font: INTER_REGULAR,
            width: 400,
            height: 100,
        });

        assert.ok(result.svg.startsWith('<svg'));
        assert.ok(result.width > 0);
        assert.ok(result.height > 0);
        assert.ok(result.arrangements > 0);
    });

    test('fit with html input returns svg and layout', async () => {
        const ff = Fitfull.create();
        const html = `<body style="font-family: inter; font-size: 12px">Hello World</body>`;
        const result = await ff.fit({
            html,
            fonts: [INTER_REGULAR],
            width: 400,
            height: 100,
        });
        assert.ok(result.svg.startsWith('<svg'));
        assert.ok(result.lines.length >= 1);
    });

    test('fit with token input returns svg and layout', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            tokens: [
                { text: 'Hello', size: 12, font: INTER_REGULAR, weight: 'regular' },
                { text: ' ', size: 12, font: INTER_REGULAR, weight: 'regular' },
                { text: 'World', size: 12, font: INTER_REGULAR, weight: 'regular' },
            ],
            width: 400,
            height: 100,
        });

        assert.ok(result.svg.startsWith('<svg'));
    });

    test('singleton returns same instance', () => {
        const a = Fitfull.get();
        const b = Fitfull.get();
        assert.strictEqual(a, b);
    });

    test('create returns new instances', () => {
        const a = Fitfull.create();
        const b = Fitfull.create();
        assert.notStrictEqual(a, b);
    });

    test('fit returns empty result for whitespace-only text', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: '   ',
            font: INTER_REGULAR,
            width: 400,
            height: 100,
        });
        assert.strictEqual(result.lines.length, 0);
        assert.strictEqual(result.width, 0);
        assert.strictEqual(result.height, 0);
        assert.strictEqual(result.arrangements, 0);
    });

    test('fit rejects invalid color', async () => {
        const ff = Fitfull.create();
        await assert.rejects(
            ff.fit({
                text: 'Hello',
                font: INTER_REGULAR,
                width: 400,
                height: 100,
                color: 'red"/><script>alert(1)</script>',
            }),
            /Invalid color/
        );
    });

    test('fit accepts fonts array for token mode', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            tokens: [
                { text: 'Hello', size: 12, font: 'inter', weight: 'regular' },
                { text: ' ', size: 12, font: 'inter', weight: 'regular' },
                { text: 'World', size: 12, font: 'inter', weight: 'regular' },
            ],
            fonts: [INTER_REGULAR],
            width: 400,
            height: 100,
        });
        assert.ok(result.svg.startsWith('<svg'));
        assert.ok(result.lines.length >= 1);
    });

    test('fit accepts valid hex color', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'Hello',
            font: INTER_REGULAR,
            width: 400,
            height: 100,
            color: '#ff0000',
        });
        assert.ok(result.svg.includes('ff0000'));
    });

    test('fit throws when token count exceeds maxTokens', async () => {
        const ff = Fitfull.create();
        const manyTokens = Array.from({ length: 50 }, (_, i) => [
            { text: `Word${i}`, size: 12, font: INTER_REGULAR, weight: 'regular' as const },
            { text: ' ', size: 12, font: INTER_REGULAR, weight: 'regular' as const },
        ]).flat();

        await assert.rejects(
            ff.fit({
                tokens: manyTokens,
                width: 400,
                height: 100,
                maxTokens: 10,
            }),
            /Input too large: 100 tokens \(max 10\)/
        );
    });

    test('fit succeeds when token count equals maxTokens', async () => {
        const ff = Fitfull.create();
        const tokens = [
            { text: 'Hello', size: 12, font: INTER_REGULAR, weight: 'regular' as const },
            { text: ' ', size: 12, font: INTER_REGULAR, weight: 'regular' as const },
            { text: 'World', size: 12, font: INTER_REGULAR, weight: 'regular' as const },
        ];
        const result = await ff.fit({
            tokens,
            width: 400,
            height: 100,
            maxTokens: 3,
        });
        assert.ok(result.lines.length >= 1);
    });

    test('text mode with \\n produces multiple lines', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'Hello\nWorld\nMulti-line',
            font: INTER_REGULAR,
            width: 200,
            height: 150,
        });
        assert.equal(result.lines.length, 3, 'should produce 3 lines from \\n separators');
        assert.equal(result.lines[0], 'Hello');
        assert.equal(result.lines[1], 'World');
        assert.equal(result.lines[2], 'Multi-line');
    });

    test('fit throws on timeout', async () => {
        const ff = Fitfull.create();
        const tokens = Array.from({ length: 100 }, (_, i) => [
            { text: `Word${i}`, size: 12, font: INTER_REGULAR, weight: 'regular' as const },
            { text: ' ', size: 12, font: INTER_REGULAR, weight: 'regular' as const },
        ]).flat();

        await assert.rejects(
            ff.fit({
                tokens,
                width: 400,
                height: 100,
                maxTokens: Infinity, // disable token cap
                timeout: 1,          // 1ms — fires immediately
            }),
            /Fit timed out/
        );
    });

    test('FitResult exposes textWidth and textHeight (text mode)', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'Hello World',
            font: INTER_REGULAR,
            width: 400,
            height: 100,
        });
        assert.ok(typeof result.textWidth === 'number', 'textWidth is a number');
        assert.ok(typeof result.textHeight === 'number', 'textHeight is a number');
        assert.ok(result.textWidth > 0, 'textWidth is positive');
        assert.ok(result.textHeight > 0, 'textHeight is positive');
        assert.ok(result.textWidth <= result.width,
            `textWidth (${result.textWidth}) must fit inside box width (${result.width})`);
        assert.ok(result.textHeight <= result.height,
            `textHeight (${result.textHeight}) must fit inside box height (${result.height})`);
    });

    test('FitResult textWidth/textHeight are 0 for empty input', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: '',
            font: INTER_REGULAR,
            width: 400,
            height: 100,
        });
        assert.strictEqual(result.textWidth, 0);
        assert.strictEqual(result.textHeight, 0);
    });

    test('per-token color overrides top-level color', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            tokens: [
                { text: 'red', size: 12, font: INTER_REGULAR, weight: 'regular', color: '#ff0000' },
                { text: ' ', size: 12, font: INTER_REGULAR, weight: 'regular' },
                { text: 'blue', size: 12, font: INTER_REGULAR, weight: 'regular', color: 'blue' },
                { text: ' default', size: 12, font: INTER_REGULAR, weight: 'regular' },
            ],
            width: 400,
            height: 100,
            color: 'green',
        });
        assert.ok(result.svg.includes('fill="#ff0000"'), 'svg should contain per-token red');
        assert.ok(result.svg.includes('fill="blue"'), 'svg should contain per-token blue');
        assert.ok(result.svg.includes('fill="green"'), 'svg should contain fallback green for tokens without color');
    });

    test('invalid per-token color throws', async () => {
        const ff = Fitfull.create();
        await assert.rejects(
            ff.fit({
                tokens: [
                    { text: 'bad', size: 12, font: INTER_REGULAR, weight: 'regular', color: 'red"/><script>alert(1)</script>' },
                ],
                width: 400,
                height: 100,
            }),
            /Invalid .* color/
        );
    });

    test('regression: 2-line strategy must not return an arrangement whose layout overflows height', async () => {
        const ff = Fitfull.create();
        const tokens = [
            { text: 'Ship', size: 1,   font: INTER_REGULAR, weight: 'regular' as const },
            { text: ' ',    size: 1,   font: INTER_REGULAR, weight: 'regular' as const },
            { text: 'type', size: 1,   font: INTER_REGULAR, weight: 'regular' as const },
            { text: ' ',    size: 1,   font: INTER_REGULAR, weight: 'regular' as const },
            { text: 'that', size: 1,   font: INTER_REGULAR, weight: 'regular' as const },
            { text: ' ',    size: 1,   font: INTER_REGULAR, weight: 'regular' as const },
            { text: 'fits', size: 1.9, font: INTER_BOLD,    weight: 'bold'    as const },
            { text: '.',    size: 1,   font: INTER_BOLD,    weight: 'bold'    as const },
        ];

        // Currently throws: "Output height 202 exceeds constraint 140 at scale=70.575"
        // A 1-line fit exists (~460×72) so auto-line-count must not error here.
        const result = await ff.fit({
            tokens,
            width: 460,
            height: 140,
            wrap: 'balanced',
            align: 'center',
        });

        assert.ok(result.height <= 140 + 0.01, `height ${result.height} > 140`);
        assert.ok(result.width  <= 460 + 0.01, `width  ${result.width}  > 460`);
    });

    test('regression: strategy and validator must agree on glyph bbox for italic outlines', async () => {
        // Bug: measureToken used path.getBoundingBox() which returns the convex hull of all
        // Bezier control points — an over-estimate for curves whose off-curve handles fall
        // outside the rendered outline. The strategy used getTightBounds (true glyph bbox).
        // For Playfair italic glyphs the two disagree by enough to exceed FIT_TOLERANCE,
        // so a fit the strategy validates is rejected by the post-hoc validator with
        // "Output width N exceeds constraint M". Inter Regular/Bold don't trigger this —
        // an italic outline is required.
        const ff = Fitfull.create();
        const tokens = [
            { text: 'Ship',  size: 1,   font: INTER_REGULAR,   weight: 'regular' as const },
            { text: ' ',     size: 1,   font: INTER_REGULAR,   weight: 'regular' as const },
            { text: 'type',  size: 1,   font: PLAYFAIR_ITALIC, weight: 'italic'  as const },
            { text: ' ',     size: 1,   font: INTER_REGULAR,   weight: 'regular' as const },
            { text: 'that',  size: 1,   font: INTER_REGULAR,   weight: 'regular' as const },
            { text: ' ',     size: 1,   font: INTER_REGULAR,   weight: 'regular' as const },
            { text: 'fits.', size: 1.5, font: INTER_BOLD,      weight: 'bold'    as const },
        ];

        const result = await ff.fit({
            tokens,
            width: 469,
            height: 554,
            wrap: 'balanced',
            align: 'center',
            lineSpacing: 0.8,
            minLines: 1,
            maxLines: 3,
        });

        assert.ok(result.width  <= 469 + 0.01, `width  ${result.width}  > 469`);
        assert.ok(result.height <= 554 + 0.01, `height ${result.height} > 554`);
    });

    test('regression: shadow + boundary-trimmed token still fits and renders without throwing', async () => {
        // Companion end-to-end smoke test for the boundary-trim shadow bug (see the
        // targeted unit-level regression tests in src/fitter/wrapping.test.ts, which
        // directly assert on the inflated metrics — FitResult.width/height are the
        // text's tight glyph bbox and never include shadow extent, so they can't
        // observe this bug directly). This just exercises the full greedy-wrap +
        // shadow + trailing-whitespace-token path end-to-end and confirms the box
        // constraint (computeBestFit's own post-hoc validator) still holds.
        const ff = Fitfull.create();
        const tokens = [
            { text: 'Alpha ', size: 1, font: INTER_BOLD, weight: 'bold' as const },
        ];
        const shadow = { offsetX: 0.3, offsetY: 0.3 };
        const result = await ff.fit({
            tokens,
            width: 200,
            height: 80,
            wrap: 'greedy',
            align: 'left',
            shadow,
        } as any);

        assert.ok(result.width  <= 200 + 0.01, `width ${result.width} exceeds 200`);
        assert.ok(result.height <= 80 + 0.01, `height ${result.height} exceeds 80`);
    });

    test('regression: shadow shrinks scale vs shadow-less fit', async () => {
        const ff = Fitfull.create();
        const tokens = [
            { text: 'Hello', size: 1, font: INTER_BOLD, weight: 'bold' as const },
            { text: ' ',     size: 1, font: INTER_BOLD, weight: 'bold' as const },
            { text: 'World', size: 1, font: INTER_BOLD, weight: 'bold' as const },
        ];
        const noShadow = await ff.fit({
            tokens,
            width: 240,
            height: 80,
            wrap: 'greedy',
            align: 'left',
        });
        const withShadow = await ff.fit({
            tokens,
            width: 240,
            height: 80,
            wrap: 'greedy',
            align: 'left',
            shadow: { offsetX: 0.1, offsetY: 0.1, blur: 0.05 },
        });
        // Deviation from the brief: `maxTextHeight`/`minTextHeight` are NOT a
        // shadow-blind proxy for the chosen scale — verified empirically while
        // implementing this test. `Fitter.computeBestFit` derives them from
        // `maxTightHeight`, which is measured on the *shadow-inflated*
        // per-token metrics (see `inflateForShadow` mutating `allMetrics`
        // before `maxTightHeight`/`minTightHeight` are computed in
        // src/fitter/fitter.ts). So `maxTextHeight` bakes in the shadow's
        // extra vertical padding on top of the shrunk scale, and it can come
        // out *larger* with shadow than without even though the underlying
        // glyph scale shrank (measured: no-shadow maxTextHeight=32.03,
        // with-shadow maxTextHeight=40.58 for this exact case — asserting
        // `<` on maxTextHeight would fail).
        //
        // `textHeight` (and `result.height`, its layout-level twin) is the
        // tight glyph bbox of the *rendered* text at the chosen scale — the
        // same shadow-blind quantity documented on `FitResult` — so it tracks
        // the fitter's chosen scale directly and is the correct observable
        // proxy for "shadow shrank the scale".
        assert.ok(
            withShadow.textHeight < noShadow.textHeight,
            `expected shadow to shrink the chosen scale (via textHeight); got no-shadow=${noShadow.textHeight}, with-shadow=${withShadow.textHeight}`,
        );
    });

    // NOTE: The brief's original "shadow stays inside the box (no bleed)" test
    // is dropped here (see task-8 brief adjustments). FitResult.width/height are
    // the tight glyph bbox of the rendered text and never include shadow extent
    // (see the discovery noted on the boundary-trim regression test above), so
    // asserting `result.width <= box + tolerance` would pass identically whether
    // or not shadow inflation is wired up — it doesn't exercise the shadow path
    // at all. The actual "no bleed" contract (shadow-inflated metrics keep the
    // *inflated* box within bounds) is already covered elsewhere:
    //   - src/fitter/effective-bounds.test.ts (Task 3: inflation math itself)
    //   - Task 7's wiring of inflateForShadow into computeBestFit
    //   - src/fitter/wrapping.test.ts (Task 7.1: boundary-trim fallback path)
    //   - src/render-snapshots.test.ts shadow-hard/soft/mixed goldens (Task 5:
    //     visible shrink relative to no-shadow snapshots)
    // Duplicating an assertion that can't observe the thing it claims to check
    // would just add a false sense of coverage.

    test('regression: no shadow → no <filter> and one <path> per non-space token', async () => {
        const ff = Fitfull.create();
        const tokens = [
            { text: 'Alpha', size: 1, font: INTER_REGULAR, weight: 'regular' as const },
            { text: ' ',     size: 1, font: INTER_REGULAR, weight: 'regular' as const },
            { text: 'Beta',  size: 1, font: INTER_REGULAR, weight: 'regular' as const },
        ];
        const result = await ff.fit({
            tokens,
            width: 300,
            height: 80,
            wrap: 'greedy',
            align: 'left',
        });
        assert.equal(result.svg.includes('<filter'), false, 'expected no <filter> without shadow');
        // Only visible-glyph tokens produce <path> nodes. 'Alpha' + 'Beta' = 2 paths.
        const pathCount = (result.svg.match(/<path /g) ?? []).length;
        assert.equal(pathCount, 2, `expected 2 path nodes (one per token), got ${pathCount}`);
    });

    test('regression: per-token shadow overrides top-level shadow', async () => {
        const ff = Fitfull.create();
        const tokens = [
            {
                text: 'Purple', size: 1, font: INTER_BOLD, weight: 'bold' as const,
                shadow: { offsetX: 0.05, offsetY: 0.05, color: 'rgba(80,0,140,0.6)' },
            },
            { text: ' ', size: 1, font: INTER_BOLD, weight: 'bold' as const },
            { text: 'Black', size: 1, font: INTER_BOLD, weight: 'bold' as const },
        ];
        const result = await ff.fit({
            tokens,
            width: 400,
            height: 80,
            wrap: 'greedy',
            align: 'left',
            shadow: { offsetX: 0.05, offsetY: 0.05, color: 'rgba(0,0,0,0.5)' },
        });
        // Both shadow colors should appear in the output SVG's fill attributes.
        assert.ok(result.svg.includes('rgba(80,0,140,0.6)'), 'expected per-token shadow color');
        assert.ok(result.svg.includes('rgba(0,0,0,0.5)'),    'expected top-level shadow color');
    });
});
