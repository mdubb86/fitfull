/**
 * Tests for the fitter module
 * Run with: npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FontManager } from './fonts/index.js';
import Fitter from './fitter/index.js';
import type { Token } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', 'fonts');

// Embedded fonts (no system dependency)
const INTER_REGULAR = join(FONTS_DIR, 'Inter-Regular.ttf');
const INTER_BOLD = join(FONTS_DIR, 'Inter-Bold.ttf');

let fonts: FontManager;

// Helper to create tokens from text
function textToTokens(text: string, size: number, fontFamily: string, weight: 'regular' | 'bold' = 'regular'): Token[] {
    const tokens: Token[] = [];
    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
        tokens.push({ text: words[i], size, font: fontFamily, weight });
        if (i < words.length - 1) {
            tokens.push({ text: ' ', size, font: fontFamily, weight });
        }
    }
    return tokens;
}

// Tolerance for floating point comparisons
const EPSILON = 1.0;

function approxEqual(a: number, b: number, tolerance = EPSILON): boolean {
    return Math.abs(a - b) <= tolerance;
}

describe('Fitter', async () => {
    // Load fonts once before all tests
    fonts = await FontManager.create({
        inter: {
            regular: INTER_REGULAR,
            bold: INTER_BOLD,
        }
    });

    test('fits within constraints', () => {
        const tokens = textToTokens('Hello World', 36, 'inter');
        const fitter = new Fitter(tokens, fonts, 400, 200, { align: 'left' });
        const fit = fitter.computeBestFit();

        assert.ok(fit.layout.scale > 0, 'scale should be positive');
        assert.ok(fit.layout.width <= 400, 'width should fit within constraint');
        assert.ok(fit.layout.height <= 200, 'height should fit within constraint');
        assert.ok(fit.layout.lines.length >= 1, 'should have at least one line');
    });

    test('respects minLines constraint', () => {
        const tokens = textToTokens('Hello World', 36, 'inter');
        const fitter = new Fitter(tokens, fonts, 400, 200, { minLines: 2, align: 'left' });
        const fit = fitter.computeBestFit();

        assert.ok(fit.layout.lines.length >= 2, 'should have at least 2 lines');
    });

    test('respects maxLines constraint', () => {
        const tokens = textToTokens('The quick brown fox jumps over the lazy dog', 36, 'inter');
        const fitter = new Fitter(tokens, fonts, 200, 300, { maxLines: 2, align: 'left' });
        const fit = fitter.computeBestFit();

        assert.ok(fit.layout.lines.length <= 2, 'should have at most 2 lines');
    });

    test('pangram fits in specified line count', () => {
        const tokens = textToTokens('The quick brown fox jumps over the lazy dog', 36, 'inter');

        // Force 3 lines
        const fitter = new Fitter(tokens, fonts, 400, 300, { minLines: 3, maxLines: 3, align: 'left' });
        const fit = fitter.computeBestFit();

        assert.strictEqual(fit.layout.lines.length, 3, 'should have exactly 3 lines');
        assert.ok(fit.layout.width <= 400, 'width should fit');
        assert.ok(fit.layout.height <= 300, 'height should fit');
    });

    test('scale increases with larger container', () => {
        const tokens = textToTokens('Hello World', 36, 'inter');

        const smallFitter = new Fitter(tokens, fonts, 200, 100, { align: 'left' });
        const largeFitter = new Fitter(tokens, fonts, 400, 200, { align: 'left' });

        const smallFit = smallFitter.computeBestFit();
        const largeFit = largeFitter.computeBestFit();

        assert.ok(largeFit.layout.scale > smallFit.layout.scale, 'larger container should allow larger scale');
    });

    test('mixed weights produce valid result', () => {
        const tokens: Token[] = [
            { text: 'Label:', size: 48, font: 'inter', weight: 'bold' },
            { text: ' ', size: 48, font: 'inter', weight: 'regular' },
            { text: 'value', size: 32, font: 'inter', weight: 'regular' },
        ];

        const fitter = new Fitter(tokens, fonts, 400, 200, { align: 'left' });
        const fit = fitter.computeBestFit();

        assert.ok(fit.layout.scale > 0, 'should produce valid fit');
        assert.ok(fit.layout.lines.length >= 1, 'should have at least one line');
    });

    test('whitespace trimming at line edges', () => {
        const tokens = textToTokens('Hello World', 36, 'inter');
        const fitter = new Fitter(tokens, fonts, 100, 200, { minLines: 2, align: 'left' });
        const fit = fitter.computeBestFit();

        // Check that lines don't start or end with spaces
        for (const line of fit.layout.lines) {
            assert.ok(!line.text.startsWith(' '), `line should not start with space: "${line.text}"`);
            assert.ok(!line.text.endsWith(' '), `line should not end with space: "${line.text}"`);
        }
    });

    test('lineSpacing is preserved in result', () => {
        const tokens = textToTokens('Hello World Test', 36, 'inter');

        const tightFitter = new Fitter(tokens, fonts, 150, 400, { minLines: 3, lineSpacing: 1.0, align: 'left' });
        const looseFitter = new Fitter(tokens, fonts, 150, 400, { minLines: 3, lineSpacing: 1.5, align: 'left' });

        const tightFit = tightFitter.computeBestFit();
        const looseFit = looseFitter.computeBestFit();

        assert.strictEqual(tightFit.layout.lineSpacing, 1.0, 'tight spacing should be 1.0');
        assert.strictEqual(looseFit.layout.lineSpacing, 1.5, 'loose spacing should be 1.5');
    });

    test('align is preserved in result', () => {
        const tokens = textToTokens('Hello World', 36, 'inter');

        const leftFitter = new Fitter(tokens, fonts, 400, 200, { align: 'left' });
        const centerFitter = new Fitter(tokens, fonts, 400, 200, { align: 'center' });
        const rightFitter = new Fitter(tokens, fonts, 400, 200, { align: 'right' });

        assert.strictEqual(leftFitter.computeBestFit().layout.align, 'left');
        assert.strictEqual(centerFitter.computeBestFit().layout.align, 'center');
        assert.strictEqual(rightFitter.computeBestFit().layout.align, 'right');
    });
});

describe('Layout positioning', async () => {
    fonts = await FontManager.create({
        inter: {
            regular: INTER_REGULAR,
            bold: INTER_BOLD,
        }
    });

    test('left-aligned lines start at x=0', () => {
        const tokens = textToTokens('The quick brown fox jumps over the lazy dog', 36, 'inter');
        const fitter = new Fitter(tokens, fonts, 400, 300, { minLines: 3, maxLines: 3, align: 'left' });
        const { layout } = fitter.computeBestFit();

        // The widest line should have x such that its visual left edge is at 0
        const widestLine = layout.lines.reduce((a, b) => a.width > b.width ? a : b);
        assert.ok(approxEqual(widestLine.x + widestLine.measured.tightBbox.x1, 0, EPSILON),
            `widest line visual left edge should be at 0, got ${widestLine.x + widestLine.measured.tightBbox.x1}`);
    });

    test('center-aligned lines are centered within layout width', () => {
        const tokens = textToTokens('The quick brown fox jumps over the lazy dog', 36, 'inter');
        const fitter = new Fitter(tokens, fonts, 400, 300, { minLines: 3, maxLines: 3, align: 'center' });
        const { layout } = fitter.computeBestFit();

        for (const line of layout.lines) {
            const lineCenterX = line.x + line.measured.tightBbox.x1 + line.width / 2;
            const layoutCenterX = layout.width / 2;
            assert.ok(approxEqual(lineCenterX, layoutCenterX),
                `line "${line.text}" center ${lineCenterX.toFixed(1)} should equal layout center ${layoutCenterX.toFixed(1)}`);
        }
    });

    test('right-aligned lines are flush right', () => {
        const tokens = textToTokens('The quick brown fox jumps over the lazy dog', 36, 'inter');
        const fitter = new Fitter(tokens, fonts, 400, 300, { minLines: 3, maxLines: 3, align: 'right' });
        const { layout } = fitter.computeBestFit();

        for (const line of layout.lines) {
            const lineRightEdge = line.x + line.measured.tightBbox.x1 + line.width;
            assert.ok(approxEqual(lineRightEdge, layout.width),
                `line "${line.text}" right edge ${lineRightEdge.toFixed(1)} should equal layout width ${layout.width.toFixed(1)}`);
        }
    });

    test('baselines are evenly spaced for uniform text', () => {
        const tokens = textToTokens('One Two Three Four', 36, 'inter');
        const fitter = new Fitter(tokens, fonts, 100, 400, { minLines: 4, maxLines: 4, align: 'left' });
        const { layout } = fitter.computeBestFit();

        assert.strictEqual(layout.lines.length, 4);

        // All baseline gaps should be equal
        const gaps: number[] = [];
        for (let i = 1; i < layout.lines.length; i++) {
            gaps.push(layout.lines[i].baseline - layout.lines[i - 1].baseline);
        }

        for (let i = 1; i < gaps.length; i++) {
            assert.ok(approxEqual(gaps[i], gaps[0], 0.1),
                `baseline gap ${i} (${gaps[i].toFixed(2)}) should equal gap 0 (${gaps[0].toFixed(2)})`);
        }
    });

    test('line spacing multiplier scales baseline distance', () => {
        const tokens = textToTokens('Hello World', 36, 'inter');

        const tight = new Fitter(tokens, fonts, 100, 400, { minLines: 2, maxLines: 2, lineSpacing: 1.0, align: 'left' });
        const loose = new Fitter(tokens, fonts, 100, 400, { minLines: 2, maxLines: 2, lineSpacing: 1.5, align: 'left' });

        const tightLayout = tight.computeBestFit().layout;
        const looseLayout = loose.computeBestFit().layout;

        const tightGap = tightLayout.lines[1].baseline - tightLayout.lines[0].baseline;
        const looseGap = looseLayout.lines[1].baseline - looseLayout.lines[0].baseline;

        // Loose gap should be roughly 1.5x tight gap (scale differs, so compare ratios)
        // At same scale, gap ratio = lineSpacing ratio = 1.5
        // Since scales differ, normalize: gap / scale
        const tightNorm = tightGap / tightLayout.scale;
        const looseNorm = looseGap / looseLayout.scale;
        const ratio = looseNorm / tightNorm;

        assert.ok(approxEqual(ratio, 1.5, 0.1),
            `normalized gap ratio should be ~1.5, got ${ratio.toFixed(2)}`);
    });

    test('mixed size tokens share same baseline', () => {
        // Price tag: different sizes on one line
        const tokens: Token[] = [
            { text: '$', size: 24, font: 'inter', weight: 'regular' },
            { text: '99', size: 72, font: 'inter', weight: 'bold' },
            { text: '.99', size: 24, font: 'inter', weight: 'regular' },
        ];

        const fitter = new Fitter(tokens, fonts, 300, 300, { align: 'left', maxLines: 1 });
        const { layout } = fitter.computeBestFit();

        // Should be one line with a single baseline
        assert.strictEqual(layout.lines.length, 1);
        assert.ok(layout.lines[0].baseline > 0, 'baseline should be positive');
        assert.ok(layout.lines[0].text === '$99.99', `text should be "$99.99", got "${layout.lines[0].text}"`);
    });

    test('greedy wrapping produces front-loaded lines', () => {
        const tokens = textToTokens('Weapon Expo take a peek at weapons throughout the ages', 36, 'inter');
        const fitter = new Fitter(tokens, fonts, 400, 300, { align: 'left', wrap: 'greedy' });
        const { layout } = fitter.computeBestFit();

        if (layout.lines.length >= 2) {
            const lastLine = layout.lines[layout.lines.length - 1];
            const firstLine = layout.lines[0];
            assert.ok(lastLine.width <= firstLine.width,
                `greedy: last line (${lastLine.width.toFixed(0)}) should not be wider than first (${firstLine.width.toFixed(0)})`);
        }
    });

    test('balanced wrapping produces even line widths', () => {
        const tokens = textToTokens('Weapon Expo take a peek at weapons throughout the ages', 36, 'inter');
        const fitter = new Fitter(tokens, fonts, 400, 300, { align: 'left', wrap: 'balanced' });
        const { layout } = fitter.computeBestFit();

        if (layout.lines.length >= 2) {
            const widths = layout.lines.map(l => l.width);
            const maxW = Math.max(...widths);
            const minW = Math.min(...widths);
            // Balanced lines should be within 50% of each other
            assert.ok(minW / maxW > 0.5,
                `balanced: min/max width ratio ${(minW / maxW).toFixed(2)} should be > 0.5`);
        }
    });

    test('long text completes without hanging', () => {
        const tokens = textToTokens(
            'Hair Braids: learn how to braid hair in a variety of styles. From simple three-strand braids to complex fishtail braids. We will also cover tips for maintaining braided hairstyles.',
            12, 'inter'
        );
        const fitter = new Fitter(tokens, fonts, 619, 112, { align: 'left' });
        const fit = fitter.computeBestFit();

        assert.ok(fit.layout.width <= 619, 'width should fit');
        assert.ok(fit.layout.height <= 112, 'height should fit');
        assert.ok(fit.layout.lines.length >= 2, 'should wrap to multiple lines');
    });

    test('layout line text matches token concatenation', () => {
        const tokens = textToTokens('Hello World Test', 36, 'inter');
        const fitter = new Fitter(tokens, fonts, 150, 400, { minLines: 3, maxLines: 3, align: 'left' });
        const { layout } = fitter.computeBestFit();

        for (const line of layout.lines) {
            const expectedText = line.measured.tokens.map(t => t.token.text).join('');
            assert.strictEqual(line.text, expectedText,
                `line text "${line.text}" should match token concatenation "${expectedText}"`);
        }
    });
});
