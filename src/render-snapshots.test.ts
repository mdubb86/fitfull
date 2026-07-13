import { test, describe } from 'node:test';
import assert from 'node:assert';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Fitfull } from './index.js';
import type { Token } from './types.js';
import { assertSnapshot } from './test-utils/snapshot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', 'fonts');
const INTER_REGULAR = join(FONTS_DIR, 'Inter-Regular.ttf');
const INTER_BOLD = join(FONTS_DIR, 'Inter-Bold.ttf');

describe('SVG render snapshots', () => {
    test('text-simple: single line text mode', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'Hello World',
            font: INTER_REGULAR,
            width: 400,
            height: 100,
        });
        assertSnapshot('text-simple', result.svg);
    });

    test('text-multiline-left: balanced wrap, left aligned', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'The quick brown fox jumps over the lazy dog',
            font: INTER_REGULAR,
            width: 200,
            height: 200,
            align: 'left',
            minLines: 3,
            maxLines: 3,
        });
        assertSnapshot('text-multiline-left', result.svg);
    });

    test('text-multiline-center: balanced wrap, center aligned', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'The quick brown fox jumps over the lazy dog',
            font: INTER_REGULAR,
            width: 200,
            height: 200,
            align: 'center',
            minLines: 3,
            maxLines: 3,
        });
        assertSnapshot('text-multiline-center', result.svg);
    });

    test('text-multiline-right: balanced wrap, right aligned', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'The quick brown fox jumps over the lazy dog',
            font: INTER_REGULAR,
            width: 200,
            height: 200,
            align: 'right',
            minLines: 3,
            maxLines: 3,
        });
        assertSnapshot('text-multiline-right', result.svg);
    });

    test('text-newlines: hard line breaks via \\n in text mode', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'Hello\nWorld\nMulti-line',
            font: INTER_REGULAR,
            width: 200,
            height: 150,
        });
        assertSnapshot('text-newlines', result.svg);
    });

    test('text-greedy: greedy wrap mode', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'Weapon Expo take a peek at weapons throughout the ages',
            font: INTER_REGULAR,
            width: 300,
            height: 200,
            align: 'left',
            wrap: 'greedy',
        });
        assertSnapshot('text-greedy', result.svg);
    });

    test('text-annotate: annotation overlays enabled', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'Hello World',
            font: INTER_REGULAR,
            width: 400,
            height: 100,
            annotate: true,
        });
        assertSnapshot('text-annotate', result.svg);
    });

    test('text-styled: with color and background', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'Hello World',
            font: INTER_REGULAR,
            width: 400,
            height: 100,
            color: '#222222',
            background: '#f0f0f0',
        });
        assertSnapshot('text-styled', result.svg);
    });

    test('text-fixed-height: textHeight option (fixed scale)', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'Hello',
            font: INTER_REGULAR,
            width: 400,
            height: 100,
            textHeight: 40,
        });
        assertSnapshot('text-fixed-height', result.svg);
    });

    test('html-with-style-block: HTML mode + CSS inlining', async () => {
        const ff = Fitfull.create();
        const html = `<body style="font-family: inter; font-size: 12px">
<style>.title { font-size: 24px; font-weight: bold; }</style>
<span class="title">Title</span> body text
</body>`;
        const result = await ff.fit({
            html,
            fonts: [INTER_REGULAR, INTER_BOLD],
            width: 400,
            height: 100,
        });
        assertSnapshot('html-with-style-block', result.svg);
    });

    test('tokens-mixed-sizes: token mode with mixed font sizes', async () => {
        const ff = Fitfull.create();
        const tokens: Token[] = [
            { text: '$', size: 24, font: 'inter', weight: 'regular' },
            { text: '99', size: 72, font: 'inter', weight: 'bold' },
            { text: '.99', size: 24, font: 'inter', weight: 'regular' },
        ];
        const result = await ff.fit({
            tokens,
            fonts: [INTER_REGULAR, INTER_BOLD],
            width: 300,
            height: 150,
            align: 'left',
            maxLines: 1,
        });
        assertSnapshot('tokens-mixed-sizes', result.svg);
    });

    test('text-kern-heavy: GPOS kerning visible in AVATAR', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'AVATAR',
            font: INTER_REGULAR,
            fonts: [INTER_REGULAR],
            width: 400,
            height: 100,
        });
        assertSnapshot('text-kern-heavy', result.svg);
    });

    test('text-multiline-kerned: multi-line kern-rich words', async () => {
        const ff = Fitfull.create();
        const result = await ff.fit({
            text: 'AVATAR TYPE WAVE',
            font: INTER_REGULAR,
            fonts: [INTER_REGULAR],
            width: 300,
            height: 200,
            align: 'left',
            minLines: 3,
            maxLines: 3,
        });
        assertSnapshot('text-multiline-kerned', result.svg);
    });

    test('tokens-kerned: token mode with kern-rich content across weights', async () => {
        const ff = Fitfull.create();
        const tokens: Token[] = [
            { text: 'AVA', size: 72, font: 'inter', weight: 'regular' },
            { text: ' ', size: 72, font: 'inter', weight: 'regular' },
            { text: 'TAR', size: 72, font: 'inter', weight: 'bold' },
        ];
        const result = await ff.fit({
            tokens,
            fonts: [INTER_REGULAR, INTER_BOLD],
            width: 400,
            height: 120,
            align: 'left',
            maxLines: 1,
        });
        assertSnapshot('tokens-kerned', result.svg);
    });

    test('shadow-hard: top-level hard shadow', async () => {
        const ff = Fitfull.create();
        const tokens: Token[] = [
            { text: 'Shadow', size: 2, font: INTER_BOLD, weight: 'bold' },
            { text: ' ',      size: 2, font: INTER_BOLD, weight: 'bold' },
            { text: 'Demo',   size: 2, font: INTER_REGULAR, weight: 'regular' },
        ];
        // `shadow` isn't on FitOptionsBase yet (Task 6 adds it) — cast to keep
        // this test runnable against Task 4's rendering support in the meantime.
        const result = await ff.fit({
            tokens,
            width: 480,
            height: 140,
            wrap: 'greedy',
            align: 'center',
            shadow: { offsetX: 0.05, offsetY: 0.05, blur: 0, color: 'rgba(0,0,0,0.5)' },
        } as any);
        assertSnapshot('shadow-hard', result.svg);
    });

    test('shadow-soft: top-level soft (blurred) shadow', async () => {
        const ff = Fitfull.create();
        const tokens: Token[] = [
            { text: 'Shadow', size: 2, font: INTER_BOLD, weight: 'bold' },
            { text: ' ',      size: 2, font: INTER_BOLD, weight: 'bold' },
            { text: 'Demo',   size: 2, font: INTER_REGULAR, weight: 'regular' },
        ];
        const result = await ff.fit({
            tokens,
            width: 480,
            height: 140,
            wrap: 'greedy',
            align: 'center',
            shadow: { offsetX: 0.03, offsetY: 0.04, blur: 0.025, color: 'rgba(0,0,0,0.45)' },
        } as any);
        assertSnapshot('shadow-soft', result.svg);
    });

    test('shadow-mixed: per-token override on top of top-level default', async () => {
        const ff = Fitfull.create();
        const tokens: Token[] = [
            { text: 'One', size: 2, font: INTER_BOLD, weight: 'bold' },
            { text: ' ',   size: 2, font: INTER_BOLD, weight: 'bold' },
            {
                text: 'Two', size: 2, font: INTER_REGULAR, weight: 'regular',
                shadow: { offsetX: -0.04, offsetY: 0.02, blur: 0.015, color: 'rgba(50,0,120,0.6)' },
            },
        ];
        const result = await ff.fit({
            tokens,
            width: 480,
            height: 140,
            wrap: 'greedy',
            align: 'center',
            shadow: { offsetX: 0.05, offsetY: 0.05, blur: 0, color: 'rgba(0,0,0,0.5)' },
        } as any);
        assertSnapshot('shadow-mixed', result.svg);
    });
});

test('SVG output contains a viewBox matching width and height', async () => {
    const ff = Fitfull.create();
    const result = await ff.fit({
        text: 'Hello',
        font: INTER_REGULAR,
        width: 200,
        height: 60,
    });

    const viewBoxMatch = result.svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    assert.ok(viewBoxMatch, `expected viewBox attribute in SVG, got header: ${result.svg.slice(0, 200)}`);

    const [, viewBoxW, viewBoxH] = viewBoxMatch;
    assert.equal(
        parseFloat(viewBoxW).toFixed(2),
        result.width.toFixed(2),
        'viewBox width must match result.width'
    );
    assert.equal(
        parseFloat(viewBoxH).toFixed(2),
        result.height.toFixed(2),
        'viewBox height must match result.height'
    );

    assert.match(result.svg, /width="[\d.]+"/);
    assert.match(result.svg, /height="[\d.]+"/);
});

