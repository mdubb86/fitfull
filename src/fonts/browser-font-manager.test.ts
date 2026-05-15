import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BrowserFontManager } from './browser-font-manager.js';

function interBytes(): ArrayBuffer {
    const buf = readFileSync('fonts/Inter-Regular.ttf');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

test('registerFont then getFont returns a usable font', () => {
    const fm = new BrowserFontManager();
    fm.registerFont('Inter', 'regular', interBytes());
    const font = fm.getFont('inter', 'regular');
    assert.ok(font.unitsPerEm > 0);
});

test('registerFont accepts a Uint8Array', () => {
    const fm = new BrowserFontManager();
    fm.registerFont('Inter', 'regular', new Uint8Array(interBytes()));
    assert.ok(fm.getUnitsPerEm('inter', 'regular') > 0);
});

test('getFont throws a clear error for an unregistered font', () => {
    const fm = new BrowserFontManager();
    assert.throws(() => fm.getFont('helvetica', 'regular'), /not registered/i);
});

test('loadForTokens registers fonts from options.fonts', async () => {
    const fm = new BrowserFontManager();
    await fm.loadForTokens(
        [{ text: 'Hi', size: 12, font: 'inter', weight: 'regular' }],
        { fonts: [{ family: 'Inter', weight: 'regular', bytes: interBytes() }] },
    );
    assert.ok(fm.getUnitsPerEm('inter', 'regular') > 0);
});

test('loadForTokens throws if a token references an unregistered font', async () => {
    const fm = new BrowserFontManager();
    await assert.rejects(
        fm.loadForTokens(
            [{ text: 'Hi', size: 12, font: 'helvetica', weight: 'regular' }],
            {},
        ),
        /not registered/i,
    );
});
