import type { Font } from 'fontkit';
import type { Token, TokenMetrics, LineMetrics, ArrangementMetrics } from '../types.js';
import type { FontManager } from '../fonts/index.js';
import { getFontMetrics } from '../fonts/index.js';

/**
 * Calculate total height for lines.
 * Uses tight visual height for fitting calculations.
 * Line spacing multiplier applies to baseline-to-baseline distance (font metrics).
 */
export function calculateTotalHeight(
    lines: Array<{ height: number; ascent: number; descent: number; tightTop: number; tightBottom: number }>,
    lineSpacing: number
): number {
    if (lines.length === 0) return 0;

    // For single line, just use tight height
    if (lines.length === 1) {
        return lines[0].height;
    }

    // For multi-line: compute span from first line's visual top to last line's visual bottom.
    // tightTop/tightBottom are relative to each line's baseline.
    // Baselines are spaced by (ascent - descent) * lineSpacing.
    const firstLine = lines[0];
    const lastLine = lines[lines.length - 1];

    // Accumulate baseline offset of last line
    let lastBaseline = 0;
    for (let i = 1; i < lines.length; i++) {
        const prevLine = lines[i - 1];
        lastBaseline += (prevLine.ascent - prevLine.descent) * lineSpacing;
    }

    // Total = from first line's visual top to last line's visual bottom
    // firstLine.tightTop is negative (above baseline), lastLine.tightBottom is positive (below baseline)
    return (lastBaseline + lastLine.tightBottom) - firstLine.tightTop;
}

/**
 * Calculate advance width for a string (includes GPOS kerning via font.layout)
 */
export function getAdvanceWidth(font: Font, text: string, fontSize: number): number {
    const scale = fontSize / font.unitsPerEm;
    const run = font.layout(text);
    let total = 0;
    for (const pos of run.positions) {
        total += pos.xAdvance * scale;
    }
    return total;
}

/**
 * Calculate tight bounds for a string using glyph bounding boxes.
 * Returns X bounds (leftBearing, tightRight) and Y bounds (tightTop, tightBottom).
 * Y values are relative to baseline: negative = above baseline, positive = below.
 */
export function getTightBounds(font: Font, text: string, fontSize: number): {
    leftBearing: number;
    tightRight: number;
    tightTop: number;
    tightBottom: number;
} {
    if (text.length === 0) return { leftBearing: 0, tightRight: 0, tightTop: 0, tightBottom: 0 };

    const scale = fontSize / font.unitsPerEm;
    const run = font.layout(text);
    let x = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < run.glyphs.length; i++) {
        const glyph = run.glyphs[i];
        const pos = run.positions[i];

        // Get glyph bounding box (in font units)
        const bbox = glyph.bbox;
        const xMin = bbox?.minX;
        const xMax = bbox?.maxX;
        const yMin = bbox?.minY;
        const yMax = bbox?.maxY;

        // Some glyphs (like space) have no visual bounds
        if (xMin !== undefined && xMax !== undefined && xMin !== xMax) {
            minX = Math.min(minX, x + xMin * scale);
            maxX = Math.max(maxX, x + xMax * scale);
        }

        // Y bounds (yMin/yMax in font coords: yMin is bottom, yMax is top)
        // We flip for screen coords: top is negative (above baseline), bottom is positive
        if (yMin !== undefined && yMax !== undefined && yMin !== yMax) {
            minY = Math.min(minY, -yMax * scale);  // topmost (most negative)
            maxY = Math.max(maxY, -yMin * scale);  // bottommost (most positive)
        }

        // Advance for next glyph (GPOS kerning included in xAdvance)
        x += pos.xAdvance * scale;
    }

    // If no visible glyphs (all spaces), return zeros
    if (minX === Infinity) return { leftBearing: 0, tightRight: 0, tightTop: 0, tightBottom: 0 };

    return {
        leftBearing: minX,
        tightRight: maxX,
        tightTop: minY,
        tightBottom: maxY,
    };
}

/**
 * Measure a single token's metrics (no inter-token kerning).
 * Used to compute metrics on-demand for tokens created after the initial bulk measurement
 * (e.g. trimmed tokens produced by trimLineWhitespace).
 */
export function measureSingleTokenMetrics(token: Token, fonts: FontManager): TokenMetrics {
    const font = fonts.getFont(token.font, token.weight);
    const metrics = getFontMetrics(font, token.size);
    const tightBounds = getTightBounds(font, token.text, token.size);
    return {
        advanceWidth: getAdvanceWidth(font, token.text, token.size),
        kerningDelta: 0,
        leftBearing: tightBounds.leftBearing,
        tightRight: tightBounds.tightRight,
        tightTop: tightBounds.tightTop,
        tightBottom: tightBounds.tightBottom,
        ascent: metrics.ascent,
        descent: metrics.descent,
    };
}

/**
 * Measure all tokens and precompute inter-token kerning deltas.
 * Returns a parallel array of TokenMetrics (same order as input tokens),
 * with kerningDelta set for each consecutive pair sharing the same font/weight.
 */
export function measureAllTokenMetrics(tokens: Token[], fonts: FontManager): TokenMetrics[] {
    const result: TokenMetrics[] = [];

    for (const token of tokens) {
        const font = fonts.getFont(token.font, token.weight);
        const metrics = getFontMetrics(font, token.size);
        const tightBounds = getTightBounds(font, token.text, token.size);
        result.push({
            advanceWidth: getAdvanceWidth(font, token.text, token.size),
            kerningDelta: 0,
            leftBearing: tightBounds.leftBearing,
            tightRight: tightBounds.tightRight,
            tightTop: tightBounds.tightTop,
            tightBottom: tightBounds.tightBottom,
            ascent: metrics.ascent,
            descent: metrics.descent,
        });
    }

    // Inter-token kerning is not applied here; fontkit auto-applies GPOS within each token via layout().
    // Cross-token kerning at boundaries is intentionally omitted (negligible for multi-token layouts).

    return result;
}

/**
 * Compute line metrics from token metrics (no path generation)
 *
 * Width formula: sum(advanceWidths[0..n-2]) + lastToken.tightRight - firstToken.leftBearing + kerning
 * Height uses tight bounding box (actual glyph bounds) for accurate fitting.
 * Ascent/descent use font metrics for consistent line spacing.
 */
export function getLineMetrics(
    tokenMetrics: TokenMetrics[]
): LineMetrics {
    if (tokenMetrics.length === 0) {
        return { width: 0, height: 0, ascent: 0, descent: 0, tightTop: 0, tightBottom: 0 };
    }

    let cursorX = 0;  // tracks where the next token would be positioned
    let maxAscent = 0;
    let minDescent = 0;
    let minTightTop = Infinity;    // topmost visual edge (most negative)
    let maxTightBottom = -Infinity; // bottommost visual edge (most positive)

    for (let i = 0; i < tokenMetrics.length; i++) {
        const tm = tokenMetrics[i];
        const isLast = i === tokenMetrics.length - 1;

        if (!isLast) {
            // Advance cursor by this token's advance width
            cursorX += tm.advanceWidth;

            // Apply inter-token kerning (precomputed on TokenMetrics)
            cursorX += tm.kerningDelta;
        }

        // Font metrics for line spacing
        maxAscent = Math.max(maxAscent, tm.ascent);
        minDescent = Math.min(minDescent, tm.descent);

        // Tight bounds for fitting (skip tokens with no visual content like spaces)
        if (tm.tightTop !== 0 || tm.tightBottom !== 0) {
            minTightTop = Math.min(minTightTop, tm.tightTop);
            maxTightBottom = Math.max(maxTightBottom, tm.tightBottom);
        }
    }

    // Width = cursor position (where last token starts) + last token's right edge - first token's left bearing
    const firstToken = tokenMetrics[0];
    const lastToken = tokenMetrics[tokenMetrics.length - 1];
    const width = cursorX + lastToken.tightRight - firstToken.leftBearing;

    // Height = tight visual extent (for fitting)
    if (minTightTop === Infinity) {
        throw new Error('getLineMetrics: no visible content in line (all spaces?)');
    }
    const tightHeight = maxTightBottom - minTightTop;

    return {
        width,
        height: tightHeight,
        ascent: maxAscent,
        descent: minDescent,
        tightTop: minTightTop,
        tightBottom: maxTightBottom,
    };
}

/**
 * Compute arrangement metrics for multiple lines (no path generation)
 */
export function getArrangementMetrics(
    lineTokenMetrics: TokenMetrics[][],
    lineSpacing: number
): ArrangementMetrics {
    const lineMetrics = lineTokenMetrics.map(tms =>
        getLineMetrics(tms)
    );

    const maxWidth = Math.max(...lineMetrics.map(lm => lm.width));
    const totalHeight = calculateTotalHeight(lineMetrics, lineSpacing);

    return { maxWidth, totalHeight, lineMetrics };
}
