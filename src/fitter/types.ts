import type { Token, TokenMetrics, Alignment, PositionedLayout } from '../types.js';

/** Tolerance for constraint checks (accounts for floating point drift) */
export const FIT_TOLERANCE = 0.01;

/** Convergence threshold for binary search in greedy scaling */
export const SEARCH_PRECISION = 0.001;

/** Configuration for the fitter */
export type FitterConfig = {
    textHeight?: number;
    maxTextHeight?: number;
    minLines?: number;
    maxLines?: number;
    lineSpacing?: number;
    align: Alignment;
    wrap?: 'balanced' | 'greedy';
};

/** Score for comparing arrangements */
export class Score {
    readonly scale: number;           // scale factor as percentage of max
    readonly lineWidths: number[];    // line widths for comparison
    readonly wrap: 'balanced' | 'greedy';

    constructor(scale: number, lineWidths: number[], wrap: 'balanced' | 'greedy') {
        this.scale = scale;
        this.lineWidths = lineWidths;
        this.wrap = wrap;
    }

    isBetterThan(other: Score): boolean {
        // Primary: higher scale is better
        if (this.scale > other.scale) return true;
        if (this.scale < other.scale) return false;

        // Secondary: depends on wrap mode
        if (this.wrap === 'balanced') {
            // Balanced: prefer higher minimum line width (more even)
            const thisMin = Math.min(...this.lineWidths);
            const otherMin = Math.min(...other.lineWidths);
            return thisMin > otherMin;
        } else {
            // Greedy: prefer arrangements where the last line is shorter than average
            // This gives natural text flow without extreme cramming
            const thisAvg = this.lineWidths.reduce((a, b) => a + b, 0) / this.lineWidths.length;
            const otherAvg = other.lineWidths.reduce((a, b) => a + b, 0) / other.lineWidths.length;
            const thisLast = this.lineWidths[this.lineWidths.length - 1] ?? 0;
            const otherLast = other.lineWidths[other.lineWidths.length - 1] ?? 0;
            // Prefer smaller (last / average) ratio - last line should be below average
            const thisRatio = thisLast / thisAvg;
            const otherRatio = otherLast / otherAvg;
            return thisRatio < otherRatio;
        }
    }

    toString(): string {
        const minWidth = Math.min(...this.lineWidths);
        return `scale=${this.scale.toFixed(3)}, minWidth=${minWidth.toFixed(3)}, wrap=${this.wrap}`;
    }
}

/** Shared inputs for strategy functions */
export type SearchContext = {
    tokens: Token[];
    tokenMetricsMap: Map<Token, TokenMetrics>;
    width: number;
    height: number;
    minScale: number;
    maxScale: number;
    minLines: number;
    maxLines: number;
    lineSpacing: number;
    wrap: 'balanced' | 'greedy';
    cumulativeWidths: number[];
    totalTokenWidth: number;
    maxTextHeight?: number;
};

/** Shared outputs from strategy functions */
export type SearchResult = {
    scale: number;
    arrangement: Token[][];
    score: Score;
    arrangements: number;
};

/** Result of computeBestFit - the winning layout with metadata */
export type BestFit = {
    layout: PositionedLayout;
    score: Score;
    arrangements: number;
    minTextHeight: number;
    maxTextHeight: number;
};
