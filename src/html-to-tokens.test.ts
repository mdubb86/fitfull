import { test, describe } from 'node:test';
import assert from 'node:assert';
import { htmlToTokens } from './html-to-tokens.js';
import { nodeParseHtml } from './html-parser.js';

/** Wrap HTML content in a body with default styling */
function styled(html: string, { font = 'inter', size = 12, weight = 'normal', style = 'normal' } = {}): string {
    return `<body style="font-family: ${font}; font-size: ${size}px; font-weight: ${weight}; font-style: ${style}">${html}</body>`;
}

describe('htmlToTokens', () => {
    // --- Basic text ---

    test('plain text produces word+space tokens', () => {
        const tokens = htmlToTokens(styled('Hello World'), nodeParseHtml);
        assert.deepStrictEqual(tokens, [
            { text: 'Hello', size: 12, font: 'inter', weight: 'regular' },
            { text: ' ', size: 12, font: 'inter', weight: 'regular' },
            { text: 'World', size: 12, font: 'inter', weight: 'regular' },
        ]);
    });

    test('single word', () => {
        const tokens = htmlToTokens(styled('Hello'), nodeParseHtml);
        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].text, 'Hello');
    });

    // --- Bold ---

    test('<b> produces bold weight', () => {
        const tokens = htmlToTokens(styled('<b>Hello</b> World'), nodeParseHtml);
        assert.strictEqual(tokens[0].weight, 'bold');
        assert.strictEqual(tokens[0].text, 'Hello');
        assert.strictEqual(tokens[2].weight, 'regular');
        assert.strictEqual(tokens[2].text, 'World');
    });

    test('<strong> produces bold weight', () => {
        const tokens = htmlToTokens(styled('<strong>Hi</strong>'), nodeParseHtml);
        assert.strictEqual(tokens[0].weight, 'bold');
    });

    // --- Italic ---

    test('<i> produces italic weight', () => {
        const tokens = htmlToTokens(styled('<i>Hello</i>'), nodeParseHtml);
        assert.strictEqual(tokens[0].weight, 'italic');
    });

    test('<em> produces italic weight', () => {
        const tokens = htmlToTokens(styled('<em>Hello</em>'), nodeParseHtml);
        assert.strictEqual(tokens[0].weight, 'italic');
    });

    // --- Nested bold + italic ---

    test('nested <b><i> produces bolditalic', () => {
        const tokens = htmlToTokens(styled('<b><i>Hello</i></b>'), nodeParseHtml);
        assert.strictEqual(tokens[0].weight, 'bolditalic');
    });

    test('nested <i><b> produces bolditalic', () => {
        const tokens = htmlToTokens(styled('<i><b>Hello</b></i>'), nodeParseHtml);
        assert.strictEqual(tokens[0].weight, 'bolditalic');
    });

    // --- CSS font-size ---

    test('inline font-size in px', () => {
        const tokens = htmlToTokens(styled('<span style="font-size: 24px">Big</span>'), nodeParseHtml);
        assert.strictEqual(tokens[0].size, 24);
    });

    test('inline font-size in pt', () => {
        const tokens = htmlToTokens(styled('<span style="font-size: 12pt">Text</span>'), nodeParseHtml);
        assert.ok(Math.abs(tokens[0].size - 16) < 0.01);
    });

    test('inline font-size in em', () => {
        const tokens = htmlToTokens(styled('<span style="font-size: 2em">Text</span>'), nodeParseHtml);
        assert.strictEqual(tokens[0].size, 24);
    });

    test('inline font-size in percent', () => {
        const tokens = htmlToTokens(styled('<span style="font-size: 200%">Text</span>'), nodeParseHtml);
        assert.strictEqual(tokens[0].size, 24);
    });

    test('nested em sizes compound', () => {
        const tokens = htmlToTokens(
            styled('<span style="font-size: 2em"><span style="font-size: 1.5em">Text</span></span>'),
            nodeParseHtml
        );
        assert.strictEqual(tokens[0].size, 36);
    });

    // --- CSS font-weight ---

    test('font-weight: bold via CSS', () => {
        const tokens = htmlToTokens(styled('<span style="font-weight: bold">Text</span>'), nodeParseHtml);
        assert.strictEqual(tokens[0].weight, 'bold');
    });

    test('font-weight: 700 via CSS', () => {
        const tokens = htmlToTokens(styled('<span style="font-weight: 700">Text</span>'), nodeParseHtml);
        assert.strictEqual(tokens[0].weight, 'bold');
    });

    test('font-weight: 400 stays regular', () => {
        const tokens = htmlToTokens(styled('<span style="font-weight: 400">Text</span>'), nodeParseHtml);
        assert.strictEqual(tokens[0].weight, 'regular');
    });

    // --- CSS font-family ---

    test('font-family is normalized', () => {
        const tokens = htmlToTokens(styled('<span style="font-family: Open Sans">Text</span>'), nodeParseHtml);
        assert.strictEqual(tokens[0].font, 'open-sans');
    });

    test('font-family with quotes and fallbacks', () => {
        const tokens = htmlToTokens(styled('<span style="font-family: \'Roboto Mono\', monospace">Text</span>'), nodeParseHtml);
        assert.strictEqual(tokens[0].font, 'roboto-mono');
    });

    // --- CSS font-style ---

    test('font-style: italic via CSS', () => {
        const tokens = htmlToTokens(styled('<span style="font-style: italic">Text</span>'), nodeParseHtml);
        assert.strictEqual(tokens[0].weight, 'italic');
    });

    // --- Style blocks with juice ---

    test('style block with class selectors', () => {
        const html = styled(`
            <style>.title { font-size: 24px; font-weight: bold; }</style>
            <span class="title">Hello</span> World
        `);
        const tokens = htmlToTokens(html, nodeParseHtml);
        assert.strictEqual(tokens[0].size, 24);
        assert.strictEqual(tokens[0].weight, 'bold');
        assert.strictEqual(tokens[2].size, 12);
        assert.strictEqual(tokens[2].weight, 'regular');
    });

    test('style block with element selector', () => {
        const html = styled(`
            <style>span { font-size: 20px; }</style>
            <span>Hello</span> World
        `);
        const tokens = htmlToTokens(html, nodeParseHtml);
        assert.strictEqual(tokens[0].size, 20);
        assert.strictEqual(tokens[0].text, 'Hello');
        assert.strictEqual(tokens[2].size, 12); // "World" uses body default
    });

    test('style block with multiple classes on one element', () => {
        const html = styled(`
            <style>
                .big { font-size: 30px; }
                .bold { font-weight: bold; }
            </style>
            <span class="big bold">Hello</span>
        `);
        const tokens = htmlToTokens(html, nodeParseHtml);
        assert.strictEqual(tokens[0].size, 30);
        assert.strictEqual(tokens[0].weight, 'bold');
    });

    test('inline style wins over style block', () => {
        const html = styled(`
            <style>.override { font-size: 30px; }</style>
            <span class="override" style="font-size: 18px">Hello</span>
        `);
        const tokens = htmlToTokens(html, nodeParseHtml);
        assert.strictEqual(tokens[0].size, 18); // inline wins
    });

    test('style block with whitespace in selector and declarations', () => {
        const html = styled(`
            <style>
                .spaced   {
                    font-size :  22px ;
                    font-weight:bold;
                }
            </style>
            <span class="spaced">Hello</span>
        `);
        const tokens = htmlToTokens(html, nodeParseHtml);
        assert.strictEqual(tokens[0].size, 22);
        assert.strictEqual(tokens[0].weight, 'bold');
    });

    // --- Whitespace ---

    test('multiple spaces collapse to one', () => {
        const tokens = htmlToTokens(styled('Hello    World'), nodeParseHtml);
        assert.strictEqual(tokens.length, 3);
        assert.strictEqual(tokens[1].text, ' ');
    });

    test('newlines and tabs collapse to spaces', () => {
        const tokens = htmlToTokens(styled('Hello\n\t  World'), nodeParseHtml);
        assert.strictEqual(tokens.length, 3);
        assert.strictEqual(tokens[1].text, ' ');
    });

    test('whitespace between tags collapses', () => {
        const tokens = htmlToTokens(styled('<b>Hello</b>  <i>World</i>'), nodeParseHtml);
        assert.strictEqual(tokens.length, 3);
        assert.strictEqual(tokens[1].text, ' ');
    });

    test('leading and trailing whitespace is trimmed', () => {
        const tokens = htmlToTokens(styled('  Hello World  '), nodeParseHtml);
        assert.strictEqual(tokens[0].text, 'Hello');
        assert.strictEqual(tokens[tokens.length - 1].text, 'World');
    });

    // --- Line breaks ---

    test('br tag produces newline token', () => {
        const tokens = htmlToTokens(styled('Hello<br>World'), nodeParseHtml);
        assert.strictEqual(tokens.length, 3);
        assert.strictEqual(tokens[0].text, 'Hello');
        assert.strictEqual(tokens[1].text, '\n');
        assert.strictEqual(tokens[2].text, 'World');
    });

    test('spaces around br are stripped', () => {
        const tokens = htmlToTokens(styled('Hello <br> World'), nodeParseHtml);
        const texts = tokens.map(t => t.text);
        // Should collapse to: Hello, \n, World (no space+newline combos)
        assert.ok(!texts.includes(' '), 'no space tokens adjacent to br');
        assert.strictEqual(tokens[1].text, '\n');
    });

    // --- Edge cases ---

    test('empty HTML returns empty array', () => {
        const tokens = htmlToTokens('', nodeParseHtml);
        assert.deepStrictEqual(tokens, []);
    });

    test('whitespace-only HTML returns empty array', () => {
        const tokens = htmlToTokens('   ', nodeParseHtml);
        assert.deepStrictEqual(tokens, []);
    });

    test('HTML comments are ignored', () => {
        const tokens = htmlToTokens(styled('Hello <!-- comment --> World'), nodeParseHtml);
        assert.strictEqual(tokens.length, 3);
        assert.strictEqual(tokens[0].text, 'Hello');
    });

    test('empty elements produce no tokens', () => {
        const tokens = htmlToTokens(styled('<b></b>Hello'), nodeParseHtml);
        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].text, 'Hello');
    });

    test('deeply nested structure', () => {
        const tokens = htmlToTokens(styled('<div><p><b><i>Deep</i></b></p></div>'), nodeParseHtml);
        assert.strictEqual(tokens[0].weight, 'bolditalic');
        assert.strictEqual(tokens[0].text, 'Deep');
    });

    // --- Body styling ---

    test('body styling sets defaults', () => {
        const tokens = htmlToTokens(styled('Hello', { font: 'arial', size: 16, weight: 'bold' }), nodeParseHtml);
        assert.strictEqual(tokens[0].weight, 'bold');
        assert.strictEqual(tokens[0].size, 16);
        assert.strictEqual(tokens[0].font, 'arial');
    });

    test('missing font-family throws', () => {
        assert.throws(
            () => htmlToTokens('<body style="font-size: 12px">Hello</body>', nodeParseHtml),
            /font-family/
        );
    });

    test('missing font-size throws', () => {
        assert.throws(
            () => htmlToTokens('<body style="font-family: inter">Hello</body>', nodeParseHtml),
            /font-size/
        );
    });

    test('no body styling throws', () => {
        assert.throws(
            () => htmlToTokens('<p>Hello</p>', nodeParseHtml),
            /font-family/
        );
    });

    // --- Cross-style word boundary ---

    test('cross-style word produces separate adjacent tokens', () => {
        const tokens = htmlToTokens(styled('<b>He</b>llo'), nodeParseHtml);
        assert.strictEqual(tokens.length, 2);
        assert.strictEqual(tokens[0].text, 'He');
        assert.strictEqual(tokens[0].weight, 'bold');
        assert.strictEqual(tokens[1].text, 'llo');
        assert.strictEqual(tokens[1].weight, 'regular');
    });
});
