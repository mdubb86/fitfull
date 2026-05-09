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
        const html = `<body style="font-family: ${INTER_REGULAR}; font-size: 12px">Hello World</body>`;
        const result = await ff.fit({
            html,
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
});
