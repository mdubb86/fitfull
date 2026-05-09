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
    arrangements: number;
};

/** Result of computeBestFit - the winning layout with metadata */
export type BestFit = {
    layout: PositionedLayout;
    arrangements: number;
    minTextHeight: number;
    maxTextHeight: number;
};
