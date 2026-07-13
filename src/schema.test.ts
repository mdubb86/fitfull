import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parseFontString, mapWeight, inputTokensToTokens, InputTokenArraySchema, ShadowSchema, InputTokenSchema } from './schema.js';

describe('parseFontString', () => {
    test('plain family name', () => {
        const r = parseFontString('Inter');
        assert.strictEqual(r.family, 'Inter');
        assert.strictEqual(r.weight, 'regular');
        assert.strictEqual(r.style, 'normal');
    });

    test('family with bold weight', () => {
        const r = parseFontString('Inter Bold');
        assert.strictEqual(r.family, 'Inter');
        assert.strictEqual(r.weight, 'bold');
        assert.strictEqual(r.style, 'normal');
    });

    test('family with italic style', () => {
        const r = parseFontString('Inter Italic');
        assert.strictEqual(r.family, 'Inter');
        assert.strictEqual(r.weight, 'regular');
        assert.strictEqual(r.style, 'italic');
    });

    test('family with bold italic', () => {
        const r = parseFontString('Inter Bold Italic');
        assert.strictEqual(r.family, 'Inter');
        assert.strictEqual(r.weight, 'bold');
        assert.strictEqual(r.style, 'italic');
    });

    test('multi-word family name with bold', () => {
        const r = parseFontString('Open Sans Bold');
        assert.strictEqual(r.family, 'Open Sans');
        assert.strictEqual(r.weight, 'bold');
    });

    test('semibold weight is recognized', () => {
        const r = parseFontString('Inter Semibold');
        assert.strictEqual(r.family, 'Inter');
        assert.strictEqual(r.weight, 'semibold');
    });
});

describe('mapWeight', () => {
    test('regular + normal → regular', () => {
        assert.strictEqual(mapWeight('regular', 'normal'), 'regular');
    });

    test('bold + normal → bold', () => {
        assert.strictEqual(mapWeight('bold', 'normal'), 'bold');
    });

    test('semibold + normal → bold', () => {
        assert.strictEqual(mapWeight('semibold', 'normal'), 'bold');
    });

    test('regular + italic → italic', () => {
        assert.strictEqual(mapWeight('regular', 'italic'), 'italic');
    });

    test('bold + italic → bolditalic', () => {
        assert.strictEqual(mapWeight('bold', 'italic'), 'bolditalic');
    });

    test('regular + oblique → italic', () => {
        assert.strictEqual(mapWeight('regular', 'oblique'), 'italic');
    });
});

describe('InputTokenArraySchema', () => {
    test('parses minimal valid token', () => {
        const result = InputTokenArraySchema.parse([
            { text: 'Hi', size: 12, font: 'Inter' },
        ]);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].text, 'Hi');
    });

    test('rejects token without required fields', () => {
        assert.throws(() => {
            InputTokenArraySchema.parse([{ text: 'Hi' }]);
        });
    });
});

describe('inputTokensToTokens', () => {
    test('passes through with resolver normalizing family', () => {
        const input = [{ text: 'Hi', size: 12, font: 'Inter' }];
        const resolver = (family: string) => family.toLowerCase();
        const result = inputTokensToTokens(input, resolver);
        assert.strictEqual(result[0].font, 'inter');
        assert.strictEqual(result[0].weight, 'regular');
    });

    test('handles bold italic font string combining to bolditalic', () => {
        const input = [{ text: 'Hi', size: 12, font: 'Inter Bold Italic' }];
        const resolver = (family: string) => family.toLowerCase();
        const result = inputTokensToTokens(input, resolver);
        assert.strictEqual(result[0].weight, 'bolditalic');
    });
});

test('ShadowSchema accepts a full shadow object', () => {
    const parsed = ShadowSchema.parse({ offsetX: 0.05, offsetY: 0.05, blur: 0.02, color: 'black' });
    assert.equal(parsed.offsetX, 0.05);
    assert.equal(parsed.blur, 0.02);
});

test('ShadowSchema accepts partial (blur + color omitted)', () => {
    const parsed = ShadowSchema.parse({ offsetX: 0.05, offsetY: -0.03 });
    assert.equal(parsed.blur, undefined);
    assert.equal(parsed.color, undefined);
});

test('ShadowSchema rejects negative blur', () => {
    assert.throws(() => ShadowSchema.parse({ offsetX: 0, offsetY: 0, blur: -0.01 }));
});

test('ShadowSchema rejects missing offsetX', () => {
    assert.throws(() => ShadowSchema.parse({ offsetY: 0.05 }));
});

test('InputTokenSchema accepts a shadow field', () => {
    const parsed = InputTokenSchema.parse({
        text: 'Hi', size: 1, font: 'Inter',
        shadow: { offsetX: 0.05, offsetY: 0.05 },
    });
    assert.equal(parsed.shadow?.offsetX, 0.05);
});
