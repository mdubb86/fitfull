import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fontkit from 'fontkit';
import { FontStore } from './font-provider.js';
import { readFileSync } from 'node:fs';

function loadInter(): fontkit.Font {
    const buf = readFileSync('fonts/Inter-Regular.ttf');
    return fontkit.create(buf) as fontkit.Font;
}

test('FontStore.set then getFont returns the font', () => {
    const store = new FontStore();
    const font = loadInter();
    store.set('inter', 'regular', font);
    assert.equal(store.getFont('inter', 'regular'), font);
});

test('FontStore.getFont throws a clear error for an unknown family', () => {
    const store = new FontStore();
    assert.throws(
        () => store.getFont('helvetica', 'regular'),
        /not registered/i,
    );
});

test('FontStore.getUnitsPerEm returns the font unitsPerEm', () => {
    const store = new FontStore();
    const font = loadInter();
    store.set('inter', 'regular', font);
    assert.equal(store.getUnitsPerEm('inter', 'regular'), font.unitsPerEm);
});
