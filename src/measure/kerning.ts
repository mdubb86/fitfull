import type opentype from 'opentype.js';

/** Returns scaled kerning value between two characters, or 0 if unavailable. */
export function kerningBetween(
    font: opentype.Font,
    leftChar: string,
    rightChar: string,
    scale: number
): number {
    const leftGlyph = font.charToGlyph(leftChar);
    const rightGlyph = font.charToGlyph(rightChar);
    if (!leftGlyph || !rightGlyph) return 0;
    return font.getKerningValue(leftGlyph, rightGlyph) * scale;
}
