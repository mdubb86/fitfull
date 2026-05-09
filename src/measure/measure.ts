import type { Font } from 'opentype.js';
import type { Token, MeasuredToken, MeasuredLine } from '../types.js';
import { FontManager, getFontMetrics } from '../fonts/index.js';
import { getAdvanceWidth } from './metrics.js';

/**
 * Measure a single token
 * Returns the path positioned at (x, baseline) and measurement info
 */
export function measureToken(
    token: Token,
    font: Font,
    x: number,
    baseline: number
): MeasuredToken {
    const path = font.getPath(token.text, x, baseline, token.size);
    const bbox = path.getBoundingBox();

    return {
        token,
        x,
        advanceWidth: getAdvanceWidth(font, token.text, token.size),
        path,
        bboxX1: bbox.x1,
        bboxX2: bbox.x2,
        bboxY1: bbox.y1,
        bboxY2: bbox.y2,
    };
}

/**
 * Measure a line of tokens
 * All tokens are positioned on the same baseline
 */
export function measureLine(tokens: Token[], fonts: FontManager): MeasuredLine {
    if (tokens.length === 0) {
        return {
            tokens: [],
            baseline: 0,
            ascent: 0,
            descent: 0,
            tightBbox: { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 },
        };
    }

    // First pass: calculate max ascent/descent for baseline positioning
    let maxAscent = 0;
    let minDescent = 0;

    for (const token of tokens) {
        const font = fonts.getFont(token.font, token.weight);
        const metrics = getFontMetrics(font, token.size);
        maxAscent = Math.max(maxAscent, metrics.ascent);
        minDescent = Math.min(minDescent, metrics.descent);
    }

    // The baseline is at maxAscent from the top
    const baseline = maxAscent;
    const height = maxAscent - minDescent;

    // Second pass: measure and position each token
    let x = 0;
    const measuredTokens: MeasuredToken[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const font = fonts.getFont(token.font, token.weight);
        const isLast = i === tokens.length - 1;

        const measured = measureToken(token, font, x, baseline);
        measuredTokens.push(measured);

        // Move x for next token
        if (!isLast) {
            x += measured.advanceWidth;

            // Apply inter-token kerning if same font
            const nextToken = tokens[i + 1];
            if (token.font === nextToken.font && token.weight === nextToken.weight &&
                token.text.length > 0 && nextToken.text.length > 0) {
                const lastChar = token.text.slice(-1);
                const firstChar = nextToken.text[0];
                const lastGlyph = font.charToGlyph(lastChar);
                const firstGlyph = font.charToGlyph(firstChar);
                const kernValue = font.getKerningValue(lastGlyph, firstGlyph);
                if (kernValue !== 0) {
                    const scale = token.size / font.unitsPerEm;
                    x += kernValue * scale;
                }
            }
        }
    }

    // Calculate tight bounding box from actual glyph bounds
    // Skip tokens with empty paths (like spaces)
    let tightX1 = Infinity;
    let tightY1 = Infinity;
    let tightX2 = -Infinity;
    let tightY2 = -Infinity;

    for (const measured of measuredTokens) {
        // Skip empty paths (spaces, etc.) - they have no visual bounds
        if (measured.path.commands.length === 0) {
            continue;
        }
        tightX1 = Math.min(tightX1, measured.bboxX1);
        tightY1 = Math.min(tightY1, measured.bboxY1);
        tightX2 = Math.max(tightX2, measured.bboxX2);
        tightY2 = Math.max(tightY2, measured.bboxY2);
    }

    // Handle edge case: all tokens were empty (spaces only)
    if (tightX1 === Infinity) {
        tightX1 = 0;
        tightY1 = 0;
        tightX2 = 0;
        tightY2 = 0;
    }

    const tightBbox = {
        x1: tightX1,
        y1: tightY1,
        x2: tightX2,
        y2: tightY2,
        width: tightX2 - tightX1,
        height: tightY2 - tightY1,
    };

    return {
        tokens: measuredTokens,
        baseline,
        ascent: maxAscent,
        descent: minDescent,
        tightBbox,
    };
}
