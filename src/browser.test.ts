import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Fitfull, fitfull } from './browser.js';
import { Fitfull as NodeFitfull } from './index.js';

function interBytes(): ArrayBuffer {
    const buf = readFileSync('fonts/Inter-Regular.ttf');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

test('browser fitfull() one-shot renders text mode', async () => {
    const result = await fitfull({
        text: 'Hello', font: 'Inter', fontWeight: 'regular',
        width: 200, height: 60,
        fonts: [{ family: 'Inter', weight: 'regular', bytes: interBytes() }],
    });
    assert.match(result.svg, /<svg/);
    assert.match(result.svg, /viewBox="0 0/);
    assert.ok(result.width > 0 && result.height > 0);
    assert.ok(typeof result.textWidth === 'number' && result.textWidth > 0,
        'textWidth populated in browser path');
    assert.ok(typeof result.textHeight === 'number' && result.textHeight > 0,
        'textHeight populated in browser path');
    assert.ok(result.textWidth <= result.width, 'textWidth fits inside box');
    assert.ok(result.textHeight <= result.height, 'textHeight fits inside box');
});

test('browser Fitfull class: register once, fit many', async () => {
    const ff = new Fitfull();
    ff.registerFont('Inter', 'regular', interBytes());
    const r1 = await ff.fit({ text: 'Hello', font: 'Inter', fontWeight: 'regular', width: 200, height: 60 });
    const r2 = await ff.fit({ text: 'World', font: 'Inter', fontWeight: 'regular', width: 200, height: 60 });
    assert.match(r1.svg, /<svg/);
    assert.match(r2.svg, /<svg/);
});

test('browser tokens mode renders', async () => {
    const ff = new Fitfull();
    ff.registerFont('Inter', 'regular', interBytes());
    const result = await ff.fit({
        tokens: [{ text: 'Hi', size: 12, font: 'Inter', weight: 'regular' }],
        width: 200, height: 60,
    });
    assert.match(result.svg, /<svg/);
});

test('browser fit() throws a clear error for an unregistered font', async () => {
    const ff = new Fitfull();
    await assert.rejects(
        ff.fit({ text: 'Hi', font: 'Helvetica', fontWeight: 'regular', width: 200, height: 60 }),
        /not registered/i,
    );
});

test('browser path produces the same SVG as the Node path (text mode)', async () => {
    const opts = { text: 'Hello world', font: 'Inter', fontWeight: 'regular' as const, width: 300, height: 80 };

    const browser = new Fitfull();
    browser.registerFont('Inter', 'regular', interBytes());
    const browserResult = await browser.fit(opts);

    const node = new NodeFitfull();
    const nodeResult = await node.fit({ ...opts, fonts: ['fonts/Inter-Regular.ttf'] });

    assert.equal(browserResult.svg, nodeResult.svg, 'browser and Node SVG output must be identical');
});
