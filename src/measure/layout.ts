import type { MeasuredLine, PositionedLine, PositionedLayout, Alignment } from '../types.js';

/**
 * Compute baseline positions and overall vertical bounds for a sequence of lines.
 *
 * Inputs are baseline-relative tight extents (tightTop negative, tightBottom positive).
 * Output coordinates are also baseline-relative: baselines[0] = 0, the rest accumulate
 * down by the gap formula below. minY/maxY/height describe the visual bbox in the same
 * coordinate space.
 *
 * Baseline-to-baseline distance between consecutive lines:
 *   gap = (prev.ascent - prev.descent) * lineSpacing + (current.ascent - prev.ascent)
 *
 * The (current.ascent - prev.ascent) term is required when ascents differ between lines
 * (e.g. mixed font sizes): measureLine positions each line's baseline at y=maxAscent inside
 * its own logical box, so a taller next line shifts its baseline further down than the
 * previous line's full font-height alone would. lineSpacing scales only the prev-line
 * portion — the baseline shift inside each line's box is not optional.
 *
 * The bounds scan walks every line: with mixed sizes, the extreme top or bottom is not
 * guaranteed to be the first/last line.
 */
export function computeVerticalLayout(
    lines: Array<{ ascent: number; descent: number; tightTop: number; tightBottom: number }>,
    lineSpacing: number
): { baselines: number[]; minY: number; maxY: number; height: number } {
    if (lines.length === 0) {
        return { baselines: [], minY: 0, maxY: 0, height: 0 };
    }

    const baselines: number[] = [0];
    for (let i = 1; i < lines.length; i++) {
        const prev = lines[i - 1];
        const current = lines[i];
        const gap = (prev.ascent - prev.descent) * lineSpacing + (current.ascent - prev.ascent);
        baselines.push(baselines[i - 1] + gap);
    }

    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < lines.length; i++) {
        minY = Math.min(minY, baselines[i] + lines[i].tightTop);
        maxY = Math.max(maxY, baselines[i] + lines[i].tightBottom);
    }

    return { baselines, minY, maxY, height: maxY - minY };
}

/**
 * Compute a fully positioned layout from measured lines.
 * Applies vertical positioning (line spacing) and horizontal alignment.
 */
export function computeLayout(
    lines: MeasuredLine[],
    lineSpacing: number,
    align: Alignment,
    scale: number
): PositionedLayout {
    if (lines.length === 0) {
        return { width: 0, height: 0, lines: [], scale, align, lineSpacing };
    }

    const vertical = computeVerticalLayout(lines, lineSpacing);
    const firstAscent = lines[0].ascent;
    const maxWidth = Math.max(...lines.map(l => l.tightBbox.width));
    // Shift so the visual top of the layout is at y=0.
    // Box-top of line i (in coords where line 0's box-top = 0) is baseline_i - line.ascent + firstAscent;
    // adding offsetY translates the topmost glyph to y=0.
    const offsetY = -(vertical.minY + firstAscent);

    const positionedLines: PositionedLine[] = lines.map((line, i) => {
        const yBoxTop = offsetY + vertical.baselines[i] + firstAscent - line.ascent;

        // Base X: shift so visual left edge starts at 0
        let x = -line.tightBbox.x1;

        // Apply horizontal alignment
        if (align === 'center') {
            x += (maxWidth - line.tightBbox.width) / 2;
        } else if (align === 'right') {
            x += maxWidth - line.tightBbox.width;
        }

        return {
            measured: line,
            x,
            y: yBoxTop,
            width: line.tightBbox.width,
            height: line.tightBbox.height,
            baseline: yBoxTop + line.baseline,
            text: line.tokens.map(t => t.token.text).join(''),
        };
    });

    return {
        width: maxWidth,
        height: vertical.height,
        lines: positionedLines,
        scale,
        align,
        lineSpacing,
    };
}
