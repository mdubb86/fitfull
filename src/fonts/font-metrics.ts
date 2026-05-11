import type { Font } from 'fontkit';

/**
 * Get font metrics at a specific size
 */
export function getFontMetrics(font: Font, fontSize: number) {
    const scale = fontSize / font.unitsPerEm;
    const ascent = font.ascent * scale;
    const descent = font.descent * scale;  // negative

    return {
        ascent,
        descent,
        lineHeight: ascent - descent,
        unitsPerEm: font.unitsPerEm,
    };
}
