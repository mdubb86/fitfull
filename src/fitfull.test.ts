import { test, describe } from 'node:test';
import assert from 'node:assert';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Fitfull } from './fitfull.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', 'fonts');
const INTER_REGULAR = join(FONTS_DIR, 'Inter-Regular.ttf');

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
});
