import type { Font } from 'opentype.js';

/**
 * Get font metrics at a specific size
 */
export function getFontMetrics(font: Font, fontSize: number) {
    const scale = fontSize / font.unitsPerEm;
    const ascent = font.ascender * scale;
    const descent = font.descender * scale;  // negative

    return {
        ascent,
        descent,
        lineHeight: ascent - descent,
        unitsPerEm: font.unitsPerEm,
    };
}

/**
 * Build a kerning lookup from font's kerning pairs.
 * Returns a Map where keys are "char1,char2" and values are kerning in font units.
 */
export function buildKerningLookup(font: Font): Map<string, number> {
    const lookup = new Map<string, number>();

    if (!font.kerningPairs) return lookup;

    for (const [key, value] of Object.entries(font.kerningPairs)) {
        const [a, b] = key.split(',').map(Number);
        const glyphA = font.glyphs.get(a);
        const glyphB = font.glyphs.get(b);

        if (glyphA?.unicode && glyphB?.unicode) {
            const charA = String.fromCodePoint(glyphA.unicode);
            const charB = String.fromCodePoint(glyphB.unicode);
            lookup.set(`${charA},${charB}`, value as number);
        }
    }

    return lookup;
}
