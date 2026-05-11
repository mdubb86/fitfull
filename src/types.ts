import type { Font } from 'fontkit';
import type { ComposedPath as Path } from './measure/path-adapter.js';

/** Font weight type alias */
export type FontWeight = 'regular' | 'bold' | 'italic' | 'bolditalic';

/** Horizontal alignment */
export type Alignment = 'left' | 'center' | 'right';

/** Input token - what the user provides */
export type Token = {
    text: string;
    size: number;
    font: string;   // font family name (must match a key in FontConfig)
    weight: 'regular' | 'bold' | 'italic' | 'bolditalic';
};

/** Measured token with positioning info */
export type MeasuredToken = {
    token: Token;
    x: number;              // x position on the line
    advanceWidth: number;   // width including spacing for next token
    path: Path;             // the rendered path
    bboxX1: number;         // absolute left edge of bbox
    bboxX2: number;         // absolute right edge of bbox
    bboxY1: number;         // absolute top edge of bbox
    bboxY2: number;         // absolute bottom edge of bbox
};

/** Line measurement result */
export type MeasuredLine = {
    tokens: MeasuredToken[];
    baseline: number;       // distance from top to baseline (using font metrics)
    ascent: number;         // max ascent across all tokens (font metrics)
    descent: number;        // min descent across all tokens (font metrics, negative)
    // Tight bounding box (actual glyph bounds)
    tightBbox: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        width: number;
        height: number;
    };
};

/** Loaded font map */
export type FontMap = {
    [weight: string]: Font;
};

/** Lightweight token metrics (no path generation) */
export type TokenMetrics = {
    advanceWidth: number;   // includes internal kerning, for positioning next token
    kerningDelta: number;   // kerning adjustment to the following token (0 for last token or cross-font boundary)
    leftBearing: number;    // visual left edge offset from x=0 (first glyph's xMin)
    tightRight: number;     // visual right edge relative to x=0 (last glyph's xMax position)
    tightTop: number;       // visual top edge (smallest yMin, typically negative = above baseline)
    tightBottom: number;    // visual bottom edge (largest yMax, typically positive = below baseline)
    ascent: number;         // font metrics ascent (for line spacing)
    descent: number;        // font metrics descent (for line spacing)
};

/** Lightweight line metrics (no path generation) */
export type LineMetrics = {
    width: number;
    height: number;
    ascent: number;
    descent: number;
    tightTop: number;    // visual top edge relative to baseline (negative = above)
    tightBottom: number; // visual bottom edge relative to baseline (positive = below)
};

/** Metrics for a complete arrangement */
export type ArrangementMetrics = {
    maxWidth: number;
    totalHeight: number;
    lineMetrics: LineMetrics[];
};

/** A line with its computed position in the layout */
export type PositionedLine = {
    measured: MeasuredLine;  // original measured line (has paths for rendering)
    x: number;              // X offset of the line (includes alignment)
    y: number;              // Y offset from layout origin to line origin
    width: number;          // tight bbox width of the line
    height: number;         // tight bbox height of the line
    baseline: number;       // absolute Y of the baseline in layout coordinates
    text: string;           // concatenated token text
};

/** Complete positioned layout ready for rendering or testing */
export type PositionedLayout = {
    width: number;
    height: number;
    lines: PositionedLine[];
    scale: number;
    align: Alignment;
    lineSpacing: number;
};
