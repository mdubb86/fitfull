import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fontkit from 'fontkit';
import { flipY, transformPath, toPathData, getBoundingBox, composeGlyphRunPath } from './path-adapter.js';

test('flipY inverts Y coordinates around the baseline', () => {
    const input = [
        { type: 'M', x: 10, y: 20 },
        { type: 'L', x: 10, y: 50 },
    ];
    const flipped = flipY(input as any, 100);
    assert.deepEqual(flipped, [
        { type: 'M', x: 10, y: 80 },
        { type: 'L', x: 10, y: 50 },
    ]);
});

test('flipY handles bezier control points', () => {
    const input = [
        { type: 'C', x1: 5, y1: 10, x2: 15, y2: 20, x: 25, y: 30 },
    ];
    const flipped = flipY(input as any, 100);
    assert.deepEqual(flipped, [
        { type: 'C', x1: 5, y1: 90, x2: 15, y2: 80, x: 25, y: 70 },
    ]);
});

test('flipY handles quadratic bezier', () => {
    const input = [
        { type: 'Q', x1: 5, y1: 10, x: 25, y: 30 },
    ];
    const flipped = flipY(input as any, 100);
    assert.deepEqual(flipped, [
        { type: 'Q', x1: 5, y1: 90, x: 25, y: 70 },
    ]);
});

test('flipY passes Z (closepath) through unchanged', () => {
    const input = [{ type: 'Z' }];
    assert.deepEqual(flipY(input as any, 100), [{ type: 'Z' }]);
});

test('transformPath scales by factor and translates by (dx, dy)', () => {
    const input = [
        { type: 'M', x: 10, y: 20 },
        { type: 'L', x: 30, y: 40 },
    ];
    const out = transformPath(input as any, 2, 5, 100);
    assert.deepEqual(out, [
        { type: 'M', x: 25, y: 140 },
        { type: 'L', x: 65, y: 180 },
    ]);
});

test('transformPath scales control points the same way', () => {
    const input = [{ type: 'C', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 }];
    const out = transformPath(input as any, 10, 0, 0);
    assert.deepEqual(out, [{ type: 'C', x1: 10, y1: 20, x2: 30, y2: 40, x: 50, y: 60 }]);
});

test('toPathData emits SVG d-string with given precision', () => {
    const cmds = [
        { type: 'M', x: 10.123, y: 20.456 },
        { type: 'L', x: 30.789, y: 40.111 },
        { type: 'C', x1: 1.5, y1: 2.5, x2: 3.5, y2: 4.5, x: 5.5, y: 6.5 },
        { type: 'Q', x1: 10.0, y1: 20.0, x: 30.0, y: 40.0 },
        { type: 'Z' },
    ];
    const out = toPathData(cmds as any, 2);
    assert.equal(out, 'M10.12 20.46L30.79 40.11C1.5 2.5 3.5 4.5 5.5 6.5Q10 20 30 40Z');
});

test('toPathData precision 0 rounds to integers', () => {
    const cmds = [{ type: 'M', x: 10.7, y: 20.3 }];
    assert.equal(toPathData(cmds as any, 0), 'M11 20');
});

test('getBoundingBox returns x1/y1/x2/y2 over move + line commands', () => {
    const cmds = [
        { type: 'M', x: 10, y: 20 },
        { type: 'L', x: 30, y: 40 },
        { type: 'L', x: 5, y: 15 },
    ];
    assert.deepEqual(getBoundingBox(cmds as any), { x1: 5, y1: 15, x2: 30, y2: 40 });
});

test('getBoundingBox includes bezier control points (conservative bbox)', () => {
    const cmds = [
        { type: 'M', x: 0, y: 0 },
        { type: 'C', x1: 50, y1: 100, x2: 80, y2: -20, x: 100, y: 0 },
    ];
    assert.deepEqual(getBoundingBox(cmds as any), { x1: 0, y1: -20, x2: 100, y2: 100 });
});

test('getBoundingBox empty commands returns zero bbox', () => {
    assert.deepEqual(getBoundingBox([]), { x1: 0, y1: 0, x2: 0, y2: 0 });
});

test('composeGlyphRunPath produces a Path-shaped object for "Hi" rendered at 64pt', () => {
    const font = fontkit.openSync('fonts/Inter-Regular.ttf');
    if ('fonts' in font) throw new Error('expected single font, got collection');

    const path = composeGlyphRunPath(font as any, 'Hi', 0, 100, 64);

    assert.ok(path.commands.length > 0, 'should have at least one command');
    assert.ok(typeof path.toPathData === 'function');
    assert.ok(typeof path.getBoundingBox === 'function');

    const bbox = path.getBoundingBox();
    assert.ok(bbox.x2 > bbox.x1, 'bbox width > 0');
    assert.ok(bbox.y2 > bbox.y1, 'bbox height > 0');

    const d = path.toPathData(2);
    assert.ok(d.startsWith('M'), 'path d-string starts with M');
    assert.ok(d.length > 50, 'path d-string is substantial');
});

test('composeGlyphRunPath applies GPOS kerning', () => {
    const font = fontkit.openSync('fonts/Inter-Regular.ttf') as any;
    const scale = 64 / font.unitsPerEm;

    // Bare advance widths summed — no GPOS, no layout
    let bareWidth = 0;
    for (const ch of 'AVATAR') {
        bareWidth += font.glyphForCodePoint(ch.codePointAt(0)).advanceWidth * scale;
    }

    // Width via layout — GPOS applied
    const path = composeGlyphRunPath(font, 'AVATAR', 0, 100, 64);
    const bbox = path.getBoundingBox();
    const layoutWidth = bbox.x2 - bbox.x1;

    // AVATAR has 4 negative-kern pairs (AV, VA, AT, TA). Layout must be meaningfully narrower.
    assert.ok(
        layoutWidth < bareWidth - 5,
        `expected layout width (${layoutWidth}) < bare width (${bareWidth}) by at least 5px`
    );
});

