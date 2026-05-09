import type { MeasuredLine, PositionedLine, PositionedLayout, Alignment } from '../types.js';

/** A line with its vertical offset from the first baseline (before alignment) */
type OffsetLine = {
    line: MeasuredLine;
    yOffset: number;
};

/**
 * Position lines vertically with proper spacing.
 *
 * lineSpacing scales the baseline-to-baseline distance (>1.0 adds gap, <1.0 tightens).
 */
function positionLines(lines: MeasuredLine[], lineSpacing: number): OffsetLine[] {
    if (lines.length === 0) return [];

    const result: OffsetLine[] = [];
    result.push({ line: lines[0], yOffset: 0 });

    for (let i = 1; i < lines.length; i++) {
        const prevPositioned = result[i - 1];
        const prevLine = prevPositioned.line;
        const currentLine = lines[i];

        // Font metrics baseline-to-baseline spacing
        // lineHeight = previous line's ascent - descent
        // Combined with baseline positions, actual baseline-to-baseline distance becomes:
        //   lineHeight + (currentLine.baseline - prevLine.baseline)
        //   = (prevLine.ascent - prevLine.descent) + (currentLine.ascent - prevLine.ascent)
        //   = currentLine.ascent - prevLine.descent
        // Which is: space for top line's descenders + space for bottom line's ascenders
        const lineHeight = prevLine.ascent - prevLine.descent;
        const actualGap = lineHeight * lineSpacing;

        result.push({
            line: currentLine,
            yOffset: prevPositioned.yOffset + actualGap,
        });
    }

    return result;
}

/**
 * Calculate total dimensions for positioned lines
 */
function getPositionedLinesBounds(positioned: OffsetLine[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
} {
    if (positioned.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const { line, yOffset } of positioned) {
        minX = Math.min(minX, line.tightBbox.x1);
        minY = Math.min(minY, line.tightBbox.y1 + yOffset);
        maxX = Math.max(maxX, line.tightBbox.x2);
        maxY = Math.max(maxY, line.tightBbox.y2 + yOffset);
    }

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
    };
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

    const offsetLines = positionLines(lines, lineSpacing);
    const bounds = getPositionedLinesBounds(offsetLines);
    const maxWidth = Math.max(...offsetLines.map(o => o.line.tightBbox.width));
    const offsetY = -bounds.minY;

    const positionedLines: PositionedLine[] = offsetLines.map(({ line, yOffset }) => {
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
            y: offsetY + yOffset,
            width: line.tightBbox.width,
            height: line.tightBbox.height,
            baseline: offsetY + yOffset + line.baseline,
            text: line.tokens.map(t => t.token.text).join(''),
        };
    });

    return {
        width: maxWidth,
        height: bounds.height,
        lines: positionedLines,
        scale,
        align,
        lineSpacing,
    };
}
